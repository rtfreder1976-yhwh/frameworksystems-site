import type { AccessReason } from "./types";

export const accessReasons: {
  id: AccessReason;
  label: string;
  wait: number;
  billable: boolean;
  blurb: string;
}[] = [
  {
    id: "no-key",
    label: "No key / lockbox fail",
    wait: 15,
    billable: true,
    blurb: "Can't get in. Text, wait, then trip charge.",
  },
  {
    id: "dog-loose",
    label: "Dog loose",
    wait: 10,
    billable: true,
    blurb: "Do not enter. Secure the animal first.",
  },
  {
    id: "tenant-out",
    label: "Tenant / host not home",
    wait: 10,
    billable: true,
    blurb: "Knock, text, wait window, then leave.",
  },
  {
    id: "gate-code",
    label: "Gate / alarm code fail",
    wait: 10,
    billable: true,
    blurb: "Code doesn't work. Don't guess twice.",
  },
  {
    id: "blocked",
    label: "Driveway / parking blocked",
    wait: 10,
    billable: false,
    blurb: "Can't park. Document, text, wait.",
  },
];

export function buildAccessCopy(input: {
  reason: AccessReason;
  address: string;
  customer: string;
  tech: string;
}) {
  const meta = accessReasons.find((r) => r.id === input.reason)!;
  const who = input.customer || "there";
  const where = input.address || "the job";
  const tech = input.tech || "the crew";

  const customerSms: Record<AccessReason, string> = {
    "no-key": `Hi ${who} — ${tech} is at ${where} and we don't have working access (key/lockbox). Can you share a code or an ETA in the next ${meta.wait} minutes? If we can't get in we'll need to reschedule and a trip charge may apply.`,
    "dog-loose": `Hi ${who} — ${tech} is at ${where} and there's a dog loose that we can't safely work around. Please secure the animal. We'll wait ${meta.wait} minutes. If we can't start we'll reschedule and a trip charge may apply.`,
    "tenant-out": `Hi ${who} — ${tech} is at ${where} and no one is available to let us in. We'll wait ${meta.wait} minutes. Reply if you're close; otherwise we'll reschedule.`,
    "gate-code": `Hi ${who} — ${tech} is at the gate for ${where} and the code isn't working. Please send the current code. We'll wait ${meta.wait} minutes before we have to leave.`,
    blocked: `Hi ${who} — ${tech} can't park at ${where} (driveway/spot blocked). We'll wait ${meta.wait} minutes. Reply with where we should leave the vehicle.`,
  };

  const officeNote = [
    `ACCESS FAIL — ${meta.label}`,
    `Address: ${where}`,
    `Customer: ${who}`,
    `Tech: ${tech}`,
    `Wait window: ${meta.wait} min`,
    `Billable trip: ${meta.billable ? "YES — log trip charge" : "no, unless wait exceeds window"}`,
    `Action: text sent, clock started, do not force entry.`,
  ].join("\n");

  const tripLog = [
    `Trip log`,
    `Reason: ${meta.label}`,
    `Site: ${where}`,
    `Arrived: (timestamp)`,
    `Customer texted: yes`,
    `Wait: ${meta.wait} minutes`,
    `Access gained: no`,
    `Reschedule: yes`,
    `Billable trip: ${meta.billable ? "yes" : "no"}`,
    `Photos of door/gate: attach`,
  ].join("\n");

  return {
    waitMinutes: meta.wait,
    billedTrip: meta.billable,
    customerSms: customerSms[input.reason],
    officeNote,
    tripLog,
  };
}
