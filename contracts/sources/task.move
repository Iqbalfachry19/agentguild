module agentguild::task {
    use std::ascii::String;
    use std::option::{Self, Option};
    use std::vector;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const E_ROLE_NOT_OPEN: u64 = 1;
    const E_ROLE_ALREADY_FILLED: u64 = 2;
    const E_NOT_ASSIGNEE: u64 = 3;
    const E_NOT_VERIFIER: u64 = 4;
    const E_NOT_RELEASABLE: u64 = 5;
    const E_WRONG_STATUS: u64 = 6;
    const E_TASK_NOT_CLOSED: u64 = 7;
    const E_NOT_CREATOR: u64 = 8;
    const E_TASK_ROLE_MISMATCH: u64 = 9;

    public struct TaskBoard has key {
        id: UID,
        task_ids: vector<ID>,
    }

    public struct Task has key, store {
        id: UID,
        creator: address,
        verifier: address,
        title: String,
        description: String,
        budget_mist: u64,
        budget_locked: bool,
        deadline_ms: u64,
        status: u8, // 0 open, 1 active, 2 submitted, 3 approved, 4 rejected, 5 closed
        role_ids: vector<ID>,
        artifact_ids: vector<ID>,
        payout_claimed: bool,
    }

    public struct Role has key, store {
        id: UID,
        task_id: ID,
        label: String,
        reward_mist: u64,
        assignee: Option<address>,
        approved: bool,
    }

    fun init(ctx: &mut TxContext) {
        transfer::share_object(TaskBoard {
            id: object::new(ctx),
            task_ids: vector[],
        });
    }

    public entry fun create_task(
        board: &mut TaskBoard,
        title: String,
        description: String,
        verifier: address,
        budget_mist: u64,
        deadline_ms: u64,
        ctx: &mut TxContext
    ) {
        let creator = tx_context::sender(ctx);
        let task = Task {
            id: object::new(ctx),
            creator,
            verifier,
            title,
            description,
            budget_mist,
            budget_locked: false,
            deadline_ms,
            status: 0,
            role_ids: vector[],
            artifact_ids: vector[],
            payout_claimed: false,
        };
        let task_id = object::id(&task);
        vector::push_back(&mut board.task_ids, task_id);
        transfer::share_object(task);
    }

    public entry fun add_role(task: &mut Task, label: String, reward_mist: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == task.creator, E_NOT_CREATOR);
        assert!(task.status == 0 || task.status == 1, E_WRONG_STATUS);
        let role = Role {
            id: object::new(ctx),
            task_id: object::id(task),
            label,
            reward_mist,
            assignee: option::none<address>(),
            approved: false,
        };
        vector::push_back(&mut task.role_ids, object::id(&role));
        transfer::share_object(role);
    }

    public entry fun join_role(role: &mut Role, task: &Task, ctx: &mut TxContext) {
        assert!(task.status == 1, E_ROLE_NOT_OPEN);
        assert!(role.task_id == object::id(task), E_TASK_ROLE_MISMATCH);
        assert!(option::is_none(&role.assignee), E_ROLE_ALREADY_FILLED);
        role.assignee = option::some(tx_context::sender(ctx));
    }

    public entry fun finalize_task(task: &mut Task, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == task.creator, E_NOT_CREATOR);
        assert!(task.status == 3 || task.status == 4, E_WRONG_STATUS);
        task.status = 5;
    }

    public(package) fun assert_task_creator(task: &Task, sender: address) {
        assert!(sender == task.creator, E_NOT_CREATOR);
    }

    public(package) fun assert_task_verifier(task: &Task, sender: address) {
        assert!(sender == task.verifier, E_NOT_VERIFIER);
    }

    public(package) fun set_task_status(task: &mut Task, status: u8) {
        task.status = status;
    }

    public(package) fun task_status(task: &Task): u8 {
        task.status
    }

    public(package) fun task_id(task: &Task): ID {
        object::id(task)
    }

    public(package) fun role_id(role: &Role): ID {
        object::id(role)
    }

    public(package) fun role_reward(role: &Role): u64 {
        role.reward_mist
    }

    public(package) fun push_artifact(task: &mut Task, artifact_id: ID) {
        vector::push_back(&mut task.artifact_ids, artifact_id);
    }

    public(package) fun assert_role_assignee(role: &Role, sender: address) {
        assert!(option::contains(&role.assignee, &sender), E_NOT_ASSIGNEE);
    }

    public(package) fun assert_role_for_task(role: &Role, task: &Task) {
        assert!(role.task_id == object::id(task), E_TASK_ROLE_MISMATCH);
    }

    public(package) fun set_role_approved(role: &mut Role, approved: bool) {
        role.approved = approved;
    }

    public(package) fun assert_role_approved(role: &Role) {
        assert!(role.approved, E_NOT_RELEASABLE);
    }

    public(package) fun assert_task_closed(task: &Task) {
        assert!(task.status == 5, E_TASK_NOT_CLOSED);
    }

    public(package) fun assert_task_budget_unlocked(task: &Task) {
        assert!(!task.budget_locked, E_WRONG_STATUS);
    }

    public(package) fun lock_budget(task: &mut Task) {
        task.budget_locked = true;
    }

    public(package) fun task_budget(task: &Task): u64 {
        task.budget_mist
    }

    public(package) fun assert_payout_unclaimed(task: &Task) {
        assert!(!task.payout_claimed, E_NOT_RELEASABLE);
    }

    public(package) fun mark_payout_claimed(task: &mut Task) {
        task.payout_claimed = true;
    }
}
