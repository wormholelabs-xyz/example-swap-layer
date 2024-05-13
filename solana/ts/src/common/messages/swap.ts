import * as wormholeSdk from "@certusone/wormhole-sdk";
import { ethers } from "ethers";

export const ID_DEPOSIT = 1;

export const ID_DEPOSIT_FILL = 1;
export const ID_DEPOSIT_SLOW_ORDER_RESPONSE = 2;

export class SwapMessage {
    constructor(header: DepositHeader, message: LiquidityLayerDepositMessage) {
        this.header = header;
        this.message = message;
    }
}
