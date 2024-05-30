// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import "wormhole-sdk/proxy/Proxy.sol";
import {SwapLayer} from "swap-layer/SwapLayer.sol";
import { TokenRouter } from "liquidity-layer/TokenRouter/TokenRouter.sol";

import { ERC1967Proxy } from "@openzeppelin/proxy/ERC1967/ERC1967Proxy.sol";

contract DeploySwapLayerForTest is Script {
    address permit2Contract = vm.envAddress("RELEASE_PERMIT_2");
    address wnative = vm.envAddress("RELEASE_WETH");
    address uniswapRouterAddress = vm.envAddress("RELEASE_UNIVERSAL_ROUTER");
    address usdc = vm.envAddress("RELEASE_USDC");
    address wormhole = vm.envAddress("RELEASE_WORMHOLE");
    address cctpTokenMessenger = vm.envAddress("RELEASE_TOKEN_MESSENGER");

    // This address should be added to the localnet env files if Avalanche
    // is ever used in the integration test.
    address traderJoeRouterAddress = address(0);

    // Anvil pubkeys. Associated private keys:
    // - 0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d
    // - 0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1
    // - 0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c
    address assistant = 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1;
    address feeUpdater = 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0;
    address feeRecipient = 0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b;

    // Predetermined values for the matching engine.
    uint16 matchingEngineChain = 1;
    uint32 matchingEngineDomain = 5;
    bytes32 matchingEngineAddress =
        bytes32(uint256(uint160(address(makeAddr("engine")))));
    bytes32 matchingEngineMintRecipient =
        bytes32(uint256(uint160(address(makeAddr("mintRecipient")))));

    function deployTokenRouter() public returns (address) {
        TokenRouter implementation = new TokenRouter(
            usdc,
            wormhole,
            cctpTokenMessenger,
            matchingEngineChain,
            matchingEngineAddress,
            matchingEngineMintRecipient,
            matchingEngineDomain
        );

        TokenRouter proxy =
            TokenRouter(address(new ERC1967Proxy(address(implementation), "")));

        proxy.initialize(abi.encodePacked(assistant));

        return address(proxy);
    }

    function deploy(address tokenRouter) public {
        address swapLayerAddress = address(
            new Proxy(
                address(
                    new SwapLayer(
                        tokenRouter,
                        permit2Contract,
                        wnative,
                        uniswapRouterAddress,
                        traderJoeRouterAddress
                    )
                ),
                abi.encodePacked(
                    msg.sender,
                    assistant,
                    feeUpdater,
                    feeRecipient
                )
            )
        );

        console.log("SwapLayer deployed at: ", swapLayerAddress);
    }

    function run() public {
        vm.startBroadcast();
        deploy(deployTokenRouter());
        vm.stopBroadcast();
    }
}
