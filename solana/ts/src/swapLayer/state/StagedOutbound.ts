import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export type RedeemOption =
    | {
          relay: {
              gasDropoff: number;
              maxRelayerFee: BN;
          };
      }
    | {
          payload: [Buffer];
      };

export type StagedRedeem =
    | { direct: {} }
    | { relay: { gasDropoff: number; relayingFee: BN } }
    | { payload: [Buffer] };

export type StagedOutboundInfo = {
    custodyTokenBump: number;
    preparedBy: PublicKey;
    srcMint: PublicKey;
    sender: PublicKey;
    targetChain: number;
    recipient: Array<number>;
};

export class StagedOutbound {
    info: StagedOutboundInfo;
    stagedRedeem: StagedRedeem;
    encodedOutputToken: Buffer | null;

    constructor(
        info: StagedOutboundInfo,
        stagedRedeem: StagedRedeem,
        encodedOutputToken: Buffer | null,
    ) {
        this.info = info;
        this.stagedRedeem = stagedRedeem;
        this.encodedOutputToken = encodedOutputToken;
    }
}
