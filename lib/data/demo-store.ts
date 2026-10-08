import "server-only";

import { randomUUID } from "node:crypto";

import { demoActor } from "@/lib/auth/session";

export type DemoProjectRecord = {
  id: string;
  tenantId: string;
  publicId: string;
  slug: string;
  name: string;
  domain: string;
  purpose: string;
  status: "DRAFT" | "ACTIVE" | "UNDER_REVIEW" | "ARCHIVED";
  memberCount: number;
  ownerName: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type DemoAuditEvent = {
  id: string;
  tenantId: string;
  projectId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  correlationId: string;
  occurredAt: string;
};

export type DemoOutboxEvent = {
  id: string;
  tenantId: string;
  projectId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  status: "PENDING";
  createdAt: string;
};

export type DemoUploadIntentRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  sampleId: string | null;
  requestedById: string;
  fileName: string;
  declaredContentType: string;
  expectedByteCount: number;
  expectedSha256: string | null;
  idempotencyKey: string;
  status: "CREATED" | "PARSING" | "READY" | "REJECTED" | "FAILED";
  expiresAt: string;
  originalFileId: string | null;
  createdAt: string;
};

export type DemoSpectrumRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  projectName: string;
  sampleId: string | null;
  publicId: string;
  title: string;
  fileName: string;
  technique: string;
  format: string;
  xUnit: string;
  yUnit: string;
  pointCount: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  warnings: string[];
  sha256: string;
  status: "Draft" | "Under review" | "Accepted";
  createdAt: string;
};

type DemoStore = {
  projects: DemoProjectRecord[];
  auditEvents: DemoAuditEvent[];
  outboxEvents: DemoOutboxEvent[];
  uploadIntents: DemoUploadIntentRecord[];
  spectra: DemoSpectrumRecord[];
  nextProjectNumber: number;
  nextSpectrumNumber: number;
};

const seedTime = new Date("2026-10-03T08:00:00.000Z").toISOString();

const seededProjects: DemoProjectRecord[] = [
  {
    id: "1cf10d17-253c-4907-a6fb-c67fc735453e",
    tenantId: demoActor.tenantId,
    publicId: "ENV-024",
    slug: "water-quality-screening",
    name: "Water quality screening",
    domain: "Environmental chemistry",
    purpose:
      "Screen surface-water samples using traceable UV-Vis measurements and reviewed calibration evidence.",
    status: "ACTIVE",
    memberCount: 6,
    ownerName: demoActor.name,
    createdById: demoActor.userId,
    createdAt: seedTime,
    updatedAt: new Date("2026-10-03T09:48:00.000Z").toISOString(),
  },
  {
    id: "1ef6790a-d342-40b8-8f84-44e40e633dc6",
    tenantId: demoActor.tenantId,
    publicId: "ORG-017",
    slug: "natural-products-library",
    name: "Natural products library",
    domain: "Organic chemistry",
    purpose:
      "Build a provenance-rich library of isolated fractions and reviewed analytical characterisation.",
    status: "UNDER_REVIEW",
    memberCount: 4,
    ownerName: "Tola Adeyemi",
    createdById: demoActor.userId,
    createdAt: seedTime,
    updatedAt: new Date("2026-10-02T14:10:00.000Z").toISOString(),
  },
  {
    id: "910d678e-b9e0-4e1d-a24c-b4529daf3169",
    tenantId: demoActor.tenantId,
    publicId: "EDU-009",
    slug: "uv-vis-teaching-pilot",
    name: "UV-Vis teaching pilot",
    domain: "Chemistry education",
    purpose:
      "Evaluate simulation-led preparation and evidence-based assessment for undergraduate spectroscopy practicals.",
    status: "ACTIVE",
    memberCount: 28,
    ownerName: "Dr. Ifeoma Okeke",
    createdById: demoActor.userId,
    createdAt: seedTime,
    updatedAt: new Date("2026-10-01T11:30:00.000Z").toISOString(),
  },
  {
    id: "75b70a7c-82dd-43ca-bb0c-6a218462e1ce",
    tenantId: demoActor.tenantId,
    publicId: "MAT-031",
    slug: "corrosion-inhibitor-study",
    name: "Corrosion inhibitor study",
    domain: "Materials chemistry",
    purpose:
      "Compare candidate corrosion inhibitors under controlled conditions with reproducible coupon measurements.",
    status: "DRAFT",
    memberCount: 5,
    ownerName: "Kelechi Okafor",
    createdById: demoActor.userId,
    createdAt: seedTime,
    updatedAt: new Date("2026-09-27T16:05:00.000Z").toISOString(),
  },
];

const seededSpectra: DemoSpectrumRecord[] = [
  {
    id: "8abed2f0-d37e-492b-b8c9-f0f3fe1f7229",
    tenantId: demoActor.tenantId,
    projectId: "1cf10d17-253c-4907-a6fb-c67fc735453e",
    projectName: "Water quality screening",
    sampleId: "eb04c2cf-d3e8-44cb-ab7f-672e91f235c4",
    publicId: "DAT-8872",
    title: "River sample R-14 · replicate 03",
    fileName: "R14-UVVIS-replicate-03.jdx",
    technique: "UV-Vis",
    format: "JCAMP-DX",
    xUnit: "nm",
    yUnit: "AU",
    pointCount: 1801,
    xMin: 200,
    xMax: 380,
    yMin: 0.018,
    yMax: 0.842,
    warnings: [],
    sha256: "6f05b0d257e1d7a5640fe47b0772786067fcd10f1f65a65ba3dc5d6a0df6419d",
    status: "Under review",
    createdAt: seedTime,
  },
];

const globalForDemo = globalThis as typeof globalThis & {
  chemciderDemoStore?: DemoStore;
};

export const demoStore =
  globalForDemo.chemciderDemoStore ??
  (globalForDemo.chemciderDemoStore = {
    projects: [...seededProjects],
    auditEvents: [],
    outboxEvents: [],
    uploadIntents: [],
    spectra: [...seededSpectra],
    nextProjectNumber: 32,
    nextSpectrumNumber: 8873,
  });

// Next.js hot reload can retain the previous in-memory shape while the server is
// running. Backfill newly introduced collections so development API changes do
// not require a manual restart.
if (!Array.isArray(demoStore.uploadIntents)) demoStore.uploadIntents = [];
if (!Array.isArray(demoStore.spectra)) demoStore.spectra = [...seededSpectra];
if (!Number.isInteger(demoStore.nextSpectrumNumber)) demoStore.nextSpectrumNumber = 8873;

export function appendDemoProject(
  project: Omit<DemoProjectRecord, "id" | "publicId">,
  correlationId: string,
) {
  const id = randomUUID();
  const publicId = `PRJ-${String(demoStore.nextProjectNumber).padStart(3, "0")}`;
  demoStore.nextProjectNumber += 1;

  const created: DemoProjectRecord = { ...project, id, publicId };
  const now = new Date().toISOString();
  demoStore.projects.unshift(created);
  demoStore.auditEvents.push({
    id: randomUUID(),
    tenantId: created.tenantId,
    projectId: id,
    actorId: created.createdById,
    action: "project.created",
    resourceType: "Project",
    resourceId: id,
    correlationId,
    occurredAt: now,
  });
  demoStore.outboxEvents.push({
    id: randomUUID(),
    tenantId: created.tenantId,
    projectId: id,
    eventType: "project.created.v1",
    aggregateType: "Project",
    aggregateId: id,
    correlationId,
    status: "PENDING",
    createdAt: now,
  });
  return created;
}

export function appendDemoUploadIntent(
  intent: Omit<DemoUploadIntentRecord, "id" | "createdAt" | "status" | "originalFileId">,
) {
  const existing = demoStore.uploadIntents.find(
    (candidate) =>
      candidate.tenantId === intent.tenantId &&
      candidate.idempotencyKey === intent.idempotencyKey,
  );
  if (existing) return existing;
  const created: DemoUploadIntentRecord = {
    ...intent,
    id: randomUUID(),
    status: "CREATED",
    originalFileId: null,
    createdAt: new Date().toISOString(),
  };
  demoStore.uploadIntents.push(created);
  return created;
}

export function appendDemoSpectrum(
  intentId: string,
  spectrum: Omit<DemoSpectrumRecord, "id" | "publicId" | "createdAt">,
  originalFileId: string,
  actorId: string,
  correlationId: string,
) {
  const intent = demoStore.uploadIntents.find((candidate) => candidate.id === intentId);
  if (!intent) throw new Error("Upload intent was not found.");
  const now = new Date().toISOString();
  intent.status = "READY";
  intent.originalFileId = originalFileId;
  const created: DemoSpectrumRecord = {
    ...spectrum,
    id: randomUUID(),
    publicId: `DAT-${demoStore.nextSpectrumNumber}`,
    createdAt: now,
  };
  demoStore.nextSpectrumNumber += 1;
  demoStore.spectra.unshift(created);
  demoStore.auditEvents.push({
    id: randomUUID(),
    tenantId: created.tenantId,
    projectId: created.projectId,
    actorId,
    action: "spectrum.imported",
    resourceType: "Spectrum",
    resourceId: created.id,
    correlationId,
    occurredAt: now,
  });
  demoStore.outboxEvents.push({
    id: randomUUID(),
    tenantId: created.tenantId,
    projectId: created.projectId,
    eventType: "spectrum.imported.v1",
    aggregateType: "Spectrum",
    aggregateId: created.id,
    correlationId,
    status: "PENDING",
    createdAt: now,
  });
  return created;
}
