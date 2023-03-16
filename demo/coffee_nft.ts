import {Connection, Ed25519Keypair, JsonRpcProvider, RawSigner} from '@mysten/sui.js';
import * as fs from 'fs';
require('dotenv').config()

const connection = new Connection({
  fullnode: process.env.SUI_RPC_URL!,
  faucet: process.env.FAUCET_URL,
});
let provider = new JsonRpcProvider(connection);
const adminKey = Ed25519Keypair.fromSecretKey(Uint8Array.from(Buffer.from(process.env.ADMIN_KEY_PAIR_SEED!, 'hex')));
const admin = new RawSigner( adminKey, provider );
const merchantKey = Ed25519Keypair.fromSecretKey(Uint8Array.from(Buffer.from(process.env.MERCHANT_KEY_PAIR_SEED!, 'hex')));
const merchant = new RawSigner( merchantKey, provider );
const userKey = Ed25519Keypair.fromSecretKey(Uint8Array.from(Buffer.from(process.env.USER_KEY_PAIR_SEED!, 'hex')));
const user = new RawSigner( userKey, provider );

const COFFEE_NFT_IMAGE_URL_INITIAL = 'https://coffee-nft/image/url/initial';
const COFFEE_NFT_IMAGE_URL_REDEEMED = 'https://coffee-nft/image/url/redeemed';

const gasBudget = 100000;

interface PublishResult {
  moduleId: string,
  globalObjectId: string,
}

async function publish(): Promise<PublishResult> {
  const compiledModules = [fs.readFileSync('packages/momentx/build/MomentX/bytecode_modules/coffee_nft.mv', {encoding: 'base64'})];
  const publishTxn = await admin.publish({
    compiledModules,
    gasBudget,
  });
  console.log('publishTxn', JSON.stringify(publishTxn, null, 2));
  const newObjectEvent = (publishTxn as any).effects.effects.events.filter((e: any) => e.newObject !== undefined)[0].newObject;
  console.log('newObjectEvent', JSON.stringify(newObjectEvent, null, 2));
  const moduleId = newObjectEvent.packageId;
  const globalObjectId = newObjectEvent.objectId;
  return { moduleId, globalObjectId }
}

async function interact_with_contract(params: PublishResult) {
  const { moduleId, globalObjectId } = params;
  // set urls
  const setUrlTxn = await admin.executeMoveCall({
    packageObjectId: moduleId,
    module: 'coffee_nft',
    function: 'set_urls',
    typeArguments: [],
    arguments: [
      globalObjectId,
      COFFEE_NFT_IMAGE_URL_INITIAL,
      COFFEE_NFT_IMAGE_URL_REDEEMED,
    ],
    gasBudget,
  });
  console.log('setUrlTxn', JSON.stringify(setUrlTxn));
  // add merchant
  const addMerchantTxn = await admin.executeMoveCall({
    packageObjectId: moduleId,
    module: 'coffee_nft',
    function: 'add_merchant',
    typeArguments: [],
    arguments: [
      globalObjectId,
      '0x' + await merchant.getAddress(),
    ],
    gasBudget,
  });
  console.log('addMerchantTxn', JSON.stringify(addMerchantTxn));
  // airdrop coffee
  const airdropTxn = await admin.executeMoveCall({
    packageObjectId: moduleId,
    module: 'coffee_nft',
    function: 'airdrop',
    typeArguments: [],
    arguments: [
      globalObjectId,
      '0x' + await user.getAddress(),
      'coffee',
      'coffee NFT to redeem a cup of coffee',
    ],
    gasBudget,
  });
  console.log('airdropTxn', JSON.stringify(airdropTxn, null, 2));
  const nftObjectId = (airdropTxn as any).effects.effects.events.filter((e: any) => e.newObject?.objectType === `${moduleId}::coffee_nft::CoffeeNFT`)[0].newObject.objectId;
  // redeem coffee request
  const redeemRequestTxn = await user.executeMoveCall({
    packageObjectId: moduleId,
    module: 'coffee_nft',
    function: 'redeem_request',
    typeArguments: [],
    arguments: [
      globalObjectId,
      nftObjectId,
      '0x' + await merchant.getAddress(),
    ],
    gasBudget,
  });
  console.log('redeemRequestTxn', JSON.stringify(redeemRequestTxn));
  // redeem coffee confirm
  const redeemConfirmTxn = await merchant.executeMoveCall({
    packageObjectId: moduleId,
    module: 'coffee_nft',
    function: 'redeem_confirm',
    typeArguments: [],
    arguments: [
      globalObjectId,
      nftObjectId,
    ],
    gasBudget,
  });
  console.log('redeemConfirmTxn', JSON.stringify(redeemConfirmTxn));
}

async function queries(moduleId: string, globalConfigId: string) {
  const globalObject = await provider.getObject(globalConfigId);
  console.log('globalObject', JSON.stringify(globalObject, null, 2));
  // list all merchants
  const merchants = (globalObject.details as any).data.fields.merchants.fields.contents;
  console.log('merchants', JSON.stringify(merchants, null, 2));
  // list all coffee NFTs
  const coffeeTableId = (globalObject.details as any).data.fields.nfts.fields.id.id;
  let cursor = null;
  const hexRegex = /(0x[a-fA-F\d]{40})/;
  while (true) {
    const coffeeNFTs: any = await provider.getDynamicFields(coffeeTableId, cursor);
    console.log('coffeeNFTs', JSON.stringify(coffeeNFTs, null, 2));
    for (const nft of coffeeNFTs.data) {
      console.log(nft.name);
      const objectId = nft.name.match(hexRegex)[1];
      const nftObject = await provider.getObject(objectId);
      console.log('nftObject', JSON.stringify(nftObject, null, 2));
    }
    if (coffeeNFTs.nextCursor === null) {
      break;
    } else {
      cursor = coffeeNFTs.nextCursor;
    }
  }
  // get coffee NFT by user address
  const userAddr = '0x' + await user.getAddress();
  const userObjects = await provider.getObjectsOwnedByAddress(userAddr);
  const coffeeNFTsByUser = userObjects.filter(o => o.type === `${moduleId}::coffee_nft::CoffeeNFT`)
  console.log('coffeeNFTsByUser', JSON.stringify(coffeeNFTsByUser, null, 2));
}

async function main() {
  console.log('-----start-----');
  const adminAddr = await admin.getAddress();
  console.log(`admin address: 0x${adminAddr}`);
  const merchantAddr = await merchant.getAddress();
  console.log(`merchant address: 0x${merchantAddr}`);
  const userAddr = await user.getAddress();
  console.log(`user address: 0x${userAddr}`)
  if (connection.faucet) {
    const res = await provider.requestSuiFromFaucet(adminAddr);
    console.log('requestSuiFromFaucet', JSON.stringify(res, null, 2));
    const res2 = await provider.requestSuiFromFaucet(merchantAddr);
    console.log('requestSuiFromFaucet', JSON.stringify(res2, null, 2));
    const res3 = await provider.requestSuiFromFaucet(userAddr);
    console.log('requestSuiFromFaucet', JSON.stringify(res3, null, 2));
  }

  const publishResult = await publish();
  console.log(`PublishResult: ${JSON.stringify(publishResult, null, 2)}`);
  // const publishResult = {
  //   "moduleId": "0x9f1ab9d663cc99f43ed86ab242dc2b781d68a264",
  //   "globalObjectId": "0xc7f2b9a4dd4fea4d6e6d53b4e48922bd2766686b"
  // }
  await interact_with_contract(publishResult);
  const { moduleId, globalObjectId } = publishResult;
  await queries(moduleId, globalObjectId);
  console.log('-----end-----');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`error: ${error.stack}`);
    process.exit(1);
  });
