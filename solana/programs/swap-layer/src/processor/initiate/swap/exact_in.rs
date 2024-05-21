use crate::{
    composite::*,
    error::SwapLayerError,
    state::{Custodian, Peer, StagedOutbound},
    PREPARED_ORDER_SEED_PREFIX,
};
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};
use common::wormhole_io::TypePrefixedPayload;

#[derive(Accounts)]
pub struct InitiateSwapExactIn<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    custodian: CheckedCustodian<'info>,

    /// CHECK: This account must be the one who paid to create the staged outbound account.
    #[account(
        mut,
        address = staged_outbound.info.prepared_by,
    )]
    prepared_by: UncheckedAccount<'info>,

    /// Staging for outbound transfer. This account has all of the instructions needed to initiate
    /// the transfer.
    ///
    /// This account will be closed by the end of the instruction.
    #[account(
        mut,
        close = prepared_by,
    )]
    staged_outbound: Account<'info, StagedOutbound>,

    /// This custody token account will be closed by the end of the instruction.
    #[account(
        mut,
        seeds = [
            crate::STAGED_CUSTODY_TOKEN_SEED_PREFIX,
            staged_outbound.key().as_ref(),
        ],
        bump = staged_outbound.info.custody_token_bump,
    )]
    staged_custody_token: Account<'info, token::TokenAccount>,

    /// CHECK: This account must equal the usdc refund token encoded in the staged outbound account.
    #[account(address = staged_outbound.usdc_refund_token)]
    usdc_refund_token: UncheckedAccount<'info>,

    /// Peer used to determine whether assets are sent to a valid destination.
    #[account(
        constraint = {
            require_eq!(
                staged_outbound.info.target_chain,
                target_peer.seeds.chain,
                SwapLayerError::InvalidTargetChain,
            );

            true
        }
    )]
    target_peer: RegisteredPeer<'info>,

    /// CHECK: Seeds must be \["swap-authority", staged_outbound.key()\].
    #[account(
        seeds = [
            crate::SWAP_AUTHORITY_SEED_PREFIX,
            staged_outbound.key().as_ref(),
        ],
        bump,
    )]
    swap_authority: UncheckedAccount<'info>,

    /// Temporary swap token account to receive source mint from the staged custody token. This
    /// account will be closed at the end of this instruction.
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = src_mint,
        associated_token::authority = swap_authority
    )]
    src_swap_token: Box<Account<'info, token::TokenAccount>>,

    /// Temporary swap token account to receive destination mint after the swap. This account will
    /// be closed at the end of this instruction.
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdc,
        associated_token::authority = swap_authority
    )]
    dst_swap_token: Box<Account<'info, token::TokenAccount>>,

    /// This account must be verified as the source mint for the swap.
    #[account(address = staged_custody_token.mint)]
    src_mint: Box<Account<'info, token::Mint>>,

    /// This account must be verified as the destination mint for the swap.
    #[account(constraint = src_mint.key() != usdc.key() @ SwapLayerError::SameMint)]
    usdc: Usdc<'info>,

    /// CHECK: Token router config.
    token_router_custodian: UncheckedAccount<'info>,

    /// CHECK: Mutable, seeds must be \["prepared-order", staged_outbound.key()\]
    #[account(
        mut,
        seeds = [
            PREPARED_ORDER_SEED_PREFIX,
            staged_outbound.key().as_ref(),
        ],
        bump,
    )]
    prepared_order: UncheckedAccount<'info>,

    /// CHECK: Mutable, seeds must be \["prepared-custody", prepared_order.key()\]
    #[account(mut)]
    prepared_custody_token: UncheckedAccount<'info>,

    token_router_program: Program<'info, token_router::program::TokenRouter>,
    associated_token_program: Program<'info, associated_token::AssociatedToken>,
    token_program: Program<'info, token::Token>,
    system_program: Program<'info, System>,
}

pub fn initiate_swap_exact_in<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, InitiateSwapExactIn<'info>>,
    instruction_data: Vec<u8>,
) -> Result<()>
where
    'c: 'info,
{
    let (shared_accounts_route, swap_args, cpi_remaining_accounts) =
        JupiterV6SharedAccountsRoute::set_up(ctx.remaining_accounts, &instruction_data[..])?;

    let swap_authority = &ctx.accounts.swap_authority;

    // Verify remaining accounts.
    {
        require_keys_eq!(
            shared_accounts_route.transfer_authority.key(),
            swap_authority.key(),
            SwapLayerError::InvalidSwapAuthority
        );
        require_keys_eq!(
            shared_accounts_route.src_custody_token.key(),
            ctx.accounts.src_swap_token.key(),
            SwapLayerError::InvalidSourceSwapToken
        );
        require_keys_eq!(
            shared_accounts_route.dst_custody_token.key(),
            ctx.accounts.dst_swap_token.key(),
            SwapLayerError::InvalidDestinationSwapToken
        );
        require_keys_eq!(
            shared_accounts_route.src_mint.key(),
            ctx.accounts.src_mint.key(),
            SwapLayerError::InvalidSourceMint
        );
        require_keys_eq!(
            shared_accounts_route.dst_mint.key(),
            common::USDC_MINT,
            SwapLayerError::InvalidDestinationMint
        );
    }

    let redeemer_message = ctx
        .accounts
        .staged_outbound
        .to_swap_message_v1()
        .map(|msg| msg.to_vec())?;

    let staged_outbound = &ctx.accounts.staged_outbound;

    let staged_outbound_key = staged_outbound.key();
    let swap_authority_seeds = &[
        crate::SWAP_AUTHORITY_SEED_PREFIX,
        staged_outbound_key.as_ref(),
        &[ctx.bumps.swap_authority],
    ];

    // Execute swap.
    let usdc_amount_out = shared_accounts_route.swap_exact_in(
        swap_args,
        swap_authority_seeds,
        cpi_remaining_accounts,
        Default::default(),
    )?;

    let token_program = &ctx.accounts.token_program;
    let dst_swap_token = &ctx.accounts.dst_swap_token;
    let custodian = &ctx.accounts.custodian;

    // Change the custody token authority from target peer to custodian.
    let peer_seeds = &ctx.accounts.target_peer.seeds;
    token::set_authority(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            token::SetAuthority {
                current_authority: ctx.accounts.target_peer.to_account_info(),
                account_or_mint: dst_swap_token.to_account_info(),
            },
            &[&[
                Peer::SEED_PREFIX,
                &peer_seeds.chain.to_be_bytes(),
                &[peer_seeds.bump],
            ]],
        ),
        token::spl_token::instruction::AuthorityType::AccountOwner,
        custodian.key().into(),
    )?;

    // Prepare market order as custodian.
    token_router::cpi::prepare_market_order(
        CpiContext::new_with_signer(
            ctx.accounts.token_router_program.to_account_info(),
            token_router::cpi::accounts::PrepareMarketOrder {
                payer: ctx.accounts.payer.to_account_info(),
                custodian: token_router::cpi::accounts::CheckedCustodian {
                    custodian: ctx.accounts.token_router_custodian.to_account_info(),
                },
                program_transfer_authority: Default::default(),
                sender: custodian.to_account_info().into(),
                prepared_order: ctx.accounts.prepared_order.to_account_info(),
                sender_token: dst_swap_token.to_account_info(),
                refund_token: ctx.accounts.usdc_refund_token.to_account_info(),
                prepared_custody_token: ctx.accounts.prepared_custody_token.to_account_info(),
                usdc: token_router::cpi::accounts::Usdc {
                    mint: ctx.accounts.usdc.to_account_info(),
                },
                token_program: token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
            &[
                Custodian::SIGNER_SEEDS,
                &[
                    PREPARED_ORDER_SEED_PREFIX,
                    staged_outbound.key().as_ref(),
                    &[ctx.bumps.prepared_order],
                ],
            ],
        ),
        token_router::PrepareMarketOrderArgs {
            amount_in: usdc_amount_out,
            min_amount_out: Default::default(),
            target_chain: staged_outbound.target_chain,
            redeemer: ctx.accounts.target_peer.address,
            redeemer_message,
        },
    )?;

    let payer = &ctx.accounts.payer;

    // Finally close swap token accounts.
    token::close_account(CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::CloseAccount {
            account: ctx.accounts.src_swap_token.to_account_info(),
            destination: payer.to_account_info(),
            authority: swap_authority.to_account_info(),
        },
        &[swap_authority_seeds],
    ))?;
    token::close_account(CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::CloseAccount {
            account: dst_swap_token.to_account_info(),
            destination: payer.to_account_info(),
            authority: swap_authority.to_account_info(),
        },
        &[swap_authority_seeds],
    ))
}
