import { assert } from "chai";
import { toUniversal } from "@wormhole-foundation/sdk-definitions";
import { Chain, toChainId } from "@wormhole-foundation/sdk-base";
import { ethers } from "ethers";
import { evmSwapLayerConfig, usdcContract } from "./helpers";
import { InitiateArgs, encodeInitiateArgs } from "../../evm/ts-sdk";

const CHAIN_PATHWAYS: [Chain, Chain][] = [
    ["Ethereum", "Base"],
    ["Base", "Ethereum"],
];

describe("Slow Path", () => {
    for (const [fromChain, toChain] of CHAIN_PATHWAYS) {
        const from = evmSwapLayerConfig(fromChain);
        const to = evmSwapLayerConfig(toChain);
        const fromUsdc = usdcContract(fromChain);
        const toUsdc = usdcContract(toChain);

        describe(`${fromChain} <> ${toChain}`, function () {
            describe("Usdc", function () {
                before("Approve Max", async function () {
                    await fromUsdc.contract
                        .connect(from.wallet)
                        .approve(from.contract.address, ethers.constants.MaxUint256)
                        .then((tx) => tx.wait());
                });

                it("Direct", async function () {
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

                    const txHash = await from.contract
                        .initiate(
                            toChainId(toChain),
                            toUniversal(fromChain, from.wallet.address).address,
                            encodeInitiateArgs(output),
                        )
                        .then((tx) => tx.wait().then((receipt) => receipt.transactionHash));
                    assert.isNotEmpty(txHash);

                    const balanceAfter = await fromUsdc.contract.balanceOf(from.wallet.address);
                    assert.equal(balanceBefore.sub(balanceAfter).toNumber(), amountIn);
                });
            });
        });
    }
});
