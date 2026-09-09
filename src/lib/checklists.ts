import type { ChecklistItem, JobType } from "./types";

export const jobTypes: { id: JobType; label: string; blurb: string }[] = [
  {
    id: "recurring",
    label: "Recurring clean",
    blurb: "Weekly / biweekly residential. Rooms vs. the house checklist.",
  },
  {
    id: "moveout",
    label: "Move-out",
    blurb: "Empty unit. Oven, fridge, baseboards, closets.",
  },
  {
    id: "airbnb",
    label: "Airbnb turn",
    blurb: "Same-day turn. Linens, restock, lockbox, room photos.",
  },
  {
    id: "inspection",
    label: "Property walk",
    blurb: "Manager walkthrough. Damage, detectors, appliances.",
  },
];

const rooms = (items: Omit<ChecklistItem, "id">[]): ChecklistItem[] =>
  items.map((item, i) => ({ ...item, id: `${item.room}-${i}` }));

export const checklists: Record<JobType, ChecklistItem[]> = {
  recurring: rooms([
    { room: "Entry", label: "Entry clear, shoes/mats reset", requiredPhoto: true },
    { room: "Kitchen", label: "Counters wiped, sink empty and dry", requiredPhoto: true },
    { room: "Kitchen", label: "Trash pulled, new liner", requiredPhoto: false },
    { room: "Bath", label: "Toilet, sink, and mirror", requiredPhoto: true },
    { room: "Bath", label: "Floor dry — no standing water", requiredPhoto: true },
    { room: "Bath", label: "Supplies packed, nothing left on the vanity", requiredPhoto: false },
    { room: "Bed", label: "Floors vacuumed / mopped, beds made if requested", requiredPhoto: true },
    { room: "Living", label: "Surfaces dusted, floors done", requiredPhoto: true },
    { room: "Whole home", label: "No wet floors on the walk-out", requiredPhoto: false },
    { room: "Whole home", label: "Crew gear out of the house", requiredPhoto: false },
  ]),
  moveout: rooms([
    { room: "Kitchen", label: "Inside oven", requiredPhoto: true },
    { room: "Kitchen", label: "Inside fridge / freezer, unplugged if asked", requiredPhoto: true },
    { room: "Kitchen", label: "Cabinets inside and out", requiredPhoto: true },
    { room: "Bath", label: "Behind and around toilet", requiredPhoto: true },
    { room: "Bath", label: "Floor dry, grout wiped", requiredPhoto: true },
    { room: "Bed", label: "Closets empty and wiped", requiredPhoto: true },
    { room: "Whole home", label: "Baseboards", requiredPhoto: true },
    { room: "Whole home", label: "Windows / sills", requiredPhoto: true },
    { room: "Whole home", label: "No supplies or gear left", requiredPhoto: false },
  ]),
  airbnb: rooms([
    { room: "Bed", label: "Beds made, extra linens set", requiredPhoto: true },
    { room: "Bath", label: "Towels hung, toiletries restocked", requiredPhoto: true },
    { room: "Bath", label: "Floor dry", requiredPhoto: true },
    { room: "Kitchen", label: "Dishes done, counters dry", requiredPhoto: true },
    { room: "Whole home", label: "Trash out, welcome book reset", requiredPhoto: true },
    { room: "Whole home", label: "Lockbox / keys photographed in place", requiredPhoto: true },
    { room: "Whole home", label: "No crew supplies left", requiredPhoto: false },
  ]),
  inspection: rooms([
    { room: "Exterior", label: "Approach and entry", requiredPhoto: true },
    { room: "Kitchen", label: "Appliances present and undamaged", requiredPhoto: true },
    { room: "Bath", label: "Fixtures, leaks, floor", requiredPhoto: true },
    { room: "Bed", label: "Walls, floors, windows", requiredPhoto: true },
    { room: "Living", label: "Walls, floors, windows", requiredPhoto: true },
    { room: "Safety", label: "Smoke / CO detectors", requiredPhoto: true },
    { room: "Whole home", label: "New damage vs. last walk", requiredPhoto: true },
  ]),
};

export function jobLabel(id: JobType) {
  return jobTypes.find((j) => j.id === id)?.label ?? id;
}
