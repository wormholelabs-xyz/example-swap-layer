import { registerPayloadTypes } from "@wormhole-foundation/sdk";
import { nttNamedPayloads } from "./layouts/index.js";

registerPayloadTypes("FastTransfers", nttNamedPayloads);

export * from "./fastTransfers.js";

export * from "./layouts/index.js";
export type * from "./layouts/index.js";

