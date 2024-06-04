import { assert } from "chai";
import { toUniversal } from "@wormhole-foundation/sdk-definitions";
import { Chain, toChainId } from "@wormhole-foundation/sdk-base";
import { ethers } from "ethers";
import {
    evmSwapLayerConfig,
    usdcContract,
    EVM_CONFIG,
    circleContract,
    ATTESTATION_TYPE_LL,
    encodeOrderResponse,
} from "./helpers";
import { InitiateArgs, encodeInitiateArgs } from "../../evm/ts-sdk";
import {
    LiquidityLayerTransactionResult,
    OrderResponse,
} from "../../lib/example-liquidity-layer/evm/ts/src/";
import {
    CircleAttester,
    GuardianNetwork,
} from "../../lib/example-liquidity-layer/evm/ts/tests/helpers/";

const CHAIN_PATHWAYS: [Chain, Chain][] = [
    ["Ethereum", "Base"],
    ["Base", "Ethereum"],
];

describe("Slow Path", () => {
    const guardianNetwork = new GuardianNetwork();
    const circleAttester = new CircleAttester();

    for (const [fromChain, toChain] of CHAIN_PATHWAYS) {
        // From contracts.
        const from = evmSwapLayerConfig(fromChain);
        const fromConfig = EVM_CONFIG[fromChain];
        const fromUsdc = usdcContract(fromChain);

        // To contracts.
        const to = evmSwapLayerConfig(toChain);
        const toConfig = EVM_CONFIG[toChain];
        const toUsdc = usdcContract(toChain);

        describe(`${fromChain} <> ${toChain}`, function () {
            describe("Usdc", function () {
                let localVariables = {};

                before("Approve Max", async function () {
                    await fromUsdc.contract
                        .connect(from.wallet)
                        .approve(from.contract.address, ethers.constants.MaxUint256)
                        .then((tx) => tx.wait());
                });

                it("Direct Outbound", async function () {
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

                it("Direct Inbound", async function () {
                    const balanceBefore = await toUsdc.contract.balanceOf(to.wallet.address);
                    const etherBefore = await to.provider.getBalance(to.wallet.address);

                    // Perform the direct redeem.
                    const receipt = await to.contract
                        .redeem(0, encodeOrderResponse(localVariables["orderResponse"]), [])
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
                });
            });
        });
    }
});
