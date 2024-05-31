import { assert } from "chai";
import { Chain, toChainId } from "@wormhole-foundation/sdk-base";
import { evmSwapLayerConfig } from "./helpers";

const CHAIN_PATHWAYS: [Chain, Chain][] = [
    ["Ethereum", "Base"],
    ["Base", "Ethereum"],
];

describe("Slow Path", () => {
    for (const [fromChain, toChain] of CHAIN_PATHWAYS) {
        const from = evmSwapLayerConfig(fromChain);
        const to = evmSwapLayerConfig(toChain);
        describe(`${fromChain} <> ${toChain}`, function () {
            describe("Usdc", function () {
                it("Direct", async function () {});
            });
        });
    }
});
