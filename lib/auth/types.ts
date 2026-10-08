export const membershipRoles = [
  "ADMIN",
  "LAB_MANAGER",
  "RESEARCHER",
  "REVIEWER",
  "STUDENT",
  "GUEST",
] as const;

export type MembershipRole = (typeof membershipRoles)[number];

export type SessionActor = {
  userId: string;
  membershipId: string;
  tenantId: string;
  tenantName: string;
  name: string;
  email: string;
  role: MembershipRole;
};
