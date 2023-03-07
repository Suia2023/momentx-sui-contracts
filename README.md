# MomentX Coffee NFT

## Development Quick Start

```bash
# install sui cli: <https://docs.sui.io/build/install>
# check sui installed
$ sui -V
sui 0.27.0-598f106ef

# install dependencies
$ yarn install

$ cp .env.example .env
# edit .env, replace KEY_PAIR_SEEDs with a random hex string
# you can generate it with command `openssl rand -hex 32`

$ yarn build
yarn run v1.22.19
$ cd packages/momentx && sui move build
INCLUDING DEPENDENCY Sui
INCLUDING DEPENDENCY MoveStdlib
BUILDING MomentX
✨  Done in 0.56s.

$ yarn demo
yarn run v1.22.19
$ ts-node demo/coffee_nft.ts
-----start-----
admin address: 0x8a4662abf9f8b7aa947b174f29a7a8f259e111e5
merchant address: 0x4adcc83fddad1582bb2a2671c2b4583369b3ea39
...

# check the explorer: <https://explorer.devnet.sui.io/addresses/0xbd0629c41d90c3c7918c4dee42829f900bfe2c13>
# replace the address with your own
```
