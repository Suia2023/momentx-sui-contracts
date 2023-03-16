module momentx::coffee_nft {
    use std::string::{String, utf8};
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::vec_set::{Self, VecSet};
    use std::option::{Self, Option, none, some};
    use sui::transfer::{Self, transfer};
    use std::vector;
    use sui::table::{Self, Table};

    // errors
    const ENOT_AUTHORIZED: u64 = 0;
    const EMERCHANT_ALREADY_EXISTS: u64 = 1;
    const EMERCHANT_NOT_EXISTS: u64 = 2;
    const EUSER_DOES_NOT_HAVE_NFT: u64 = 3;
    const EMERCHANT_NOT_AUTHORIZED: u64 = 4;
    const EMERCHANT_NOT_MATCH: u64 = 5;

    struct Global has key, store {
        id: UID,
        admin: address,
        merchants: VecSet<address>,
        nfts: Table<ID, bool>, // keep track of all nfts
        url_init: String,
        url_redeemed: String,
    }

    struct CoffeeNFT has key, store {
        id: UID,
        name: String,
        description: String,
        url: String,
        owner: address,
        redeemed: bool,
        merchant: Option<address>,
    }

    fun init(ctx: &mut TxContext) {
        create_global(ctx)
    }

    fun create_global(
        ctx: &mut TxContext,
    ) {
        let global = Global {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            merchants: vec_set::empty(),
            url_init: utf8(vector::empty()),
            url_redeemed: utf8(vector::empty()),
            nfts: table::new(ctx),
        };
        transfer::share_object(global)
    }

    public entry fun set_urls(
        global: &mut Global,
        url_init: vector<u8>,
        url_redeemed: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == global.admin, ENOT_AUTHORIZED);
        global.url_init = utf8(url_init);
        global.url_redeemed = utf8(url_redeemed);
    }

    public entry fun add_merchant(
        global: &mut Global,
        merchant: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == global.admin, ENOT_AUTHORIZED);
        assert!(!vec_set::contains(&global.merchants, &merchant), EMERCHANT_ALREADY_EXISTS);
        vec_set::insert(&mut global.merchants, merchant);
    }

    public entry fun remove_merchant(
        global: &mut Global,
        merchant: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == global.admin, ENOT_AUTHORIZED);
        assert!(vec_set::contains(&global.merchants, &merchant), EMERCHANT_NOT_EXISTS);
        vec_set::remove(&mut global.merchants, &merchant);
    }

    public entry fun airdrop(
        global: &mut Global,
        to: address,
        name: vector<u8>,
        description: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == global.admin, ENOT_AUTHORIZED);
        let nft = CoffeeNFT {
            id: object::new(ctx),
            name: utf8(name),
            description: utf8(description),
            url: global.url_init,
            owner: to,
            redeemed: false,
            merchant: none(),
        };
        table::add(&mut global.nfts, object::id(&nft), true);
        transfer(nft, to)
    }

    public entry fun redeem_request(
        global: &Global,
        nft: CoffeeNFT,
        merchant: address,
        _ctx: &mut TxContext,
    ) {
        assert!(vec_set::contains(&global.merchants, &merchant), EMERCHANT_NOT_AUTHORIZED);
        nft.merchant = some(merchant);
        transfer(nft, merchant)
    }

    public entry fun redeem_confirm(
        global: &Global,
        nft: CoffeeNFT,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(&sender == option::borrow(&nft.merchant), EMERCHANT_NOT_MATCH);
        nft.redeemed = true;
        nft.url = global.url_redeemed;
        let owner = nft.owner;
        transfer(nft, owner)
    }
}
