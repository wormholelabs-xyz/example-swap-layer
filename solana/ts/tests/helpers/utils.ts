import * as splToken from "@solana/spl-token";
import {
    AddressLookupTableAccount,
    ConfirmOptions,
    Connection,
    MessageV0,
    PublicKey,
    Signer,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";
import { encoding } from "@wormhole-foundation/sdk-base";
import { expect } from "chai";
import { execSync } from "child_process";
import { Err, Ok } from "ts-results";
import {
    CORE_BRIDGE_PID,
    USDC_MINT_ADDRESS,
} from "../../../../lib/example-liquidity-layer/solana/ts/tests/helpers/index.js";

async function confirmLatest(connection: Connection, signature: string) {
    return connection.getLatestBlockhash().then(({ blockhash, lastValidBlockHeight }) =>
        connection.confirmTransaction(
            {
                blockhash,
                lastValidBlockHeight,
                signature,
            },
            "confirmed",
        ),
    );
}

export async function expectIxOk(
    connection: Connection,
    instructions: TransactionInstruction[],
    signers: Signer[],
    options: {
        addressLookupTableAccounts?: AddressLookupTableAccount[];
        confirmOptions?: ConfirmOptions;
    } = {},
) {
    const { addressLookupTableAccounts, confirmOptions } = options;
    return debugSendAndConfirmTransaction(connection, instructions, signers, {
        addressLookupTableAccounts,
        logError: true,
        confirmOptions,
    }).then((result) => result.unwrap());
}

export async function expectIxErr(
    connection: Connection,
    instructions: TransactionInstruction[],
    signers: Signer[],
    expectedError: string,
    options: {
        addressLookupTableAccounts?: AddressLookupTableAccount[];
        confirmOptions?: ConfirmOptions;
    } = {},
) {
    const { addressLookupTableAccounts, confirmOptions } = options;
    const errorMsg = await debugSendAndConfirmTransaction(connection, instructions, signers, {
        addressLookupTableAccounts,
        logError: false,
        confirmOptions,
    }).then((result) => {
        if (result.err) {
            return result.toString();
        } else {
            throw new Error("Expected transaction to fail");
        }
    });
    try {
        expect(errorMsg).includes(expectedError);
    } catch (err) {
        console.log(errorMsg);
        throw err;
    }
}

export async function expectIxOkDetails(
    connection: Connection,
    ixs: TransactionInstruction[],
    signers: Signer[],
    options: {
        addressLookupTableAccounts?: AddressLookupTableAccount[];
        confirmOptions?: ConfirmOptions;
    } = {},
) {
    const txSig = await expectIxOk(connection, ixs, signers, options);
    await confirmLatest(connection, txSig);
    return connection.getTransaction(txSig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
    });
}

async function debugSendAndConfirmTransaction(
    connection: Connection,
    instructions: TransactionInstruction[],
    signers: Signer[],
    options: {
        addressLookupTableAccounts?: AddressLookupTableAccount[];
        logError?: boolean;
        confirmOptions?: ConfirmOptions;
    } = {},
) {
    const { logError, confirmOptions, addressLookupTableAccounts } = options;

    const latestBlockhash = await connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
        payerKey: signers[0].publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions,
    }).compileToV0Message(addressLookupTableAccounts);

    const tx = new VersionedTransaction(messageV0);

    // sign your transaction with the required `Signers`
    tx.sign(signers);

    return connection
        .sendTransaction(tx, confirmOptions)
        .then(async (signature) => {
            await connection.confirmTransaction(
                {
                    signature,
                    ...latestBlockhash,
                },
                confirmOptions === undefined ? "confirmed" : confirmOptions.commitment,
            );
            return new Ok(signature);
        })
        .catch((err) => {
            if (logError) {
                console.log(err);
            }

            logTxDetails(tx);

            if (err.logs !== undefined) {
                const logs: string[] = err.logs;
                return new Err(logs.join("\n"));
            } else {
                return new Err(err.message);
            }
        });
}

export function loadProgramBpf(artifactPath: string): PublicKey {
    // Write keypair to temporary file.
    const keypath = `${__dirname}/../keys/pFCBP4bhqdSsrWUVTgqhPsLrfEdChBK17vgFM7TxjxQ.json`;

    // Invoke BPF Loader Upgradeable `write-buffer` instruction.
    const buffer = (() => {
        const output = execSync(`solana -u l -k ${keypath} program write-buffer ${artifactPath}`);
        return new PublicKey(output.toString().match(/^Buffer: ([A-Za-z0-9]+)/)![1]);
    })();

    // Return the pubkey for the buffer (our new program implementation).
    return buffer;
}

export async function waitBySlots(connection: Connection, numSlots: number) {
    const targetSlot = await connection.getSlot().then((slot) => slot + numSlots);
    return waitUntilSlot(connection, targetSlot);
}

export async function waitUntilSlot(connection: Connection, targetSlot: number) {
    return new Promise((resolve, _) => {
        const sub = connection.onSlotChange((slot) => {
            if (slot.slot >= targetSlot) {
                connection.removeSlotChangeListener(sub);
                resolve(slot.slot);
            }
        });
    });
}

export async function waitUntilTimestamp(connection: Connection, targetTimestamp: number) {
    return new Promise((resolve, _) => {
        const sub = connection.onSlotChange(async (slot) => {
            const blockTime = await connection.getBlockTime(slot.slot);
            if (blockTime === null) {
                throw new Error("block time is null");
            } else if (blockTime >= targetTimestamp) {
                connection.removeSlotChangeListener(sub);
                resolve(blockTime);
            }
        });
    });
}

export async function getUsdcAtaBalance(connection: Connection, owner: PublicKey) {
    return splToken
        .getAccount(connection, splToken.getAssociatedTokenAddressSync(USDC_MINT_ADDRESS, owner))
        .then((token) => token.amount)
        .catch(() => 0n);
}

export async function getBlockTime(connection: Connection): Promise<number> {
    // This should never fail.
    return connection
        .getSlot()
        .then(async (slot) => connection.getBlockTime(slot))
        .then((value) => value!);
}

export function hackedExpectDeepEqual(left: any, right: any) {
    expect(JSON.parse(JSON.stringify(left))).to.eql(JSON.parse(JSON.stringify(right)));
}

export function isVersionedTransaction(tx: any): tx is VersionedTransaction {
    return (
        (<VersionedTransaction>tx).signatures !== undefined &&
        (<VersionedTransaction>tx).message !== undefined
    );
}

export async function logTxDetails(transaction: Transaction | VersionedTransaction) {
    if (isVersionedTransaction(transaction)) {
        console.log(transaction.signatures);
        const msg = transaction.message as MessageV0;
        console.log("LOOKUPS", msg.addressTableLookups);
        console.log(msg.staticAccountKeys);
        //msg.compiledInstructions.forEach((ix) => {
        //    // console.log("Data: ", encoding.hex.encode(ix.data));
        //    // console.log(
        //    //     "Keys: ",
        //    //     ix.accountKeyIndexes.map((k) => [k, keys.get(k)!.toBase58()]),
        //    // );
        //});
    } else {
        console.log(transaction.signatures);
        console.log(transaction.feePayer);
        transaction.instructions.forEach((ix) => {
            console.log("Program", ix.programId.toBase58());
            console.log("Data: ", ix.data.toString("hex"));
            console.log(
                "Keys: ",
                ix.keys.map((k) => [k, k.pubkey.toBase58()]),
            );
        });
    }
}
