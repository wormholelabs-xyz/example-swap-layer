use crate::{
    composite::*,
    error::SwapLayerError,
    state::{StagedInbound, StagedInboundInfo, StagedInboundSeeds},
};
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token, token_interface};
use swap_layer_messages::{
    messages::SwapMessageV1,
    types::{JupiterV6SwapParameters, OutputSwap, OutputToken, RedeemMode, SwapType},
};

#[derive(Accounts)]
pub struct CompleteSwapPayload<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    #[account(constraint = consume_swap_layer_fill.is_valid_output_swap(&dst_mint)?)]
    consume_swap_layer_fill: ConsumeSwapLayerFill<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        space = StagedInbound::try_compute_size_if_needed(
            staged_inbound,
            consume_swap_layer_fill.read_message_unchecked()
        )?,
        seeds = [
            StagedInbound::SEED_PREFIX,
            consume_swap_layer_fill.prepared_fill_key().as_ref(),
        ],
        bump
    )]
    staged_inbound: Box<Account<'info, StagedInbound>>,

    /// Temporary swap token account to receive USDC from the prepared fill. This account will be
    /// closed at the end of this instruction.
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdc,
        associated_token::authority = staged_inbound,
        associated_token::token_program = token_program
    )]
    src_swap_token: Box<Account<'info, token::TokenAccount>>,

    /// Temporary swap token account to receive destination mint after the swap. This account will
    /// be closed at the end of this instruction.
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = dst_mint,
        associated_token::authority = staged_inbound,
        associated_token::token_program = dst_token_program
    )]
    dst_swap_token: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    /// This account must be verified as the source mint for the swap.
    usdc: Usdc<'info>,

    /// CHECK: This account must be verified as the destination mint for the swap.
    #[account(constraint = usdc.key() != dst_mint.key() @ SwapLayerError::SameMint)]
    dst_mint: UncheckedAccount<'info>,

    token_program: Program<'info, token::Token>,
    dst_token_program: Interface<'info, token_interface::TokenInterface>,
    associated_token_program: Program<'info, associated_token::AssociatedToken>,
    system_program: Program<'info, System>,
}

pub fn complete_swap_payload<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, CompleteSwapPayload<'info>>,
    instruction_data: Vec<u8>,
) -> Result<()>
where
    'c: 'info,
{
    // Set the staged transfer if it hasn't been set yet.
    if ctx.accounts.staged_inbound.staged_by == Pubkey::default() {
        let SwapMessageV1 {
            recipient,
            redeem_mode,
            output_token,
        } = ctx
            .accounts
            .consume_swap_layer_fill
            .read_message_unchecked();

        match redeem_mode {
            RedeemMode::Payload(payload) => match output_token {
                OutputToken::Gas(OutputSwap {
                    deadline: _,
                    limit_amount,
                    swap_type: SwapType::JupiterV6(swap_params),
                }) => handle_complete_swap_direct_jup_v6(
                    ctx,
                    instruction_data,
                    (limit_amount.try_into().unwrap(), swap_params).into(),
                    true,
                    recipient,
                    payload,
                ),
                OutputToken::Other {
                    address: _,
                    swap:
                        OutputSwap {
                            deadline: _,
                            limit_amount,
                            swap_type: SwapType::JupiterV6(swap_params),
                        },
                } => handle_complete_swap_direct_jup_v6(
                    ctx,
                    instruction_data,
                    (limit_amount.try_into().unwrap(), swap_params).into(),
                    false,
                    recipient,
                    payload,
                ),
                _ => err!(SwapLayerError::InvalidOutputToken),
            },
            _ => err!(SwapLayerError::InvalidRedeemMode),
        }
    } else {
        Ok(())
    }
}

pub fn handle_complete_swap_direct_jup_v6<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, CompleteSwapPayload<'info>>,
    ix_data: Vec<u8>,
    limit_and_params: Option<(u64, JupiterV6SwapParameters)>,
    is_native: bool,
    recipient: [u8; 32],
    recipient_payload: Vec<u8>,
) -> Result<()>
where
    'c: 'info,
{
    let token_program = &ctx.accounts.token_program;
    let src_swap_token =
        AsRef::<Account<token::TokenAccount>>::as_ref(&ctx.accounts.src_swap_token);
    let consume_swap_layer_fill = &ctx.accounts.consume_swap_layer_fill;

    // Consume prepared fill.
    let in_amount =
        consume_swap_layer_fill.consume_prepared_fill(src_swap_token.as_ref(), token_program)?;

    let swap_authority = &ctx.accounts.staged_inbound;

    let prepared_fill_key = &consume_swap_layer_fill.prepared_fill_key();
    let swap_authority_seeds = &[
        StagedInbound::SEED_PREFIX,
        prepared_fill_key.as_ref(),
        &[ctx.bumps.staged_inbound],
    ];

    let (shared_accounts_route, mut swap_args, cpi_remaining_accounts) =
        JupiterV6SharedAccountsRoute::set_up(ctx.remaining_accounts, &ix_data[..])?;

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
            common::USDC_MINT,
            SwapLayerError::InvalidSourceMint
        );
        require_keys_eq!(
            shared_accounts_route.dst_mint.key(),
            ctx.accounts.dst_mint.key(),
            SwapLayerError::InvalidDestinationMint
        );
    }

    let limit_amount = match limit_and_params {
        // If the limit amount is some value (meaning that the OutputToken is Gas or Other), we
        // will override the instruction arguments with the limit amount and slippage == 0 bps.
        // Otherwise we will compute the limit amount using the given swap args.
        Some((limit_amount, swap_params)) => {
            msg!(
                "Override in_amount: {}, quoted_out_amount: {}, slippage_bps: {}",
                swap_args.in_amount,
                swap_args.quoted_out_amount,
                swap_args.slippage_bps
            );
            swap_args.in_amount = in_amount;
            swap_args.quoted_out_amount = limit_amount;
            swap_args.slippage_bps = 0;

            // Peek into the head of remaining accounts. This account will be the dex program that Jupiter
            // V6 interacts with. If the swap params specify a specific dex program, we need to ensure that
            // the one passed into this instruction handler is that.
            if let Some(dex_program_id) = swap_params.dex_program_id {
                require_eq!(
                    swap_args.route_plan.len(),
                    1,
                    SwapLayerError::NotJupiterV6DirectRoute
                );
                require_keys_eq!(
                    cpi_remaining_accounts[0].key(),
                    Pubkey::from(dex_program_id),
                    SwapLayerError::JupiterV6DexProgramMismatch
                );
            }

            limit_amount.into()
        }
        None => {
            // Fetched swap args should have the same in amount as the prepared (fast) fill.
            require_eq!(
                swap_args.in_amount,
                in_amount,
                SwapLayerError::InvalidSwapInAmount
            );

            None
        }
    };

    // Execute swap.
    shared_accounts_route.swap_exact_in(
        swap_args,
        swap_authority_seeds,
        cpi_remaining_accounts,
        limit_amount,
    )?;

    let payer = &ctx.accounts.payer;

    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::CloseAccount {
            account: ctx.accounts.src_swap_token.to_account_info(),
            destination: payer.to_account_info(),
            authority: swap_authority.to_account_info(),
        },
        &[swap_authority_seeds],
    ))?;

    ctx.accounts.staged_inbound.set_inner(StagedInbound {
        seeds: StagedInboundSeeds {
            prepared_fill: ctx.accounts.consume_swap_layer_fill.prepared_fill_key(),
            bump: ctx.bumps.staged_inbound,
        },
        info: StagedInboundInfo {
            custody_token: ctx.accounts.dst_swap_token.key(),
            staged_by: ctx.accounts.payer.key(),
            source_chain: ctx.accounts.consume_swap_layer_fill.fill.source_chain,
            recipient: recipient.into(),
            is_native,
        },
        recipient_payload,
    });

    Ok(())
}
