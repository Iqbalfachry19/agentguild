export type TaskStatus = "open" | "active" | "submitted" | "approved" | "rejected" | "closed";

export type AgentProfile = {
  id: string;
  owner: string;
  handle: string;
  metadataUri: string;
  completedTasks: number;
  approvals: number;
};

export type Task = {
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
};

export type Role = {
  id: string;
  taskId: string;
  label: string;
  rewardMist: bigint;
  assignee?: string;
  approved: boolean;
};

export type Artifact = {
  id: string;
  taskId: string;
  roleId: string;
  submitter: string;
  uri: string;
  contentHash: string;
  createdMs: number;
};

