import {
    ComputeBudgetProgram,
    Connection,
    Keypair,
    PublicKey,
    Signer,
    TransactionInstruction,
} from "@solana/web3.js";
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
import * as jupiterV6 from "../../../solana/ts/src/jupiterV6";

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
        usdcRefundToken: PublicKey;
    },
    opts: {
        exactIn?: boolean;
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

    let { redeemOption, outputToken, transferType, exactIn } = opts;
    redeemOption ??= null;
    outputToken ??= null;
    transferType ??= "sender";
    exactIn ??= false;

    const [, ix] = await swapLayer.stageOutboundIx(
        {
            payer: payer.publicKey,
            ...accounts,
            stagedOutbound,
        },
        {
            transferType,
            amountIn,
            isExactIn: exactIn,
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

const JUPITER_V6_LUT_ADDRESSES = [
    new PublicKey("GxS6FiQ3mNnAar9HGQ6mxP7t6FcwmHkU7peSeQDUHmpN"),
    new PublicKey("HsLPzBjqK3SUKQZwHdd2QHVc9cioPrsHNw9GcUDs7WL7"),
];

const luts: PublicKey[] = [];
for (let i = 0; i < JUPITER_V6_LUT_ADDRESSES.length; ++i) {
    luts.push(JUPITER_V6_LUT_ADDRESSES[i]);
}

export async function completeSwapDirectForTest(
    swapLayer: SwapLayerProgram,
    connection: Connection,
    accounts: {
        payer: PublicKey;
        preparedFill: PublicKey;
        recipient: PublicKey;
        recipientToken?: PublicKey;
        dstMint?: PublicKey;
    },
    opts: {
        signers: Signer[];
        inAmount?: bigint;
        quotedAmountOut?: bigint;
        swapResponseModifier: (
            tokenOwner: PublicKey,
            opts: jupiterV6.ModifySharedAccountsRouteOpts,
        ) => Promise<jupiterV6.ModifiedSharedAccountsRoute>;
        additionalLuts?: PublicKey[];
    },
): Promise<undefined> {
    let { signers, swapResponseModifier, additionalLuts } = opts;

    additionalLuts ??= [];

    const { instruction: cpiInstruction } = await swapResponseModifier(
        swapLayer.swapAuthorityAddress(accounts.preparedFill),
        {
            cpi: true,
            inAmount: opts.inAmount,
            quotedOutAmount: opts.quotedAmountOut,
        },
    );

    const ix = await swapLayer.completeSwapDirectIx(accounts, { cpiInstruction });
    const ixs = [
        ComputeBudgetProgram.setComputeUnitLimit({
            units: 700_000,
        }),
        ix,
    ];

    const addressLookupTableAccounts = await Promise.all(
        [...luts, ...additionalLuts].map(async (lookupTableAddress) => {
            const resp = await connection.getAddressLookupTable(lookupTableAddress);
            return resp.value!;
        }),
    );

    await expectIxOk(swapLayer.connection(), ixs, signers, {
        addressLookupTableAccounts,
    });
}

export async function swapExactInForTest(
    swapLayer: SwapLayerProgram,
    accounts: {
        payer: PublicKey;
        stagedOutbound: PublicKey;
        stagedCustodyToken?: PublicKey;
        preparedOrder?: PublicKey;
        srcMint?: PublicKey;
        srcTokenProgram?: PublicKey;
        preparedBy?: PublicKey;
        usdcRefundToken?: PublicKey;
        srcResidual?: PublicKey;
    },
    args: {
        cpiInstruction: TransactionInstruction;
    },
    opts: {
        additionalLuts?: PublicKey[];
        signers: Signer[];
    },
) {
    let { additionalLuts, signers } = opts;
    additionalLuts ??= [];

    const ix = await swapLayer.initiateSwapExactInIx(accounts, args);

    const computeIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 700_000,
    });

    const addressLookupTableAccounts = await Promise.all(
        [...luts, ...additionalLuts].map(async (lookupTableAddress) => {
            const resp = await swapLayer.connection().getAddressLookupTable(lookupTableAddress);
            return resp.value!;
        }),
    );

    await expectIxOk(swapLayer.connection(), [computeIx, ix], signers, {
        addressLookupTableAccounts,
    });
}
