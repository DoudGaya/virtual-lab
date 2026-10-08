import { NextResponse } from "next/server";

import {
  createSessionToken,
  demoActor,
  isDemoAuthEnabled,
  sessionCookieName,
} from "@/lib/auth/session";
import { getCorrelationId, problem } from "@/lib/http/problem";

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  if (!isDemoAuthEnabled()) {
    return problem(
      404,
      "DEMO_AUTH_DISABLED",
      "Demo authentication is disabled.",
      correlationId,
    );
  }

  const response = NextResponse.json(
    { data: demoActor, meta: { mode: "demo" } },
    {
      status: 201,
      headers: {
        "cache-control": "no-store",
        "x-correlation-id": correlationId,
      },
    },
  );
  response.cookies.set({
    name: sessionCookieName,
    value: createSessionToken(demoActor),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}
