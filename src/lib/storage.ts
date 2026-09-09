import type { AccessRun, Client, QcReport } from "./types";

const K = {
  reports: "crewflag.reports",
  clients: "crewflag.clients",
  access: "crewflag.access",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const store = {
  reports: () => read<QcReport[]>(K.reports, []),
  saveReport: (report: QcReport) => {
    write(K.reports, [report, ...store.reports()].slice(0, 40));
  },
  clients: () => read<Client[]>(K.clients, []),
  saveClients: (clients: Client[]) => write(K.clients, clients),
  access: () => read<AccessRun[]>(K.access, []),
  saveAccess: (run: AccessRun) => {
    write(K.access, [run, ...store.access()].slice(0, 40));
  },
};
