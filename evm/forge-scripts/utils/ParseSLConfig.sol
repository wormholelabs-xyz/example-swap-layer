// SPDX-License-Identifier: Apache 2
pragma solidity >=0.8.8 <0.9.0;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {ISwapLayer} from "swap-layer/ISwapLayer.sol";

contract ParseSwapLayerConfig is Script {
    using stdJson for string;

    // NOTE: Forge expects any struct to be defined in alphabetical order if being used
    // to parse JSON.
    struct DeploymentConfig {
        address assistant;
        uint16 chainId;
        uint32 circleDomain;
        address circleMessageTransmitter;
        address feeRecipient;
        address feeUpdater;
        address liquidityLayer;
        address permit2;
        address traderJoeRouter;
        address universalRouter;
        address weth;
        address wormhole;
    }

    function _parseAndValidateDeploymentConfig(
        uint16 wormholeChainId
    )
        internal
        returns (
            DeploymentConfig memory config
        )
    {
        require(wormholeChainId > 0, "Invalid chain id");

        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/cfg/evm.deployment.json");
        string memory json = vm.readFile(path);
        bytes memory deployments = json.parseRaw(".deployment");

        // Decode the json into ChainConfig array.
        DeploymentConfig[] memory config = abi.decode(deployments, (DeploymentConfig[]));

        // Validate values and find the specified chain's configuration.
        for (uint256 i = 0; i < config.length; i++) {
            DeploymentConfig memory targetConfig = config[i];

            if (targetConfig.chainId == wormholeChainId) {
                require(targetConfig.circleMessageTransmitter != address(0), "Invalid circleMessageTransmitter");
                require(targetConfig.liquidityLayer != address(0), "Invalid liquidityLayer");
                require(targetConfig.weth != address(0), "Invalid weth");
                require(targetConfig.wormhole != address(0), "Invalid wormhole");
                require(targetConfig.assistant != address(0), "Invalid assistant");
                require(targetConfig.feeRecipient != address(0), "Invalid feeRecipient");
                require(targetConfig.feeUpdater != address(0), "Invalid feeUpdater");

                return config[i];
            }
        }

        revert("Chain configuration not found");
    }
}