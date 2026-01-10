/// User Pool Module
/// 
/// Manages user's personal fund pool that can be controlled by their AI agent
/// 
/// Key features:
/// - Users deposit USDC into their pool
/// - AI agent can spend from pool with owner's permission
/// - All transactions are tracked and auditable
/// - Agent can create escrows directly from pool

module beeplancer::user_pool;

use sui::coin::{Self, Coin};
use sui::balance::{Self, Balance};
use sui::event;

// ===== Errors =====
const EInsufficientBalance: u64 = 0;
const EUnauthorized: u64 = 1;
const EPoolNotActive: u64 = 2;

// ===== Structs =====

/// User's personal fund pool
/// Shared object that both owner and agent can access
public struct UserPool<phantom T> has key, store {
    id: UID,
    owner: address,
    agent: address,  // AI agent address with spending permission
    balance: Balance<T>,
    is_active: bool,
    total_deposited: u64,
    total_spent: u64,
    created_at: u64,
}

/// Agent capability - proves agent has permission to spend from pool
public struct AgentCapability has key, store {
    id: UID,
    pool_id: ID,
    agent: address,
    spending_limit: u64,  // Max amount agent can spend per transaction
}

// ===== Events =====

public struct PoolCreated has copy, drop {
    pool_id: ID,
    owner: address,
    agent: address,
}

public struct Deposited has copy, drop {
    pool_id: ID,
    amount: u64,
    new_balance: u64,
}

public struct AgentSpent has copy, drop {
    pool_id: ID,
    agent: address,
    amount: u64,
    remaining_balance: u64,
    purpose: vector<u8>,  // Job reference or description
}

public struct Withdrawn has copy, drop {
    pool_id: ID,
    owner: address,
    amount: u64,
    remaining_balance: u64,
}

// ===== Public Functions =====

/// Create a new user pool
/// 
/// @param agent: Address of AI agent that will manage this pool
/// @param initial_deposit: Initial USDC to deposit
/// @param spending_limit: Max amount agent can spend per transaction
public fun create_pool<T>(
    agent: address,
    initial_deposit: Coin<T>,
    spending_limit: u64,
    ctx: &mut TxContext
) {
    let pool_uid = object::new(ctx);
    let pool_id = object::uid_to_inner(&pool_uid);

    let amount = coin::value(&initial_deposit);
    let balance = coin::into_balance(initial_deposit);
    
    let pool = UserPool<T> {
        id: pool_uid,
        owner: tx_context::sender(ctx),
        agent,
        balance,
        is_active: true,
        total_deposited: amount,
        total_spent: 0,
        created_at: tx_context::epoch(ctx),
    };

    // Create agent capability
    let cap = AgentCapability {
        id: object::new(ctx),
        pool_id,
        agent,
        spending_limit,
    };

    event::emit(PoolCreated {
        pool_id,
        owner: ctx.sender(),
        agent,
    });

    event::emit(Deposited {
        pool_id,
        amount,
        new_balance: amount,
    });

    // Transfer capability to agent
    transfer::transfer(cap, agent);
    
    // Share pool so both owner and agent can access
    transfer::share_object(pool);
}

/// Deposit more funds to pool (owner only)
public fun deposit<T>(
    pool: &mut UserPool<T>,
    deposit: Coin<T>,
    ctx: &mut TxContext
) {
    assert!(pool.owner == ctx.sender(), EUnauthorized);
    assert!(pool.is_active, EPoolNotActive);
    
    let amount = coin::value(&deposit);
    balance::join(&mut pool.balance, coin::into_balance(deposit));
    
    pool.total_deposited = pool.total_deposited + amount;
    
    event::emit(Deposited {
        pool_id: object::uid_to_inner(&pool.id),
        amount,
        new_balance: balance::value(&pool.balance),
    });
}

/// Agent spends from pool to create escrow or pay for services
/// Returns a coin with exact amount for the transaction
public fun agent_spend<T>(
    pool: &mut UserPool<T>,
    cap: &AgentCapability,
    amount: u64,
    purpose: vector<u8>,
    ctx: &mut TxContext
): Coin<T> {
    // Verify agent capability
    assert!(cap.agent == tx_context::sender(ctx), EUnauthorized);
    assert!(cap.pool_id == object::uid_to_inner(&pool.id), EUnauthorized);
    assert!(pool.is_active, EPoolNotActive);
    
    // Check spending limit
    assert!(amount <= cap.spending_limit, EInsufficientBalance);
    
    // Check pool balance
    assert!(balance::value(&pool.balance) >= amount, EInsufficientBalance);
    
    // Take amount from pool
    let spent_balance = balance::split(&mut pool.balance, amount);
    pool.total_spent = pool.total_spent + amount;
    
    event::emit(AgentSpent {
        pool_id: object::uid_to_inner(&pool.id),
        agent: cap.agent,
        amount,
        remaining_balance: balance::value(&pool.balance),
        purpose,
    });
    
    coin::from_balance(spent_balance, ctx)
}

/// Owner withdraws from pool
public fun withdraw<T>(
    pool: &mut UserPool<T>,
    amount: u64,
    ctx: &mut TxContext
) {
    assert!(pool.owner == tx_context::sender(ctx), EUnauthorized);
    assert!(pool.is_active, EPoolNotActive);
    assert!(balance::value(&pool.balance) >= amount, EInsufficientBalance);
    
    let withdrawn = balance::split(&mut pool.balance, amount);
    let coin = coin::from_balance(withdrawn, ctx);
    
    event::emit(Withdrawn {
        pool_id: object::uid_to_inner(&pool.id),
        owner: tx_context::sender(ctx),
        amount,
        remaining_balance: balance::value(&pool.balance),
    });
    
    transfer::public_transfer(coin, tx_context::sender(ctx));
}

/// Deactivate pool (owner only)
public fun deactivate_pool<T>(
    pool: &mut UserPool<T>,
    ctx: &mut TxContext
) {
    assert!(pool.owner == tx_context::sender(ctx), EUnauthorized);
    pool.is_active = false;
}

/// Reactivate pool (owner only)
public fun activate_pool<T>(
    pool: &mut UserPool<T>,
    ctx: &mut TxContext
) {
    assert!(pool.owner == tx_context::sender(ctx), EUnauthorized);
    pool.is_active = true;
}

// ===== View Functions =====

/// Get pool balance
public fun get_balance<T>(pool: &UserPool<T>): u64 {
    balance::value(&pool.balance)
}

/// Get pool owner
public fun get_owner<T>(pool: &UserPool<T>): address {
    pool.owner
}

/// Get pool agent
public fun get_agent<T>(pool: &UserPool<T>): address {
    pool.agent
}

/// Check if pool is active
public fun is_active<T>(pool: &UserPool<T>): bool {
    pool.is_active
}

/// Get total deposited
public fun get_total_deposited<T>(pool: &UserPool<T>): u64 {
    pool.total_deposited
}

/// Get total spent
public fun get_total_spent<T>(pool: &UserPool<T>): u64 {
    pool.total_spent
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    // Test initialization if needed
}
