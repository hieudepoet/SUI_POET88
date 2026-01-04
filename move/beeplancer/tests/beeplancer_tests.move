#[test_only]
module beeplancer::escrow_tests;

use beeplancer::escrow::{Self, LockedPayment, AdminCap};
use sui::test_scenario::{Self, Scenario};
use sui::coin::{Self, Coin};
use sui::sui::SUI;

// =============================================================================
// Constants
// =============================================================================

const ADMIN: address = @0xAD;
const BUYER: address = @0xB;
const AGENT: address = @0xA;
const FAKE_USER: address = @0xF;

const JOB_ID: vector<u8> = b"JOB_123";
const ESCROW_AMOUNT: u64 = 1000;

// =============================================================================
// Helpers
// =============================================================================

fun init_test_scenario(): Scenario {
    let mut scenario = test_scenario::begin(ADMIN);
    
    // Run module init
    escrow::init_for_testing(test_scenario::ctx(&mut scenario));
    
    scenario
}

fun mint_coin(amount: u64, ctx: &mut TxContext): Coin<SUI> {
    coin::mint_for_testing<SUI>(amount, ctx)
}

// =============================================================================
// Test Cases
// =============================================================================

#[test]
fun test_create_escrow_success() {
    let mut scenario = init_test_scenario();

    // 1. Buyer creates escrow
    test_scenario::next_tx(&mut scenario, BUYER);
    {
        let coin = mint_coin(ESCROW_AMOUNT, test_scenario::ctx(&mut scenario));
        escrow::create_escrow(
            coin,
            AGENT,
            JOB_ID,
            test_scenario::ctx(&mut scenario)
        );
    };

    // 2. Check if escrow object exists and has correct data
    test_scenario::next_tx(&mut scenario, BUYER);
    {
        let escrow = test_scenario::take_shared<LockedPayment<SUI>>(&scenario);
        
        assert!(escrow::get_buyer(&escrow) == BUYER, 0);
        assert!(escrow::get_agent(&escrow) == AGENT, 0);
        assert!(escrow::get_balance_value(&escrow) == ESCROW_AMOUNT, 0);
        assert!(escrow::is_locked(&escrow) == true, 0);

        test_scenario::return_shared(escrow);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_release_escrow_success() {
    let mut scenario = init_test_scenario();

    // 1. Setup Escrow
    test_scenario::next_tx(&mut scenario, BUYER);
    {
        let coin = mint_coin(ESCROW_AMOUNT, test_scenario::ctx(&mut scenario));
        escrow::create_escrow(coin, AGENT, JOB_ID, test_scenario::ctx(&mut scenario));
    };

    // 2. Buyer releases funds
    test_scenario::next_tx(&mut scenario, BUYER);
    {
        let mut escrow = test_scenario::take_shared<LockedPayment<SUI>>(&scenario);
        escrow::release_escrow(&mut escrow, test_scenario::ctx(&mut scenario));
        test_scenario::return_shared(escrow);
    };

    // 3. Verify Agent received funds and Escrow status
    test_scenario::next_tx(&mut scenario, AGENT);
    {
        // Agent should have the coin now
        let coin = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
        assert!(coin::value(&coin) == ESCROW_AMOUNT, 0);
        test_scenario::return_to_sender(&scenario, coin);

        // Verify Escrow status is RELEASED (1)
        // Note: take_shared again to read state
        let escrow = test_scenario::take_shared<LockedPayment<SUI>>(&scenario);
        assert!(escrow::get_status(&escrow) == 1, 0); // 1 = RELEASED
        assert!(escrow::get_balance_value(&escrow) == 0, 0);
        test_scenario::return_shared(escrow);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_cancel_escrow_success() {
    let mut scenario = init_test_scenario();

    // 1. Setup Escrow
    test_scenario::next_tx(&mut scenario, BUYER);
    {
        let coin = mint_coin(ESCROW_AMOUNT, test_scenario::ctx(&mut scenario));
        escrow::create_escrow(coin, AGENT, JOB_ID, test_scenario::ctx(&mut scenario));
    };

    // 2. Buyer cancels escrow
    test_scenario::next_tx(&mut scenario, BUYER);
    {
        let mut escrow = test_scenario::take_shared<LockedPayment<SUI>>(&scenario);
        escrow::cancel_escrow(&mut escrow, test_scenario::ctx(&mut scenario));
        test_scenario::return_shared(escrow);
    };

    // 3. Verify Buyer received refund
    test_scenario::next_tx(&mut scenario, BUYER);
    {
        let coin = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
        assert!(coin::value(&coin) == ESCROW_AMOUNT, 0);
        test_scenario::return_to_sender(&scenario, coin);

        let escrow = test_scenario::take_shared<LockedPayment<SUI>>(&scenario);
        assert!(escrow::get_status(&escrow) == 2, 0); // 2 = CANCELLED
        test_scenario::return_shared(escrow);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = beeplancer::escrow::E_NOT_BUYER)]
fun test_release_escrow_unauthorized() {
    let mut scenario = init_test_scenario();

    // Setup
    test_scenario::next_tx(&mut scenario, BUYER);
    {
        let coin = mint_coin(ESCROW_AMOUNT, test_scenario::ctx(&mut scenario));
        escrow::create_escrow(coin, AGENT, JOB_ID, test_scenario::ctx(&mut scenario));
    };

    // Fake User tries to release
    test_scenario::next_tx(&mut scenario, FAKE_USER);
    {
        let mut escrow = test_scenario::take_shared<LockedPayment<SUI>>(&scenario);
        escrow::release_escrow(&mut escrow, test_scenario::ctx(&mut scenario)); // Should fail
        test_scenario::return_shared(escrow);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = beeplancer::escrow::E_NOT_AUTHORIZED_TO_CANCEL)]
fun test_cancel_escrow_unauthorized() {
    let mut scenario = init_test_scenario();

    // Setup
    test_scenario::next_tx(&mut scenario, BUYER);
    {
        let coin = mint_coin(ESCROW_AMOUNT, test_scenario::ctx(&mut scenario));
        escrow::create_escrow(coin, AGENT, JOB_ID, test_scenario::ctx(&mut scenario));
    };

    // Agent tries to cancel (only Buyer can cancel)
    test_scenario::next_tx(&mut scenario, AGENT);
    {
        let mut escrow = test_scenario::take_shared<LockedPayment<SUI>>(&scenario);
        escrow::cancel_escrow(&mut escrow, test_scenario::ctx(&mut scenario)); // Should fail
        test_scenario::return_shared(escrow);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_admin_emergency_recover() {
    let mut scenario = init_test_scenario();

    // 1. Setup Escrow
    test_scenario::next_tx(&mut scenario, BUYER);
    {
        let coin = mint_coin(ESCROW_AMOUNT, test_scenario::ctx(&mut scenario));
        escrow::create_escrow(coin, AGENT, JOB_ID, test_scenario::ctx(&mut scenario));
    };

    // 2. Admin performs emergency recovery
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let admin_cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut escrow = test_scenario::take_shared<LockedPayment<SUI>>(&scenario);
        
        escrow::emergency_recover(
            &admin_cap,
            &mut escrow,
            FAKE_USER, // Recovering to FAKE_USER for testing
            test_scenario::ctx(&mut scenario)
        );

        test_scenario::return_shared(escrow);
        test_scenario::return_to_sender(&scenario, admin_cap);
    };

    // 3. Verify Recipient (FAKE_USER) received funds
    test_scenario::next_tx(&mut scenario, FAKE_USER);
    {
        let coin = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
        assert!(coin::value(&coin) == ESCROW_AMOUNT, 0);
        test_scenario::return_to_sender(&scenario, coin);

        let escrow = test_scenario::take_shared<LockedPayment<SUI>>(&scenario);
        assert!(escrow::get_status(&escrow) == 2, 0); // 2 = CANCELLED/Ended
        test_scenario::return_shared(escrow);
    };

    test_scenario::end(scenario);
}