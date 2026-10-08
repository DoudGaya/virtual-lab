import { ZodError } from "zod";

import {
  AuthenticationError,
  requireSessionActor,
} from "@/lib/auth/session";
import {
  createUploadIntent,
  UploadWorkflowError,
} from "@/lib/data/uploads";
import { createUploadIntentSchema } from "@/lib/domain/upload";
import { getCorrelationId, problem } from "@/lib/http/problem";
import { AuthorizationError } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function uploadError(error: unknown, correlationId: string) {
  if (error instanceof AuthenticationError) {
    return problem(401, "AUTHENTICATION_REQUIRED", error.message, correlationId);
  }
  if (error instanceof AuthorizationError) {
    return problem(403, "FORBIDDEN", error.message, correlationId);
  }
  if (error instanceof UploadWorkflowError) {
    return problem(error.status, error.code, error.message, correlationId);
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        type: "https://labs.chemcider.com/problems/validation-error",
        title: "The upload request is not valid.",
        status: 422,
        code: "VALIDATION_ERROR",
        correlationId,
        errors: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      {
        status: 422,
        headers: {
          "content-type": "application/problem+json",
          "cache-control": "no-store",
          "x-correlation-id": correlationId,
        },
      },
    );
  }
  if (error instanceof SyntaxError) {
    return problem(400, "INVALID_JSON", "The request body must contain valid JSON.", correlationId);
  }
  return problem(500, "INTERNAL_ERROR", "The upload intent could not be created.", correlationId);
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = requireSessionActor(request);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return problem(413, "PAYLOAD_TOO_LARGE", "The upload-intent request exceeds 16 KB.", correlationId);
    }
    const input = createUploadIntentSchema.parse(await request.json());
    const intent = await createUploadIntent(actor, input);
    return Response.json(
      { data: intent },
      {
        status: 201,
        headers: {
          "cache-control": "no-store",
          location: intent.uploadUrl,
          "x-correlation-id": correlationId,
        },
      },
    );
  } catch (error) {
    return uploadError(error, correlationId);
  }
}
