import { getSessionActor } from "@/lib/auth/session";
import { getCorrelationId, problem } from "@/lib/http/problem";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const actor = getSessionActor(request);
  if (!actor) {
    return problem(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required.",
      correlationId,
    );
  }

  return Response.json(
    { data: actor },
    {
      headers: {
        "cache-control": "no-store",
        "x-correlation-id": correlationId,
      },
    },
  );
}
