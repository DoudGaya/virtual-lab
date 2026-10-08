import { createHash } from "node:crypto";

import {
  AuthenticationError,
  requireSessionActor,
} from "@/lib/auth/session";
import {
  completeParsedUpload,
  getUploadIntent,
  newOriginalFileId,
  recordQuarantinedUpload,
  rejectParsedUpload,
  spectrumParser,
  UploadWorkflowError,
} from "@/lib/data/uploads";
import { getCorrelationId, problem } from "@/lib/http/problem";
import {
  parseSpectrumFile,
  SpectrumParseError,
  spectrumLimits,
} from "@/lib/science/spectrum-parser";
import { AuthorizationError } from "@/lib/security/permissions";
import {
  fileExtension,
  putImmutableObject,
} from "@/lib/storage/local-object-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function contentError(error: unknown, correlationId: string) {
  if (error instanceof AuthenticationError) {
    return problem(401, "AUTHENTICATION_REQUIRED", error.message, correlationId);
  }
  if (error instanceof AuthorizationError) {
    return problem(403, "FORBIDDEN", error.message, correlationId);
  }
  if (error instanceof UploadWorkflowError) {
    return problem(error.status, error.code, error.message, correlationId);
  }
  if (error instanceof SpectrumParseError) {
    return problem(422, error.code, error.message, correlationId);
  }
  console.error("Spectrum import failed", { correlationId, error });
  return problem(500, "INTERNAL_ERROR", "The scientific file could not be imported.", correlationId);
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/v1/uploads/[intentId]/content">,
) {
  const correlationId = getCorrelationId(request);
  let actor: ReturnType<typeof requireSessionActor> | null = null;
  let recordedFile: { id: string } | null = null;
  let authorizedIntent: Awaited<ReturnType<typeof getUploadIntent>> | null = null;

  try {
    actor = requireSessionActor(request);
    const { intentId } = await context.params;
    authorizedIntent = await getUploadIntent(actor, intentId);

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (
      Number.isFinite(contentLength) &&
      contentLength > spectrumLimits.maximumBytes + 512 * 1024
    ) {
      return problem(413, "PAYLOAD_TOO_LARGE", "The multipart upload exceeds the pilot limit.", correlationId);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new UploadWorkflowError("FILE_REQUIRED", "Attach one spectrum file using the file field.", 422);
    }
    if (file.name !== authorizedIntent.fileName) {
      throw new UploadWorkflowError("FILE_NAME_MISMATCH", "The uploaded filename does not match the upload intent.", 409);
    }
    if (file.size !== authorizedIntent.expectedByteCount) {
      throw new UploadWorkflowError("FILE_SIZE_MISMATCH", "The uploaded file size does not match the upload intent.", 409);
    }
    if (file.size > spectrumLimits.maximumBytes) {
      throw new UploadWorkflowError("FILE_TOO_LARGE", "The uploaded file exceeds the 5 MB pilot limit.", 413);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const originalSha256 = hash(bytes);
    if (
      authorizedIntent.expectedSha256 &&
      authorizedIntent.expectedSha256.toLowerCase() !== originalSha256
    ) {
      throw new UploadWorkflowError("CHECKSUM_MISMATCH", "The uploaded file checksum does not match the declared SHA-256.", 422);
    }

    const originalFileId = newOriginalFileId();
    const originalObjectKey = `${actor.tenantId}/${authorizedIntent.projectId}/quarantine/${authorizedIntent.id}/original${fileExtension(file.name)}`;
    await putImmutableObject(originalObjectKey, bytes);
    await recordQuarantinedUpload(actor, authorizedIntent, {
      id: originalFileId,
      objectKey: originalObjectKey,
      contentType: file.type || "application/octet-stream",
      byteCount: bytes.byteLength,
      sha256: originalSha256,
    });
    recordedFile = { id: originalFileId };

    const parsed = parseSpectrumFile(bytes, file.name);
    const normalizedBytes = new TextEncoder().encode(JSON.stringify({
      schema: "chemcider.normalized-spectrum.v1",
      source: {
        originalFileId,
        sha256: originalSha256,
      },
      parser: spectrumParser,
      spectrum: parsed,
    }));
    const artifactSha256 = hash(normalizedBytes);
    const artifactObjectKey = `${actor.tenantId}/${authorizedIntent.projectId}/derived/${originalFileId}/normalized-spectrum.json`;
    await putImmutableObject(artifactObjectKey, normalizedBytes);

    const spectrum = await completeParsedUpload(
      actor,
      authorizedIntent,
      { id: originalFileId, sha256: originalSha256 },
      {
        objectKey: artifactObjectKey,
        byteCount: normalizedBytes.byteLength,
        sha256: artifactSha256,
      },
      parsed,
      correlationId,
    );
    return Response.json(
      {
        data: spectrum,
        meta: {
          originalPreserved: true,
          parser: spectrumParser,
          normalizedArtifactSha256: artifactSha256,
        },
      },
      {
        status: 201,
        headers: {
          "cache-control": "no-store",
          location: `/api/v1/spectra/${spectrum.id}`,
          "x-correlation-id": correlationId,
        },
      },
    );
  } catch (error) {
    if (
      error instanceof SpectrumParseError &&
      actor &&
      recordedFile &&
      authorizedIntent
    ) {
      await rejectParsedUpload(actor, authorizedIntent, recordedFile.id, error.code);
    }
    return contentError(error, correlationId);
  }
}
