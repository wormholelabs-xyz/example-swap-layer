import { PublicKey } from "@solana/web3.js";
import { parseSwapLayerEnvFile } from "./";
import { uint64ToBN } from "@wormhole-foundation/example-liquidity-layer-solana/common";

export const SOLANA_SWAP_LAYER_ID = "SwapLayer1111111111111111111111111111111111";
export const USDC_MINT_ADDRESS = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export const EVM_PRIVATE_KEY = "0x395df67f0c2d2d9fe1ad08d1bc8b6627011959b79c53d7dd6a3536a33ab8a4fd";
export const RELAYER_PRIVATE_KEY =
    "0xe485d098507f54e7733a205420dfddbe58db035fa577fc294ebd14db90767a52";
export const GUARDIAN_PRIVATE_KEY =
    "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";

// Avalanche Mainnet Fork
export const EVM_LOCALHOSTS = {
    Ethereum: "http://127.0.0.1:8548",
    Base: "http://127.0.0.1:8549",
};

export const REGISTERED_EVM_CHAINS = ["Ethereum", "Base"] as const;
export const EVM_CONFIG = {
    Ethereum: {
        cctpDomain: 0,
        ...parseSwapLayerEnvFile(`${__dirname}/../../../evm/env/localnet/Ethereum.env`),
        relayParams: {
            baseFee: 250_000, // $0.25
            nativeTokenPrice: uint64ToBN(10_000_000), // $10
            maxGasDropoff: 1_000_000, // 1 SOL
            gasDropoffMargin: 10_000, // 1%
            executionParams: {
                evm: {
                    gasPrice: 25_000, // 25 Gwei
                    gasPriceMargin: 250_000, // 25%
                },
            },
            swapTimeLimit: { fastLimit: 30, finalizedLimit: 20 * 60 },
        },
    },
    Base: {
        cctpDomain: 6,
        ...parseSwapLayerEnvFile(`${__dirname}/../../../evm/env/localnet/Base.env`),
        relayParams: {
            baseFee: 250_000, // $0.25
            nativeTokenPrice: uint64ToBN(10_000_000), // $10
            maxGasDropoff: 1_000_000, // 1 SOL
            gasDropoffMargin: 10_000, // 1%
            executionParams: {
                evm: {
                    gasPrice: 25_000, // 25 Gwei
                    gasPriceMargin: 250_000, // 25%
                },
            },
            swapTimeLimit: { fastLimit: 30, finalizedLimit: 20 * 60 },
        },
    },
} as const;
