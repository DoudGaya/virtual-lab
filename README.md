# Chemcider Virtual Laboratory

Chemcider Labs is a tenant-aware chemistry intelligence and virtual laboratory platform for research, education, scientific data review, and reproducible laboratory work. The current milestone combines a polished Next.js workspace with a secure server foundation for projects, samples, experiments, instrument data, notebook records, and scientific review.

The product deliberately separates three kinds of information:

1. **Scientific records** — original files, observations, measurements, simulations, and deterministic calculations.
2. **Human-reviewed conclusions** — interpretations and decisions approved by named users.
3. **AI interpretations** — suggestions tied to their inputs, evidence, tools, caveats, and model versions.

AI output must never silently overwrite an original scientific record or become an approved conclusion without review.

## Current milestone

- Responsive research workspace with light and dark themes
- Projects, compounds, samples, experiments, spectra, ELN, virtual lab, instruments, and review areas
- Interactive UV-Vis analysis workbench
- Versioned PostgreSQL schema using Prisma ORM
- Tenant-scoped Data Access Layer
- Signed, HTTP-only local demonstration session
- Central role-based permissions
- Validated project API and end-to-end project creation
- Authenticated two-step spectrum import with upload intents
- Immutable local quarantine storage with SHA-256 verification
- Deterministic CSV, TSV, and JCAMP-DX spectrum parsing
- Normalized spectrum artifacts, parser runs, and quality warnings
- Traceable spectrum registry in the research workspace
- Audit and transactional outbox records for project creation
- PostgreSQL row-level-security policies
- Explicit in-memory development adapter when PostgreSQL is not configured
- Seed data aligned with the interface

## Technology

- Next.js 16 App Router and React 19
- TypeScript in strict mode
- Tailwind CSS 4 with a custom Chemcider design system
- PostgreSQL as the production source of truth
- Prisma ORM 7 with the PostgreSQL driver adapter
- Zod for request validation
- Node cryptography for the temporary local session boundary

The local signed session is a development aid, not a replacement for production OIDC, SAML, or Auth.js integration.

## Quick start: interface and demo data

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no `DATABASE_URL`, the app automatically uses the in-memory demonstration adapter. Project creation and spectrum import still pass through session verification, input validation, authorization, the Data Access Layer, audit records, and outbox events.

The in-memory metadata adapter resets whenever the development server restarts. Uploaded development files are written beneath `.data/object-store` and ignored by Git.

## PostgreSQL setup

1. Create a PostgreSQL database with a migration-owner account and a separate, non-owner runtime account. The runtime account must not have `BYPASSRLS`.
2. Copy `.env.example` to `.env.local`.
3. Replace `DATABASE_URL` and `AUTH_SECRET` with secure values.
4. Apply the migration and seed the development workspace:

```powershell
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

For schema development, use `npm run db:migrate` instead of `db:deploy`. Never run development migrations automatically in production.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection used only by server-side database code |
| `AUTH_SECRET` | Signs local session tokens; use at least 32 random bytes |
| `CHEMCIDER_DEMO_AUTH` | Enables the local demo identity; never enable on a public deployment |
| `LOCAL_OBJECT_STORAGE_ROOT` | Optional development-only root for immutable local objects |
| `OBJECT_STORAGE_*` | Private S3-compatible storage configuration for the production adapter |

Do not prefix secrets with `NEXT_PUBLIC_`. Only the server-side data and authentication modules may access them.

## Useful commands

```powershell
npm run dev          # Start local development
npm run build        # Create a production build
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript validation
npm test             # Run deterministic scientific-parser tests
npm run db:generate  # Generate the Prisma client
npm run db:validate  # Validate the Prisma schema
npm run db:migrate   # Create/apply a development migration
npm run db:deploy    # Apply reviewed migrations in deployment
npm run db:seed      # Seed the demonstration institution
```

## Architecture

```text
Browser interface
  -> /api/v1 route handlers
    -> session verification + validation
      -> central permission policy
        -> server-only Data Access Layer
          -> PostgreSQL/Prisma (configured)
          -> in-memory demo adapter (local fallback)
        -> immutable object boundary
          -> local private store (development only)
          -> S3-compatible private store (required for production)
```

Important locations:

| Path | Responsibility |
|---|---|
| `app/_components/lab-application.tsx` | Interactive research workspace |
| `app/api/v1` | Versioned HTTP endpoints |
| `lib/auth` | Session parsing and identity boundary |
| `lib/security` | Role and permission policy |
| `lib/data` | Tenant-scoped Data Access Layer and DTO mapping |
| `lib/domain` | Validated domain inputs and public data contracts |
| `lib/db` | Prisma/PostgreSQL connection boundary |
| `lib/science/spectrum-parser.ts` | Deterministic CSV and JCAMP-DX normalization |
| `lib/storage/local-object-store.ts` | Development-only immutable object boundary |
| `prisma/schema.prisma` | Canonical transactional data model |
| `prisma/migrations` | Reviewed schema and RLS changes |
| `prisma/seed.ts` | Development institution and chemistry records |

## API foundation

### `POST /api/v1/session/demo`

Creates a short-lived, signed, HTTP-only development session. The endpoint is unavailable in production and can be disabled locally with `CHEMCIDER_DEMO_AUTH=false`.

### `GET /api/v1/session`

Returns the minimum safe user and workspace fields needed by the interface.

### `GET /api/v1/projects`

Returns projects for the authenticated tenant only. The response identifies whether the PostgreSQL or demo adapter served the request.

### `POST /api/v1/projects`

Validates and creates a tenant-scoped project. The operation also creates:

- project membership for the creator;
- an immutable `project.created` audit event; and
- a `project.created.v1` transactional outbox event.

Errors follow a stable problem-details shape and include a correlation ID. Internal exception details and database messages are not returned to clients.

### `POST /api/v1/uploads/intents`

Authorizes a spectrum upload against a project, validates declared metadata, applies the 5 MB limit, and returns a short-lived single-use content endpoint. The client supplies an idempotency key; the tenant and requesting user come only from the verified session.

### `POST /api/v1/uploads/:intentId/content`

Accepts one multipart file for the matching intent. The service verifies file name, byte count, optional expected checksum, supported extension, and intent expiry before preserving the original. CSV, TSV, and JCAMP-DX content is parsed deterministically into a versioned normalized JSON artifact. The operation records parser provenance, quality warnings, an audit event, and a transactional outbox event.

Supported text extensions are `.csv`, `.tsv`, `.txt`, `.jdx`, `.dx`, and `.jcamp`. The current limit is 5 MB and 200,000 points. Binary vendor formats require a reviewed, isolated converter and are intentionally rejected.

### `GET /api/v1/spectra`

Returns the authenticated tenant's normalized spectrum registry without returning raw point arrays or private object keys.

### `GET /api/v1/health`

Reports web-service health and the selected data adapter. It does not expose credentials or scientific data.

## Roles

Initial roles are `ADMIN`, `LAB_MANAGER`, `RESEARCHER`, `REVIEWER`, `STUDENT`, and `GUEST`. UI visibility is only a convenience; every mutation must verify identity, permission, tenant scope, and resource access again inside the server layer.

The current demonstration user is a `RESEARCHER`, which permits project creation, sample registration, data upload, and review submission, but not scientific approval or instrument administration.

## Data and security rules

- Every tenant-owned row contains `tenant_id`.
- Project reads and writes derive tenant context from the verified session, never from request JSON.
- Tenant-aware PostgreSQL transactions set `app.current_tenant_id` before queries.
- Row-level-security policies provide database-level isolation in addition to application checks.
- Production must use a runtime database role separate from the table owner; owners and roles with `BYPASSRLS` can bypass normal RLS enforcement.
- Raw scientific uploads are immutable; transformations produce separate versioned artifacts.
- Audit events are append-only and must not contain secrets or complete scientific payloads.
- Outbox consumers must be idempotent and re-check authorization when accessing referenced data.
- Route handlers and future Server Actions are public entry points and must validate and authorize every request.

## Production identity

Before any public pilot, replace the local demo session endpoint with Auth.js or an approved OIDC/SAML provider. Required production controls include MFA for elevated roles, secure invitation acceptance, session revocation, account lifecycle management, rate limiting, CSRF review, tenant-switch auditing, and institutional SSO testing.

## Next engineering milestone

The next milestone should productionize the ingestion boundary and start scientific review:

1. implement the private S3-compatible adapter with encryption, retention, lifecycle, and malware-scanning policies;
2. move parsing from the request process to an idempotent queue worker with bounded CPU, memory, and time;
3. replace the local demonstration identity with institutional OIDC/SAML and invitation workflows;
4. add spectrum detail pages with normalized point retrieval, preview generation, and reviewer annotations;
5. add sample selection and enforce sample-to-project lineage during import;
6. expose audit and processing history to authorized reviewers; and
7. connect rejected or warning-bearing imports to a human resolution workflow.

Local object storage deliberately refuses to run in production. A production deployment is incomplete until the private object-store adapter and its operational controls are configured.

Do not claim regulated LIMS/CDS, GxP, or 21 CFR Part 11 compliance during the pilot stage.
