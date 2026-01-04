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

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx)
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
    
    assert!(escrow.status == STATUS_LOCKED, E_NOT_LOCKED);

    let amount = escrow.balance.value();
    let payment = coin::from_balance(escrow.balance.withdraw_all(), ctx);

    escrow.status = STATUS_CANCELLED;

    event::emit(EscrowCancelled {
        escrow_id: object::id(escrow),
        buyer: escrow.buyer,
        agent: escrow.agent,
        amount,
    });    

    transfer::public_transfer(payment, escrow.buyer);
}

// view function
public fun get_escrow_id<T>(escrow: &LockedPayment<T>): ID {
    object::id(escrow)  
}

public fun get_buyer<T>(escrow: &LockedPayment<T>): address {
    escrow.buyer
}

/// Lấy địa chỉ của Agent
public fun get_agent<T>(escrow: &LockedPayment<T>): address {
    escrow.agent
}

/// Lấy trạng thái hiện tại (0: Locked, 1: Released, 2: Cancelled)
public fun get_status<T>(escrow: &LockedPayment<T>): u8 {
    escrow.status
}

/// Lấy số dư hiện có trong Escrow
public fun get_balance_value<T>(escrow: &LockedPayment<T>): u64 {
    escrow.balance.value()
}

/// Kiểm tra xem Escrow có đang bị khóa (chờ xử lý) hay không
public fun is_locked<T>(escrow: &LockedPayment<T>): bool {
    escrow.status == STATUS_LOCKED
}


// =============================================================================
// ADMIN FUNCTIONS
// =============================================================================

/// Định nghĩa thêm một Event để theo dõi các hành động khẩn cấp của Admin
public struct EmergencyRecoveryPerformed has copy, drop {
    escrow_id: ID,
    admin_address: address,
    recipient: address,
    amount: u64,
}

/// @notice Emergency function to recover stuck funds (admin only)
/// @dev Only callable by AdminCap holder
public fun emergency_recover<T>(
    _admin_cap: &AdminCap,
    escrow: &mut LockedPayment<T>,
    recipient: address,
    ctx: &mut TxContext
) {
    // 1. Kiểm tra số dư hiện có trong Escrow
    let amount = escrow.balance.value();
    
    // Đảm bảo vẫn còn tiền để rút
    assert!(amount > 0, E_INVALID_AMOUNT);

    // 2. Rút toàn bộ tiền
    let recovered_coin = coin::from_balance(escrow.balance.withdraw_all(), ctx);

    // 3. Cập nhật trạng thái sang CANCELLED hoặc một trạng thái EMERGENCY riêng biệt
    // Ở đây dùng STATUS_CANCELLED để đánh dấu escrow đã kết thúc
    escrow.status = STATUS_CANCELLED;

    // 4. Emit event để phục vụ việc audit (truy xuất lịch sử)
    event::emit(EmergencyRecoveryPerformed {
        escrow_id: object::id(escrow),
        admin_address: ctx.sender(),
        recipient,
        amount,
    });

    // 5. Chuyển tiền tới người nhận chỉ định
    transfer::public_transfer(recovered_coin, recipient);
}