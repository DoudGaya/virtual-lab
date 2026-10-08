import {
  AuthenticationError,
  requireSessionActor,
} from "@/lib/auth/session";
import { listSpectra } from "@/lib/data/uploads";
import { hasDatabaseConnection } from "@/lib/db/client";
import { getCorrelationId, problem } from "@/lib/http/problem";
import { AuthorizationError } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = requireSessionActor(request);
    const spectra = await listSpectra(actor);
    return Response.json(
      {
        data: spectra,
        meta: {
          count: spectra.length,
          adapter: hasDatabaseConnection() ? "postgresql" : "demo-memory",
        },
      },
      {
        headers: {
          "cache-control": "no-store",
          "x-correlation-id": correlationId,
        },
      },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return problem(401, "AUTHENTICATION_REQUIRED", error.message, correlationId);
    }
    if (error instanceof AuthorizationError) {
      return problem(403, "FORBIDDEN", error.message, correlationId);
    }
    return problem(500, "INTERNAL_ERROR", "Spectra could not be loaded.", correlationId);
  }
}
