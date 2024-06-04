import { OrderResponse } from "../../../lib/example-liquidity-layer/evm/ts/src";
import { ethers } from "ethers";

export function encodeOrderResponse(orderResponse: OrderResponse) {
    // Use ethers AbiCoder to encode the OrderResponse
    const abiCoder = new ethers.utils.AbiCoder();
    const encodedOrderResponse = abiCoder.encode(
        ["tuple(bytes, bytes, bytes)"],
        [
            [
                orderResponse.encodedWormholeMessage,
                orderResponse.circleBridgeMessage,
                orderResponse.circleAttestation,
            ],
        ],
    );
    return encodedOrderResponse;
}
