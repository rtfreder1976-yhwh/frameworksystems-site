import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checklists } from "./checklists";
import type { JobType, QcFinding } from "./types";

const Input = z.object({
  jobType: z.enum(["recurring", "moveout", "airbnb", "inspection"]),
  address: z.string(),
  images: z
    .array(
      z.object({
        name: z.string(),
        dataUrl: z.string().max(1_800_000),
      }),
    )
    .max(4),
});

export const runVisionQc = createServerFn({ method: "POST" })
  .validator(Input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Vision QC isn't available in this preview." };
    }

    const list = checklists[data.jobType as JobType];
    const catalog = list
      .map((i) => `- id=${i.id} | ${i.room} | ${i.label} | photo:${i.requiredPhoto}`)
      .join("\n");

    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      {
        type: "text",
        text: `You are CrewFlag, a post-job photo QC for residential cleaning and property turns.
Job type: ${data.jobType}
Address: ${data.address || "n/a"}
Checklist:
${catalog}

For EACH checklist id, return JSON only:
{"findings":[{"itemId":"...","room":"...","label":"...","severity":"pass"|"watch"|"fail"|"missing","note":"one sentence"}]}

Rules:
- fail: clear miss (wet floor, supplies left, unmade bed, dirty toilet, trash full, missing restock).
- missing: required photo not in the set.
- watch: can't tell.
- pass: clearly done.
- Be specific. Mention what you see. No fluff.`,
      },
      ...data.images.map((img) => ({
        type: "image_url" as const,
        image_url: { url: img.dataUrl },
      })),
    ];

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 900,
        temperature: 0.2,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `Vision QC failed (${res.status}).` };
    }

    const body = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const text = body.choices[0]?.message.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false as const, error: "Couldn't read the QC result." };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as { findings: QcFinding[] };
      if (!Array.isArray(parsed.findings)) {
        return { ok: false as const, error: "Couldn't read the QC result." };
      }
      return { ok: true as const, findings: parsed.findings };
    } catch {
      return { ok: false as const, error: "Couldn't read the QC result." };
    }
  });
