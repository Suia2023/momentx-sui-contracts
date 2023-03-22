module momentx::coffee_nft {
    use std::string::{String, utf8};
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::vec_set::{Self, VecSet};
    use std::option::{Self, Option, none, some};
    use sui::transfer::{Self, transfer};
    use std::vector;
    use sui::table::{Self, Table};
    use sui::vec_map::{Self, VecMap};

    // errors
    const ENOT_AUTHORIZED: u64 = 0;
    const EMERCHANT_ALREADY_EXISTS: u64 = 1;
    const EMERCHANT_NOT_EXISTS: u64 = 2;
    const EUSER_DOES_NOT_HAVE_NFT: u64 = 3;
    const EMERCHANT_NOT_AUTHORIZED: u64 = 4;
    const EMERCHANT_NOT_MATCH: u64 = 5;
    const EMERCHANT_ALREADY_AUTHORIZED: u64 = 6;
    const ENFT_ALREADY_REDEEMED: u64 = 7;
    const ENOT_ENOUGH_STOCK: u64 = 8;

    struct Global has key, store {
        id: UID,
        admin: address,
        merchants: VecSet<address>,
        // stocks of merchants
        stocks: VecMap<address, u64>,
        // keep track of all nfts
        nfts: Table<ID, CoffeeNFTConfig>,
        url_init: String,
        url_redeemed: String,
    }
    struct CoffeeNFTConfig has store {
        merchant_white_list: VecSet<address>,
        merchant_redeemed: Option<address>,
    }

    struct CoffeeNFT has key, store {
        id: UID,
        name: String,
        description: String,
        url: String,
        redeemed: bool,
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
            stocks: vec_map::empty(),
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
            redeemed: false,
        };
        let coffee_nft_config = CoffeeNFTConfig {
            merchant_white_list: vec_set::empty(),
            merchant_redeemed: none(),
        };
        table::add(&mut global.nfts, object::id(&nft), coffee_nft_config);
        transfer(nft, to)
    }

    public entry fun set_stock(
        global: &mut Global,
        stock: u64,
        ctx: &mut TxContext,
    ) {
        let merchant = tx_context::sender(ctx);
        assert!(vec_set::contains(&global.merchants, &merchant), EMERCHANT_NOT_AUTHORIZED);
        if(vec_map::contains(&global.stocks, &merchant)) {
            let stock_now = vec_map::get_mut(&mut global.stocks, &merchant);
            *stock_now = stock;
        } else {
            vec_map::insert(&mut global.stocks, merchant, stock);
        }
    }

    // sent from the merchant, add the user to the white list
    public entry fun redeem_request(
        global: &mut Global,
        nft_id: ID,
        ctx: &mut TxContext,
    ) {
        let merchant = tx_context::sender(ctx);
        assert!(vec_set::contains(&global.merchants, &merchant), EMERCHANT_NOT_AUTHORIZED);
        let nft_config = table::borrow_mut(&mut global.nfts, nft_id);
        assert!(option::is_none(&nft_config.merchant_redeemed), ENFT_ALREADY_REDEEMED);
        assert!(!vec_set::contains(&nft_config.merchant_white_list, &merchant), EMERCHANT_ALREADY_AUTHORIZED);
        vec_set::insert(&mut nft_config.merchant_white_list, merchant);
    }

    public entry fun redeem_confirm(
        global: &mut Global,
        nft: &mut CoffeeNFT,
        merchant: address,
        _ctx: &mut TxContext,
    ) {
        // check if the merchant authorized to redeem
        let nft_config = table::borrow_mut(&mut global.nfts, object::id(nft));
        assert!(vec_set::contains(&nft_config.merchant_white_list, &merchant), EMERCHANT_NOT_AUTHORIZED);
        // check stock
        let stock = vec_map::get_mut(&mut global.stocks, &merchant);
        assert!(*stock > 0, ENOT_ENOUGH_STOCK);

        // redeem
        // update nft config
        nft_config.merchant_redeemed = some(merchant);
        // update stock
        *stock = *stock - 1;
        // update nft
        nft.redeemed = true;
        nft.url = global.url_redeemed;
    }
}
