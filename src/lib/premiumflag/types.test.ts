import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  AlignmentSchema,
  BillExtractSchema,
  CertificatesExtractSchema,
  SummaryExtractSchema,
} from "./types.ts";
import { bill, line, summary } from "./test-fixtures.ts";

describe("extraction schemas", () => {
  it("still convert to the structured-output format the API takes", () => {
    for (const s of [
      BillExtractSchema,
      SummaryExtractSchema,
      CertificatesExtractSchema,
      AlignmentSchema,
    ]) {
      assert.equal(zodOutputFormat(s).type, "json_schema");
    }
  });

  it("read near-miss labels the way the model meant them", () => {
    const b = BillExtractSchema.parse({
      ...bill(),
      document_type: "Audit Worksheet",
      policy_type: "Workers Comp",
      lines: [
        {
          ...line({ id: "L1" }),
          category: "Subcontractor",
          basis: "subcontract cost",
          rate_basis: "Per 100",
        },
      ],
    });
    assert.equal(b.document_type, "audit_worksheet");
    assert.equal(b.policy_type, "workers_comp");
    assert.equal(b.lines[0]!.category, "subcontractor");
    assert.equal(b.lines[0]!.basis, "subcontract_cost");
    assert.equal(b.lines[0]!.rate_basis, "per_100");
    const s = SummaryExtractSchema.parse({ ...summary([]), document_type: "Payroll Summary" });
    assert.equal(s.document_type, "payroll_summary");
  });

  it("fall back to the label that makes no claim", () => {
    const b = BillExtractSchema.parse({
      ...bill(),
      document_type: "invoice",
      policy_type: "workers compensation",
      lines: [{ ...line({ id: "L1" }), category: "laborer", basis: "hours", rate_basis: "weekly" }],
    });
    assert.equal(b.document_type, "other");
    assert.equal(b.policy_type, "unknown");
    assert.equal(b.lines[0]!.category, "other");
    assert.equal(b.lines[0]!.basis, "unknown");
    assert.equal(b.lines[0]!.rate_basis, "unknown");
  });
});
