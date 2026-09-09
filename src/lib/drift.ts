import type { Client, Visit } from "./types";

export type DriftLevel = "steady" | "watch" | "risk" | "cancel";

export function driftFor(client: Client) {
  const visits = [...client.visits].sort((a, b) => a.date.localeCompare(b.date));
  const last = visits.slice(-6);
  if (last.length < 3) {
    return {
      level: "watch" as DriftLevel,
      headline: "Need 3 visits before drift is real.",
      detail: "Log ratings (and photo QC scores if you have them) after each job.",
      delta: 0,
      last,
    };
  }

  const metric = (v: Visit) => (v.qcScore ?? v.stars * 20);
  const first3 = last.slice(0, 3).reduce((s, v) => s + metric(v), 0) / 3;
  const last3 = last.slice(-3).reduce((s, v) => s + metric(v), 0) / 3;
  const delta = last3 - first3;
  const lastTwo = last.slice(-2);
  const lowStreak = lastTwo.every((v) => (v.stars ?? 5) <= 3.5 || (v.qcScore ?? 100) < 70);

  let level: DriftLevel = "steady";
  if (delta <= -18 || lowStreak) level = "cancel";
  else if (delta <= -10) level = "risk";
  else if (delta <= -5) level = "watch";

  const headline =
    level === "cancel"
      ? "They are about to cancel."
      : level === "risk"
        ? "Quality is slipping. Call this week."
        : level === "watch"
          ? "Slight drift. Don't wait for the review."
          : "Holding steady.";

  const detail =
    level === "steady"
      ? `Last 6 visits are flat (Δ ${delta.toFixed(0)} pts).`
      : `Score dropped ${Math.abs(delta).toFixed(0)} pts from the first half of this window to the last.`;

  return { level, headline, detail, delta, last };
}

export function saveScript(client: Client) {
  const d = driftFor(client);
  return `Hi — it's ${client.name} on our books. Quality has been drifting (${d.headline.toLowerCase()}). I wanted to catch it before you had to say something. Can we put a senior on the next visit and walk the last flags with you?`;
}

export const sampleClient: Client = {
  id: "maple",
  name: "124 Maple — biweekly",
  jobType: "recurring",
  cadence: "Every other Tuesday",
  visits: [
    { id: "v1", date: "2026-07-28", stars: 5, qcScore: 96, notes: "Host left a thank-you note." },
    { id: "v2", date: "2026-08-11", stars: 5, qcScore: 92, notes: "Normal." },
    { id: "v3", date: "2026-08-25", stars: 4, qcScore: 84, notes: "Hair in guest bath." },
    { id: "v4", date: "2026-09-08", stars: 4, qcScore: 78, notes: "Kitchen counters sticky." },
    { id: "v5", date: "2026-09-22", stars: 3, qcScore: 64, notes: "Wet bath floor. Review: 'not like it used to be.'" },
    { id: "v6", date: "2026-10-06", stars: 3, qcScore: 58, notes: "Vacuum left in bedroom. Host asked if a new tech was on the job." },
  ],
};
