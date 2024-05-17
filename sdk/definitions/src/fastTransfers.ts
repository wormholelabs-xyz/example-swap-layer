import { type Chain, type Network } from "@wormhole-foundation/sdk-base";

import {
  AccountAddress,
  ChainAddress,
  EmptyPlatformMap,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-definitions";

import { OutputToken, RedeemMode } from "./layouts/index.js";

export namespace FastTransfers {
  const _protocol = "FastTransfers";
  export type ProtocolName = typeof _protocol;

  //export type InputToken<C extends Chain> = {
  //  type: "Usdc" | "Gas" | "Other";
  //  amount: bigint;
  //};
}

export interface FastTransfers<N extends Network, C extends Chain> {
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress, // TODO: `destination` is better name?
    inputToken: any, // TODO: what type shoudl this be? Should be dependent on the chain
    outputToken: OutputToken,
    redeemMode: RedeemMode
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
}

declare module "@wormhole-foundation/sdk-definitions" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      FastTransfers: FastTransfers<N, C>;
    }
    interface ProtocolToPlatformMapping {
      FastTransfers: EmptyPlatformMap<FastTransfers.ProtocolName>;
    }
  }
}
