module momentx::coffee_nft {
    use std::string::{String, utf8};
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::vec_set::{Self, VecSet};
    use sui::transfer;
    use sui::object_table::{Self, ObjectTable};

    // errors
    const ENOT_AUTHORIZED: u64 = 0;
    const EMERCHANT_ALREADY_EXISTS: u64 = 1;
    const EMERCHANT_NOT_EXISTS: u64 = 2;
    const EUSER_DOES_NOT_HAVE_NFT: u64 = 3;

    struct Global has key, store {
        id: UID,
        CoffeeNFTs: ObjectTable<address, CoffeeNFT>,
        admin: address,
        merchants: VecSet<address>,
    }

    struct CoffeeNFT has key, store {
        id: UID,
        name: String,
        description: String,
        url: String,
        owner: address,
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
            CoffeeNFTs: object_table::new(ctx),
            admin: tx_context::sender(ctx),
            merchants: vec_set::empty(),
        };
        transfer::share_object(global)
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
        url: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == global.admin, ENOT_AUTHORIZED);
        let nft = CoffeeNFT {
            id: object::new(ctx),
            name: utf8(name),
            description: utf8(description),
            url: utf8(url),
            owner: to,
            redeemed: false,
        };
        object_table::add(&mut global.CoffeeNFTs, to, nft);
    }

    public entry fun redeem(
        global: &mut Global,
        user: address,
        url: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(vec_set::contains(&global.merchants, &sender), ENOT_AUTHORIZED);
        assert!(object_table::contains(&global.CoffeeNFTs, user), EUSER_DOES_NOT_HAVE_NFT);
        let nft = object_table::borrow_mut(&mut global.CoffeeNFTs, user);
        nft.redeemed = true;
        nft.url = utf8(url);
    }
}
