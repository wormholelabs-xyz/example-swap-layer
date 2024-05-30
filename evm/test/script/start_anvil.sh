#/bin/bash

pgrep anvil > /dev/null
if [ $? -eq 0 ]; then
    echo "anvil already running"
    exit 1;
fi

ROOT=$(dirname $0)
ENV=$ROOT/../../env/localnet

. $ENV/Ethereum.env

# Ethereum (CCTP).
anvil --port 8548 \
    -m "myth like bonus scare over problem client lizard pioneer submit female collect" \
    --no-mining \
    --fork-url $RELEASE_RPC > /dev/null &

. $ENV/Base.env

# Base (CCTP).
anvil --port 8549 \
    -m "myth like bonus scare over problem client lizard pioneer submit female collect" \
    --no-mining \
    --fork-url $RELEASE_RPC > /dev/null &


sleep 2

# Double-check number of anvil instances.
if [ "$( pgrep anvil | wc -l )" -ne 2 ]; then
    echo "Not all anvil instances are running. Try again."
    pkill anvil
    exit 1
fi