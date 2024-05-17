use crate::{
    composite::*,
    error::SwapLayerError,
    state::{RedeemOption, StagedInput, StagedOutbound, StagedOutboundInfo, StagedRedeem},
    utils::{self, jupiter_v6::cpi::SharedAccountsRouteArgs, AnchorInstructionData},
};
use anchor_lang::prelude::*;
use anchor_spl::token;
use common::wormhole_io::Readable;
use swap_layer_messages::types::OutputToken;

#[derive(Accounts)]
#[instruction(args: StageOutboundArgs)]
pub struct StageOutbound<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    sender: Option<Signer<'info>>,

    program_transfer_authority: Option<UncheckedAccount<'info>>,

    #[account(
        mut,
        token::mint = src_mint,
    )]
    sender_token: Account<'info, token::TokenAccount>,

    /// Peer used to determine whether assets are sent to a valid destination. The registered peer
    /// will also act as the authority over the staged custody token account.
    ///
    /// Ordinarily we could consider the authority to be the staged outbound account itself. But
    /// because this account can be signed for outside of this program (either keypair or PDA), the
    /// token account would then be out of this program's control.
    #[account(
        constraint = {
            require_eq!(
                args.target_chain,
                peer.chain,
                SwapLayerError::InvalidTargetChain,
            );

            true
        }
    )]
    peer: RegisteredPeer<'info>,

    /// Staged outbound account, which contains all of the instructions needed to initiate a
    /// transfer on behalf of the sender.
    #[account(
        init,
        payer = payer,
        space = StagedOutbound::try_compute_size(
            &args.staged_input,
            &args.redeem_option,
            &args.encoded_output_token
        )?,
        constraint = {
            // Cannot send to zero address.
            require!(args.recipient != [0; 32], SwapLayerError::InvalidRecipient);

            true
        }
    )]
    staged_outbound: Account<'info, StagedOutbound>,

    /// Custody token account for the staged outbound transfer. This account will be owned by the
    /// registered peer.
    #[account(
        init,
        payer = payer,
        token::mint = src_mint,
        token::authority = peer,
        seeds = [
            crate::STAGED_CUSTODY_TOKEN_SEED_PREFIX,
            staged_outbound.key().as_ref(),
        ],
        bump,
    )]
    staged_custody_token: Account<'info, token::TokenAccount>,

    /// Mint can either be USDC or whichever mint is used to swap into USDC.
    src_mint: Account<'info, token::Mint>,

    token_program: Program<'info, token::Token>,
    system_program: Program<'info, System>,
}

/// Arguments for [prepare_market_order].
#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct StageOutboundArgs {
    pub staged_input: StagedInput,

    /// The Wormhole chain ID of the network to transfer tokens to.
    pub target_chain: u16,

    /// The recipient of the transfer.
    pub recipient: [u8; 32],

    pub redeem_option: Option<RedeemOption>,

    pub encoded_output_token: Option<Vec<u8>>,
}

pub fn stage_outbound(ctx: Context<StageOutbound>, args: StageOutboundArgs) -> Result<()> {
    let StageOutboundArgs {
        staged_input,
        target_chain,
        recipient,
        redeem_option,
        encoded_output_token,
    } = args;

    // We need to determine the relayer fee. This fee will either be paid for right now if
    // StagedInput::Usdc or will be paid for later if a swap is required to get USDC.
    let staged_redeem = match redeem_option {
        Some(redeem_option) => match redeem_option {
            RedeemOption::Relay {
                gas_dropoff,
                max_relayer_fee,
            } => {
                let output_token = encoded_output_token
                    .as_ref()
                    .map(|encoded_output_token| {
                        OutputToken::read(&mut &encoded_output_token[..]).unwrap()
                    })
                    .unwrap_or(OutputToken::Usdc);

                // Relaying fee must be less than the user-specific maximum.
                let relaying_fee = utils::relayer_fees::calculate_relayer_fee(
                    &ctx.accounts.peer.relay_params,
                    gas_dropoff,
                    &output_token,
                )?;
                require!(
                    relaying_fee <= max_relayer_fee,
                    SwapLayerError::ExceedsMaxRelayingFee
                );

                StagedRedeem::Relay {
                    gas_dropoff,
                    relaying_fee,
                }
            }
            RedeemOption::Payload(buf) => StagedRedeem::Payload(buf),
        },
        None => StagedRedeem::Direct,
    };

    let transfer_amount = match &staged_input {
        StagedInput::Usdc { amount } => {
            require_keys_eq!(
                ctx.accounts.src_mint.key(),
                common::USDC_MINT,
                ErrorCode::InstructionMissing
            );

            match &staged_redeem {
                StagedRedeem::Relay {
                    gas_dropoff: _,
                    relaying_fee,
                } => relaying_fee
                    .checked_add(*amount)
                    .ok_or(SwapLayerError::U64Overflow)?,
                _ => *amount,
            }
        }
        StagedInput::SwapExactIn { instruction_data } => {
            require!(
                ctx.accounts.src_mint.key() != common::USDC_MINT,
                ErrorCode::InstructionMissing
            );

            // Deserialize shared accounts route for in amount.
            let args = SharedAccountsRouteArgs::deserialize_checked(&instruction_data[..])?;

            let min_amount_out = u64::try_from(
                u128::from(args.quoted_out_amount)
                    .saturating_mul(args.slippage_bps.into())
                    .saturating_div(10000),
            )
            .map_err(|_| SwapLayerError::U64Overflow)?;

            if let StagedRedeem::Relay {
                gas_dropoff: _,
                relaying_fee,
            } = &staged_redeem
            {
                require!(
                    min_amount_out >= *relaying_fee,
                    SwapLayerError::RelayingFeeExceedsMinAmountOut,
                );
            }

            args.in_amount
        }
    };

    ctx.accounts.staged_outbound.set_inner(StagedOutbound {
        info: StagedOutboundInfo {
            custody_token_bump: ctx.bumps.staged_custody_token,
            prepared_by: ctx.accounts.payer.key(),
            src_mint: ctx.accounts.src_mint.key(),
            target_chain,
            recipient,
        },
        staged_input,
        staged_redeem,
        encoded_output_token,
    });

    match (
        &ctx.accounts.sender,
        &ctx.accounts.program_transfer_authority,
    ) {
        (Some(sender), None) => token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.sender_token.to_account_info(),
                    to: ctx.accounts.staged_custody_token.to_account_info(),
                    authority: sender.to_account_info(),
                },
            ),
            transfer_amount,
        ),
        (None, Some(program_transfer_authority)) => token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.sender_token.to_account_info(),
                    to: ctx.accounts.staged_custody_token.to_account_info(),
                    authority: program_transfer_authority.to_account_info(),
                },
                &[],
            ),
            transfer_amount,
        ),
        _ => err!(SwapLayerError::EitherSenderOrProgramTransferAuthority),
    }
}
