import { createFileRoute } from "@tanstack/react-router";
import { Cleaning } from "./cleaning";

export const Route = createFileRoute("/crewflag")({
  head: () => ({
    meta: [
      { title: "CrewFlag | Walkthrough photos for cleaning companies" },
      {
        name: "description",
        content:
          "CrewFlag reads post-job photos for standing water, leftover product, and unfinished rooms. First job free.",
      },
    ],
  }),
  component: Cleaning,
});
