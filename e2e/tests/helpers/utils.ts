import { ComputeBudgetProgram, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { OrderResponse } from "../../../lib/example-liquidity-layer/evm/ts/src";
import { deserialize } from "@wormhole-foundation/sdk-definitions";
import { CORE_BRIDGE_PID } from "../../../solana/ts/tests/helpers";
import { expectIxOk, postVaa } from "@wormhole-foundation/example-liquidity-layer-solana/testing";
import { utils as coreUtils } from "@wormhole-foundation/sdk-solana-core";
import { ethers } from "ethers";
import { TokenRouterProgram } from "@wormhole-foundation/example-liquidity-layer-solana/tokenRouter";
import { OutputToken, SwapLayerProgram } from "../../../solana/ts/src/swapLayer";
import { Uint64 } from "@wormhole-foundation/example-liquidity-layer-solana/common";
import { Chain, toChainId } from "@wormhole-foundation/sdk-base";
import * as splToken from "@solana/spl-token";

export function encodeOrderResponse(orderResponse: OrderResponse) {
    // Use ethers AbiCoder to encode the OrderResponse
    const abiCoder = new ethers.utils.AbiCoder();
    const encodedOrderResponse = abiCoder.encode(
        ["tuple(bytes, bytes, bytes)"],
        [
            [
                orderResponse.encodedWormholeMessage,
                orderResponse.circleBridgeMessage,
                orderResponse.circleAttestation,
            ],
        ],
    );
    return encodedOrderResponse;
}

export async function postSignedVaa(
    connection: Connection,
    payer: Keypair,
    vaa: Uint8Array | Buffer,
) {
    await postVaa(connection, payer, Buffer.from(vaa));
    const parsed = deserialize("Uint8Array", vaa);
    return coreUtils.derivePostedVaaKey(CORE_BRIDGE_PID, Buffer.from(parsed.hash));
}

export async function getCircleMessageSolana(
    tokenRouter: TokenRouterProgram,
    preparedOrder: PublicKey,
) {
    const cctpMessage = tokenRouter.cctpMessageAddress(preparedOrder);
    const messageTransmitter = tokenRouter.messageTransmitterProgram();
    const { message } = await messageTransmitter.fetchMessageSent(cctpMessage);
    return message;
}

export async function redeemFillOnSolana(
    connection: Connection,
    payer: Keypair,
    tokenRouter: TokenRouterProgram,
    tokenRouterLkupTable: PublicKey,
    accounts: {
        vaa: PublicKey;
        routerEndpoint?: PublicKey;
    },
    args: {
        encodedCctpMessage: Buffer;
        cctpAttestation: Buffer;
    },
) {
    const ix = await tokenRouter.redeemCctpFillIx({ payer: payer.publicKey, ...accounts }, args);

    const computeIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
    });

    const { value: lookupTableAccount } =
        await connection.getAddressLookupTable(tokenRouterLkupTable);

    await expectIxOk(connection, [computeIx, ix], [payer], {
        addressLookupTableAccounts: [lookupTableAccount!],
    });

    return tokenRouter.preparedFillAddress(accounts.vaa);
}

export async function stageOutboundOnSolana(
    swapLayer: SwapLayerProgram,
    amountIn: bigint,
    targetChain: Chain,
    foreignRecipientAddress: number[],
    payer: Keypair,
    accounts: {
        senderToken: PublicKey;
        sender?: PublicKey;
    },
    opts: {
        transferType?: "sender" | "native";
        redeemOption?:
            | { relay: { gasDropoff: number; maxRelayerFee: Uint64 } }
            | { payload: Uint8Array | Buffer }
            | null;
        outputToken?: OutputToken | null;
    } = {},
) {
    const stagedOutboundSigner = Keypair.generate();
    const stagedOutbound = stagedOutboundSigner.publicKey;

    let { redeemOption, outputToken, transferType } = opts;
    redeemOption ??= null;
    outputToken ??= null;
    transferType ??= "sender";

    const [, ix] = await swapLayer.stageOutboundIx(
        {
            payer: payer.publicKey,
            ...accounts,
            stagedOutbound,
            usdcRefundToken: accounts.senderToken,
        },
        {
            transferType,
            amountIn,
            targetChain: toChainId(targetChain),
            recipient: foreignRecipientAddress,
            redeemOption,
            outputToken,
        },
    );

    await expectIxOk(swapLayer.connection(), [ix], [payer, stagedOutboundSigner]);

    const stagedCustodyToken = swapLayer.stagedCustodyTokenAddress(stagedOutbound);
    const preparedOrder = swapLayer.preparedOrderAddress(stagedOutbound);

    return { stagedOutbound, stagedCustodyToken, preparedOrder };
}
