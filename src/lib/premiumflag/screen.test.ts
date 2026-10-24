import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasSsn,
  headerLooksLikeRegister,
  parseCsv,
  screenCsv,
  screenText,
  textLooksLikeRegister,
} from "./screen.ts";

describe("hasSsn", () => {
  it("catches dashed, spaced, and labelled nine-digit numbers", () => {
    assert.equal(hasSsn("Employee 123-45-6789"), true);
    assert.equal(hasSsn("SSN 123 45 6789"), true);
    assert.equal(hasSsn("Social Security No: 123456789"), true);
  });
  it("leaves phone numbers, dates, EINs, and policy numbers alone", () => {
    assert.equal(hasSsn("Call 256-555-1234 before 2025-01-15"), false);
    assert.equal(hasSsn("EIN 12-3456789 policy WC123456789"), false);
    assert.equal(hasSsn("Check 100045 for $1,234.56 on 12/31/2025"), false);
  });
});

describe("screenCsv", () => {
  const summary =
    "Name,State,Class Code,Straight Time,Overtime,OT Premium\nJohn Doe,AL,5645,52000,6000,2000\nCrew,AL,5645,180000,12000,4000\n";

  it("passes a payroll summary", () => {
    assert.deepEqual(screenCsv(summary), { ok: true });
  });
  it("refuses a file with an SSN column", () => {
    const v = screenCsv("Name,SSN,Class,Wages\nJohn Doe,123-45-6789,5645,52000\n");
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.reason, "ssn");
  });
  it("refuses unformatted SSNs under an SSN header", () => {
    const v = screenCsv("Name,Social Security No,Class,Wages\nJohn Doe,123456789,5645,52000\n");
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.reason, "ssn");
  });
  it("refuses a register by its columns", () => {
    const v = screenCsv(
      "Employee,Check No,Check Date,Gross,Federal W/H,FICA,Net Pay\nJohn Doe,1001,2025-01-10,1500,150,114.75,1235.25\n",
    );
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.reason, "register");
  });
  it("treats masked SSNs as a register, not a summary", () => {
    const v = screenCsv("Name,SSN,Class,Wages\nJohn Doe,***-**-6789,5645,52000\n");
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.reason, "register");
  });
  it("reads tab-separated files and quoted commas", () => {
    const tsv = "Name\tClass Code\tWages\nJohn Doe\t5645\t52000\n";
    assert.equal(parseCsv(tsv)[0]?.length, 3);
    assert.deepEqual(screenCsv(tsv), { ok: true });
    const rows = parseCsv('Name,Wages\n"Doe, John",52000\n');
    assert.equal(rows[1]?.[0], "Doe, John");
  });
});

describe("register signals", () => {
  it("needs one register-only column or two softer ones", () => {
    assert.equal(headerLooksLikeRegister(["Name", "Class Code", "Wages"]), false);
    assert.equal(headerLooksLikeRegister(["Name", "Pay Period", "Wages"]), false);
    assert.equal(headerLooksLikeRegister(["Name", "Pay Date", "Employee ID", "Wages"]), true);
    assert.equal(headerLooksLikeRegister(["Name", "Deductions", "Wages"]), true);
  });
  it("needs two distinct register terms in free text", () => {
    assert.equal(
      textLooksLikeRegister("Payroll summary by class code. Total wages 240,000."),
      false,
    );
    assert.equal(textLooksLikeRegister("Check No 1001 Net Pay 1,235.25 Federal W/H 150.00"), true);
  });
});

describe("screenText", () => {
  it("only applies the register test to the summary slot", () => {
    const text = "Check No 1001 Net Pay 1,235.25 Deductions 50";
    assert.equal(screenText(text, "bill").ok, true);
    assert.equal(screenText(text, "summary").ok, false);
  });
  it("refuses an SSN in any slot", () => {
    assert.equal(screenText("Owner 123-45-6789", "certificate").ok, false);
    assert.equal(screenText("Owner 123-45-6789", "bill").ok, false);
  });
});
