import { createFileRoute } from "@tanstack/react-router";
import { Shipping } from "./shipping";

export const Route = createFileRoute("/invoiceflag")({
  head: () => ({
    meta: [
      { title: "InvoiceFlag | 3PL invoice auditor" },
      {
        name: "description",
        content:
          "Upload last month’s 3PL or parcel invoice. First audit free. No store login.",
      },
    ],
  }),
  component: Shipping,
});
