module agentguild::artifact {
    use std::ascii::String;
    use sui::clock::{Self, Clock};
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use agentguild::task::{Self, Role, Task};

    public struct Artifact has key, store {
        id: UID,
        task_id: ID,
        role_id: ID,
        submitter: address,
        uri: String,
        content_hash: String,
        created_ms: u64,
        status: u8, // 0 pending, 1 approved, 2 rejected
        reviewed_ms: u64,
    }

    public entry fun submit_artifact(
        task: &mut Task,
        role: &Role,
        uri: String,
        content_hash: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let status = task::task_status(task);
        assert!(status == 1 || status == 2, 6);

        let sender = tx_context::sender(ctx);
        task::assert_role_for_task(role, task);
        task::assert_role_assignee(role, sender);

        let artifact = Artifact {
            id: object::new(ctx),
            task_id: task::task_id(task),
            role_id: task::role_id(role),
            submitter: sender,
            uri,
            content_hash,
            created_ms: clock::timestamp_ms(clock),
            status: 0,
            reviewed_ms: 0,
        };
        task::push_artifact(task, object::id(&artifact));
        task::set_task_status(task, 2);
        transfer::share_object(artifact);
    }

    public entry fun verify_artifact(
        task: &mut Task,
        role: &mut Role,
        artifact: &mut Artifact,
        approved: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        task::assert_task_verifier(task, tx_context::sender(ctx));
        assert!(task::task_status(task) == 2, 6);
        task::assert_role_for_task(role, task);
        assert!(artifact.task_id == task::task_id(task), 9);
        assert!(artifact.role_id == task::role_id(role), 9);

        artifact.reviewed_ms = clock::timestamp_ms(clock);
        if (approved) {
            artifact.status = 1;
            task::set_role_approved(role, true);
            task::set_task_status(task, 3);
        } else {
            artifact.status = 2;
            task::set_role_approved(role, false);
            task::set_task_status(task, 4);
        }
    }
}
