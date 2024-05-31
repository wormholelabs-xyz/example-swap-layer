import * as fs from "fs";
import { parse as envParse } from "envfile";
import { Chain } from "@wormhole-foundation/sdk-base";
import { EVM_CONFIG, EVM_LOCALHOSTS, EVM_PRIVATE_KEY } from "./";
import { ethers } from "ethers";

export type SwapLayerEnv = {
    tokenRouter: string;
    swapLayer: string;
};

export function parseSwapLayerEnvFile(envPath: string): SwapLayerEnv {
    if (!fs.existsSync(envPath)) {
        console.log(envPath);
        throw new Error(`${envPath} non-existent`);
    }

    const raw = fs.readFileSync(envPath, "utf8");
    const contents = envParse(raw.replace(/export RELEASE_/g, ""));

    const keys = ["TOKEN_ROUTER", "SWAP_LAYER"];
    for (const key of keys) {
        if (!contents[key]) {
            throw new Error(`no ${key}`);
        }
    }

    return {
        tokenRouter: contents.TOKEN_ROUTER,
        swapLayer: contents.SWAP_LAYER,
    };
}

export function evmSwapLayerConfig(chain: Chain): {
    wallet: ethers.Wallet;
    contract: ethers.Contract;
} {
    const provider = new ethers.providers.JsonRpcProvider(EVM_LOCALHOSTS[chain]);
    const wallet = new ethers.Wallet(EVM_PRIVATE_KEY, provider);
    const swapLayerAddress = EVM_CONFIG[chain].swapLayer;
    const contract = new ethers.Contract(
        swapLayerAddress,
        [
            "function initiate(uint16,bytes32,bytes)",
            "function redeem(uint8,bytes,bytes)",
            "function batchQueries(bytes)",
            "function batchMaxApprove(bytes)",
        ],
        wallet,
    );

    return { wallet, contract };
}
