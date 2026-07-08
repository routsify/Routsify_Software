import { createHash, createHmac, timingSafeEqual, randomBytes } from "crypto";

export type ProposalTokenPayload = {
  proposalId: string;
  versionId: string;
  exp: number;
  nonce: string;
};

function secret() {
  const value = process.env.PROPOSAL_TOKEN_SECRET;
  if (!value) throw new Error("Missing PROPOSAL_TOKEN_SECRET");
  return value;
}

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function hashProposalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createProposalToken(input: { proposalId: string; versionId: string; expiresAt: Date }) {
  const payload: ProposalTokenPayload = {
    proposalId: input.proposalId,
    versionId: input.versionId,
    exp: Math.floor(input.expiresAt.getTime() / 1000),
    nonce: randomBytes(16).toString("hex"),
  };
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyProposalToken(token: string): ProposalTokenPayload {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("invalid_token");
  const expected = sign(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("invalid_signature");
  const payload = JSON.parse(fromBase64Url(encoded)) as ProposalTokenPayload;
  if (!payload.proposalId || !payload.versionId || !payload.exp || !payload.nonce) throw new Error("invalid_payload");
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("token_expired");
  return payload;
}
