module beeplancer::escrow;

use sui::coin::{Self, Coin};
use sui::balance::Balance;
use sui::event;


// const error codes
const E_INVALID_AMOUNT: u64 = 1;
const E_NOT_AUTHORIZED_TO_CANCEL: u64 = 2;
const E_NOT_BUYER: u64 = 3;
const E_NOT_LOCKED: u64 = 4;
const E_ALREADY_RELEASED: u64 = 5;
const E_INVALID_JOB_REFERENCE: u64 = 6;

const STATUS_LOCKED: u8 = 0;
const STATUS_RELEASED: u8 = 1;
const STATUS_CANCELLED: u8 = 2;

public struct LockedPayment<phantom T> has key, store {
    id: UID,
    buyer: address,
    agent: address,
    balance: Balance<T>,
    job_reference: vector<u8>,
    status: u8,
    created_at: u64,
}

public struct EscrowCreated has copy, drop {
    escrow_id: ID,
    buyer: address,
    agent: address,
    amount: u64,
    job_reference: vector<u8>,
}

public struct EscrowReleased has copy, drop {
    escrow_id: ID, 
    buyer: address,
    agent: address,
    amount: u64,
}

public struct EscrowCancelled has copy, drop {
    escrow_id: ID,
    buyer: address,
    agent: address,
    amount: u64,
}

public struct AdminCap has key{
    id: UID,
}

// init
fun init(ctx: &mut TxContext) {
    let admin_cap = AdminCap {
        id: object::new(ctx),
    };

    transfer::transfer(admin_cap, ctx.sender())
}

// entry fun
public fun create_escrow<T>(
    payment: Coin<T>,
    agent: address,
    job_reference: vector<u8>,
    ctx: &mut TxContext,
) {
    let amount = payment.value();
    assert!(amount > 0, E_INVALID_AMOUNT);

    let balance = coin::into_balance(payment);
    
    let escrow = LockedPayment {
        id: object::new(ctx),
        buyer: ctx.sender(),
        agent: agent,
        balance,
        job_reference,
        status: STATUS_LOCKED,
        created_at: ctx.epoch(),
    };

    event::emit(EscrowCreated {
        escrow_id: object::id(&escrow),
        buyer: ctx.sender(),
        agent: agent,
        amount,
        job_reference,
    });
    
    transfer::public_share_object(escrow);  
}

public fun release_escrow<T>(
    escrow: &mut LockedPayment<T>,
    ctx: &mut TxContext,
) { 
    assert!(ctx.sender() == escrow.buyer, E_NOT_BUYER);

    assert!(escrow.status == STATUS_LOCKED, E_NOT_LOCKED);
    
    let amount = escrow.balance.value();
    let payment = coin::from_balance(escrow.balance.withdraw_all(), ctx);

    escrow.status = STATUS_RELEASED;

    event::emit(EscrowReleased {
        escrow_id: object::id(escrow),
        buyer: escrow.buyer,
        agent: escrow.agent,
        amount,
    });

    transfer::public_transfer(payment, escrow.agent);
}

public fun cancel_escrow<T>(
    escrow: &mut LockedPayment<T>,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == escrow.buyer, E_NOT_AUTHORIZED_TO_CANCEL);
    
    assert!(escrow.status = STATUS_LOCKED, E_NOT_LOCKED);

    let amount = escrow.balance.value();
    let payment = coin::from_balance(escrow.balance.withdraw_all(), ctx);

    escrow.status = STATUS_CANCELLED;

    event::emit(EscrowCancelled {
        escrow: object::id(escrow),
        buyer: escrow.buyer,
        agent: escrow.agent,
        amount,
        job_reference: escrow.job_reference,
    })    

    transfer::public_transfer(payment, escrow.buyer);
}

