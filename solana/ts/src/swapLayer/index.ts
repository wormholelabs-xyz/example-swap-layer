import { Custodian, ExecutionParams, Peer, RelayParams } from "./state/index.js";
export * from "./state/index.js";

import { IDL, type SwapLayer } from "../../idl/ts/swap_layer.js";

import { BN, Program } from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { ChainId } from "@wormhole-foundation/sdk-base";

export const PROGRAM_IDS = ["AQFz751pSuxMX6PFWx9uruoVSZ3qay2Zi33MJ4NmUF2m"] as const;

export type ProgramId = (typeof PROGRAM_IDS)[number];

export type AddPeerArgs = {
    chain: ChainId;
    address: Array<number>;
    executionParams: ExecutionParams;
    baseFee: number;
    maxGasDropoff: BN;
};

export class SwapLayerProgram {
    private _programId: ProgramId;
    private _mint: PublicKey;

    program: Program<SwapLayer>;

    get ID(): PublicKey {
        return this.program.programId;
    }

    get mint(): PublicKey {
        return this._mint;
    }

    constructor(connection: Connection, programId: ProgramId, mint: PublicKey) {
        this._programId = programId;
        this._mint = mint;
        this.program = new Program(IDL as any, new PublicKey(this._programId), {
            connection,
        });
    }

    custodianAddress(): PublicKey {
        return PublicKey.findProgramAddressSync([Buffer.from("custodian")], this.ID)[0];
    }

    peerAddress(chain: ChainId): PublicKey {
        const encodedChain = Buffer.alloc(2);
        encodedChain.writeUInt16BE(chain);
        return PublicKey.findProgramAddressSync([Buffer.from("peer"), encodedChain], this.ID)[0];
    }

    usdcComposite(mint?: PublicKey): { mint: PublicKey } {
        return {
            mint: mint ?? this.mint,
        };
    }

    completeTokenAccountKey(preparedFill: PublicKey) {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("complete"), preparedFill.toBuffer()],
            this.ID,
        )[0];
    }

    checkedCustodianComposite(addr?: PublicKey): { custodian: PublicKey } {
        return { custodian: addr ?? this.custodianAddress() };
    }

    adminComposite(
        ownerOrAssistant: PublicKey,
        custodian?: PublicKey,
    ): { ownerOrAssistant: PublicKey; custodian: { custodian: PublicKey } } {
        return { ownerOrAssistant, custodian: this.checkedCustodianComposite(custodian) };
    }

    async fetchCustodian(input?: { address: PublicKey }): Promise<Custodian> {
        const addr = input === undefined ? this.custodianAddress() : input.address;
        return this.program.account.custodian.fetch(addr);
    }

    async fetchPeer(input: ChainId | { address: PublicKey }): Promise<Peer> {
        const addr =
            typeof input == "object" && "address" in input
                ? input.address
                : this.peerAddress(input);
        return this.program.account.peer.fetch(addr);
    }

    async initializeIx(accounts: {
        owner: PublicKey;
        ownerAssistant: PublicKey;
        feeRecipient: PublicKey;
        feeUpdater: PublicKey;
        mint?: PublicKey;
    }): Promise<TransactionInstruction> {
        const { owner, ownerAssistant, feeRecipient, feeUpdater, mint } = accounts;

        return this.program.methods
            .initialize()
            .accountsStrict({
                owner,
                custodian: this.custodianAddress(),
                ownerAssistant,
                feeRecipient,
                feeRecipientToken: splToken.getAssociatedTokenAddressSync(this.mint, feeRecipient),
                feeUpdater,
                usdc: this.usdcComposite(this.mint),
                systemProgram: SystemProgram.programId,
            })
            .instruction();
    }

    async addPeerIx(
        accounts: {
            ownerOrAssistant: PublicKey;
            payer?: PublicKey;
            custodian?: PublicKey;
            peer?: PublicKey;
        },
        args: AddPeerArgs,
    ) {
        let { ownerOrAssistant, payer, custodian, peer } = accounts;
        payer ??= ownerOrAssistant;
        peer ??= this.peerAddress(args.chain);

        return this.program.methods
            .addPeer(args)
            .accountsStrict({
                payer,
                admin: this.adminComposite(ownerOrAssistant, custodian),
                peer,
                systemProgram: SystemProgram.programId,
            })
            .instruction();
    }

    async completeTransferRelayIx(
        accounts: {
            payer: PublicKey;
            preparedFill: PublicKey;
            tokenRouterCustody: PublicKey;
            tokenRouterProgram: PublicKey;
            recipient: PublicKey;
            peer?: PublicKey;
            beneficiary?: PublicKey;
            recipientTokenAccount?: PublicKey;
            feeRecipientToken?: PublicKey;
        },
        fromChain?: ChainId,
    ) {
        let {
            payer,
            beneficiary,
            preparedFill,
            tokenRouterCustody,
            tokenRouterProgram,
            peer,
            recipient,
            recipientTokenAccount,
            feeRecipientToken,
        } = accounts;

        if (fromChain === undefined && peer === undefined) {
            throw new Error("from_chain or peer must be provided");
        }

        peer = peer ?? this.peerAddress(fromChain!);
        beneficiary ??= payer;
        recipientTokenAccount ??= splToken.getAssociatedTokenAddressSync(this.mint, recipient);

        if (feeRecipientToken === undefined) {
            feeRecipientToken = await this.fetchCustodian().then((c) => c.feeRecipientToken);
        }

        return this.program.methods
            .completeTransferRelay()
            .accountsStrict({
                payer,
                custodian: this.checkedCustodianComposite(),
                recipient,
                recipientTokenAccount,
                usdc: this.usdcComposite(this.mint),
                beneficiary,
                peer,
                preparedFill,
                completeTokenAccount: this.completeTokenAccountKey(preparedFill),
                tokenRouterCustody,
                tokenRouterProgram,
                systemProgram: SystemProgram.programId,
                tokenProgram: splToken.TOKEN_PROGRAM_ID,
                feeRecipientToken: feeRecipientToken!,
            })
            .instruction();
    }

    async completeTransferDirectIx(
        accounts: {
            payer: PublicKey;
            preparedFill: PublicKey;
            tokenRouterCustody: PublicKey;
            tokenRouterProgram: PublicKey;
            peer?: PublicKey;
            recipient?: PublicKey;
            beneficiary?: PublicKey;
            recipientTokenAccount?: PublicKey;
        },
        fromChain?: ChainId,
    ) {
        let {
            payer,
            beneficiary,
            preparedFill,
            tokenRouterCustody,
            tokenRouterProgram,
            peer,
            recipient,
            recipientTokenAccount,
        } = accounts;

        if (fromChain === undefined && peer === undefined) {
            throw new Error("from_chain or peer must be provided");
        }

        peer = peer ?? this.peerAddress(fromChain!);

        beneficiary ??= payer;
        recipient ??= payer;
        recipientTokenAccount ??= splToken.getAssociatedTokenAddressSync(this.mint, recipient);

        return this.program.methods
            .completeTransferDirect()
            .accountsStrict({
                payer,
                custodian: this.checkedCustodianComposite(),
                beneficiary,
                recipient,
                recipientTokenAccount,
                usdc: this.usdcComposite(this.mint),
                preparedFill,
                peer,
                tokenRouterCustody,
                tokenRouterProgram,
                tokenProgram: splToken.TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .instruction();
    }
}

export function localnet(): ProgramId {
    return "AQFz751pSuxMX6PFWx9uruoVSZ3qay2Zi33MJ4NmUF2m";
}
