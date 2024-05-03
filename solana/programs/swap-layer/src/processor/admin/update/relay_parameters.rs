use anchor_lang::prelude::*;
use crate::{composite::*, state::{Peer, RelayParams}};
use crate::utils::relay_parameters::verify_relay_params;

#[derive(Accounts)]
#[instruction(args: UpdateRelayParametersArgs)]
pub struct UpdateRelayParameters<'info> {
    #[account(address = custodian.fee_updater)]
    fee_updater: Signer<'info>,

    custodian: CheckedCustodian<'info>,

    #[account(
        seeds = [
            Peer::SEED_PREFIX,
            &args.chain.to_be_bytes()
        ],
        bump,
    )]
    peer: Account<'info, Peer>, 
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateRelayParametersArgs {
    pub chain: u16,
    pub relay_params: RelayParams,
}

pub fn update_relay_parameters(ctx: Context<UpdateRelayParameters>, args: UpdateRelayParametersArgs) -> Result<()> {
    verify_relay_params(&ctx.accounts.peer.relay_params)?;

    let peer = &mut ctx.accounts.peer;
    peer.relay_params = args.relay_params;

    Ok(())
}