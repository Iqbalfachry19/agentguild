module agentguild::verification {
    use sui::tx_context::{Self, TxContext};

    use agentguild::task::{Self, Role, Task};

    public entry fun verify_role(task: &mut Task, role: &mut Role, approved: bool, ctx: &mut TxContext) {
        task::assert_task_verifier(task, tx_context::sender(ctx));
        assert!(task::task_status(task) == 2, 6);
        task::assert_role_for_task(role, task);
        task::set_role_approved(role, approved);

        if (approved) {
            task::set_task_status(task, 3);
        } else {
            task::set_task_status(task, 4);
        }
    }
}
