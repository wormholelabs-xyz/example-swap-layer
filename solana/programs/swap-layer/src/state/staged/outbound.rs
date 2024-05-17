use crate::error::SwapLayerError;
use anchor_lang::prelude::*;
use common::wormhole_io::Readable;
use swap_layer_messages::types::OutputToken;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum StagedInput {
    Usdc { amount: u64 },
    SwapExactIn { instruction_data: Vec<u8> },
}

impl Default for StagedInput {
    fn default() -> Self {
        Self::Usdc {
            amount: Default::default(),
        }
    }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub enum RedeemOption {
    Relay {
        /// Normalized amount of gas to drop off on destination network.
        gas_dropoff: u32,

        /// Maximum fee that a relayer can charge for the transfer.
        max_relayer_fee: u64,
    },
    Payload(Vec<u8>),
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub enum StagedRedeem {
    Direct,
    Relay { gas_dropoff: u32, relaying_fee: u64 },
    Payload(Vec<u8>),
}

// /// Options specifying how the total relayer fee should be calculated.
// #[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, InitSpace)]
// pub struct RelayOptions {
//     /// Normalized amount of gas to drop off on destination network.
//     pub gas_dropoff: u32,

//     /// Maximum fee that a relayer can charge for the transfer.
//     pub max_relayer_fee: u64,
// }

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, InitSpace)]
pub struct StagedOutboundInfo {
    pub custody_token_bump: u8,

    /// One who paid the lamports to create [StagedOutbound].
    pub prepared_by: Pubkey,

    /// The mint of the token to be transferred.
    pub src_mint: Pubkey,

    /// Wormhole chain ID of the target network.
    pub target_chain: u16,

    /// Intended recipient of the transfer.
    pub recipient: [u8; 32],
}

#[account]
#[derive(Debug)]
pub struct StagedOutbound {
    pub info: StagedOutboundInfo,
    pub staged_input: StagedInput,
    pub staged_redeem: StagedRedeem,
    pub encoded_output_token: Option<Vec<u8>>,
}

impl StagedOutbound {
    const BASE_SIZE: usize = 8 // DISCRIMINATOR
        + StagedOutboundInfo::INIT_SPACE
        + 1 // StagedType discriminant
        + 1 // StagedRedeem discrimant
        + 1 // encoded_output_token === None
        ;

    pub fn try_compute_size(
        staged_input: &StagedInput,
        redeem_option: &Option<RedeemOption>,
        encoded_output_token: &Option<Vec<u8>>,
    ) -> Result<usize> {
        Ok(Self::BASE_SIZE
            .saturating_add(match staged_input {
                StagedInput::Usdc { .. } => 8,
                StagedInput::SwapExactIn { instruction_data } => {
                    instruction_data.len().saturating_add(4)
                }
            })
            .saturating_add(match redeem_option {
                Some(redeem) => match redeem {
                    RedeemOption::Relay { .. } => 8, // StagedRedeem::Relay(u64)
                    RedeemOption::Payload(payload) => payload.len().saturating_add(4),
                },
                None => 0,
            })
            .saturating_add(match encoded_output_token {
                Some(encoded_output_token) => {
                    // First validate the encoded output token by attempting to deserialize it.
                    OutputToken::read(&mut &encoded_output_token[..])
                        .map_err(|_| error!(SwapLayerError::InvalidOutputToken))?;

                    encoded_output_token.len().saturating_add(4)
                }
                None => 0,
            }))
    }
}
