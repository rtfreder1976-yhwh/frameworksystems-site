import { checklists, jobLabel } from "./checklists";
import type { FlagSeverity, JobType, QcFinding, QcReport } from "./types";
import { uid } from "./utils";

export const samplePhotos = [
  {
    src: "/samples/bath-wet-floor.jpg",
    caption: "Bath — wet floor, supplies on vanity",
  },
  {
    src: "/samples/bedroom-miss.jpg",
    caption: "Bedroom — unmade, vacuum left",
  },
  {
    src: "/samples/kitchen-pass.jpg",
    caption: "Kitchen — pass",
  },
];

function scoreFrom(findings: QcFinding[]) {
  if (!findings.length) return 0;
  const weight: Record<FlagSeverity, number> = {
    pass: 100,
    watch: 70,
    fail: 30,
    missing: 0,
  };
  const total = findings.reduce((s, f) => s + weight[f.severity], 0);
  return Math.round(total / findings.length);
}

function smsFor(address: string, jobType: JobType, findings: QcFinding[], score: number) {
  const fails = findings.filter((f) => f.severity === "fail" || f.severity === "missing");
  const lines = fails.slice(0, 6).map((f) => `• ${f.room}: ${f.label} — ${f.note}`);
  return [
    `QC ${score}/100 — ${jobLabel(jobType)}${address ? ` @ ${address}` : ""}`,
    fails.length
      ? `Needs a return or a note to the client:`
      : `Looks complete. No return needed.`,
    ...lines,
  ].join("\n");
}

function officeNote(address: string, jobType: JobType, findings: QcFinding[], score: number) {
  const fails = findings.filter((f) => f.severity !== "pass");
  return [
    `CrewFlag photo QC`,
    `Job: ${jobLabel(jobType)}`,
    `Site: ${address || "—"}`,
    `Score: ${score}/100`,
    `Flags: ${fails.length}`,
    ...fails.map((f) => `- [${f.severity}] ${f.room} / ${f.label}: ${f.note}`),
  ].join("\n");
}

export function sampleReport(jobType: JobType, address: string): QcReport {
  const list = checklists[jobType];
  const canned: Record<string, { severity: FlagSeverity; note: string }> = {
    Bath: {
      severity: "fail",
      note: "Standing water on the floor. Spray bottle and towels left on the vanity.",
    },
    Bed: {
      severity: "fail",
      note: "Bed unmade. Vacuum left in the room. Closet not finished.",
    },
    Kitchen: {
      severity: "pass",
      note: "Counters dry, sink empty, trash lined.",
    },
  };

  const findings: QcFinding[] = list.map((item) => {
    const hit = canned[item.room];
    if (hit) {
      return {
        itemId: item.id,
        room: item.room,
        label: item.label,
        severity: item.room === "Kitchen" ? "pass" : hit.severity,
        note:
          item.room === "Kitchen"
            ? hit.note
            : item.label.toLowerCase().includes("supplies") ||
                item.label.toLowerCase().includes("wet") ||
                item.label.toLowerCase().includes("beds") ||
                item.label.toLowerCase().includes("vacuum")
              ? hit.note
              : hit.severity === "fail"
                ? hit.note
                : "Photo present.",
      };
    }
    if (item.requiredPhoto) {
      return {
        itemId: item.id,
        room: item.room,
        label: item.label,
        severity: "missing",
        note: "No photo for this required shot.",
      };
    }
    return {
      itemId: item.id,
      room: item.room,
      label: item.label,
      severity: "watch",
      note: "Can't confirm from the photos on hand.",
    };
  });

  const score = scoreFrom(findings);
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    jobType,
    address: address || "124 Maple St (sample)",
    photoCount: samplePhotos.length,
    score,
    findings,
    sms: smsFor(address || "124 Maple St", jobType, findings, score),
    officeNote: officeNote(address || "124 Maple St", jobType, findings, score),
    source: "sample",
  };
}

export function heuristicReport(
  jobType: JobType,
  address: string,
  captions: string[],
): QcReport {
  const list = checklists[jobType];
  const blob = captions.join(" ").toLowerCase();
  const findings: QcFinding[] = list.map((item) => {
    const roomHit = blob.includes(item.room.toLowerCase());
    const wet = /wet|puddle|standing water/.test(blob);
    const supplies = /spray|bottle|vacuum|supplies|left out/.test(blob);
    if (item.label.toLowerCase().includes("wet") && wet) {
      return {
        itemId: item.id,
        room: item.room,
        label: item.label,
        severity: "fail",
        note: "Photo or filename suggests a wet floor.",
      };
    }
    if (item.label.toLowerCase().includes("supplies") && supplies) {
      return {
        itemId: item.id,
        room: item.room,
        label: item.label,
        severity: "fail",
        note: "Looks like gear or product was left behind.",
      };
    }
    if (item.requiredPhoto && !roomHit && captions.length < list.filter((i) => i.requiredPhoto).length) {
      return {
        itemId: item.id,
        room: item.room,
        label: item.label,
        severity: "missing",
        note: "Required room photo not identified.",
      };
    }
    return {
      itemId: item.id,
      room: item.room,
      label: item.label,
      severity: roomHit ? "watch" : "pass",
      note: roomHit
        ? "Photo present — confirm the finish on site or run vision QC."
        : "No obvious miss from filenames. Run vision for a real read.",
    };
  });
  const score = scoreFrom(findings);
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    jobType,
    address,
    photoCount: captions.length,
    score,
    findings,
    sms: smsFor(address, jobType, findings, score),
    officeNote: officeNote(address, jobType, findings, score),
    source: "heuristic",
  };
}

export function reportFromAi(
  jobType: JobType,
  address: string,
  photoCount: number,
  findings: QcFinding[],
): QcReport {
  const score = scoreFrom(findings);
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    jobType,
    address,
    photoCount,
    score,
    findings,
    sms: smsFor(address, jobType, findings, score),
    officeNote: officeNote(address, jobType, findings, score),
    source: "vision",
  };
}
