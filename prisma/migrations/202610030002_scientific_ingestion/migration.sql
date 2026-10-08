-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('CREATED', 'UPLOADING', 'QUARANTINED', 'PARSING', 'READY', 'REJECTED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ParserRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED');

-- CreateEnum
CREATE TYPE "DerivedArtifactKind" AS ENUM ('NORMALIZED_SPECTRUM', 'PROCESSED_SPECTRUM', 'PREVIEW', 'REPORT');

-- CreateTable
CREATE TABLE "upload_intents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "sample_id" UUID,
    "requested_by_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "declared_content_type" VARCHAR(120) NOT NULL,
    "expected_byte_count" BIGINT NOT NULL,
    "expected_sha256" CHAR(64),
    "idempotency_key" VARCHAR(120) NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'CREATED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "original_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parser_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "original_file_id" UUID NOT NULL,
    "parser_name" VARCHAR(100) NOT NULL,
    "parser_version" VARCHAR(80) NOT NULL,
    "status" "ParserRunStatus" NOT NULL DEFAULT 'RUNNING',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "error_code" VARCHAR(100),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "parser_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "derived_artifacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "original_file_id" UUID NOT NULL,
    "object_key" VARCHAR(500) NOT NULL,
    "kind" "DerivedArtifactKind" NOT NULL,
    "content_type" VARCHAR(120) NOT NULL,
    "byte_count" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "provenance" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "derived_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_intents_original_file_id_key" ON "upload_intents"("original_file_id");
CREATE UNIQUE INDEX "upload_intents_tenant_id_idempotency_key_key" ON "upload_intents"("tenant_id", "idempotency_key");
CREATE INDEX "upload_intents_tenant_id_project_id_status_expires_at_idx" ON "upload_intents"("tenant_id", "project_id", "status", "expires_at");
CREATE INDEX "parser_runs_tenant_id_project_id_status_started_at_idx" ON "parser_runs"("tenant_id", "project_id", "status", "started_at");
CREATE UNIQUE INDEX "derived_artifacts_object_key_key" ON "derived_artifacts"("object_key");
CREATE INDEX "derived_artifacts_tenant_id_project_id_kind_created_at_idx" ON "derived_artifacts"("tenant_id", "project_id", "kind", "created_at");

-- AddForeignKey
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_original_file_id_fkey" FOREIGN KEY ("original_file_id") REFERENCES "original_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "parser_runs" ADD CONSTRAINT "parser_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parser_runs" ADD CONSTRAINT "parser_runs_original_file_id_fkey" FOREIGN KEY ("original_file_id") REFERENCES "original_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "derived_artifacts" ADD CONSTRAINT "derived_artifacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "derived_artifacts" ADD CONSTRAINT "derived_artifacts_original_file_id_fkey" FOREIGN KEY ("original_file_id") REFERENCES "original_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security for the ingestion chain.
DO $$
DECLARE
    target_table TEXT;
BEGIN
    FOREACH target_table IN ARRAY ARRAY['upload_intents', 'parser_runs', 'derived_artifacts']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
            target_table
        );
    END LOOP;
END $$;
