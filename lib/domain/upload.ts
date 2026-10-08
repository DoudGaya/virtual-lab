import { z } from "zod";

import { spectrumLimits } from "@/lib/science/spectrum-parser";

export const createUploadIntentSchema = z.object({
  projectId: z.string().uuid("Select a valid research project."),
  sampleId: z.string().uuid().optional(),
  fileName: z.string().trim().min(1).max(255).refine(
    (value) => /\.(csv|tsv|txt|jdx|dx|jcamp)$/i.test(value),
    "Use a CSV, TSV, TXT, JDX, DX, or JCAMP file.",
  ),
  contentType: z.string().trim().min(1).max(120),
  expectedBytes: z.number().int().positive().max(spectrumLimits.maximumBytes),
  expectedSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  idempotencyKey: z.string().uuid(),
});

export type CreateUploadIntentInput = z.infer<typeof createUploadIntentSchema>;

export type UploadIntentDto = {
  id: string;
  projectId: string;
  fileName: string;
  expectedBytes: number;
  status: "CREATED";
  expiresAt: string;
  uploadUrl: string;
  acceptedFormats: string[];
  maximumBytes: number;
};

export type SpectrumDto = {
  id: string;
  publicId: string;
  projectId: string;
  projectName: string;
  sampleId: string | null;
  title: string;
  fileName: string;
  technique: string;
  format: string;
  xUnit: string;
  yUnit: string;
  pointCount: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  warnings: string[];
  sha256: string;
  status: "Draft" | "Under review" | "Accepted";
  createdAt: string;
};
