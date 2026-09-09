export type JobType = "recurring" | "moveout" | "airbnb" | "inspection";

export type FlagSeverity = "pass" | "watch" | "fail" | "missing";

export type ChecklistItem = {
  id: string;
  room: string;
  label: string;
  requiredPhoto: boolean;
};

export type QcFinding = {
  itemId: string;
  room: string;
  label: string;
  severity: FlagSeverity;
  note: string;
};

export type QcReport = {
  id: string;
  createdAt: string;
  jobType: JobType;
  address: string;
  photoCount: number;
  score: number;
  findings: QcFinding[];
  sms: string;
  officeNote: string;
  source: "sample" | "heuristic" | "vision";
};

export type Visit = {
  id: string;
  date: string;
  stars: number;
  qcScore: number | null;
  notes: string;
};

export type Client = {
  id: string;
  name: string;
  jobType: JobType;
  cadence: string;
  visits: Visit[];
};

export type AccessReason =
  | "no-key"
  | "dog-loose"
  | "tenant-out"
  | "gate-code"
  | "blocked";

export type AccessRun = {
  id: string;
  createdAt: string;
  reason: AccessReason;
  address: string;
  customer: string;
  waitMinutes: number;
  billedTrip: boolean;
  customerSms: string;
  officeNote: string;
  tripLog: string;
};
