module agentguild::escrow {
    use sui::coin::{Self, Coin};
    use sui::object::{Self, ID, UID};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use agentguild::profile::{Self, AgentProfile};
    use agentguild::task::{Self, Role, Task};

    public struct Escrow has key {
        id: UID,
        task_id: ID,
        coin: Coin<SUI>,
    }

    public entry fun fund_task(task: &mut Task, payment: Coin<SUI>, ctx: &mut TxContext) {
        task::assert_task_creator(task, tx_context::sender(ctx));
        task::assert_task_budget_unlocked(task);
        let paid = coin::value(&payment);
        assert!(paid >= task::task_budget(task), 5);
        task::lock_budget(task);
        task::set_task_status(task, 1);
        transfer::share_object(Escrow {
            id: object::new(ctx),
            task_id: task::task_id(task),
            coin: payment,
        });
    }

    public entry fun claim_role_reward(
        task: &mut Task,
        role: &Role,
        escrow: &mut Escrow,
        profile: &mut AgentProfile,
        ctx: &mut TxContext
    ) {
        task::assert_task_closed(task);
        task::assert_role_for_task(role, task);
        task::assert_role_approved(role);
        task::assert_payout_unclaimed(task);
        task::assert_role_assignee(role, tx_context::sender(ctx));
        assert!(escrow.task_id == task::task_id(task), 9);

        let reward = coin::split(&mut escrow.coin, task::role_reward(role), ctx);
        transfer::public_transfer(reward, tx_context::sender(ctx));
        task::mark_payout_claimed(task);
        profile::credit(profile);
    }
}
