import "server-only";

import type { MembershipRole, SessionActor } from "@/lib/auth/types";

export type Permission =
  | "project:read"
  | "project:create"
  | "project:update"
  | "project:archive"
  | "sample:register"
  | "spectrum:upload"
  | "review:submit"
  | "review:decide"
  | "instrument:manage";

const grants: Record<MembershipRole, ReadonlySet<Permission>> = {
  ADMIN: new Set([
    "project:read",
    "project:create",
    "project:update",
    "project:archive",
    "sample:register",
    "spectrum:upload",
    "review:submit",
    "review:decide",
    "instrument:manage",
  ]),
  LAB_MANAGER: new Set([
    "project:read",
    "project:create",
    "project:update",
    "sample:register",
    "spectrum:upload",
    "review:submit",
    "review:decide",
    "instrument:manage",
  ]),
  RESEARCHER: new Set([
    "project:read",
    "project:create",
    "project:update",
    "sample:register",
    "spectrum:upload",
    "review:submit",
  ]),
  REVIEWER: new Set(["project:read", "review:decide"]),
  STUDENT: new Set([
    "project:read",
    "sample:register",
    "spectrum:upload",
    "review:submit",
  ]),
  GUEST: new Set(["project:read"]),
};

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function can(actor: SessionActor, permission: Permission) {
  return grants[actor.role].has(permission);
}

export function assertPermission(
  actor: SessionActor,
  permission: Permission,
) {
  if (!can(actor, permission)) throw new AuthorizationError();
}

export function assertTenantScope(actor: SessionActor, tenantId: string) {
  if (actor.tenantId !== tenantId) {
    throw new AuthorizationError("The requested record is outside this workspace.");
  }
}
