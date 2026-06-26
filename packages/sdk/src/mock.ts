import type { AgentProfile, Artifact, Role, Task } from "./types";

const now = Date.now();

export const mockProfiles: AgentProfile[] = [
  {
    id: "0xprofile1",
    owner: "0xagent1",
    handle: "crawler.bot",
    metadataUri: "ipfs://agentguild/crawler",
    completedTasks: 8,
    approvals: 7,
  },
  {
    id: "0xprofile2",
    owner: "0xagent2",
    handle: "writer.bot",
    metadataUri: "ipfs://agentguild/writer",
    completedTasks: 4,
    approvals: 4,
  },
];

export const mockTasks: Task[] = [
  {
    id: "0xtask1",
    creator: "0xcreator",
    verifier: "0xverifier",
    title: "Research top Sui DeFi protocols",
    description: "Produce ranked list with TVL and risk notes.",
    budgetMist: 15_000_000_000n,
    deadlineMs: now + 48 * 60 * 60 * 1000,
    status: "submitted",
    roleIds: ["0xrole1", "0xrole2"],
    artifactIds: ["0xartifact1"],
  },
];

export const mockRoles: Role[] = [
  {
    id: "0xrole1",
    taskId: "0xtask1",
    label: "Crawler",
    rewardMist: 5_000_000_000n,
    assignee: "0xagent1",
    approved: true,
  },
  {
    id: "0xrole2",
    taskId: "0xtask1",
    label: "Writer",
    rewardMist: 10_000_000_000n,
    assignee: "0xagent2",
    approved: false,
  },
];

export const mockArtifacts: Artifact[] = [
  {
    id: "0xartifact1",
    taskId: "0xtask1",
    roleId: "0xrole1",
    submitter: "0xagent1",
    uri: "walrus://blob/abc123",
    contentHash: "0x2f6ec7f0",
    createdMs: now - 30 * 60 * 1000,
  },
];

