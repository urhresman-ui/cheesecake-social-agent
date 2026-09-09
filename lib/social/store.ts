import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";

export type ContentType = "POST" | "STORY";
export type ContentKind = "IMAGE" | "VIDEO";
export type ProposalStatus = "pending" | "done" | "rejected";

export type Proposal = {
  id: string;
  type: ContentType;
  kind: ContentKind;
  status: ProposalStatus;
  driveFileId: string;
  driveFileName: string;
  driveViewUrl: string;
  mimeType: string;
  caption: string;
  burnText?: string;
  editSuggestion?: string;
  createdAt: number;
  completedAt?: number;
};

const IDS_KEY = "social:proposal:ids";
const PROPOSAL_KEY = (id: string) => `social:proposal:${id}`;
const USED_KEY = (type: ContentType) => `social:used:${type}`;
const MAX_PROPOSALS = 300;

function getRedis() {
  return Redis.fromEnv();
}

export async function createProposal(
  input: Omit<Proposal, "id" | "status" | "createdAt">
): Promise<Proposal> {
  const proposal: Proposal = {
    ...input,
    id: randomUUID(),
    status: "pending",
    createdAt: Date.now(),
  };
  const redis = getRedis();
  await redis.set(PROPOSAL_KEY(proposal.id), JSON.stringify(proposal));
  await redis.lpush(IDS_KEY, proposal.id);
  await redis.ltrim(IDS_KEY, 0, MAX_PROPOSALS - 1);
  return proposal;
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const redis = getRedis();
  const raw = await redis.get<string | Proposal>(PROPOSAL_KEY(id));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function listProposals(status?: ProposalStatus): Promise<Proposal[]> {
  const redis = getRedis();
  const ids = await redis.lrange<string>(IDS_KEY, 0, MAX_PROPOSALS - 1);
  if (ids.length === 0) return [];
  const raw = await redis.mget<(string | Proposal | null)[]>(
    ...ids.map(PROPOSAL_KEY)
  );
  const proposals = raw
    .filter((entry): entry is string | Proposal => entry !== null)
    .map((entry) => (typeof entry === "string" ? JSON.parse(entry) : entry));
  return status ? proposals.filter((p) => p.status === status) : proposals;
}

export async function updateProposal(
  id: string,
  patch: Partial<Pick<Proposal, "status" | "caption" | "burnText" | "completedAt">>
): Promise<Proposal | null> {
  const existing = await getProposal(id);
  if (!existing) return null;
  const updated: Proposal = { ...existing, ...patch };
  const redis = getRedis();
  await redis.set(PROPOSAL_KEY(id), JSON.stringify(updated));
  return updated;
}

export async function getUsedFileIds(type: ContentType): Promise<Set<string>> {
  const redis = getRedis();
  const members = await redis.smembers(USED_KEY(type));
  return new Set(members);
}

export async function markFileUsed(type: ContentType, driveFileId: string): Promise<void> {
  const redis = getRedis();
  await redis.sadd(USED_KEY(type), driveFileId);
}
