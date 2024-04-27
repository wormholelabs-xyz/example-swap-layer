export type SwapLayer = {
  "version": "0.0.0",
  "name": "swap_layer",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "Owner of the program, who presumably deployed this program."
          ]
        },
        {
          "name": "custodian",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Sender Config account, which saves program data useful for other",
            "instructions, specifically for outbound transfers. Also saves the payer",
            "of the [`initialize`](crate::initialize) instruction as the program's",
            "owner."
          ]
        },
        {
          "name": "ownerAssistant",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "feeRecipient",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "feeRecipientToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "feeUpdater",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdc",
          "accounts": [
            {
              "name": "mint",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "We use the program data to make sure this owner is the upgrade authority (the true owner,",
            "who deployed this program)."
          ]
        }
      ],
      "args": []
    },
    {
      "name": "addPeer",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "admin",
          "accounts": [
            {
              "name": "ownerOrAssistant",
              "isMut": false,
              "isSigner": true
            },
            {
              "name": "custodian",
              "accounts": [
                {
                  "name": "custodian",
                  "isMut": false,
                  "isSigner": false
                }
              ]
            }
          ]
        },
        {
          "name": "peer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": "AddPeerArgs"
          }
        }
      ]
    },
    {
      "name": "completeTransferRelay",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "The payer of the transaction. This could either be the recipient or a relayer."
          ]
        },
        {
          "name": "custodian",
          "accounts": [
            {
              "name": "custodian",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "beneficiary",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "completeTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "recipientTokenAccount",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Recipient associated token account. The recipient authority check",
            "is necessary to ensure that the recipient is the intended recipient",
            "of the bridged tokens. Mutable."
          ]
        },
        {
          "name": "recipient",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "transaction. This instruction verifies that the recipient key",
            "passed in this context matches the intended recipient in the fill."
          ]
        },
        {
          "name": "feeRecipientToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdc",
          "accounts": [
            {
              "name": "mint",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "peer",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "preparedFill",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Prepared fill account."
          ]
        },
        {
          "name": "tokenRouterCustody",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Custody token account. This account will be closed at the end of this instruction. It just",
            "acts as a conduit to allow this program to be the transfer initiator in the CCTP message.",
            ""
          ]
        },
        {
          "name": "tokenRouterProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "completeTransferDirect",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "custodian",
          "accounts": [
            {
              "name": "custodian",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "beneficiary",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "recipient",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "recipient token account must be encoded in the prepared fill."
          ]
        },
        {
          "name": "recipientTokenAccount",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Recipient associated token account. The recipient authority check",
            "is necessary to ensure that the recipient is the intended recipient",
            "of the bridged tokens. Mutable."
          ]
        },
        {
          "name": "usdc",
          "accounts": [
            {
              "name": "mint",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "peer",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "preparedFill",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Prepared fill account."
          ]
        },
        {
          "name": "tokenRouterCustody",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Custody token account. This account will be closed at the end of this instruction. It just",
            "acts as a conduit to allow this program to be the transfer initiator in the CCTP message.",
            ""
          ]
        },
        {
          "name": "tokenRouterProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "completeSwap",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "custodian",
          "accounts": [
            {
              "name": "custodian",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "beneficiary",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "completeToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "peer",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "preparedFill",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Prepared fill account."
          ]
        },
        {
          "name": "tokenRouterCustody",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Custody token account. This account will be closed at the end of this instruction. It just",
            "acts as a conduit to allow this program to be the transfer initiator in the CCTP message.",
            ""
          ]
        },
        {
          "name": "usdc",
          "accounts": [
            {
              "name": "mint",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "tokenRouterProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "ixData",
          "type": "bytes"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "custodian",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Program's owner."
            ],
            "type": "publicKey"
          },
          {
            "name": "pendingOwner",
            "type": {
              "option": "publicKey"
            }
          },
          {
            "name": "ownerAssistant",
            "docs": [
              "Program's assistant. Can be used to update the relayer fee and swap rate."
            ],
            "type": "publicKey"
          },
          {
            "name": "feeUpdater",
            "docs": [
              "Program's fee updater. Can be used to update fee parameters and the like."
            ],
            "type": "publicKey"
          },
          {
            "name": "feeRecipientToken",
            "docs": [
              "Program's fee recipient. Receives relayer fees in USDC."
            ],
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "peer",
      "docs": [
        "Foreign emitter account data."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "chain",
            "docs": [
              "Peer chain. Cannot equal `1` (Solana's Chain ID)."
            ],
            "type": "u16"
          },
          {
            "name": "address",
            "docs": [
              "Peer address. Cannot be zero address."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "relayParams",
            "docs": [
              "Relay parameters."
            ],
            "type": {
              "defined": "RelayParams"
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "AddPeerArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "chain",
            "type": "u16"
          },
          {
            "name": "address",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "executionParams",
            "type": {
              "defined": "ExecutionParams"
            }
          },
          {
            "name": "baseFee",
            "type": "u32"
          },
          {
            "name": "maxGasDropoff",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "RelayParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lastUpdate",
            "type": "u32"
          },
          {
            "name": "baseFee",
            "type": "u32"
          },
          {
            "name": "maxGasDropoff",
            "type": "u64"
          },
          {
            "name": "executionParams",
            "type": {
              "defined": "ExecutionParams"
            }
          }
        ]
      }
    },
    {
      "name": "SharedAccountsRouteArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authorityId",
            "type": "u8"
          },
          {
            "name": "routePlan",
            "type": {
              "vec": {
                "defined": "RoutePlanStep"
              }
            }
          },
          {
            "name": "inAmount",
            "type": "u64"
          },
          {
            "name": "quotedOutAmount",
            "type": "u64"
          },
          {
            "name": "slippageBps",
            "type": "u16"
          },
          {
            "name": "platformFeeBps",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "RoutePlanStep",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swap",
            "type": {
              "defined": "Swap"
            }
          },
          {
            "name": "percent",
            "type": "u8"
          },
          {
            "name": "inputIndex",
            "type": "u8"
          },
          {
            "name": "outputIndex",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ExecutionParams",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "None"
          },
          {
            "name": "Evm",
            "fields": [
              {
                "name": "gasPrice",
                "type": "u32"
              },
              {
                "name": "gasTokenPrice",
                "type": "u64"
              },
              {
                "name": "updateThreshold",
                "type": "u32"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "Swap",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Saber"
          },
          {
            "name": "SaberAddDecimalsDeposit"
          },
          {
            "name": "SaberAddDecimalsWithdraw"
          },
          {
            "name": "TokenSwap"
          },
          {
            "name": "Sencha"
          },
          {
            "name": "Step"
          },
          {
            "name": "Cropper"
          },
          {
            "name": "Raydium"
          },
          {
            "name": "Crema",
            "fields": [
              {
                "name": "aToB",
                "type": "bool"
              }
            ]
          },
          {
            "name": "Lifinity"
          },
          {
            "name": "Mercurial"
          },
          {
            "name": "Cykura"
          },
          {
            "name": "Serum",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "MarinadeDeposit"
          },
          {
            "name": "MarinadeUnstake"
          },
          {
            "name": "Aldrin",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "AldrinV2",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "Whirlpool",
            "fields": [
              {
                "name": "aToB",
                "type": "bool"
              }
            ]
          },
          {
            "name": "Invariant",
            "fields": [
              {
                "name": "xToY",
                "type": "bool"
              }
            ]
          },
          {
            "name": "Meteora"
          },
          {
            "name": "GooseFX"
          },
          {
            "name": "DeltaFi",
            "fields": [
              {
                "name": "stable",
                "type": "bool"
              }
            ]
          },
          {
            "name": "Balansol"
          },
          {
            "name": "MarcoPolo",
            "fields": [
              {
                "name": "xToY",
                "type": "bool"
              }
            ]
          },
          {
            "name": "Dradex",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "LifinityV2"
          },
          {
            "name": "RaydiumClmm"
          },
          {
            "name": "Openbook",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "Phoenix",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "Symmetry",
            "fields": [
              {
                "name": "fromTokenId",
                "type": "u64"
              },
              {
                "name": "toTokenId",
                "type": "u64"
              }
            ]
          },
          {
            "name": "TokenSwapV2"
          },
          {
            "name": "HeliumTreasuryManagementRedeemV0"
          },
          {
            "name": "StakeDexStakeWrappedSol"
          },
          {
            "name": "StakeDexSwapViaStake",
            "fields": [
              {
                "name": "bridgeStakeSeed",
                "type": "u32"
              }
            ]
          },
          {
            "name": "GooseFXV2"
          },
          {
            "name": "Perps"
          },
          {
            "name": "PerpsAddLiquidity"
          },
          {
            "name": "PerpsRemoveLiquidity"
          },
          {
            "name": "MeteoraDlmm"
          },
          {
            "name": "OpenbookV2",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "RaydiumClmmV2"
          },
          {
            "name": "StakeDexPrefundWithdrawStakeAndDepositStake",
            "fields": [
              {
                "name": "bridgeStakeSeed",
                "type": "u32"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "Side",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Bid"
          },
          {
            "name": "Ask"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "DummyError"
    },
    {
      "code": 6256,
      "name": "AssistantZeroPubkey"
    },
    {
      "code": 6257,
      "name": "FeeRecipientZeroPubkey"
    },
    {
      "code": 6258,
      "name": "FeeUpdaterZeroPubkey"
    },
    {
      "code": 6259,
      "name": "InvalidRedeemMode"
    },
    {
      "code": 6260,
      "name": "InvalidOutputToken"
    },
    {
      "code": 6261,
      "name": "InvalidRelayerFee"
    },
    {
      "code": 6262,
      "name": "InvalidSwapMessage"
    },
    {
      "code": 6263,
      "name": "InvalidRecipient"
    },
    {
      "code": 6264,
      "name": "OwnerOrAssistantOnly"
    },
    {
      "code": 6265,
      "name": "ChainNotAllowed"
    },
    {
      "code": 6266,
      "name": "InvalidPeer"
    },
    {
      "code": 6512,
      "name": "InvalidGasPrice"
    },
    {
      "code": 6513,
      "name": "InvalidGasTokenPrice"
    },
    {
      "code": 6514,
      "name": "InvalidUpdateThreshold"
    },
    {
      "code": 6768,
      "name": "InvalidJupiterV6AuthorityId",
      "msg": "Jupiter V6 Authority ID must be >= 0 and < 8"
    },
    {
      "code": 6770,
      "name": "SameMint"
    }
  ]
};

export const IDL: SwapLayer = {
  "version": "0.0.0",
  "name": "swap_layer",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "Owner of the program, who presumably deployed this program."
          ]
        },
        {
          "name": "custodian",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Sender Config account, which saves program data useful for other",
            "instructions, specifically for outbound transfers. Also saves the payer",
            "of the [`initialize`](crate::initialize) instruction as the program's",
            "owner."
          ]
        },
        {
          "name": "ownerAssistant",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "feeRecipient",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "feeRecipientToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "feeUpdater",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdc",
          "accounts": [
            {
              "name": "mint",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "We use the program data to make sure this owner is the upgrade authority (the true owner,",
            "who deployed this program)."
          ]
        }
      ],
      "args": []
    },
    {
      "name": "addPeer",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "admin",
          "accounts": [
            {
              "name": "ownerOrAssistant",
              "isMut": false,
              "isSigner": true
            },
            {
              "name": "custodian",
              "accounts": [
                {
                  "name": "custodian",
                  "isMut": false,
                  "isSigner": false
                }
              ]
            }
          ]
        },
        {
          "name": "peer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": "AddPeerArgs"
          }
        }
      ]
    },
    {
      "name": "completeTransferRelay",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "The payer of the transaction. This could either be the recipient or a relayer."
          ]
        },
        {
          "name": "custodian",
          "accounts": [
            {
              "name": "custodian",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "beneficiary",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "completeTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "recipientTokenAccount",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Recipient associated token account. The recipient authority check",
            "is necessary to ensure that the recipient is the intended recipient",
            "of the bridged tokens. Mutable."
          ]
        },
        {
          "name": "recipient",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "transaction. This instruction verifies that the recipient key",
            "passed in this context matches the intended recipient in the fill."
          ]
        },
        {
          "name": "feeRecipientToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdc",
          "accounts": [
            {
              "name": "mint",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "peer",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "preparedFill",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Prepared fill account."
          ]
        },
        {
          "name": "tokenRouterCustody",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Custody token account. This account will be closed at the end of this instruction. It just",
            "acts as a conduit to allow this program to be the transfer initiator in the CCTP message.",
            ""
          ]
        },
        {
          "name": "tokenRouterProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "completeTransferDirect",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "custodian",
          "accounts": [
            {
              "name": "custodian",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "beneficiary",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "recipient",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "recipient token account must be encoded in the prepared fill."
          ]
        },
        {
          "name": "recipientTokenAccount",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Recipient associated token account. The recipient authority check",
            "is necessary to ensure that the recipient is the intended recipient",
            "of the bridged tokens. Mutable."
          ]
        },
        {
          "name": "usdc",
          "accounts": [
            {
              "name": "mint",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "peer",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "preparedFill",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Prepared fill account."
          ]
        },
        {
          "name": "tokenRouterCustody",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Custody token account. This account will be closed at the end of this instruction. It just",
            "acts as a conduit to allow this program to be the transfer initiator in the CCTP message.",
            ""
          ]
        },
        {
          "name": "tokenRouterProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "completeSwap",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "custodian",
          "accounts": [
            {
              "name": "custodian",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "beneficiary",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "completeToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "peer",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "preparedFill",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Prepared fill account."
          ]
        },
        {
          "name": "tokenRouterCustody",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Custody token account. This account will be closed at the end of this instruction. It just",
            "acts as a conduit to allow this program to be the transfer initiator in the CCTP message.",
            ""
          ]
        },
        {
          "name": "usdc",
          "accounts": [
            {
              "name": "mint",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "tokenRouterProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "ixData",
          "type": "bytes"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "custodian",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Program's owner."
            ],
            "type": "publicKey"
          },
          {
            "name": "pendingOwner",
            "type": {
              "option": "publicKey"
            }
          },
          {
            "name": "ownerAssistant",
            "docs": [
              "Program's assistant. Can be used to update the relayer fee and swap rate."
            ],
            "type": "publicKey"
          },
          {
            "name": "feeUpdater",
            "docs": [
              "Program's fee updater. Can be used to update fee parameters and the like."
            ],
            "type": "publicKey"
          },
          {
            "name": "feeRecipientToken",
            "docs": [
              "Program's fee recipient. Receives relayer fees in USDC."
            ],
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "peer",
      "docs": [
        "Foreign emitter account data."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "chain",
            "docs": [
              "Peer chain. Cannot equal `1` (Solana's Chain ID)."
            ],
            "type": "u16"
          },
          {
            "name": "address",
            "docs": [
              "Peer address. Cannot be zero address."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "relayParams",
            "docs": [
              "Relay parameters."
            ],
            "type": {
              "defined": "RelayParams"
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "AddPeerArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "chain",
            "type": "u16"
          },
          {
            "name": "address",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "executionParams",
            "type": {
              "defined": "ExecutionParams"
            }
          },
          {
            "name": "baseFee",
            "type": "u32"
          },
          {
            "name": "maxGasDropoff",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "RelayParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lastUpdate",
            "type": "u32"
          },
          {
            "name": "baseFee",
            "type": "u32"
          },
          {
            "name": "maxGasDropoff",
            "type": "u64"
          },
          {
            "name": "executionParams",
            "type": {
              "defined": "ExecutionParams"
            }
          }
        ]
      }
    },
    {
      "name": "SharedAccountsRouteArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authorityId",
            "type": "u8"
          },
          {
            "name": "routePlan",
            "type": {
              "vec": {
                "defined": "RoutePlanStep"
              }
            }
          },
          {
            "name": "inAmount",
            "type": "u64"
          },
          {
            "name": "quotedOutAmount",
            "type": "u64"
          },
          {
            "name": "slippageBps",
            "type": "u16"
          },
          {
            "name": "platformFeeBps",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "RoutePlanStep",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "swap",
            "type": {
              "defined": "Swap"
            }
          },
          {
            "name": "percent",
            "type": "u8"
          },
          {
            "name": "inputIndex",
            "type": "u8"
          },
          {
            "name": "outputIndex",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ExecutionParams",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "None"
          },
          {
            "name": "Evm",
            "fields": [
              {
                "name": "gasPrice",
                "type": "u32"
              },
              {
                "name": "gasTokenPrice",
                "type": "u64"
              },
              {
                "name": "updateThreshold",
                "type": "u32"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "Swap",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Saber"
          },
          {
            "name": "SaberAddDecimalsDeposit"
          },
          {
            "name": "SaberAddDecimalsWithdraw"
          },
          {
            "name": "TokenSwap"
          },
          {
            "name": "Sencha"
          },
          {
            "name": "Step"
          },
          {
            "name": "Cropper"
          },
          {
            "name": "Raydium"
          },
          {
            "name": "Crema",
            "fields": [
              {
                "name": "aToB",
                "type": "bool"
              }
            ]
          },
          {
            "name": "Lifinity"
          },
          {
            "name": "Mercurial"
          },
          {
            "name": "Cykura"
          },
          {
            "name": "Serum",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "MarinadeDeposit"
          },
          {
            "name": "MarinadeUnstake"
          },
          {
            "name": "Aldrin",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "AldrinV2",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "Whirlpool",
            "fields": [
              {
                "name": "aToB",
                "type": "bool"
              }
            ]
          },
          {
            "name": "Invariant",
            "fields": [
              {
                "name": "xToY",
                "type": "bool"
              }
            ]
          },
          {
            "name": "Meteora"
          },
          {
            "name": "GooseFX"
          },
          {
            "name": "DeltaFi",
            "fields": [
              {
                "name": "stable",
                "type": "bool"
              }
            ]
          },
          {
            "name": "Balansol"
          },
          {
            "name": "MarcoPolo",
            "fields": [
              {
                "name": "xToY",
                "type": "bool"
              }
            ]
          },
          {
            "name": "Dradex",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "LifinityV2"
          },
          {
            "name": "RaydiumClmm"
          },
          {
            "name": "Openbook",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "Phoenix",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "Symmetry",
            "fields": [
              {
                "name": "fromTokenId",
                "type": "u64"
              },
              {
                "name": "toTokenId",
                "type": "u64"
              }
            ]
          },
          {
            "name": "TokenSwapV2"
          },
          {
            "name": "HeliumTreasuryManagementRedeemV0"
          },
          {
            "name": "StakeDexStakeWrappedSol"
          },
          {
            "name": "StakeDexSwapViaStake",
            "fields": [
              {
                "name": "bridgeStakeSeed",
                "type": "u32"
              }
            ]
          },
          {
            "name": "GooseFXV2"
          },
          {
            "name": "Perps"
          },
          {
            "name": "PerpsAddLiquidity"
          },
          {
            "name": "PerpsRemoveLiquidity"
          },
          {
            "name": "MeteoraDlmm"
          },
          {
            "name": "OpenbookV2",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": "Side"
                }
              }
            ]
          },
          {
            "name": "RaydiumClmmV2"
          },
          {
            "name": "StakeDexPrefundWithdrawStakeAndDepositStake",
            "fields": [
              {
                "name": "bridgeStakeSeed",
                "type": "u32"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "Side",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Bid"
          },
          {
            "name": "Ask"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "DummyError"
    },
    {
      "code": 6256,
      "name": "AssistantZeroPubkey"
    },
    {
      "code": 6257,
      "name": "FeeRecipientZeroPubkey"
    },
    {
      "code": 6258,
      "name": "FeeUpdaterZeroPubkey"
    },
    {
      "code": 6259,
      "name": "InvalidRedeemMode"
    },
    {
      "code": 6260,
      "name": "InvalidOutputToken"
    },
    {
      "code": 6261,
      "name": "InvalidRelayerFee"
    },
    {
      "code": 6262,
      "name": "InvalidSwapMessage"
    },
    {
      "code": 6263,
      "name": "InvalidRecipient"
    },
    {
      "code": 6264,
      "name": "OwnerOrAssistantOnly"
    },
    {
      "code": 6265,
      "name": "ChainNotAllowed"
    },
    {
      "code": 6266,
      "name": "InvalidPeer"
    },
    {
      "code": 6512,
      "name": "InvalidGasPrice"
    },
    {
      "code": 6513,
      "name": "InvalidGasTokenPrice"
    },
    {
      "code": 6514,
      "name": "InvalidUpdateThreshold"
    },
    {
      "code": 6768,
      "name": "InvalidJupiterV6AuthorityId",
      "msg": "Jupiter V6 Authority ID must be >= 0 and < 8"
    },
    {
      "code": 6770,
      "name": "SameMint"
    }
  ]
};
