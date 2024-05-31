import { assert } from "chai";
import * as swapLayerSdk from "../../solana/ts/src/swapLayer";
import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
    expectIxOk,
    PAYER_KEYPAIR,
    CHAIN_TO_DOMAIN,
    OWNER_KEYPAIR,
    LOCALHOST,
} from "@wormhole-foundation/example-liquidity-layer-solana/testing";
import { uint64ToBN } from "@wormhole-foundation/example-liquidity-layer-solana/common";
import { Chain, toChainId } from "@wormhole-foundation/sdk-base";
import { createAta } from "../../solana/ts/tests/helpers";

const USDC_MINT_ADDRESS = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const REGISTERED_EVM_CHAINS = [
    "Ethereum",
    "Avalanche",
    "Optimism",
    "Arbitrum",
    "Base",
    "Polygon",
] as const;

describe("Setup", () => {
    const connection = new Connection(LOCALHOST, "confirmed");

    const swapLayer = new swapLayerSdk.SwapLayerProgram(
        connection,
        "SwapLayer1111111111111111111111111111111111",
        USDC_MINT_ADDRESS,
    );
    const tokenRouter = swapLayer.tokenRouterProgram();
    const matchingEngine = tokenRouter.matchingEngineProgram();

    const payer = PAYER_KEYPAIR;
    const owner = OWNER_KEYPAIR;

    describe("Matching Engine", function () {
        for (const chain of REGISTERED_EVM_CHAINS.slice(0, 1)) {
            it(`Update CCTP Endpoint (${chain})`, async function () {
                await updateMatchingEngineCctpEndpoint(chain, Buffer.alloc(32, "deadbeef", "hex"));
            });
        }

        for (const chain of REGISTERED_EVM_CHAINS.slice(1)) {
            it(`Add CCTP Endpoint (${chain})`, async function () {
                const cctpDomain = CHAIN_TO_DOMAIN[chain];
                assert.isDefined(cctpDomain);

                const ix = await matchingEngine.addCctpRouterEndpointIx(
                    {
                        ownerOrAssistant: owner.publicKey,
                        payer: payer.publicKey,
                    },
                    {
                        chain: toChainId(chain),
                        cctpDomain,
                        address: Array.from(Buffer.alloc(32, "deadbeef", "hex")),
                        mintRecipient: Array.from(Buffer.alloc(32, "deadbeef", "hex")),
                    },
                );
                await expectIxOk(connection, [ix], [payer, owner]);
            });
        }
    });

    describe("Token Router", function () {
        // Nothing to do.
    });

    describe("Swap Layer", function () {
        before("Set Up Owner", async function () {
            await expectIxOk(
                connection,
                [
                    SystemProgram.transfer({
                        fromPubkey: payer.publicKey,
                        toPubkey: owner.publicKey,
                        lamports: 1000000000,
                    }),
                ],
                [payer],
            );
            await createAta(connection, payer, swapLayer.usdcMint, owner.publicKey);
        });

        it("Initialize", async function () {
            const ix = await swapLayer.initializeIx({
                owner: owner.publicKey,
                ownerAssistant: owner.publicKey,
                feeRecipient: owner.publicKey,
                feeUpdater: owner.publicKey,
            });

            await expectIxOk(connection, [ix], [payer, owner]);
        });

        for (const chain of REGISTERED_EVM_CHAINS) {
            it(`Add Peer (${chain})`, async function () {
                const ix = await swapLayer.addPeerIx(
                    {
                        ownerOrAssistant: owner.publicKey,
                        payer: payer.publicKey,
                    },
                    {
                        chain: toChainId(chain),
                        address: Array.from(Buffer.alloc(32, "deadbeef", "hex")),
                        relayParams: {
                            baseFee: 69,
                            nativeTokenPrice: uint64ToBN(69),
                            maxGasDropoff: 69,
                            gasDropoffMargin: 69,
                            executionParams: {
                                evm: {
                                    gasPrice: 69,
                                    gasPriceMargin: 69,
                                },
                            },
                            swapTimeLimit: { fastLimit: 0, finalizedLimit: 0 },
                        },
                    },
                );
                await expectIxOk(connection, [ix], [payer, owner]);
            });
        }
    });

    async function updateMatchingEngineCctpEndpoint(
        chain: Chain,
        address: Uint8Array | Buffer,
        mintRecipient?: Uint8Array | Buffer,
    ) {
        mintRecipient ??= address;

        const cctpDomain = CHAIN_TO_DOMAIN[chain];
        assert.isDefined(cctpDomain);

        const ix = await matchingEngine.updateCctpRouterEndpointIx(
            {
                owner: owner.publicKey,
            },
            {
                chain: toChainId(chain),
                cctpDomain,
                address: Array.from(address),
                mintRecipient: Array.from(mintRecipient),
            },
        );
        await expectIxOk(connection, [ix], [payer, owner]);
    }

    async function disableMatchingEngineEndpoint(chain: Chain) {
        const ix = await matchingEngine.disableRouterEndpointIx(
            {
                owner: owner.publicKey,
            },
            toChainId(chain),
        );
        await expectIxOk(connection, [ix], [payer, owner]);
    }
});
