import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed Chemcider Labs.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ids = {
  tenant: "7af73ab2-d2ad-4bd4-b355-553d6260fe9d",
  user: "d26f2d48-d5a4-4fd6-aa42-43298f8c6027",
  membership: "ac10d2d7-a4d3-4c93-b80a-b62619f38e41",
  project: "1cf10d17-253c-4907-a6fb-c67fc735453e",
  sample: "eb04c2cf-d3e8-44cb-ab7f-672e91f235c4",
  experiment: "60da609f-6d76-4d41-b693-daf073a89efb",
  originalFile: "cfd0615d-e6a9-4a4b-bb56-bb59130c9c6c",
  spectrum: "8abed2f0-d37e-492b-b8c9-f0f3fe1f7229",
  notebookEntry: "d32a7e9e-59a5-45e8-9a33-134d50d4cdf3",
  reviewer: "1fae2ff6-1163-4289-8fa2-67276432c826",
} as const;

async function seed() {
  await prisma.tenant.upsert({
    where: { id: ids.tenant },
    update: {},
    create: {
      id: ids.tenant,
      slug: "chemcider-university-lab",
      name: "Chemcider University Lab",
      kind: "UNIVERSITY",
    },
  });

  await prisma.user.upsert({
    where: { id: ids.user },
    update: {},
    create: {
      id: ids.user,
      email: "amara.bello@demo.chemcider.com",
      name: "Amara Bello",
      emailVerifiedAt: new Date("2026-10-01T09:00:00.000Z"),
    },
  });
  await prisma.user.upsert({
    where: { id: ids.reviewer },
    update: {},
    create: {
      id: ids.reviewer,
      email: "ifeoma.okeke@demo.chemcider.com",
      name: "Dr. Ifeoma Okeke",
      emailVerifiedAt: new Date("2026-10-01T09:00:00.000Z"),
    },
  });

  await prisma.membership.upsert({
    where: { id: ids.membership },
    update: {},
    create: {
      id: ids.membership,
      tenantId: ids.tenant,
      userId: ids.user,
      role: "RESEARCHER",
      department: "Analytical Chemistry",
    },
  });
  await prisma.membership.upsert({
    where: {
      tenantId_userId: { tenantId: ids.tenant, userId: ids.reviewer },
    },
    update: {},
    create: {
      tenantId: ids.tenant,
      userId: ids.reviewer,
      role: "REVIEWER",
      department: "Quality and Scientific Review",
    },
  });

  const projectSeeds = [
    {
      id: ids.project,
      publicId: "ENV-024",
      slug: "water-quality-screening",
      name: "Water quality screening",
      domain: "Environmental chemistry",
      purpose:
        "Screen surface-water samples using traceable UV-Vis measurements and reviewed calibration evidence.",
      status: "ACTIVE" as const,
    },
    {
      id: "1ef6790a-d342-40b8-8f84-44e40e633dc6",
      publicId: "ORG-017",
      slug: "natural-products-library",
      name: "Natural products library",
      domain: "Organic chemistry",
      purpose:
        "Build a provenance-rich library of isolated fractions and reviewed analytical characterisation.",
      status: "UNDER_REVIEW" as const,
    },
    {
      id: "910d678e-b9e0-4e1d-a24c-b4529daf3169",
      publicId: "EDU-009",
      slug: "uv-vis-teaching-pilot",
      name: "UV-Vis teaching pilot",
      domain: "Chemistry education",
      purpose:
        "Evaluate simulation-led preparation and evidence-based assessment for undergraduate spectroscopy practicals.",
      status: "ACTIVE" as const,
    },
    {
      id: "75b70a7c-82dd-43ca-bb0c-6a218462e1ce",
      publicId: "MAT-031",
      slug: "corrosion-inhibitor-study",
      name: "Corrosion inhibitor study",
      domain: "Materials chemistry",
      purpose:
        "Compare candidate corrosion inhibitors under controlled conditions with reproducible coupon measurements.",
      status: "DRAFT" as const,
    },
  ];

  for (const project of projectSeeds) {
    await prisma.project.upsert({
      where: { id: project.id },
      update: {},
      create: {
        ...project,
        tenantId: ids.tenant,
        createdById: ids.user,
      },
    });
    await prisma.projectMember.upsert({
      where: {
        projectId_membershipId: {
          projectId: project.id,
          membershipId: ids.membership,
        },
      },
      update: {},
      create: {
        projectId: project.id,
        membershipId: ids.membership,
        role: "RESEARCHER",
      },
    });
  }

  await prisma.sample.upsert({
    where: { id: ids.sample },
    update: {},
    create: {
      id: ids.sample,
      tenantId: ids.tenant,
      projectId: ids.project,
      publicId: "SAM-2411",
      name: "River sample R-14",
      source: "Field collection",
      storageLocation: "Cold room B2",
      status: "ACTIVE",
      metadata: { collectedAt: "2026-10-02T07:30:00.000Z" },
    },
  });
  await prisma.experiment.upsert({
    where: { id: ids.experiment },
    update: {},
    create: {
      id: ids.experiment,
      tenantId: ids.tenant,
      projectId: ids.project,
      publicId: "EXP-118",
      title: "UV-Vis nitrate screening",
      methodRef: "UVV-004 v2.1",
      status: "ACTIVE",
      ownerId: ids.user,
    },
  });
  await prisma.originalFile.upsert({
    where: { id: ids.originalFile },
    update: {},
    create: {
      id: ids.originalFile,
      tenantId: ids.tenant,
      projectId: ids.project,
      objectKey: `${ids.tenant}/${ids.project}/raw/DAT-8872.jdx`,
      fileName: "R14-UVVIS-replicate-03.jdx",
      contentType: "chemical/x-jcamp-dx",
      byteCount: BigInt(18432),
      sha256:
        "6f05b0d257e1d7a5640fe47b0772786067fcd10f1f65a65ba3dc5d6a0df6419d",
      lifecycle: "READY",
      uploadedById: ids.user,
      metadata: { sourceInstrument: "Shimadzu UV-1900i" },
    },
  });
  await prisma.spectrum.upsert({
    where: { id: ids.spectrum },
    update: {},
    create: {
      id: ids.spectrum,
      tenantId: ids.tenant,
      projectId: ids.project,
      sampleId: ids.sample,
      experimentId: ids.experiment,
      originalFileId: ids.originalFile,
      publicId: "DAT-8872",
      technique: "UV-Vis",
      xUnit: "nm",
      yUnit: "AU",
      pointCount: 1801,
      status: "UNDER_REVIEW",
      parserVersion: "jcamp-parser-1.2.0",
      qualitySummary: { passed: true, warnings: [] },
    },
  });
  await prisma.notebookEntry.upsert({
    where: { id: ids.notebookEntry },
    update: {},
    create: {
      id: ids.notebookEntry,
      tenantId: ids.tenant,
      projectId: ids.project,
      publicId: "ELN-219",
      title: "Calibration curve and dilution notes",
      status: "DRAFT",
      authorId: ids.user,
      revisions: {
        create: {
          revision: 1,
          createdById: ids.user,
          content: {
            objective: "Quantify nitrate response across the validated range.",
            conclusion: "Draft pending dilution correction review.",
          },
        },
      },
    },
  });
  await prisma.review.upsert({
    where: { id: "0c29aa5a-3202-4492-9622-e989555e91d3" },
    update: {},
    create: {
      id: "0c29aa5a-3202-4492-9622-e989555e91d3",
      tenantId: ids.tenant,
      projectId: ids.project,
      targetType: "Spectrum",
      targetId: ids.spectrum,
      status: "PENDING",
      priority: "HIGH",
      reviewerId: ids.reviewer,
      submittedById: ids.user,
      dueAt: new Date("2026-10-03T17:00:00.000Z"),
    },
  });

  const instrumentSeeds = [
    ["INS-001", "Shimadzu UV-1900i", "Shimadzu", "UV-1900i", "Analytical lab", "READY"],
    ["INS-002", "FTIR-8400S", "Shimadzu", "FTIR-8400S", "Research lab 2", "ATTENTION"],
    ["INS-003", "HPLC 1260 Infinity", "Agilent", "1260 Infinity", "Central lab", "OFFLINE"],
    ["INS-004", "pH meter PH-07", "Mettler Toledo", "SevenCompact", "Teaching lab", "READY"],
  ] as const;
  for (const [publicId, name, manufacturer, model, location, status] of instrumentSeeds) {
    await prisma.instrument.upsert({
      where: { publicId },
      update: {},
      create: {
        tenantId: ids.tenant,
        publicId,
        name,
        manufacturer,
        model,
        location,
        status,
      },
    });
  }
}

seed()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
