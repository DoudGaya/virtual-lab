import { hasDatabaseConnection } from "@/lib/db/client";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "chemcider-labs-web",
      dataAdapter: hasDatabaseConnection() ? "postgresql" : "demo-memory",
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
