import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
    verbose: true,
    testTimeout: 10000000,
    testMatch: ["**/tests/*.test.ts"],
    preset: "ts-jest",
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.anchor-test.json" }],
        "../lib/example-liquidity-layer/.+\\.tsx?$": [
            "ts-jest",
            { tsconfig: "../lib/example-liquidity-layer/tsconfig.json" },
        ],
    },
};

export default jestConfig;
