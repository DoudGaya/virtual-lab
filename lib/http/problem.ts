import { randomUUID } from "node:crypto";

export function getCorrelationId(request: Request) {
  const supplied = request.headers.get("x-correlation-id");
  return supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied)
    ? supplied
    : randomUUID();
}

export function problem(
  status: number,
  code: string,
  title: string,
  correlationId: string,
  detail?: string,
) {
  return Response.json(
    {
      type: `https://labs.chemcider.com/problems/${code.toLowerCase()}`,
      title,
      status,
      code,
      correlationId,
      ...(detail ? { detail } : {}),
    },
    {
      status,
      headers: {
        "content-type": "application/problem+json",
        "cache-control": "no-store",
        "x-correlation-id": correlationId,
      },
    },
  );
}
