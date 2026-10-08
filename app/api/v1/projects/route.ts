import { ZodError } from "zod";

import {
  AuthenticationError,
  requireSessionActor,
} from "@/lib/auth/session";
import { createProject, listProjects } from "@/lib/data/projects";
import { hasDatabaseConnection } from "@/lib/db/client";
import { createProjectSchema } from "@/lib/domain/project";
import { getCorrelationId, problem } from "@/lib/http/problem";
import { AuthorizationError } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";

function safeErrorResponse(error: unknown, correlationId: string) {
  if (error instanceof AuthenticationError) {
    return problem(401, "AUTHENTICATION_REQUIRED", error.message, correlationId);
  }
  if (error instanceof AuthorizationError) {
    return problem(403, "FORBIDDEN", error.message, correlationId);
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        type: "https://labs.chemcider.com/problems/validation-error",
        title: "The submitted project is not valid.",
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
    return problem(
      400,
      "INVALID_JSON",
      "The request body must contain valid JSON.",
      correlationId,
    );
  }
  return problem(
    500,
    "INTERNAL_ERROR",
    "The request could not be completed.",
    correlationId,
  );
}

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = requireSessionActor(request);
    const projects = await listProjects(actor);
    return Response.json(
      {
        data: projects,
        meta: {
          count: projects.length,
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
    return safeErrorResponse(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = requireSessionActor(request);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return problem(
        413,
        "PAYLOAD_TOO_LARGE",
        "The project request exceeds the 16 KB limit.",
        correlationId,
      );
    }
    const body = await request.json();
    const input = createProjectSchema.parse(body);
    const project = await createProject(actor, input, correlationId);
    return Response.json(
      { data: project },
      {
        status: 201,
        headers: {
          "cache-control": "no-store",
          location: `/api/v1/projects/${project.id}`,
          "x-correlation-id": correlationId,
        },
      },
    );
  } catch (error) {
    return safeErrorResponse(error, correlationId);
  }
}
