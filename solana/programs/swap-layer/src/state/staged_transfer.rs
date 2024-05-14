use anchor_lang::prelude::*;

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct StagedTransferSeeds {
    pub prepared_fill: Pubkey,
    pub bump: u8,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct StagedTransferInfo {
    pub staged_custody_token_bump: u8,

    // Payer that created this StagedTransfer.
    pub staged_by: Pubkey,

    // Exposed out of convenience for the receiving program.
    pub source_chain: u16,

    // pub payload_sender: [u8; 32],

    // The encoded recipient must be the caller.
    pub recipient: [u8; 32],

    // Indicates whether the output token type is Gas.
    pub is_native: bool,
}

#[account]
#[derive(Debug)]
pub struct StagedTransfer {
    pub seeds: StagedTransferSeeds,
    pub info: StagedTransferInfo,
    pub recipient_payload: Vec<u8>,
}

impl StagedTransfer {
    pub const SEED_PREFIX: &'static [u8] = b"staged";

    pub fn checked_compute_size(payload_len: usize) -> Option<usize> {
        const FIXED: usize = 8 // DISCRIMINATOR
            + StagedTransferSeeds::INIT_SPACE
            + 1 // staged_custody_token_bump
            + 32 // staged_by
            + 2 // source_chain
            //+ 32 // payload_sender
            + 32 // recipient
            + 1 // is_native
            + 2 // payload len
        ;

        payload_len.checked_add(FIXED)
    }
}

impl std::ops::Deref for StagedTransfer {
    type Target = StagedTransferInfo;

    fn deref(&self) -> &Self::Target {
        &self.info
    }
}
