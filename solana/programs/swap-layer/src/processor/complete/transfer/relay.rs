use crate::{
    composite::*,
    error::SwapLayerError,
    state::Custodian,
    utils::{self},
};
use anchor_lang::{prelude::*, system_program};
use anchor_spl::token;
use swap_layer_messages::types::{OutputToken, RedeemMode};
use token_router::state::FillType;

#[derive(Accounts)]
pub struct CompleteTransferRelay<'info> {
    #[account(mut)]
    /// The payer of the transaction. This could either be the recipient or a relayer.
    payer: Signer<'info>,

    /// This redeemer is used to check against the recipient. If the redeemer is the same as the
    /// recipient, he is free to redeem his tokens directly as USDC even if swap instructions are
    /// encoded.
    redeemer: Signer<'info>,

    #[account(
        constraint = {
            let swap_msg = consume_swap_layer_fill.read_message_unchecked();

            require_keys_eq!(
                recipient.key(),
                Pubkey::from(swap_msg.recipient),
                SwapLayerError::InvalidRecipient
            );

            // Ensure that the swap time limit has been exceeded if the
            // relayer is attempting to redeem an output token that is not USDC.
            match swap_msg.output_token {
                OutputToken::Usdc => {}
                OutputToken::Gas(_) | OutputToken::Other { .. } => {
                    // If the redeemer is not the recipient, handle these output tokens very
                    // carefully by checking the time limits.
                    if redeemer.key() != recipient.key() {
                        let time_diff = Clock::get()
                            .unwrap()
                            .unix_timestamp
                            .saturating_sub(consume_swap_layer_fill.fill.timestamp);
                        let swap_time_limit = &consume_swap_layer_fill
                            .source_peer
                            .relay_params
                            .swap_time_limit;

                        match consume_swap_layer_fill.fill.fill_type {
                            FillType::FastFill => {
                                require!(
                                    time_diff >= i64::from(swap_time_limit.fast_limit),
                                    SwapLayerError::SwapTimeLimitNotExceeded
                                );
                            }
                            FillType::WormholeCctpDeposit => {
                                require!(
                                    time_diff >= i64::from(swap_time_limit.finalized_limit),
                                    SwapLayerError::SwapTimeLimitNotExceeded
                                );
                            }
                            FillType::Unset => return Err(SwapLayerError::UnsupportedFillType.into()),
                        }
                    }
                }
            }

            true
        }
    )]
    consume_swap_layer_fill: ConsumeSwapLayerFill<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [
            crate::COMPLETE_TOKEN_SEED_PREFIX,
            consume_swap_layer_fill.key().as_ref(),
        ],
        bump,
        token::mint = usdc,
        token::authority = consume_swap_layer_fill.custodian
    )]
    complete_token_account: Account<'info, token::TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc,
        associated_token::authority = recipient
    )]
    /// Recipient associated token account. The recipient authority check
    /// is necessary to ensure that the recipient is the intended recipient
    /// of the bridged tokens.
    recipient_token_account: Box<Account<'info, token::TokenAccount>>,

    /// CHECK: Recipient may differ from redeemer if a relayer paid for this
    /// transaction. This instruction verifies that the recipient key
    /// passed in this context matches the intended recipient in the fill.
    #[account(mut)]
    recipient: UncheckedAccount<'info>,

    #[account(
        mut,
        address = consume_swap_layer_fill.custodian.fee_recipient_token,
    )]
    fee_recipient_token: Account<'info, token::TokenAccount>,

    usdc: Usdc<'info>,

    token_program: Program<'info, token::Token>,
    system_program: Program<'info, System>,
}

pub fn complete_transfer_relay(ctx: Context<CompleteTransferRelay>) -> Result<()> {
    // Gas dropoff needs to be scaled by 1e3 to convert into lamports.
    match ctx
        .accounts
        .consume_swap_layer_fill
        .read_message_unchecked()
        .redeem_mode
    {
        RedeemMode::Relay {
            gas_dropoff,
            relaying_fee,
        } => handle_complete_transfer_relay(
            ctx,
            utils::gas_dropoff::denormalize_gas_dropoff(gas_dropoff),
            relaying_fee.into(),
        ),
        _ => err!(SwapLayerError::InvalidRedeemMode),
    }
}

fn handle_complete_transfer_relay(
    ctx: Context<CompleteTransferRelay>,
    gas_dropoff: u64,
    relaying_fee: u64,
) -> Result<()> {
    let complete_token = &ctx.accounts.complete_token_account;
    let token_program = &ctx.accounts.token_program;

    // CPI Call token router.
    let fill_amount = ctx
        .accounts
        .consume_swap_layer_fill
        .consume_prepared_fill(complete_token.as_ref(), token_program)?;

    let custodian = &ctx.accounts.consume_swap_layer_fill.custodian;
    let payer = &ctx.accounts.payer;
    let recipient = &ctx.accounts.recipient;

    // If the redeemer is the recipient, just transfer the tokens to the recipient.
    let user_amount = {
        if ctx.accounts.redeemer.key() == recipient.key() {
            fill_amount
        } else {
            if gas_dropoff > 0 {
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: payer.to_account_info(),
                            to: recipient.to_account_info(),
                        },
                    ),
                    gas_dropoff,
                )?;
            }

            // Calculate the user amount.
            fill_amount
                .checked_sub(relaying_fee)
                .ok_or_else(|| SwapLayerError::InvalidRelayerFee)?
        }
    };

    // Transfer the tokens to the recipient.
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            token::Transfer {
                from: complete_token.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: custodian.to_account_info(),
            },
            &[Custodian::SIGNER_SEEDS],
        ),
        user_amount,
    )?;

    // Transfer eligible USDC to the fee recipient.
    if user_amount != fill_amount {
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                token::Transfer {
                    from: complete_token.to_account_info(),
                    to: ctx.accounts.fee_recipient_token.to_account_info(),
                    authority: custodian.to_account_info(),
                },
                &[Custodian::SIGNER_SEEDS],
            ),
            fill_amount.checked_sub(user_amount).unwrap(),
        )?;
    }

    // Finally close token account.
    token::close_account(CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::CloseAccount {
            account: complete_token.to_account_info(),
            destination: payer.to_account_info(),
            authority: custodian.to_account_info(),
        },
        &[Custodian::SIGNER_SEEDS],
    ))
}
