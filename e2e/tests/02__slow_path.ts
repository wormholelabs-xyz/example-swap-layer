import { assert } from "chai";
import * as swapLayerSdk from "../../solana/ts/src/swapLayer";
import { toUniversal } from "@wormhole-foundation/sdk-definitions";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import {
    PAYER_KEYPAIR,
    LOCALHOST,
    expectIxOk,
    getUsdcAtaBalance,
} from "@wormhole-foundation/example-liquidity-layer-solana/testing";
import { Chain, toChainId } from "@wormhole-foundation/sdk-base";
import { ethers } from "ethers";
import {
    evmSwapLayerConfig,
    usdcContract,
    EVM_CONFIG,
    circleContract,
    ATTESTATION_TYPE_LL,
    USDC_MINT_ADDRESS,
    SOLANA_SWAP_LAYER_ID,
    encodeOrderResponse,
    postSignedVaa,
    GUARDIAN_SET_INDEX,
    redeemFillOnSolana,
    stageOutboundOnSolana,
    getCircleMessageSolana,
} from "./helpers";
import * as splToken from "@solana/spl-token";
import { InitiateArgs, encodeInitiateArgs } from "../../evm/ts-sdk";
import {
    LiquidityLayerTransactionResult,
    OrderResponse,
} from "../../lib/example-liquidity-layer/evm/ts/src/";
import { CircleAttester } from "../../lib/example-liquidity-layer/evm/ts/tests/helpers/";
import { GuardianNetwork } from "./helpers/guardians";
import { createLut } from "../../solana/ts/tests/helpers";

const EVM_CHAIN_PATHWAYS: [Chain, Chain][] = [
    ["Ethereum", "Base"],
    ["Base", "Ethereum"],
];

describe("Slow Path", () => {
    const guardianNetwork = new GuardianNetwork(GUARDIAN_SET_INDEX);
    const circleAttester = new CircleAttester();

    // Solana.
    const solanaPayer = PAYER_KEYPAIR;
    const solanaRecipient = Keypair.generate();
    const connection = new Connection(LOCALHOST, "confirmed");
    const solanaSwapLayer = new swapLayerSdk.SwapLayerProgram(
        connection,
        SOLANA_SWAP_LAYER_ID,
        USDC_MINT_ADDRESS,
    );
    const solanaTokenRouter = solanaSwapLayer.tokenRouterProgram();
    let tokenRouterLkupTable: PublicKey;

    let localVariables = {};

    for (const [fromChain, toChain] of EVM_CHAIN_PATHWAYS) {
        // From contracts.
        const from = evmSwapLayerConfig(fromChain);
        const fromConfig = EVM_CONFIG[fromChain];
        const fromUsdc = usdcContract(fromChain);

        // To contracts.
        const to = evmSwapLayerConfig(toChain);
        const toUsdc = usdcContract(toChain);

        before("Approve Max", async function () {
            await fromUsdc.contract
                .connect(from.wallet)
                .approve(from.contract.address, ethers.constants.MaxUint256)
                .then((tx) => tx.wait());
        });

        describe(`${fromChain} <> ${toChain}`, function () {
            describe("Usdc", function () {
                describe("Direct", function () {
                    it("Outbound", async function () {
                        const amountIn = 20_000_000_000; // 20k USDC

                        const output: InitiateArgs = {
                            transferMode: {
                                mode: "LiquidityLayer",
                            },
                            redeemMode: {
                                mode: "Direct",
                            },
                            outputToken: {
                                type: "Usdc",
                            },
                            isExactIn: true,
                            inputToken: {
                                type: "Usdc",
                                amount: BigInt(amountIn),
                                acquireMode: {
                                    mode: "Preapproved",
                                },
                            },
                        };

                        const balanceBefore = await fromUsdc.contract.balanceOf(
                            from.wallet.address,
                        );

                        const receipt = await from.contract
                            .initiate(
                                toChainId(toChain),
                                toUniversal(fromChain, from.wallet.address).address,
                                encodeInitiateArgs(output),
                            )
                            .then((tx) => tx.wait());
                        assert.isNotEmpty(receipt);

                        const balanceAfter = await fromUsdc.contract.balanceOf(from.wallet.address);
                        assert.equal(balanceBefore.sub(balanceAfter).toNumber(), amountIn);

                        // Fetch the vaa and cctp attestation.
                        const result = LiquidityLayerTransactionResult.fromEthersTransactionReceipt(
                            toChainId(fromChain),
                            fromConfig.tokenRouter,
                            fromConfig.coreBridge,
                            receipt,
                            await circleContract(fromChain).then(
                                (c) => c.messageTransmitter.address,
                            ),
                        );

                        // Create a signed VAA and circle attestation.
                        const fillVaa = await guardianNetwork.observeEvm(
                            from.provider,
                            fromChain,
                            receipt,
                        );

                        const orderResponse: OrderResponse = {
                            encodedWormholeMessage: Buffer.from(fillVaa),
                            circleBridgeMessage: result.circleMessage!,
                            circleAttestation: circleAttester.createAttestation(
                                result.circleMessage!,
                            ),
                        };
                        localVariables["orderResponse"] = orderResponse;
                        localVariables["amountIn"] = amountIn;
                    });

                    it("Inbound", async function () {
                        const balanceBefore = await toUsdc.contract.balanceOf(to.wallet.address);
                        const etherBefore = await to.provider.getBalance(to.wallet.address);

                        // Perform the direct redeem.
                        const receipt = await to.contract
                            .redeem(
                                ATTESTATION_TYPE_LL,
                                encodeOrderResponse(localVariables["orderResponse"]),
                                [],
                            )
                            .then((tx) => tx.wait());

                        const balanceAfter = await toUsdc.contract.balanceOf(to.wallet.address);
                        const etherAfter = await to.provider.getBalance(to.wallet.address);

                        assert.isTrue(
                            etherBefore
                                .sub(etherAfter)
                                .eq(receipt.effectiveGasPrice.mul(receipt.gasUsed)),
                        );
                        assert.equal(
                            balanceAfter.sub(balanceBefore).toNumber(),
                            localVariables["amountIn"],
                        );

                        localVariables = {};
                    });
                });
            });
        });
    }

    before("Set up Token Accounts", async function () {
        await splToken.getOrCreateAssociatedTokenAccount(
            connection,
            solanaPayer,
            USDC_MINT_ADDRESS,
            solanaRecipient.publicKey,
        );
    });

    before("Setup Lookup Table", async function () {
        const usdcCommonAccounts = await solanaTokenRouter.commonAccounts();

        tokenRouterLkupTable = await createLut(
            connection,
            solanaPayer,
            Object.values(usdcCommonAccounts).filter((key) => key !== undefined),
        );
    });

    describe("Solana <> Base", function () {
        const toChain = "Base";

        // From contracts.
        const to = evmSwapLayerConfig(toChain);
        const toUsdc = usdcContract(toChain);

        describe("Usdc", function () {
            describe("Direct", function () {
                it("Outbound", async function () {
                    const amountIn = 20_000_000_000; // 20k USDC
                    const senderToken = splToken.getAssociatedTokenAddressSync(
                        solanaSwapLayer.usdcMint,
                        solanaPayer.publicKey,
                    );
                    const senderBefore = await getUsdcAtaBalance(connection, solanaPayer.publicKey);

                    const { stagedOutbound, stagedCustodyToken, preparedOrder } =
                        await stageOutboundOnSolana(
                            solanaSwapLayer,
                            BigInt(amountIn),
                            toChain,
                            Array.from(toUniversal(toChain, to.wallet.address).address),
                            solanaPayer,
                            {
                                senderToken,
                            },
                        );

                    // Confirm that the 20k was staged.
                    const senderAfter = await getUsdcAtaBalance(connection, solanaPayer.publicKey);
                    assert.equal(senderBefore - senderAfter, BigInt(amountIn));

                    // Send the transfer.
                    const initiateIx = await solanaSwapLayer.initiateTransferIx({
                        payer: solanaPayer.publicKey,
                        preparedOrder,
                        stagedOutbound,
                        stagedCustodyToken,
                    });

                    await expectIxOk(connection, [initiateIx], [solanaPayer]);

                    const ix = await solanaTokenRouter.placeMarketOrderCctpIx(
                        {
                            payer: solanaPayer.publicKey,
                            preparedOrder: preparedOrder,
                        },
                        {
                            targetChain: toChainId(toChain),
                        },
                    );

                    await expectIxOk(connection, [ix], [solanaPayer]);

                    // Create a signed VAA and circle attestation.
                    const fillVaa = await guardianNetwork.observeSolana(
                        connection,
                        solanaTokenRouter.coreMessageAddress(preparedOrder),
                    );
                    const circleMessage = await getCircleMessageSolana(
                        solanaTokenRouter,
                        preparedOrder,
                    );

                    const orderResponse: OrderResponse = {
                        encodedWormholeMessage: fillVaa,
                        circleBridgeMessage: circleMessage,
                        circleAttestation: circleAttester.createAttestation(circleMessage),
                    };
                    localVariables["orderResponse"] = orderResponse;
                    localVariables["amountIn"] = amountIn;
                });

                it("Inbound", async function () {
                    const balanceBefore = await toUsdc.contract.balanceOf(to.wallet.address);
                    const etherBefore = await to.provider.getBalance(to.wallet.address);

                    // Perform the direct redeem.
                    const receipt = await to.contract
                        .redeem(
                            ATTESTATION_TYPE_LL,
                            encodeOrderResponse(localVariables["orderResponse"]),
                            [],
                        )
                        .then((tx) => tx.wait());

                    const balanceAfter = await toUsdc.contract.balanceOf(to.wallet.address);
                    const etherAfter = await to.provider.getBalance(to.wallet.address);

                    assert.isTrue(
                        etherBefore
                            .sub(etherAfter)
                            .eq(receipt.effectiveGasPrice.mul(receipt.gasUsed)),
                    );
                    assert.equal(
                        balanceAfter.sub(balanceBefore).toNumber(),
                        localVariables["amountIn"],
                    );

                    localVariables = {};
                });
            });
        });
    });

    describe("Base <> Solana", function () {
        const fromChain = "Base";
        const toChain = "Solana";

        // From contracts.
        const from = evmSwapLayerConfig(fromChain);
        const fromConfig = EVM_CONFIG[fromChain];
        const fromUsdc = usdcContract(fromChain);

        describe("Usdc", function () {
            describe("Direct", function () {
                it("Outbound", async function () {
                    const amountIn = 20_000_000_000; // 20k USDC

                    const output: InitiateArgs = {
                        transferMode: {
                            mode: "LiquidityLayer",
                        },
                        redeemMode: {
                            mode: "Direct",
                        },
                        outputToken: {
                            type: "Usdc",
                        },
                        isExactIn: true,
                        inputToken: {
                            type: "Usdc",
                            amount: BigInt(amountIn),
                            acquireMode: {
                                mode: "Preapproved",
                            },
                        },
                    };

                    const balanceBefore = await fromUsdc.contract.balanceOf(from.wallet.address);

                    const receipt = await from.contract
                        .initiate(
                            toChainId(toChain),
                            toUniversal(toChain, solanaRecipient.publicKey.toBuffer()).address,
                            encodeInitiateArgs(output),
                        )
                        .then((tx) => tx.wait());
                    assert.isNotEmpty(receipt);

                    const balanceAfter = await fromUsdc.contract.balanceOf(from.wallet.address);
                    assert.equal(balanceBefore.sub(balanceAfter).toNumber(), amountIn);

                    // Fetch the vaa and cctp attestation.
                    const result = LiquidityLayerTransactionResult.fromEthersTransactionReceipt(
                        toChainId(fromChain),
                        fromConfig.tokenRouter,
                        fromConfig.coreBridge,
                        receipt,
                        await circleContract(fromChain).then((c) => c.messageTransmitter.address),
                    );

                    // Create a signed VAA and circle attestation.
                    const fillVaa = await guardianNetwork.observeEvm(
                        from.provider,
                        fromChain,
                        receipt,
                    );

                    const orderResponse: OrderResponse = {
                        encodedWormholeMessage: Buffer.from(fillVaa),
                        circleBridgeMessage: result.circleMessage!,
                        circleAttestation: circleAttester.createAttestation(result.circleMessage!),
                    };
                    localVariables["orderResponse"] = orderResponse;
                    localVariables["amountIn"] = amountIn;
                });

                it("Inbound", async function () {
                    // Post the Fill on Solana and derive the account.
                    const vaaKey = await postSignedVaa(
                        connection,
                        solanaPayer,
                        localVariables["orderResponse"].encodedWormholeMessage,
                    );

                    // Redeem fill on Solana.
                    const preparedFill = await redeemFillOnSolana(
                        connection,
                        solanaPayer,
                        solanaTokenRouter,
                        tokenRouterLkupTable,
                        {
                            vaa: vaaKey,
                        },
                        {
                            encodedCctpMessage: localVariables["orderResponse"].circleBridgeMessage,
                            cctpAttestation: localVariables["orderResponse"].circleAttestation,
                        },
                    );

                    const recipientBefore = await getUsdcAtaBalance(
                        connection,
                        solanaRecipient.publicKey,
                    );

                    const transferIx = await solanaSwapLayer.completeTransferDirectIx(
                        {
                            payer: solanaPayer.publicKey,
                            preparedFill,
                            recipient: solanaRecipient.publicKey,
                        },
                        toChainId(fromChain),
                    );

                    await expectIxOk(connection, [transferIx], [solanaPayer]);

                    const recipientAfter = await getUsdcAtaBalance(
                        connection,
                        solanaRecipient.publicKey,
                    );
                    assert.equal(
                        recipientAfter,
                        recipientBefore + BigInt(localVariables["amountIn"]),
                    );

                    localVariables = {};
                });
            });
        });
    });
});
