#[test_only]
module beeplancer::user_pool_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use beeplancer::user_pool::{Self, UserPool, AgentCapability};

    // Test addresses
    const OWNER: address = @0xA;
    const AGENT: address = @0xB;
    const OTHER: address = @0xC;

    #[test]
    fun test_create_pool() {
        let mut scenario = ts::begin(OWNER);
        
        // Owner creates pool with 1000 SUI
        {
            let ctx = ts::ctx(&mut scenario);
            let initial_coin = coin::mint_for_testing<SUI>(1000, ctx);
            
            user_pool::create_pool<SUI>(
                AGENT,
                initial_coin,
                100,  // Spending limit per tx
                ctx
            );
        };

        // Check pool was created and shared
        ts::next_tx(&mut scenario, OWNER);
        {
            let pool = ts::take_shared<UserPool<SUI>>(&scenario);
            
            assert!(user_pool::get_owner(&pool) == OWNER, 0);
            assert!(user_pool::get_agent(&pool) == AGENT, 1);
            assert!(user_pool::get_balance(&pool) == 1000, 2);
            assert!(user_pool::is_active(&pool), 3);
            
            ts::return_shared(pool);
        };

        // Check agent capability was transferred
        ts::next_tx(&mut scenario, AGENT);
        {
            assert!(ts::has_most_recent_for_address<AgentCapability>(AGENT), 4);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_deposit() {
        let mut scenario = ts::begin(OWNER);
        
        // Create pool
        {
            let ctx = ts::ctx(&mut scenario);
            let initial_coin = coin::mint_for_testing<SUI>(1000, ctx);
            user_pool::create_pool<SUI>(AGENT, initial_coin, 100, ctx);
        };

        // Owner deposits more
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut pool = ts::take_shared<UserPool<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let deposit = coin::mint_for_testing<SUI>(500, ctx);
            
            user_pool::deposit(&mut pool, deposit, ctx);
            
            assert!(user_pool::get_balance(&pool) == 1500, 0);
            assert!(user_pool::get_total_deposited(&pool) == 1500, 1);
            
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_agent_spend() {
        let mut scenario = ts::begin(OWNER);
        
        // Create pool
        {
            let ctx = ts::ctx(&mut scenario);
            let initial_coin = coin::mint_for_testing<SUI>(1000, ctx);
            user_pool::create_pool<SUI>(AGENT, initial_coin, 100, ctx);
        };

        // Agent spends from pool
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut pool = ts::take_shared<UserPool<SUI>>(&scenario);
            let cap = ts::take_from_address<AgentCapability>(&scenario, AGENT);
            let ctx = ts::ctx(&mut scenario);
            
            let spent_coin = user_pool::agent_spend(
                &mut pool,
                &cap,
                50,
                b"Job payment",
                ctx
            );
            
            assert!(coin::value(&spent_coin) == 50, 0);
            assert!(user_pool::get_balance(&pool) == 950, 1);
            assert!(user_pool::get_total_spent(&pool) == 50, 2);
            
            coin::burn_for_testing(spent_coin);
            ts::return_to_address(AGENT, cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_withdraw() {
        let mut scenario = ts::begin(OWNER);
        
        // Create pool
        {
            let ctx = ts::ctx(&mut scenario);
            let initial_coin = coin::mint_for_testing<SUI>(1000, ctx);
            user_pool::create_pool<SUI>(AGENT, initial_coin, 100, ctx);
        };

        // Owner withdraws
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut pool = ts::take_shared<UserPool<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            user_pool::withdraw(&mut pool, 200, ctx);
            
            assert!(user_pool::get_balance(&pool) == 800, 0);
            
            ts::return_shared(pool);
        };

        // Check owner received coin
        ts::next_tx(&mut scenario, OWNER);
        {
            assert!(ts::has_most_recent_for_address<Coin<SUI>>(OWNER), 1);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = user_pool::EUnauthorized)]
    fun test_unauthorized_withdraw() {
        let mut scenario = ts::begin(OWNER);
        
        // Create pool
        {
            let ctx = ts::ctx(&mut scenario);
            let initial_coin = coin::mint_for_testing<SUI>(1000, ctx);
            user_pool::create_pool<SUI>(AGENT, initial_coin, 100, ctx);
        };

        // Non-owner tries to withdraw (should fail)
        ts::next_tx(&mut scenario, OTHER);
        {
            let mut pool = ts::take_shared<UserPool<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            user_pool::withdraw(&mut pool, 200, ctx);
            
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = user_pool::EInsufficientBalance)]
    fun test_overspend() {
        let mut scenario = ts::begin(OWNER);
        
        // Create pool with spending limit 100
        {
            let ctx = ts::ctx(&mut scenario);
            let initial_coin = coin::mint_for_testing<SUI>(1000, ctx);
            user_pool::create_pool<SUI>(AGENT, initial_coin, 100, ctx);
        };

        // Agent tries to spend beyond limit (should fail)
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut pool = ts::take_shared<UserPool<SUI>>(&scenario);
            let cap = ts::take_from_address<AgentCapability>(&scenario, AGENT);
            let ctx = ts::ctx(&mut scenario);
            
            let spent_coin = user_pool::agent_spend(
                &mut pool,
                &cap,
                200,  // Over limit!
                b"Big payment",
                ctx
            );
            
            coin::burn_for_testing(spent_coin);
            ts::return_to_address(AGENT, cap);
            ts::return_shared(pool);
        };

        ts::end(scenario);
    }
}
