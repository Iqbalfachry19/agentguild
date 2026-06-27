import { useEffect, useMemo, useState } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useCurrentWallet,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { type TaskStatus } from "@agentguild/sdk";
import {
  SUI_CLOCK_OBJECT_ID,
  TESTNET_AGENTGUILD_BOARD_ID,
  TESTNET_AGENTGUILD_PACKAGE_ID,
} from "./constants";

type Panel = "tasks" | "artifacts" | "verifier";

const STATUS_STYLES: Record<TaskStatus, string> = {
  open: "chip open",
  active: "chip active",
  submitted: "chip submitted",
  approved: "chip approved",
  rejected: "chip rejected",
  closed: "chip closed",
};

const AGENTGUILD = {
  packageId: TESTNET_AGENTGUILD_PACKAGE_ID,
  boardId: TESTNET_AGENTGUILD_BOARD_ID,
  clockId: SUI_CLOCK_OBJECT_ID,
};

export function App() {
  const account = useCurrentAccount();
  const currentWallet = useCurrentWallet();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [panel, setPanel] = useState<Panel>("tasks");
  const [newArtifactUri, setNewArtifactUri] = useState("");
  const [newArtifactHash, setNewArtifactHash] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [statusText, setStatusText] = useState<string>("Ready");
  const [roleLabel, setRoleLabel] = useState("Analyst");
  const [roleRewardSui, setRoleRewardSui] = useState("2");
  const [profileHandle, setProfileHandle] = useState("agent.handle");
  const [profileMetadataUri, setProfileMetadataUri] = useState(
    "https://example.com/agent.json",
  );
  const [taskTitle, setTaskTitle] = useState("New Agent Task");
  const [taskDescription, setTaskDescription] = useState(
    "Define deliverables and acceptance criteria.",
  );
  const [taskVerifier, setTaskVerifier] = useState("");
  const [taskBudgetSui, setTaskBudgetSui] = useState("5");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [fundTaskId, setFundTaskId] = useState("");
  const [fundAmountSui, setFundAmountSui] = useState("5");
  const [claimTaskId, setClaimTaskId] = useState("");
  const [claimRoleId, setClaimRoleId] = useState("");
  const [claimEscrowId, setClaimEscrowId] = useState("");
  const [claimProfileId, setClaimProfileId] = useState("");
  const [walletBalanceSui, setWalletBalanceSui] = useState("0");
  const [escrowByTask, setEscrowByTask] = useState<Record<string, string>>({});
  const [resolverTaskId, setResolverTaskId] = useState("");
  const [resolvedTasks, setResolvedTasks] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [resolvedRoles, setResolvedRoles] = useState<
    Array<{ id: string; taskId: string; label: string }>
  >([]);
  const [resolvedEscrows, setResolvedEscrows] = useState<
    Array<{ id: string; taskId: string }>
  >([]);
  const [resolverLoading, setResolverLoading] = useState(false);
  const [tasks, setTasks] = useState<
    Array<{
      id: string;
      creator: string;
      verifier: string;
      title: string;
      description: string;
      budgetMist: bigint;
      deadlineMs: number;
      status: TaskStatus;
      roleIds: string[];
      artifactIds: string[];
      payoutClaimed: boolean;
    }>
  >([]);
  const [roles, setRoles] = useState<
    Array<{
      id: string;
      taskId: string;
      label: string;
      rewardMist: bigint;
      assignee?: string;
      approved: boolean;
    }>
  >([]);
  const [artifacts, setArtifacts] = useState<
    Array<{
      id: string;
      taskId: string;
      roleId: string;
      submitter: string;
      uri: string;
      contentHash: string;
      createdMs: number;
      status: number;
      reviewedMs: number;
    }>
  >([]);
  const [profiles, setProfiles] = useState<
    Array<{
      id: string;
      owner: string;
      handle: string;
      metadataUri: string;
      completedTasks: number;
      approvals: number;
    }>
  >([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId),
    [selectedTaskId, tasks],
  );
  const selectedRoles = useMemo(
    () => roles.filter((role) => role.taskId === selectedTaskId),
    [selectedTaskId, roles],
  );
  const selectedArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.taskId === selectedTaskId),
    [selectedTaskId, artifacts],
  );
  const selectedTaskForClaim = useMemo(
    () => tasks.find((task) => task.id === claimTaskId),
    [tasks, claimTaskId],
  );
  const selectedRoleForClaim = useMemo(
    () => roles.find((role) => role.id === claimRoleId),
    [roles, claimRoleId],
  );
  const autoProfileId = profiles[0]?.id ?? "";
  const autoEscrowId = claimTaskId ? (escrowByTask[claimTaskId] ?? "") : "";
  const resolvedEscrowId = claimEscrowId || autoEscrowId;
  const resolvedProfileId = claimProfileId || autoProfileId;
  const claimableMist =
    selectedTaskForClaim &&
    selectedRoleForClaim &&
    selectedTaskForClaim.status === "closed" &&
    !selectedTaskForClaim.payoutClaimed &&
    selectedRoleForClaim.approved &&
    selectedRoleForClaim.assignee === account?.address
      ? selectedRoleForClaim.rewardMist
      : 0n;
  const claimStatus =
    !claimTaskId || !claimRoleId
      ? "Please select a task and role first."
      : !selectedTaskForClaim || !selectedRoleForClaim
        ? "Task/role not found in the on-chain cache."
        : selectedTaskForClaim.status !== "closed"
          ? "Task is not closed yet (finalize it first)."
          : selectedTaskForClaim.payoutClaimed
            ? "The reward for this task has already been claimed."
            : !selectedRoleForClaim.approved
              ? "The role has not been approved yet (currently rejected or pending)."
              : selectedRoleForClaim.assignee !== account?.address
                ? "This wallet is not the assignee for this role."
                : !resolvedEscrowId
                  ? "Escrow ID is not available yet. Enter it manually or fund the task from this UI."
                  : !resolvedProfileId
                    ? "Profile ID is not available yet. Create a profile first."
                    : "Ready to claim";

  const walletReady = !!account?.address;
  const contractReady = !!AGENTGUILD.packageId;

  async function execTx(transaction: unknown) {
    if (!walletReady) {
      setStatusText("Connect wallet first.");
      return null;
    }
    if (!contractReady) {
      setStatusText("Set VITE_AGENTGUILD_PACKAGE_ID in .env.local.");
      return null;
    }

    setStatusText("Signing transaction...");
    const result = await signAndExecute({
      transaction: transaction as never,
      chain: "sui:testnet",
    });
    await suiClient.waitForTransaction({
      digest: result.digest,
    });
    const txBlock = await suiClient.getTransactionBlock({
      digest: result.digest,
      options: {
        showObjectChanges: true,
        showEffects: true,
      },
    });
    setStatusText(`Executed: ${result.digest}`);
    setRefreshKey((v) => v + 1);
    return txBlock as unknown;
  }

  useEffect(() => {
    void loadOnchain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, refreshKey]);

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [selectedTaskId, tasks]);

  async function loadOnchain() {
    if (!contractReady) return;
    setLoading(true);
    try {
      const board = await suiClient.getObject({
        id: AGENTGUILD.boardId,
        options: { showContent: true },
      });

      const boardFields =
        (
          board.data?.content as
            | { fields?: Record<string, unknown> }
            | undefined
        )?.fields ?? {};
      const taskIds = normalizeIdVector(boardFields.task_ids);
      if (taskIds.length === 0) {
        setTasks([]);
        setRoles([]);
        setArtifacts([]);
      } else {
        const taskObjs = await suiClient.multiGetObjects({
          ids: taskIds,
          options: { showContent: true },
        });

        const nextTasks = taskObjs
          .map((obj) => parseTask(obj.data?.objectId ?? "", obj.data?.content))
          .filter((x): x is NonNullable<typeof x> => !!x);
        setTasks(nextTasks);

        const roleIds = [...new Set(nextTasks.flatMap((t) => t.roleIds))];
        const artifactIds = [
          ...new Set(nextTasks.flatMap((t) => t.artifactIds)),
        ];

        if (roleIds.length > 0) {
          const roleObjs = await suiClient.multiGetObjects({
            ids: roleIds,
            options: { showContent: true },
          });
          setRoles(
            roleObjs
              .map((obj) =>
                parseRole(obj.data?.objectId ?? "", obj.data?.content),
              )
              .filter((x): x is NonNullable<typeof x> => !!x),
          );
        } else {
          setRoles([]);
        }

        if (artifactIds.length > 0) {
          const artifactObjs = await suiClient.multiGetObjects({
            ids: artifactIds,
            options: { showContent: true },
          });
          setArtifacts(
            artifactObjs
              .map((obj) =>
                parseArtifact(obj.data?.objectId ?? "", obj.data?.content),
              )
              .filter((x): x is NonNullable<typeof x> => !!x),
          );
        } else {
          setArtifacts([]);
        }
      }

      if (account?.address) {
        const bal = await suiClient.getBalance({ owner: account.address });
        setWalletBalanceSui(
          (Number(bal.totalBalance) / 1_000_000_000).toFixed(4),
        );
        const ownedProfiles = await suiClient.getOwnedObjects({
          owner: account.address,
          filter: {
            StructType: `${AGENTGUILD.packageId}::profile::AgentProfile`,
          },
          options: { showContent: true },
        });
        setProfiles(
          ownedProfiles.data
            .map((entry) =>
              parseProfile(entry.data?.objectId ?? "", entry.data?.content),
            )
            .filter((x): x is NonNullable<typeof x> => !!x),
        );
      } else {
        setProfiles([]);
        setWalletBalanceSui("0");
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to load on-chain data";
      setStatusText(msg);
    } finally {
      setLoading(false);
    }
  }

  async function resolveFromHistory() {
    if (!account?.address) {
      setStatusText("Connect wallet first.");
      return;
    }
    setResolverLoading(true);
    try {
      let cursor: string | null = null;
      const createdIds: string[] = [];
      for (let i = 0; i < 4; i++) {
        const page = await suiClient.queryTransactionBlocks({
          filter: { FromAddress: account.address },
          options: { showObjectChanges: true },
          limit: 50,
          cursor,
          order: "descending",
        });
        for (const tx of page.data) {
          for (const change of tx.objectChanges ?? []) {
            if (
              change.type === "created" &&
              typeof change.objectType === "string" &&
              change.objectType.startsWith(`${AGENTGUILD.packageId}::`)
            ) {
              createdIds.push(change.objectId);
            }
          }
        }
        if (!page.hasNextPage || !page.nextCursor) break;
        cursor = page.nextCursor;
      }

      const uniqIds = [...new Set(createdIds)];
      if (uniqIds.length === 0) {
        setResolvedTasks([]);
        setResolvedRoles([]);
        setResolvedEscrows([]);
        setStatusText(
          "Resolver: no AgentGuild objects found in recent tx history.",
        );
        return;
      }

      const objs = await suiClient.multiGetObjects({
        ids: uniqIds,
        options: { showContent: true, showType: true },
      });

      const nextTasks: Array<{ id: string; title: string }> = [];
      const nextRoles: Array<{ id: string; taskId: string; label: string }> =
        [];
      const nextEscrows: Array<{ id: string; taskId: string }> = [];

      for (const obj of objs) {
        const id = obj.data?.objectId ?? "";
        const objectType = String(obj.data?.type ?? "");
        const fields =
          (
            obj.data?.content as
              | { fields?: Record<string, unknown> }
              | undefined
          )?.fields ?? {};
        if (objectType.endsWith("::task::Task")) {
          nextTasks.push({ id, title: String(fields.title ?? "") });
        } else if (objectType.endsWith("::task::Role")) {
          nextRoles.push({
            id,
            taskId: String(fields.task_id ?? ""),
            label: String(fields.label ?? ""),
          });
        } else if (objectType.endsWith("::escrow::Escrow")) {
          nextEscrows.push({
            id,
            taskId: String(fields.task_id ?? ""),
          });
        }
      }

      setResolvedTasks(nextTasks);
      setResolvedRoles(nextRoles);
      setResolvedEscrows(nextEscrows);

      const taskId = resolverTaskId || claimTaskId || nextTasks[0]?.id;
      if (taskId) {
        const role = nextRoles.find((r) => r.taskId === taskId);
        const escrow = nextEscrows.find((e) => e.taskId === taskId);
        setClaimTaskId(taskId);
        if (role) setClaimRoleId(role.id);
        if (escrow) setClaimEscrowId(escrow.id);
        if (escrow) {
          setEscrowByTask((prev) => ({ ...prev, [taskId]: escrow.id }));
        }
      }
      if (profiles[0]?.id) setClaimProfileId((prev) => prev || profiles[0]!.id);

      setStatusText(
        "Resolver completed: task, role, and escrow were successfully scanned from transaction history.",
      );
    } catch (e) {
      setStatusText(
        e instanceof Error ? `Resolver error: ${e.message}` : "Resolver error",
      );
    } finally {
      setResolverLoading(false);
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>AgentGuild</h1>
        <p>Autonomous task guilds with proof-backed payouts.</p>
        <ConnectButton />
        <p className="wallet-line">
          Wallet: {account ? short(account.address) : "Not connected"}
        </p>
        <p className="wallet-line">SUI Balance: {walletBalanceSui}</p>
        <p className="wallet-line">
          Connector: {currentWallet.currentWallet?.name ?? "None"}
        </p>
        {currentWallet.currentWallet &&
          !currentWallet.currentWallet.name.toLowerCase().includes("slush") && (
            <p className="wallet-line warn">
              Use Slush wallet for this demo flow.
            </p>
          )}

        <nav>
          <button
            className={panel === "tasks" ? "nav-btn active" : "nav-btn"}
            onClick={() => setPanel("tasks")}
          >
            Task Board
          </button>
          <button
            className={panel === "artifacts" ? "nav-btn active" : "nav-btn"}
            onClick={() => setPanel("artifacts")}
          >
            Artifacts
          </button>
          <button
            className={panel === "verifier" ? "nav-btn active" : "nav-btn"}
            onClick={() => setPanel("verifier")}
          >
            Verification
          </button>
        </nav>
      </aside>

      <main className="content">
        <div className="status">{statusText}</div>
        <div className="status">
          {loading
            ? "Loading on-chain data..."
            : `On-chain loaded: ${tasks.length} tasks`}
        </div>
        {panel === "tasks" && (
          <section className="panel">
            <header className="panel-head">
              <h2>Live Tasks</h2>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </header>

            {selectedTask && (
              <article className="card">
                <div className="card-head">
                  <h3>{selectedTask.title}</h3>
                  <span className={STATUS_STYLES[selectedTask.status]}>
                    {selectedTask.status}
                  </span>
                </div>
                <p>{selectedTask.description}</p>
                <div className="meta">
                  <span>
                    Budget: {Number(selectedTask.budgetMist) / 1_000_000_000}{" "}
                    SUI
                  </span>
                  <span>
                    Deadline:{" "}
                    {new Date(selectedTask.deadlineMs).toLocaleString()}
                  </span>
                </div>
              </article>
            )}

            <article className="card">
              <h3>Create Profile</h3>
              <label>
                Handle
                <input
                  value={profileHandle}
                  onChange={(e) => setProfileHandle(e.target.value)}
                  placeholder="agent.handle"
                />
              </label>
              <label>
                Metadata URI
                <input
                  value={profileMetadataUri}
                  onChange={(e) => setProfileMetadataUri(e.target.value)}
                  placeholder="https://..."
                />
              </label>
              <button
                onClick={async () => {
                  const tx = new Transaction();
                  tx.moveCall({
                    target: `${AGENTGUILD.packageId}::profile::create_profile`,
                    arguments: [
                      tx.pure.string(profileHandle),
                      tx.pure.string(profileMetadataUri),
                    ],
                  });
                  await execTx(tx);
                }}
              >
                Create Profile On-chain
              </button>
            </article>

            <article className="card">
              <h3>Create Task</h3>
              <label>
                Title
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                />
              </label>
              <label>
                Description
                <input
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Task description"
                />
              </label>
              <label>
                Verifier Address
                <input
                  value={taskVerifier}
                  onChange={(e) => setTaskVerifier(e.target.value)}
                  placeholder="0x..."
                />
              </label>
              <label>
                Budget (SUI)
                <input
                  value={taskBudgetSui}
                  onChange={(e) => setTaskBudgetSui(e.target.value)}
                  placeholder="5"
                />
              </label>
              <label>
                Deadline
                <input
                  type="datetime-local"
                  value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                />
              </label>
              <button
                onClick={async () => {
                  if (!taskVerifier) {
                    setStatusText("Verifier address is required.");
                    return;
                  }
                  const deadlineMs = taskDeadline
                    ? new Date(taskDeadline).getTime()
                    : Date.now() + 24 * 60 * 60 * 1000;
                  const tx = new Transaction();
                  tx.moveCall({
                    target: `${AGENTGUILD.packageId}::task::create_task`,
                    arguments: [
                      tx.object(AGENTGUILD.boardId),
                      tx.pure.string(taskTitle),
                      tx.pure.string(taskDescription),
                      tx.pure.address(taskVerifier),
                      tx.pure.u64(toMist(taskBudgetSui)),
                      tx.pure.u64(BigInt(deadlineMs)),
                    ],
                  });
                  await execTx(tx);
                }}
              >
                Create Task On-chain
              </button>
            </article>

            <article className="card">
              <h3>Fund Task</h3>
              <label>
                Task Object ID
                <input
                  value={fundTaskId}
                  onChange={(e) => setFundTaskId(e.target.value)}
                  placeholder={selectedTask?.id ?? "0x..."}
                />
              </label>
              <label>
                Amount (SUI)
                <input
                  value={fundAmountSui}
                  onChange={(e) => setFundAmountSui(e.target.value)}
                  placeholder="5"
                />
              </label>
              <button
                onClick={async () => {
                  const taskId = fundTaskId || selectedTask?.id;
                  if (!taskId) {
                    setStatusText("Task object ID is required.");
                    return;
                  }
                  const tx = new Transaction();
                  const [payment] = tx.splitCoins(tx.gas, [
                    tx.pure.u64(toMist(fundAmountSui)),
                  ]);
                  tx.moveCall({
                    target: `${AGENTGUILD.packageId}::escrow::fund_task`,
                    arguments: [tx.object(taskId), payment],
                  });
                  const result = (await execTx(tx)) as {
                    objectChanges?: Array<{
                      type?: string;
                      objectType?: string;
                      objectId?: string;
                    }>;
                  } | null;
                  const escrowId = result?.objectChanges?.find(
                    (c) =>
                      c.type === "created" &&
                      c.objectType?.endsWith("::escrow::Escrow"),
                  )?.objectId;
                  if (escrowId) {
                    setEscrowByTask((prev) => ({
                      ...prev,
                      [taskId]: escrowId,
                    }));
                    setClaimTaskId(taskId);
                    setClaimEscrowId(escrowId);
                  }
                }}
              >
                Fund Task On-chain
              </button>
            </article>

            <article className="card">
              <h3>Add Role</h3>
              <label>
                Role Label
                <input
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  placeholder="Analyst"
                />
              </label>
              <label>
                Reward (SUI)
                <input
                  value={roleRewardSui}
                  onChange={(e) => setRoleRewardSui(e.target.value)}
                  placeholder="2"
                />
              </label>
              <button
                onClick={async () => {
                  if (!selectedTask) return;
                  const tx = new Transaction();
                  tx.moveCall({
                    target: `${AGENTGUILD.packageId}::task::add_role`,
                    arguments: [
                      tx.object(selectedTask.id),
                      tx.pure.string(roleLabel),
                      tx.pure.u64(
                        BigInt(
                          Math.floor(
                            Number(roleRewardSui || "0") * 1_000_000_000,
                          ),
                        ),
                      ),
                    ],
                  });
                  await execTx(tx);
                }}
              >
                Add Role On-chain
              </button>
            </article>

            <article className="card">
              <h3>Roles</h3>
              <ul className="list">
                {selectedRoles.map((role) => (
                  <li key={role.id}>
                    <div>
                      <strong>{role.label}</strong>
                      <small>
                        {Number(role.rewardMist) / 1_000_000_000} SUI
                      </small>
                    </div>
                    <div className="actions">
                      <button
                        onClick={async () => {
                          if (!selectedTask) return;
                          const tx = new Transaction();
                          tx.moveCall({
                            target: `${AGENTGUILD.packageId}::task::join_role`,
                            arguments: [
                              tx.object(role.id),
                              tx.object(selectedTask.id),
                            ],
                          });
                          await execTx(tx);
                        }}
                      >
                        Join
                      </button>
                      <div className="tag">
                        {role.assignee ? short(role.assignee) : "Unassigned"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        )}

        {panel === "artifacts" && (
          <section className="panel">
            <header className="panel-head">
              <h2>Task Artifacts</h2>
            </header>

            <article className="card">
              <h3>Submit Artifact</h3>
              <label>
                URI
                <input
                  value={newArtifactUri}
                  onChange={(e) => setNewArtifactUri(e.target.value)}
                  placeholder="walrus://blob/..."
                />
              </label>
              <label>
                Content Hash
                <input
                  value={newArtifactHash}
                  onChange={(e) => setNewArtifactHash(e.target.value)}
                  placeholder="0x..."
                />
              </label>
              <button
                onClick={async () => {
                  if (!selectedTask || selectedRoles.length === 0) return;
                  const tx = new Transaction();
                  tx.moveCall({
                    target: `${AGENTGUILD.packageId}::artifact::submit_artifact`,
                    arguments: [
                      tx.object(selectedTask.id),
                      tx.object(selectedRoles[0].id),
                      tx.pure.string(newArtifactUri),
                      tx.pure.string(newArtifactHash),
                      tx.object(AGENTGUILD.clockId),
                    ],
                  });
                  await execTx(tx);
                  setNewArtifactUri("");
                  setNewArtifactHash("");
                }}
              >
                Submit On-chain
              </button>
            </article>

            <article className="card">
              <h3>Claim Role Reward</h3>
              <div className="meta">
                <span>
                  Claimable:{" "}
                  {(Number(claimableMist) / 1_000_000_000).toFixed(4)} SUI
                </span>
                <span>{claimStatus}</span>
              </div>
              <div className="resolver-box">
                <strong>Escrow Resolver</strong>
                <label>
                  Task ID (optional, for filtering)
                  <input
                    value={resolverTaskId}
                    onChange={(e) => setResolverTaskId(e.target.value)}
                    placeholder={claimTaskId || selectedTask?.id || "0x..."}
                  />
                </label>
                <button onClick={resolveFromHistory} disabled={resolverLoading}>
                  {resolverLoading ? "Scanning..." : "Scan Tx History"}
                </button>
                <small>
                  Found: {resolvedTasks.length} task, {resolvedRoles.length}{" "}
                  role, {resolvedEscrows.length} escrow
                </small>
              </div>
              <label>
                Task Object ID
                <input
                  value={claimTaskId}
                  onChange={(e) => setClaimTaskId(e.target.value)}
                  placeholder="0x..."
                />
              </label>
              <label>
                Role Object ID
                <input
                  value={claimRoleId}
                  onChange={(e) => setClaimRoleId(e.target.value)}
                  placeholder="0x..."
                />
              </label>
              <label>
                Escrow Object ID
                <input
                  value={claimEscrowId || autoEscrowId}
                  onChange={(e) => setClaimEscrowId(e.target.value)}
                  placeholder="0x..."
                />
              </label>
              <label>
                Profile Object ID
                <input
                  value={claimProfileId || autoProfileId}
                  onChange={(e) => setClaimProfileId(e.target.value)}
                  placeholder="0x..."
                />
              </label>
              <button
                disabled={claimStatus !== "Ready to claim"}
                onClick={async () => {
                  if (
                    !claimTaskId ||
                    !claimRoleId ||
                    !resolvedEscrowId ||
                    !resolvedProfileId
                  ) {
                    setStatusText(
                      "Task, role, escrow, and profile IDs are required.",
                    );
                    return;
                  }
                  const tx = new Transaction();
                  tx.moveCall({
                    target: `${AGENTGUILD.packageId}::escrow::claim_role_reward`,
                    arguments: [
                      tx.object(claimTaskId),
                      tx.object(claimRoleId),
                      tx.object(resolvedEscrowId),
                      tx.object(resolvedProfileId),
                    ],
                  });
                  await execTx(tx);
                }}
              >
                Claim Reward On-chain
              </button>
            </article>

            <article className="card">
              <h3>Submitted</h3>
              <ul className="list">
                {selectedArtifacts.map((artifact) => (
                  <li key={artifact.id}>
                    <div>
                      <strong>{artifact.uri}</strong>
                      <small>{artifact.contentHash}</small>
                    </div>
                    <div className="tag">{short(artifact.submitter)}</div>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        )}

        {panel === "verifier" && (
          <section className="panel">
            <header className="panel-head">
              <h2>Verification Queue</h2>
            </header>

            <article className="card grid-two">
              {selectedRoles.map((role) => (
                <div key={role.id} className="role-box">
                  {(() => {
                    const roleArtifacts = selectedArtifacts
                      .filter((a) => a.roleId === role.id)
                      .sort((a, b) => b.createdMs - a.createdMs);
                    const latestArtifact = roleArtifacts[0];
                    return (
                      <>
                        <h3>{role.label}</h3>
                        <p>
                          Assignee:{" "}
                          {role.assignee ? short(role.assignee) : "None"}
                        </p>
                        <p>
                          Reward: {Number(role.rewardMist) / 1_000_000_000} SUI
                        </p>
                        <p>
                          Latest Submission:{" "}
                          {latestArtifact
                            ? `${latestArtifact.uri} (${artifactStatusLabel(latestArtifact.status)})`
                            : "No submission"}
                        </p>
                        <div className="actions">
                          <button
                            disabled={!latestArtifact}
                            onClick={async () => {
                              if (!selectedTask || !latestArtifact) return;
                              const tx = new Transaction();
                              tx.moveCall({
                                target: `${AGENTGUILD.packageId}::artifact::verify_artifact`,
                                arguments: [
                                  tx.object(selectedTask.id),
                                  tx.object(role.id),
                                  tx.object(latestArtifact.id),
                                  tx.pure.bool(true),
                                  tx.object(AGENTGUILD.clockId),
                                ],
                              });
                              await execTx(tx);
                            }}
                          >
                            Approve
                          </button>
                          <button
                            className="ghost"
                            disabled={!latestArtifact}
                            onClick={async () => {
                              if (!selectedTask || !latestArtifact) return;
                              const tx = new Transaction();
                              tx.moveCall({
                                target: `${AGENTGUILD.packageId}::artifact::verify_artifact`,
                                arguments: [
                                  tx.object(selectedTask.id),
                                  tx.object(role.id),
                                  tx.object(latestArtifact.id),
                                  tx.pure.bool(false),
                                  tx.object(AGENTGUILD.clockId),
                                ],
                              });
                              await execTx(tx);
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </article>

            <article className="card">
              <button
                onClick={async () => {
                  if (!selectedTask) return;
                  const tx = new Transaction();
                  tx.moveCall({
                    target: `${AGENTGUILD.packageId}::task::finalize_task`,
                    arguments: [tx.object(selectedTask.id)],
                  });
                  await execTx(tx);
                }}
              >
                Finalize Task
              </button>
            </article>

            <article className="card">
              <h3>Top Agents</h3>
              <ul className="list">
                {profiles.map((profile) => (
                  <li key={profile.id}>
                    <div>
                      <strong>{profile.handle}</strong>
                      <small>{short(profile.owner)}</small>
                    </div>
                    <div className="tag">
                      {profile.approvals}/{profile.completedTasks}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

function short(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function toMist(suiAmount: string) {
  const amount = Number(suiAmount || "0");
  return BigInt(Math.floor(amount * 1_000_000_000));
}

function normalizeIdVector(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "object" && value !== null) {
    const v = value as { fields?: unknown; id?: unknown };
    if (Array.isArray(v.fields)) return v.fields.map(String);
    if (Array.isArray(v.id)) return v.id.map(String);
  }
  return [];
}

function parseTask(id: string, content: unknown) {
  const fields = (content as { fields?: Record<string, unknown> } | undefined)
    ?.fields;
  if (!fields) return null;
  const status = Number(fields.status ?? 0);
  return {
    id,
    creator: String(fields.creator ?? ""),
    verifier: String(fields.verifier ?? ""),
    title: String(fields.title ?? ""),
    description: String(fields.description ?? ""),
    budgetMist: BigInt(String(fields.budget_mist ?? "0")),
    deadlineMs: Number(fields.deadline_ms ?? 0),
    status: mapStatus(status),
    roleIds: normalizeIdVector(fields.role_ids),
    artifactIds: normalizeIdVector(fields.artifact_ids),
    payoutClaimed: Boolean(fields.payout_claimed),
  };
}

function parseRole(id: string, content: unknown) {
  const fields = (content as { fields?: Record<string, unknown> } | undefined)
    ?.fields;
  if (!fields) return null;
  const assigneeObj = fields.assignee as { vec?: string[] } | undefined;
  return {
    id,
    taskId: String(fields.task_id ?? ""),
    label: String(fields.label ?? ""),
    rewardMist: BigInt(String(fields.reward_mist ?? "0")),
    assignee: assigneeObj?.vec?.[0],
    approved: Boolean(fields.approved),
  };
}

function parseArtifact(id: string, content: unknown) {
  const fields = (content as { fields?: Record<string, unknown> } | undefined)
    ?.fields;
  if (!fields) return null;
  return {
    id,
    taskId: String(fields.task_id ?? ""),
    roleId: String(fields.role_id ?? ""),
    submitter: String(fields.submitter ?? ""),
    uri: String(fields.uri ?? ""),
    contentHash: String(fields.content_hash ?? ""),
    createdMs: Number(fields.created_ms ?? 0),
    status: Number(fields.status ?? 0),
    reviewedMs: Number(fields.reviewed_ms ?? 0),
  };
}

function parseProfile(id: string, content: unknown) {
  const fields = (content as { fields?: Record<string, unknown> } | undefined)
    ?.fields;
  if (!fields) return null;
  return {
    id,
    owner: String(fields.owner ?? ""),
    handle: String(fields.handle ?? ""),
    metadataUri: String(fields.metadata_uri ?? ""),
    completedTasks: Number(fields.completed_tasks ?? 0),
    approvals: Number(fields.approvals ?? 0),
  };
}

function mapStatus(status: number): TaskStatus {
  if (status === 1) return "active";
  if (status === 2) return "submitted";
  if (status === 3) return "approved";
  if (status === 4) return "rejected";
  if (status === 5) return "closed";
  return "open";
}

function artifactStatusLabel(status: number) {
  if (status === 1) return "approved";
  if (status === 2) return "rejected";
  return "pending";
}
