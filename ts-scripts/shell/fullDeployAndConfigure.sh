npx tsx ./ts-scripts/config/checkNetworks.ts \
  && npx tsx ./ts-scripts/swapLayer/deploySwapLayer.ts \
  && npx tsx ./ts-scripts/swapLayer/configureSwapLayer.ts \
  && npx tsx ./ts-scripts/swapLayer/updateSwapLayerFees.ts \
  && npx tsx ./ts-scripts/swapLayer/testSend.ts \