import { Chain } from "@wormhole-foundation/sdk-base";
import { mocks } from "@wormhole-foundation/sdk-definitions/testing";
import { SolanaWormholeCore, utils } from "@wormhole-foundation/sdk-solana-core";

import { Connection, Keypair } from "@solana/web3.js";
import { ethers } from "ethers";
import { LiquidityLayerMessage } from "../../src/common";
import { getBlockTime } from "./utils";
import { UniversalAddress, buildConfig } from "@wormhole-foundation/sdk-definitions";
import { CORE_BRIDGE_PID } from "../../../../lib/example-liquidity-layer/solana/ts/tests/helpers";

export async function postLiquidityLayerVaa(
    connection: Connection,
    payer: Keypair,
    guardians: mocks.MockGuardians,
    foreignEmitterAddress: Array<number>,
    sequence: bigint,
    message: LiquidityLayerMessage | Buffer,
    args: { sourceChain?: Chain; timestamp?: number } = {},
) {
    const sourceChain = args.sourceChain ?? "Ethereum";
    const timestamp = args.timestamp ?? (await getBlockTime(connection));

    const foreignEmitter = new mocks.MockEmitter(
        new UniversalAddress(new Uint8Array(foreignEmitterAddress)),
        sourceChain,
        sequence,
    );

    const published = foreignEmitter.publishMessage(
        0, // nonce,
        Buffer.isBuffer(message) ? message : message.encode(),
        0, // consistencyLevel
        timestamp,
    );
    const vaa = guardians.addSignatures(published, [0]);

    const core = await SolanaWormholeCore.fromRpc(connection, buildConfig("Devnet"));
    const txs = core.postVaa(payer, vaa);
    console.log("Submitme plz", txs);

    return utils.derivePostedVaaKey(CORE_BRIDGE_PID, Buffer.from(vaa.hash));
}

//export class CircleAttester {
//    attester: ethers.utils.SigningKey;
//
//    constructor() {
//        this.attester = new ethers.utils.SigningKey("0x" + GUARDIAN_KEY);
//    }
//
//    createAttestation(message: Buffer | Uint8Array) {
//        const signature = this.attester.signDigest(ethers.utils.keccak256(message));
//
//        const attestation = Buffer.alloc(65);
//
//        let offset = 0;
//        attestation.set(ethers.utils.arrayify(signature.r), offset);
//        offset += 32;
//        attestation.set(ethers.utils.arrayify(signature.s), offset);
//        offset += 32;
//
//        const recoveryId = signature.recoveryParam;
//        attestation.writeUInt8(recoveryId < 27 ? recoveryId + 27 : recoveryId, offset);
//        offset += 1;
//
//        return attestation;
//    }
//}
//
