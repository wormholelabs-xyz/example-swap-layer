#/bin/bash

ROOT=$(dirname $0)

# start anvil in the evm directory
bash $ROOT/../..evm/test/script/start_anvil.sh

echo "Anvil started successfully."

#pkill anvil
