import "server-only";

import type { MembershipRole, SessionActor } from "@/lib/auth/types";
import { getPrismaClient } from "@/lib/db/client";
import {
  type CreateProjectInput,
  type ProjectDto,
} from "@/lib/domain/project";
import { assertPermission } from "@/lib/security/permissions";

import { appendDemoProject, demoStore, type DemoProjectRecord } from "./demo-store";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);
}

function toStatusLabel(status: string): ProjectDto["status"] {
  if (status === "ACTIVE") return "Active";
  if (status === "UNDER_REVIEW") return "Under review";
  if (status === "ARCHIVED") return "Archived";
  return "Draft";
}

function demoProjectToDto(project: DemoProjectRecord): ProjectDto {
  return {
    id: project.id,
    publicId: project.publicId,
    name: project.name,
    slug: project.slug,
    domain: project.domain,
    purpose: project.purpose,
    status: toStatusLabel(project.status),
    memberCount: project.memberCount,
    ownerName: project.ownerName,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function toDatabaseRole(role: MembershipRole) {
  return role;
}

export async function listProjects(actor: SessionActor) {
  assertPermission(actor, "project:read");
  const prisma = getPrismaClient();

  if (!prisma) {
    return demoStore.projects
      .filter((project) => project.tenantId === actor.tenantId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(demoProjectToDto);
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      actor.tenantId,
    );
    const projects = await transaction.project.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        publicId: true,
        name: true,
        slug: true,
        domain: true,
        purpose: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
        _count: { select: { members: true } },
      },
    });

    return projects.map((project) => ({
      id: project.id,
      publicId: project.publicId,
      name: project.name,
      slug: project.slug,
      domain: project.domain,
      purpose: project.purpose,
      status: toStatusLabel(project.status),
      memberCount: project._count.members,
      ownerName: project.createdBy.name,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }));
  });
}

export async function createProject(
  actor: SessionActor,
  input: CreateProjectInput,
  correlationId: string,
) {
  assertPermission(actor, "project:create");
  const prisma = getPrismaClient();
  const now = new Date();

  if (!prisma) {
    const baseSlug = slugify(input.name) || "research-project";
    const hasConflict = demoStore.projects.some(
      (project) =>
        project.tenantId === actor.tenantId && project.slug === baseSlug,
    );
    return demoProjectToDto(
      appendDemoProject(
        {
          tenantId: actor.tenantId,
          slug: hasConflict ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug,
          name: input.name,
          domain: input.domain,
          purpose: input.purpose,
          status: "DRAFT",
          memberCount: 1,
          ownerName: actor.name,
          createdById: actor.userId,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        correlationId,
      ),
    );
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      actor.tenantId,
    );

    const baseSlug = slugify(input.name) || "research-project";
    const existing = await transaction.project.count({
      where: { tenantId: actor.tenantId, slug: { startsWith: baseSlug } },
    });
    const slug = existing ? `${baseSlug}-${existing + 1}` : baseSlug;
    const publicId = `PRJ-${Date.now().toString(36).toUpperCase()}`;

    const project = await transaction.project.create({
      data: {
        tenantId: actor.tenantId,
        publicId,
        slug,
        name: input.name,
        domain: input.domain,
        purpose: input.purpose,
        status: "DRAFT",
        createdById: actor.userId,
      },
    });

    await transaction.projectMember.create({
      data: {
        projectId: project.id,
        membershipId: actor.membershipId,
        role: toDatabaseRole(actor.role),
      },
    });
    await transaction.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        projectId: project.id,
        actorType: "user",
        actorId: actor.userId,
        action: "project.created",
        resourceType: "Project",
        resourceId: project.id,
        correlationId,
        metadata: { publicId },
      },
    });
    await transaction.outboxEvent.create({
      data: {
        tenantId: actor.tenantId,
        projectId: project.id,
        eventType: "project.created.v1",
        aggregateType: "Project",
        aggregateId: project.id,
        correlationId,
        payload: {
          projectId: project.id,
          publicId,
          actorId: actor.userId,
        },
      },
    });

    return {
      id: project.id,
      publicId: project.publicId,
      name: project.name,
      slug: project.slug,
      domain: project.domain,
      purpose: project.purpose,
      status: toStatusLabel(project.status),
      memberCount: 1,
      ownerName: actor.name,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    } satisfies ProjectDto;
  });
}
