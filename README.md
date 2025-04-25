# Blockchain wallet tools

I frequently find myself needing to create/fund/drain wallets when testing things in testnet
(especially relevant to load testing). This problem is exacerbated by my working in the
interoperability space where I need to manage wallets across multiple chains.

This repository contains scripts to facilitate multi-chain wallet management:

* Create wallet(s)
* Fund wallet(s) from a given wallet
* Drain wallet(s) funds to a given wallet
* Check balance(s)

## Warnings

* DO NOT use a wallet with mainnet funds when using random tools found online.

## Usage:

```bash
# install
npm run ci

# build
npm run build

# create .env, don't forget to update it with your variables
cp .env.example .env

# create avalanche wallets
npm run create avalanche 5

# fund them (make sure the funder defined in .env has enough AVAX)
npm run fund avalanche 0.001

# check their balances
npm run blances avalanche

# drain them (return unused balance back to the funder)
npm run drain avalanche
```