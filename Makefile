.PHONY: clean
clean:
	$(MAKE) fast-transfer-clean
	rm -rf node_modules

.PHONY: fast-transfer-sync
fast-transfer-sync:
	git submodule update --checkout
	git submodule sync --recursive

.PHONY: fast-transfer-clean
fast-transfer-clean: fast-transfer-sync
	cd lib/example-liquidity-layer/solana && $(MAKE) clean
	cd lib/example-liquidity-layer/evm && $(MAKE) clean

.PHONY: fast-transfer-setup
fast-transfer-setup: fast-transfer-sync
	cd lib/example-liquidity-layer/solana && $(MAKE) anchor-test-setup
	cd lib/example-liquidity-layer/evm && $(MAKE) build

.PHONY: fast-transfer-sdk
fast-transfer-sdk: fast-transfer-setup
	cd lib/example-liquidity-layer \
	&& $(MAKE) build \
	&& npm run build -w solana -w evm \
	&& npm pack -w universal/ts -w solana -w evm

node_modules: fast-transfer-sdk
	npm install -w solana lib/example-liquidity-layer/wormhole-foundation-example-liquidity-layer-*
	npm install -w e2e lib/example-liquidity-layer/wormhole-foundation-example-liquidity-layer-*
	npm ci
