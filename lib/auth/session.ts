import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { membershipRoles, type SessionActor } from "./types";

export const sessionCookieName = "chemcider_session";

export const demoActor: SessionActor = {
  userId: "d26f2d48-d5a4-4fd6-aa42-43298f8c6027",
  membershipId: "ac10d2d7-a4d3-4c93-b80a-b62619f38e41",
  tenantId: "7af73ab2-d2ad-4bd4-b355-553d6260fe9d",
  tenantName: "Chemcider University Lab",
  name: "Amara Bello",
  email: "amara.bello@demo.chemcider.com",
  role: "RESEARCHER",
};

type SessionPayload = SessionActor & {
  issuedAt: number;
  expiresAt: number;
  version: 1;
};

export class AuthenticationError extends Error {
  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

function getSecret() {
  const configured = process.env.AUTH_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "local-development-only-change-before-deployment";
  }
  throw new Error("AUTH_SECRET must be configured in production.");
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function isSessionActor(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SessionPayload>;
  return (
    typeof candidate.userId === "string" &&
    typeof candidate.membershipId === "string" &&
    typeof candidate.tenantId === "string" &&
    typeof candidate.tenantName === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    membershipRoles.includes(candidate.role as SessionActor["role"]) &&
    candidate.version === 1 &&
    typeof candidate.issuedAt === "number" &&
    typeof candidate.expiresAt === "number"
  );
}

export function isDemoAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.CHEMCIDER_DEMO_AUTH !== "false"
  );
}

export function createSessionToken(
  actor: SessionActor,
  lifetimeSeconds = 8 * 60 * 60,
) {
  const now = Math.floor(Date.now() / 1_000);
  const payload: SessionPayload = {
    ...actor,
    issuedAt: now,
    expiresAt: now + lifetimeSeconds,
    version: 1,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string): SessionActor | null {
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) return null;

  const expectedSignature = sign(encoded);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as unknown;
    if (!isSessionActor(parsed) || parsed.expiresAt <= Date.now() / 1_000) {
      return null;
    }
    const {
      userId,
      membershipId,
      tenantId,
      tenantName,
      name,
      email,
      role,
    } = parsed;
    return {
      userId,
      membershipId,
      tenantId,
      tenantName,
      name,
      email,
      role,
    };
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const [key, ...valueParts] = item.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

export function getSessionActor(request: Request) {
  const token = readCookie(request, sessionCookieName);
  return token ? verifySessionToken(token) : null;
}

export function requireSessionActor(request: Request) {
  const actor = getSessionActor(request);
  if (!actor) throw new AuthenticationError();
  return actor;
}
