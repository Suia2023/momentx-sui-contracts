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
  // add merchant
  const { moduleId, globalObjectId } = params;
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
      COFFEE_NFT_IMAGE_URL_INITIAL,
    ],
    gasBudget,
  });
  console.log('airdropTxn', JSON.stringify(airdropTxn));
  // redeem coffee
  const redeemTxn = await merchant.executeMoveCall({
    packageObjectId: moduleId,
    module: 'coffee_nft',
    function: 'redeem',
    typeArguments: [],
    arguments: [
      globalObjectId,
      '0x' + await user.getAddress(),
      COFFEE_NFT_IMAGE_URL_REDEEMED,
    ],
    gasBudget,
  });
  console.log('redeemTxn', JSON.stringify(redeemTxn));
}

async function queries(moduleId: string, globalConfigId: string) {
  const globalObject = await provider.getObject(globalConfigId);
  console.log('globalObject', JSON.stringify(globalObject, null, 2));
  // list all merchants
  const merchants = (globalObject.details as any).data.fields.merchants.fields.contents;
  console.log('merchants', JSON.stringify(merchants, null, 2));
  // list all coffee NFTs
  const coffeeTableId = (globalObject.details as any).data.fields.CoffeeNFTs.fields.id.id;
  let cursor = null;
  while (true) {
    const coffeeNFTs: any = await provider.getDynamicFields(coffeeTableId, cursor);
    console.log('coffeeNFTs', JSON.stringify(coffeeNFTs, null, 2));
    for (const nft of coffeeNFTs.data) {
      const nftObject = await provider.getObject(nft.objectId);
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
  const coffeeNFTByUser = await provider.getDynamicFieldObject(coffeeTableId, userAddr);
  console.log('coffeeNFTByUser', JSON.stringify(coffeeNFTByUser, null, 2));
}

async function main() {
  console.log('-----start-----');
  const adminAddr = await admin.getAddress();
  console.log(`admin address: 0x${adminAddr}`);
  const merchantAddr = await merchant.getAddress();
  console.log(`merchant address: 0x${merchantAddr}`);
  if (connection.faucet) {
    const res = await provider.requestSuiFromFaucet(adminAddr);
    console.log('requestSuiFromFaucet', JSON.stringify(res, null, 2));
    const res2 = await provider.requestSuiFromFaucet(merchantAddr);
    console.log('requestSuiFromFaucet', JSON.stringify(res2, null, 2));
  }

  const publishResult = await publish();
  console.log(`PublishResult: ${JSON.stringify(publishResult, null, 2)}`);
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
