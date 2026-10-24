import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { unpackCertificateZip } from "./zip.ts";
import { MAX_CERTIFICATE_FILES, MAX_FILE_BYTES } from "./limits.ts";

const pdf = (label: string): Uint8Array => strToU8(`%PDF-1.4 ${label}`);

describe("unpackCertificateZip", () => {
  it("keeps the PDFs and skips Mac metadata, hidden files, and other types", () => {
    const zip = zipSync({
      "certs/a.pdf": pdf("a"),
      "certs/b.PDF": pdf("b"),
      "__MACOSX/certs/._a.pdf": pdf("x"),
      "certs/._b.pdf": pdf("y"),
      "notes.txt": strToU8("hi"),
    });
    const out = unpackCertificateZip("certs.zip", zip, 0);
    assert.deepEqual(out.map((f) => f.name).sort(), ["a.pdf", "b.PDF"]);
  });

  it("refuses more certificates than one bill can use", () => {
    const many = Object.fromEntries(
      Array.from({ length: MAX_CERTIFICATE_FILES + 1 }, (_, i) => [`c${i}.pdf`, pdf(String(i))]),
    );
    assert.throws(() => unpackCertificateZip("many.zip", zipSync(many), 0), /more than 60/);
    const two = zipSync({ "a.pdf": pdf("a"), "b.pdf": pdf("b") });
    assert.throws(
      () => unpackCertificateZip("two.zip", two, MAX_CERTIFICATE_FILES - 1),
      /more than 60/,
    );
  });

  it("refuses an entry over 3 MB by its declared size, before inflating it", () => {
    const zip = zipSync({ "big.pdf": new Uint8Array(MAX_FILE_BYTES + 1) });
    assert.throws(
      () => unpackCertificateZip("big.zip", zip, 0),
      /big\.pdf inside big\.zip is over 3 MB/,
    );
  });

  it("says so when the zip has no PDFs", () => {
    const zip = zipSync({ "a.txt": strToU8("x") });
    assert.throws(() => unpackCertificateZip("empty.zip", zip, 0), /no PDF certificates/);
  });
});
