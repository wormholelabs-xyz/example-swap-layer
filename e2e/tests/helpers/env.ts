import * as fs from "fs";
import { parse as envParse } from "envfile";

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
