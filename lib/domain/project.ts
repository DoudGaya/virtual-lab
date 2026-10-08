import { z } from "zod";

export const researchDomains = [
  "Environmental chemistry",
  "Analytical chemistry",
  "Organic chemistry",
  "Materials chemistry",
  "Chemistry education",
] as const;

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Project name must contain at least 3 characters.")
    .max(180, "Project name cannot exceed 180 characters."),
  domain: z.enum(researchDomains),
  purpose: z
    .string()
    .trim()
    .min(20, "Describe the research purpose in at least 20 characters.")
    .max(2_000, "Project purpose cannot exceed 2,000 characters."),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export type ProjectDto = {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  domain: string;
  purpose: string;
  status: "Draft" | "Active" | "Under review" | "Archived";
  memberCount: number;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
};
