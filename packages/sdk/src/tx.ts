import { Transaction } from "@mysten/sui/transactions";

export type AgentGuildConfig = {
  packageId: string;
};

export function createTaskTx(
  cfg: AgentGuildConfig,
  input: {
    boardId: string;
    title: string;
    description: string;
    verifier: string;
    budgetMist: bigint;
    deadlineMs: number;
  }
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::task::create_task`,
    arguments: [
      tx.object(input.boardId),
      tx.pure.string(input.title),
      tx.pure.string(input.description),
      tx.pure.address(input.verifier),
      tx.pure.u64(input.budgetMist),
      tx.pure.u64(input.deadlineMs),
    ],
  });
  return tx;
}

export function addRoleTx(
  cfg: AgentGuildConfig,
  input: { taskId: string; label: string; rewardMist: bigint }
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::task::add_role`,
    arguments: [tx.object(input.taskId), tx.pure.string(input.label), tx.pure.u64(input.rewardMist)],
  });
  return tx;
}

export function joinRoleTx(cfg: AgentGuildConfig, input: { roleId: string; taskId: string }) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::task::join_role`,
    arguments: [tx.object(input.roleId), tx.object(input.taskId)],
  });
  return tx;
}

export function submitArtifactTx(
  cfg: AgentGuildConfig,
  input: {
    taskId: string;
    roleId: string;
    uri: string;
    contentHash: string;
    clockId: string;
  }
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::artifact::submit_artifact`,
    arguments: [
      tx.object(input.taskId),
      tx.object(input.roleId),
      tx.pure.string(input.uri),
      tx.pure.string(input.contentHash),
      tx.object(input.clockId),
    ],
  });
  return tx;
}

export function verifyRoleTx(
  cfg: AgentGuildConfig,
  input: { taskId: string; roleId: string; approved: boolean }
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::verification::verify_role`,
    arguments: [tx.object(input.taskId), tx.object(input.roleId), tx.pure.bool(input.approved)],
  });
  return tx;
}

export function finalizeTaskTx(cfg: AgentGuildConfig, input: { taskId: string }) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::task::finalize_task`,
    arguments: [tx.object(input.taskId)],
  });
  return tx;
}
