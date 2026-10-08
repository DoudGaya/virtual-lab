import "server-only";

import { randomUUID } from "node:crypto";

import type { SessionActor } from "@/lib/auth/types";
import { getPrismaClient } from "@/lib/db/client";
import type {
  CreateUploadIntentInput,
  SpectrumDto,
  UploadIntentDto,
} from "@/lib/domain/upload";
import type { NormalizedSpectrum } from "@/lib/science/spectrum-parser";
import { spectrumLimits } from "@/lib/science/spectrum-parser";
import { assertPermission, AuthorizationError } from "@/lib/security/permissions";

import {
  appendDemoSpectrum,
  appendDemoUploadIntent,
  demoStore,
  type DemoSpectrumRecord,
  type DemoUploadIntentRecord,
} from "./demo-store";

export const spectrumParser = {
  name: "chemcider-text-spectrum-parser",
  version: "0.1.0",
} as const;

export class UploadWorkflowError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "UploadWorkflowError";
    this.code = code;
    this.status = status;
  }
}

export type AuthorizedUploadIntent = {
  id: string;
  tenantId: string;
  projectId: string;
  projectName: string;
  sampleId: string | null;
  requestedById: string;
  fileName: string;
  declaredContentType: string;
  expectedByteCount: number;
  expectedSha256: string | null;
  status: string;
  expiresAt: string;
};

function toIntentDto(intent: AuthorizedUploadIntent): UploadIntentDto {
  return {
    id: intent.id,
    projectId: intent.projectId,
    fileName: intent.fileName,
    expectedBytes: intent.expectedByteCount,
    status: "CREATED",
    expiresAt: intent.expiresAt,
    uploadUrl: `/api/v1/uploads/${intent.id}/content`,
    acceptedFormats: [".jdx", ".dx", ".jcamp", ".csv", ".tsv", ".txt"],
    maximumBytes: spectrumLimits.maximumBytes,
  };
}

function demoIntentToAuthorized(intent: DemoUploadIntentRecord): AuthorizedUploadIntent {
  const project = demoStore.projects.find((candidate) => candidate.id === intent.projectId);
  if (!project) throw new UploadWorkflowError("PROJECT_NOT_FOUND", "The selected project was not found.", 404);
  return {
    id: intent.id,
    tenantId: intent.tenantId,
    projectId: intent.projectId,
    projectName: project.name,
    sampleId: intent.sampleId,
    requestedById: intent.requestedById,
    fileName: intent.fileName,
    declaredContentType: intent.declaredContentType,
    expectedByteCount: intent.expectedByteCount,
    expectedSha256: intent.expectedSha256,
    status: intent.status,
    expiresAt: intent.expiresAt,
  };
}

function demoSpectrumToDto(spectrum: DemoSpectrumRecord): SpectrumDto {
  return { ...spectrum };
}

export async function createUploadIntent(
  actor: SessionActor,
  input: CreateUploadIntentInput,
) {
  assertPermission(actor, "spectrum:upload");
  const prisma = getPrismaClient();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1_000);

  if (!prisma) {
    const project = demoStore.projects.find(
      (candidate) => candidate.id === input.projectId && candidate.tenantId === actor.tenantId,
    );
    if (!project) throw new AuthorizationError("The selected project is not available in this workspace.");
    const intent = appendDemoUploadIntent({
      tenantId: actor.tenantId,
      projectId: input.projectId,
      sampleId: input.sampleId ?? null,
      requestedById: actor.userId,
      fileName: input.fileName,
      declaredContentType: input.contentType,
      expectedByteCount: input.expectedBytes,
      expectedSha256: input.expectedSha256 ?? null,
      idempotencyKey: input.idempotencyKey,
      expiresAt: expiresAt.toISOString(),
    });
    return toIntentDto(demoIntentToAuthorized(intent));
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      actor.tenantId,
    );
    const project = await transaction.project.findFirst({
      where: { id: input.projectId, tenantId: actor.tenantId },
      select: { id: true, name: true },
    });
    if (!project) throw new AuthorizationError("The selected project is not available in this workspace.");
    if (input.sampleId) {
      const sample = await transaction.sample.findFirst({
        where: { id: input.sampleId, projectId: project.id, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!sample) throw new AuthorizationError("The selected sample is not available in this project.");
    }

    const existing = await transaction.uploadIntent.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: actor.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { project: { select: { name: true } } },
    });
    const intent = existing ?? await transaction.uploadIntent.create({
      data: {
        tenantId: actor.tenantId,
        projectId: project.id,
        sampleId: input.sampleId,
        requestedById: actor.userId,
        fileName: input.fileName,
        declaredContentType: input.contentType,
        expectedByteCount: BigInt(input.expectedBytes),
        expectedSha256: input.expectedSha256,
        idempotencyKey: input.idempotencyKey,
        expiresAt,
      },
      include: { project: { select: { name: true } } },
    });
    return toIntentDto({
      id: intent.id,
      tenantId: intent.tenantId,
      projectId: intent.projectId,
      projectName: intent.project.name,
      sampleId: intent.sampleId,
      requestedById: intent.requestedById,
      fileName: intent.fileName,
      declaredContentType: intent.declaredContentType,
      expectedByteCount: Number(intent.expectedByteCount),
      expectedSha256: intent.expectedSha256,
      status: intent.status,
      expiresAt: intent.expiresAt.toISOString(),
    });
  });
}

export async function getUploadIntent(
  actor: SessionActor,
  intentId: string,
): Promise<AuthorizedUploadIntent> {
  assertPermission(actor, "spectrum:upload");
  const prisma = getPrismaClient();
  let intent: AuthorizedUploadIntent | null = null;

  if (!prisma) {
    const record = demoStore.uploadIntents.find(
      (candidate) => candidate.id === intentId && candidate.tenantId === actor.tenantId,
    );
    if (record) intent = demoIntentToAuthorized(record);
  } else {
    intent = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        "SELECT set_config('app.current_tenant_id', $1, true)",
        actor.tenantId,
      );
      const record = await transaction.uploadIntent.findFirst({
        where: { id: intentId, tenantId: actor.tenantId },
        include: { project: { select: { name: true } } },
      });
      return record ? {
        id: record.id,
        tenantId: record.tenantId,
        projectId: record.projectId,
        projectName: record.project.name,
        sampleId: record.sampleId,
        requestedById: record.requestedById,
        fileName: record.fileName,
        declaredContentType: record.declaredContentType,
        expectedByteCount: Number(record.expectedByteCount),
        expectedSha256: record.expectedSha256,
        status: record.status,
        expiresAt: record.expiresAt.toISOString(),
      } : null;
    });
  }

  if (!intent) throw new UploadWorkflowError("UPLOAD_INTENT_NOT_FOUND", "The upload intent was not found.", 404);
  if (intent.requestedById !== actor.userId) throw new AuthorizationError("Only the requesting user can complete this upload.");
  if (intent.status !== "CREATED") throw new UploadWorkflowError("UPLOAD_INTENT_USED", "This upload intent has already been used.", 409);
  if (new Date(intent.expiresAt).getTime() <= Date.now()) throw new UploadWorkflowError("UPLOAD_INTENT_EXPIRED", "This upload intent has expired.", 410);
  return intent;
}

export async function recordQuarantinedUpload(
  actor: SessionActor,
  intent: AuthorizedUploadIntent,
  file: {
    id: string;
    objectKey: string;
    contentType: string;
    byteCount: number;
    sha256: string;
  },
) {
  const prisma = getPrismaClient();
  if (!prisma) {
    const record = demoStore.uploadIntents.find((candidate) => candidate.id === intent.id);
    if (!record) throw new UploadWorkflowError("UPLOAD_INTENT_NOT_FOUND", "The upload intent was not found.", 404);
    record.status = "PARSING";
    record.originalFileId = file.id;
    return;
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      actor.tenantId,
    );
    await transaction.originalFile.create({
      data: {
        id: file.id,
        tenantId: actor.tenantId,
        projectId: intent.projectId,
        objectKey: file.objectKey,
        fileName: intent.fileName,
        contentType: file.contentType,
        byteCount: BigInt(file.byteCount),
        sha256: file.sha256,
        lifecycle: "PARSING",
        uploadedById: actor.userId,
        metadata: { declaredContentType: intent.declaredContentType },
      },
    });
    await transaction.uploadIntent.update({
      where: { id: intent.id },
      data: { status: "PARSING", originalFileId: file.id },
    });
  });
}

export async function completeParsedUpload(
  actor: SessionActor,
  intent: AuthorizedUploadIntent,
  originalFile: { id: string; sha256: string },
  artifact: { objectKey: string; byteCount: number; sha256: string },
  parsed: NormalizedSpectrum,
  correlationId: string,
) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return demoSpectrumToDto(appendDemoSpectrum(
      intent.id,
      {
        tenantId: actor.tenantId,
        projectId: intent.projectId,
        projectName: intent.projectName,
        sampleId: intent.sampleId,
        title: parsed.title,
        fileName: intent.fileName,
        technique: parsed.technique,
        format: parsed.format,
        xUnit: parsed.xUnit,
        yUnit: parsed.yUnit,
        pointCount: parsed.pointCount,
        xMin: parsed.xMin,
        xMax: parsed.xMax,
        yMin: parsed.yMin,
        yMax: parsed.yMax,
        warnings: parsed.warnings,
        sha256: originalFile.sha256,
        status: "Draft",
      },
      originalFile.id,
      actor.userId,
      correlationId,
    ));
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      actor.tenantId,
    );
    const publicId = `DAT-${Date.now().toString(36).toUpperCase()}`;
    const spectrum = await transaction.spectrum.create({
      data: {
        tenantId: actor.tenantId,
        projectId: intent.projectId,
        sampleId: intent.sampleId,
        originalFileId: originalFile.id,
        publicId,
        technique: parsed.technique,
        xUnit: parsed.xUnit,
        yUnit: parsed.yUnit,
        pointCount: parsed.pointCount,
        status: "DRAFT",
        parserVersion: spectrumParser.version,
        qualitySummary: {
          format: parsed.format,
          title: parsed.title,
          xMin: parsed.xMin,
          xMax: parsed.xMax,
          yMin: parsed.yMin,
          yMax: parsed.yMax,
          axisDirection: parsed.axisDirection,
          warnings: parsed.warnings,
        },
      },
    });
    await transaction.parserRun.create({
      data: {
        tenantId: actor.tenantId,
        projectId: intent.projectId,
        originalFileId: originalFile.id,
        parserName: spectrumParser.name,
        parserVersion: spectrumParser.version,
        status: parsed.warnings.length ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
        warnings: parsed.warnings,
        completedAt: new Date(),
      },
    });
    await transaction.derivedArtifact.create({
      data: {
        tenantId: actor.tenantId,
        projectId: intent.projectId,
        originalFileId: originalFile.id,
        objectKey: artifact.objectKey,
        kind: "NORMALIZED_SPECTRUM",
        contentType: "application/json",
        byteCount: BigInt(artifact.byteCount),
        sha256: artifact.sha256,
        provenance: {
          parser: spectrumParser.name,
          parserVersion: spectrumParser.version,
          inputSha256: originalFile.sha256,
        },
      },
    });
    await transaction.originalFile.update({
      where: { id: originalFile.id },
      data: { lifecycle: "READY" },
    });
    await transaction.uploadIntent.update({
      where: { id: intent.id },
      data: { status: "READY" },
    });
    await transaction.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        projectId: intent.projectId,
        actorType: "user",
        actorId: actor.userId,
        action: "spectrum.imported",
        resourceType: "Spectrum",
        resourceId: spectrum.id,
        correlationId,
        metadata: { publicId, sha256: originalFile.sha256 },
      },
    });
    await transaction.outboxEvent.create({
      data: {
        tenantId: actor.tenantId,
        projectId: intent.projectId,
        eventType: "spectrum.imported.v1",
        aggregateType: "Spectrum",
        aggregateId: spectrum.id,
        correlationId,
        payload: { spectrumId: spectrum.id, originalFileId: originalFile.id },
      },
    });

    return {
      id: spectrum.id,
      publicId,
      projectId: intent.projectId,
      projectName: intent.projectName,
      sampleId: intent.sampleId,
      title: parsed.title,
      fileName: intent.fileName,
      technique: parsed.technique,
      format: parsed.format,
      xUnit: parsed.xUnit,
      yUnit: parsed.yUnit,
      pointCount: parsed.pointCount,
      xMin: parsed.xMin,
      xMax: parsed.xMax,
      yMin: parsed.yMin,
      yMax: parsed.yMax,
      warnings: parsed.warnings,
      sha256: originalFile.sha256,
      status: "Draft",
      createdAt: spectrum.createdAt.toISOString(),
    } satisfies SpectrumDto;
  });
}

export async function rejectParsedUpload(
  actor: SessionActor,
  intent: AuthorizedUploadIntent,
  originalFileId: string,
  code: string,
) {
  const prisma = getPrismaClient();
  if (!prisma) {
    const record = demoStore.uploadIntents.find((candidate) => candidate.id === intent.id);
    if (record) record.status = "REJECTED";
    return;
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      actor.tenantId,
    );
    await transaction.originalFile.update({ where: { id: originalFileId }, data: { lifecycle: "REJECTED" } });
    await transaction.uploadIntent.update({ where: { id: intent.id }, data: { status: "REJECTED" } });
    await transaction.parserRun.create({
      data: {
        tenantId: actor.tenantId,
        projectId: intent.projectId,
        originalFileId,
        parserName: spectrumParser.name,
        parserVersion: spectrumParser.version,
        status: "FAILED",
        errorCode: code,
        completedAt: new Date(),
      },
    });
  });
}

function qualityNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function listSpectra(actor: SessionActor): Promise<SpectrumDto[]> {
  assertPermission(actor, "project:read");
  const prisma = getPrismaClient();
  if (!prisma) {
    return demoStore.spectra
      .filter((spectrum) => spectrum.tenantId === actor.tenantId)
      .map(demoSpectrumToDto);
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      actor.tenantId,
    );
    const spectra = await transaction.spectrum.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { name: true } },
        originalFile: { select: { fileName: true, sha256: true } },
      },
    });
    return spectra.map((spectrum) => {
      const quality = spectrum.qualitySummary && typeof spectrum.qualitySummary === "object"
        ? spectrum.qualitySummary as Record<string, unknown>
        : {};
      return {
        id: spectrum.id,
        publicId: spectrum.publicId,
        projectId: spectrum.projectId,
        projectName: spectrum.project.name,
        sampleId: spectrum.sampleId,
        title: typeof quality.title === "string" ? quality.title : spectrum.originalFile.fileName,
        fileName: spectrum.originalFile.fileName,
        technique: spectrum.technique,
        format: typeof quality.format === "string" ? quality.format : "Unknown",
        xUnit: spectrum.xUnit,
        yUnit: spectrum.yUnit,
        pointCount: spectrum.pointCount,
        xMin: qualityNumber(quality.xMin),
        xMax: qualityNumber(quality.xMax),
        yMin: qualityNumber(quality.yMin),
        yMax: qualityNumber(quality.yMax),
        warnings: Array.isArray(quality.warnings) ? quality.warnings.filter((item): item is string => typeof item === "string") : [],
        sha256: spectrum.originalFile.sha256,
        status: spectrum.status === "ACCEPTED" ? "Accepted" : spectrum.status === "UNDER_REVIEW" ? "Under review" : "Draft",
        createdAt: spectrum.createdAt.toISOString(),
      } satisfies SpectrumDto;
    });
  });
}

export function newOriginalFileId() {
  return randomUUID();
}
