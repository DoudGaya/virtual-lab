-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantKind" AS ENUM ('COMPANY', 'UNIVERSITY', 'RESEARCH_INSTITUTE', 'LABORATORY');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'LAB_MANAGER', 'RESEARCHER', 'REVIEWER', 'STUDENT', 'GUEST');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScientificRecordStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REVISION_REQUESTED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReviewPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InstrumentStatus" AS ENUM ('READY', 'ATTENTION', 'OFFLINE');

-- CreateEnum
CREATE TYPE "FileLifecycle" AS ENUM ('QUARANTINED', 'SCANNING', 'PARSING', 'READY', 'REJECTED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "kind" "TenantKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "password_hash" VARCHAR(255),
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token" VARCHAR(255) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "department" VARCHAR(160),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "domain" VARCHAR(120) NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "project_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id","membership_id")
);

-- CreateTable
CREATE TABLE "compounds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "preferred_name" VARCHAR(180) NOT NULL,
    "molecular_formula" VARCHAR(100),
    "source_structure" TEXT,
    "canonical_structure" TEXT,
    "normalization_version" VARCHAR(80),
    "validation_status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_compounds" (
    "project_id" UUID NOT NULL,
    "compound_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_compounds_pkey" PRIMARY KEY ("project_id","compound_id")
);

-- CreateTable
CREATE TABLE "samples" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "source" VARCHAR(180) NOT NULL,
    "storage_location" VARCHAR(180),
    "status" "ScientificRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "parent_sample_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "method_ref" VARCHAR(120),
    "status" "ScientificRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "owner_id" UUID NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "original_files" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "object_key" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(120) NOT NULL,
    "byte_count" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "lifecycle" "FileLifecycle" NOT NULL DEFAULT 'QUARANTINED',
    "uploaded_by_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "original_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spectra" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "sample_id" UUID,
    "experiment_id" UUID,
    "original_file_id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "technique" VARCHAR(80) NOT NULL,
    "x_unit" VARCHAR(40) NOT NULL,
    "y_unit" VARCHAR(40) NOT NULL,
    "point_count" INTEGER NOT NULL,
    "status" "ScientificRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "parser_version" VARCHAR(80) NOT NULL,
    "quality_summary" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spectra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" "ScientificRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "author_id" UUID NOT NULL,
    "current_revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notebook_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook_revisions" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notebook_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "target_type" VARCHAR(80) NOT NULL,
    "target_id" UUID NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ReviewPriority" NOT NULL DEFAULT 'NORMAL',
    "reviewer_id" UUID NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "conclusion" TEXT,
    "due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "manufacturer" VARCHAR(120),
    "model" VARCHAR(120),
    "serial_number" VARCHAR(120),
    "location" VARCHAR(180) NOT NULL,
    "status" "InstrumentStatus" NOT NULL DEFAULT 'READY',
    "calibration_due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID,
    "actor_type" VARCHAR(32) NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "resource_type" VARCHAR(80) NOT NULL,
    "resource_id" UUID NOT NULL,
    "correlation_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID,
    "event_type" VARCHAR(140) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "aggregate_version" INTEGER NOT NULL DEFAULT 1,
    "correlation_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "memberships_user_id_status_idx" ON "memberships"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_public_id_key" ON "projects"("public_id");

-- CreateIndex
CREATE INDEX "projects_tenant_id_status_updated_at_idx" ON "projects"("tenant_id", "status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "projects_tenant_id_slug_key" ON "projects"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "projects_tenant_id_id_key" ON "projects"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "project_members_membership_id_idx" ON "project_members"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "compounds_public_id_key" ON "compounds"("public_id");

-- CreateIndex
CREATE INDEX "compounds_tenant_id_preferred_name_idx" ON "compounds"("tenant_id", "preferred_name");

-- CreateIndex
CREATE UNIQUE INDEX "samples_public_id_key" ON "samples"("public_id");

-- CreateIndex
CREATE INDEX "samples_tenant_id_project_id_status_idx" ON "samples"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "experiments_public_id_key" ON "experiments"("public_id");

-- CreateIndex
CREATE INDEX "experiments_tenant_id_project_id_status_idx" ON "experiments"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "original_files_object_key_key" ON "original_files"("object_key");

-- CreateIndex
CREATE INDEX "original_files_tenant_id_project_id_lifecycle_idx" ON "original_files"("tenant_id", "project_id", "lifecycle");

-- CreateIndex
CREATE INDEX "original_files_tenant_id_sha256_idx" ON "original_files"("tenant_id", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "spectra_public_id_key" ON "spectra"("public_id");

-- CreateIndex
CREATE INDEX "spectra_tenant_id_project_id_technique_status_idx" ON "spectra"("tenant_id", "project_id", "technique", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notebook_entries_public_id_key" ON "notebook_entries"("public_id");

-- CreateIndex
CREATE INDEX "notebook_entries_tenant_id_project_id_status_idx" ON "notebook_entries"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notebook_revisions_entry_id_revision_key" ON "notebook_revisions"("entry_id", "revision");

-- CreateIndex
CREATE INDEX "reviews_tenant_id_reviewer_id_status_priority_idx" ON "reviews"("tenant_id", "reviewer_id", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_public_id_key" ON "instruments"("public_id");

-- CreateIndex
CREATE INDEX "instruments_tenant_id_status_idx" ON "instruments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_project_id_occurred_at_idx" ON "audit_events"("tenant_id", "project_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_resource_type_resource_id_idx" ON "audit_events"("tenant_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_project_id_created_at_idx" ON "outbox_events"("tenant_id", "project_id", "created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compounds" ADD CONSTRAINT "compounds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_compounds" ADD CONSTRAINT "project_compounds_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_compounds" ADD CONSTRAINT "project_compounds_compound_id_fkey" FOREIGN KEY ("compound_id") REFERENCES "compounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_parent_sample_id_fkey" FOREIGN KEY ("parent_sample_id") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "original_files" ADD CONSTRAINT "original_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spectra" ADD CONSTRAINT "spectra_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spectra" ADD CONSTRAINT "spectra_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spectra" ADD CONSTRAINT "spectra_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spectra" ADD CONSTRAINT "spectra_original_file_id_fkey" FOREIGN KEY ("original_file_id") REFERENCES "original_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook_entries" ADD CONSTRAINT "notebook_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook_entries" ADD CONSTRAINT "notebook_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook_revisions" ADD CONSTRAINT "notebook_revisions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "notebook_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook_revisions" ADD CONSTRAINT "notebook_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation is enforced in the database as a second line of defence.
-- Every application transaction must set app.current_tenant_id with SET LOCAL
-- before reading or writing tenant-owned tables.
DO $$
DECLARE
    target_table TEXT;
BEGIN
    FOREACH target_table IN ARRAY ARRAY[
        'memberships',
        'projects',
        'compounds',
        'samples',
        'experiments',
        'original_files',
        'spectra',
        'notebook_entries',
        'reviews',
        'instruments',
        'audit_events',
        'outbox_events'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
            target_table
        );
    END LOOP;
END $$;

ALTER TABLE "project_members" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "project_members"
USING (
    EXISTS (
        SELECT 1 FROM "projects"
        WHERE "projects"."id" = "project_members"."project_id"
          AND "projects"."tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "projects"
        WHERE "projects"."id" = "project_members"."project_id"
          AND "projects"."tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
);

ALTER TABLE "project_compounds" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "project_compounds"
USING (
    EXISTS (
        SELECT 1 FROM "projects"
        WHERE "projects"."id" = "project_compounds"."project_id"
          AND "projects"."tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "projects"
        WHERE "projects"."id" = "project_compounds"."project_id"
          AND "projects"."tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
);

ALTER TABLE "notebook_revisions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "notebook_revisions"
USING (
    EXISTS (
        SELECT 1 FROM "notebook_entries"
        WHERE "notebook_entries"."id" = "notebook_revisions"."entry_id"
          AND "notebook_entries"."tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "notebook_entries"
        WHERE "notebook_entries"."id" = "notebook_revisions"."entry_id"
          AND "notebook_entries"."tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
);
