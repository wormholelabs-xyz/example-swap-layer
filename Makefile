
.PHONY: clean-fast-transfer
fast-transfer-clean:
	cd lib/example-liquidity-layer/solana && $(MAKE) clean

fast-transfer-setup:
	git submodule sync --recursive
	cd lib/example-liquidity-layer/solana && $(MAKE) anchor-test-setup