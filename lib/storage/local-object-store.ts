import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const defaultStorageRoot = path.resolve(process.cwd(), ".data", "object-store");

function storageRoot() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.LOCAL_OBJECT_STORAGE_ROOT || defaultStorageRoot,
  );
}

function resolveObjectPath(objectKey: string) {
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9/_.-]+$/.test(objectKey) ||
    objectKey.split("/").includes("..")
  ) {
    throw new Error("Object key contains unsafe characters.");
  }
  const root = storageRoot();
  const target = path.resolve(root, ...objectKey.split("/"));
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Object key resolves outside the private storage root.");
  }
  return target;
}

export function fileExtension(fileName: string) {
  const extension = path.extname(path.basename(fileName)).toLowerCase();
  return [".csv", ".tsv", ".txt", ".jdx", ".dx", ".jcamp"].includes(extension)
    ? extension
    : ".txt";
}

export async function putImmutableObject(
  objectKey: string,
  bytes: Uint8Array,
) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "The local object-store adapter is disabled in production. Configure a private S3-compatible adapter.",
    );
  }
  const target = resolveObjectPath(objectKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
  return { objectKey, byteCount: bytes.byteLength };
}
