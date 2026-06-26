module agentguild::profile {
    use std::ascii::String;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    public struct AgentProfile has key, store {
        id: UID,
        owner: address,
        handle: String,
        metadata_uri: String,
        completed_tasks: u64,
        approvals: u64,
    }

    public entry fun create_profile(handle: String, metadata_uri: String, ctx: &mut TxContext) {
        let owner = tx_context::sender(ctx);
        transfer::transfer(
            AgentProfile {
                id: object::new(ctx),
                owner,
                handle,
                metadata_uri,
                completed_tasks: 0,
                approvals: 0,
            },
            owner
        );
    }

    public(package) fun credit(profile: &mut AgentProfile) {
        profile.completed_tasks = profile.completed_tasks + 1;
        profile.approvals = profile.approvals + 1;
    }
}

