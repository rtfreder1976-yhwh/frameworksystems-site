import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  AnalysisSchema,
  BillExtractSchema,
  CertificatesExtractSchema,
  SummaryExtractSchema,
} from "./types.ts";

/**
 * PremiumFlag server functions. Each handler loads its server-only module inside the handler,
 * so the Anthropic SDK, unpdf, and node:crypto never reach the browser bundle.
 */

const UploadSchema = z.object({
  kind: z.enum(["bill", "summary", "certificate"]),
  filename: z.string().min(1).max(200),
  mediaType: z.enum(["application/pdf", "text/csv"]),
  base64: z.string().min(1).max(4_400_000),
});

export const extractDocumentFn = createServerFn({ method: "POST" })
  .validator(UploadSchema)
  .handler(async ({ data }) => {
    const { extractUpload } = await import("./extract.server");
    return extractUpload(data);
  });

const AnalyzeSchema = z.object({
  bill: z.object({ filename: z.string().min(1).max(200), extract: BillExtractSchema }),
  summary: z
    .object({ filename: z.string().min(1).max(200), extract: SummaryExtractSchema })
    .nullable(),
  certificates: z
    .array(z.object({ filename: z.string().min(1).max(200), extract: CertificatesExtractSchema }))
    .max(60),
});

export const analyzeBillFn = createServerFn({ method: "POST" })
  .validator(AnalyzeSchema)
  .handler(async ({ data }) => {
    const { analyze } = await import("./analyze.server");
    return analyze(data);
  });

const UnlockSchema = z.object({
  sessionId: z.string().min(8).max(200),
  analysis: AnalysisSchema,
  sig: z.string().min(16).max(200),
});

export const unlockEmailFn = createServerFn({ method: "POST" })
  .validator(UnlockSchema)
  .handler(async ({ data }) => {
    const { unlock } = await import("./unlock.server");
    return unlock(data);
  });
