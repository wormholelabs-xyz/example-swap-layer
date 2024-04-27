.PHONY: all
all: check _anchor-build idl

.PHONY: check
check:
	cargo check --workspace --all-targets --all-features

.PHONY: clean
clean:
	anchor clean
	rm -rf artifacts-mainnet artifacts-testnet artifacts-localnet ts/tests/artifacts

node_modules: ../lib/example-liquidity-layer/solana/node_modules
	cd .. && npm ci

.PHONY: clippy
clippy:
	cargo clippy --workspace --no-deps --all-targets --all-features -- -Dwarnings

.PHONY: lint
lint:
	cargo fmt --check
	$(MAKE) clippy

.PHONY: cargo-test
cargo-test:
	cargo test --workspace --all-targets --features $(NETWORK) -- --nocapture


.PHONY: anchor-build
_anchor-build:
	@anchor build --arch sbf -- --features localnet


.PHONY: idl
idl: anchor-build 
	$(eval VERSION=$(shell grep "const VERSION" programs/swap-layer/src/lib.rs | cut -d'"' -f2 | sed 's/\./_/g'))
	@echo "IDL Version: $(VERSION)"
	@ mkdir -p ts/idl/$(VERSION)/json
	@ mkdir -p ts/idl/$(VERSION)/ts
	@ cp -r target/idl/* ts/idl/$(VERSION)/json/
	@ find target/types/ -name "*.ts" ! -name "*.d.ts" -exec cp {} ts/idl/$(VERSION)/ts/ \;

CLONED_PROGRAMS=\
	ts/tests/artifacts/mainnet_core_bridge.so \
	ts/tests/artifacts/mainnet_cctp_token_messenger_minter.so \
	ts/tests/artifacts/mainnet_cctp_message_transmitter.so \
	ts/tests/artifacts/mainnet_jupiter_v6.so \
	ts/tests/artifacts/mainnet_whirlpool.so

.PHONY: integration-test
integration-test: node_modules $(CLONED_PROGRAMS) ../lib/example-liquidity-layer/solana/artifacts-localnet
	anchor test --arch sbf -- --features integration-test 

../lib/example-liquidity-layer/solana/node_modules:
	cd ../lib/example-liquidity-layer/solana && $(MAKE) node_modules

.PHONY: test
test:
	NETWORK=localnet $(MAKE) cargo-test
	NETWORK=testnet $(MAKE) cargo-test

ts/tests/artifacts:
	mkdir ts/tests/artifacts

ts/tests/artifacts/mainnet_core_bridge.so: ts/tests/artifacts
	solana program dump -u m worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth ts/tests/artifacts/mainnet_core_bridge.so

ts/tests/artifacts/mainnet_cctp_token_messenger_minter.so: ts/tests/artifacts
	solana program dump -u m CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3 ts/tests/artifacts/mainnet_cctp_token_messenger_minter.so

ts/tests/artifacts/mainnet_cctp_message_transmitter.so: ts/tests/artifacts
	solana program dump -u m CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd ts/tests/artifacts/mainnet_cctp_message_transmitter.so

ts/tests/artifacts/mainnet_jupiter_v6.so: ts/tests/artifacts
	solana program dump -u m JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 ts/tests/artifacts/mainnet_jupiter_v6.so

ts/tests/artifacts/mainnet_whirlpool.so: ts/tests/artifacts
	solana program dump -u m whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc ts/tests/artifacts/mainnet_whirlpool.so

../lib/example-liquidity-layer/solana/artifacts-localnet:
	cd ../lib/example-liquidity-layer/solana && NETWORK=localnet $(MAKE) build
