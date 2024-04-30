import { PublicKey } from "@solana/web3.js";
import { BN, IdlAccounts } from "@coral-xyz/anchor";
import { SwapLayer } from "../../../idl/ts/swap_layer.js";

export type ExecutionParams = {
    none?: any;
    evm: {
        gasPrice: number;
        gasPriceMargin: number;
        gasTokenPrice: BN;
        updateThreshold: number;
    };
};

export type RelayParams = {
    baseFee: number;
    nativeTokenPrice: BN;
    maxGasDropoff: number;
    gasDropoffMargin: number;
    executionParams: ExecutionParams;
};

export type Peer = IdlAccounts<SwapLayer>["peer"];

// export class Peer {
//     chain: number;
//     address: Array<number>;
//     relayParams: RelayParams;
//
//     constructor(chain: number, address: Array<number>, relayParams: RelayParams) {
//         this.chain = chain;
//         this.address = address;
//         this.relayParams = relayParams;
//     }
//
//     static address(programId: PublicKey, chain: number) {
//         const encodedChain = Buffer.alloc(2);
//         encodedChain.writeUInt16BE(chain);
//         return PublicKey.findProgramAddressSync([Buffer.from("peer"), encodedChain], programId)[0];
//     }
// }
//
