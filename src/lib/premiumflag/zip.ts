import { unzipSync } from "fflate";
import { MAX_CERTIFICATE_FILES, MAX_FILE_BYTES } from "./limits.ts";

export type UnpackedPdf = { name: string; bytes: Uint8Array };

export const TOO_MANY_CERTIFICATES = `That is more than ${MAX_CERTIFICATE_FILES} certificates. Send only the ones for the subs on this bill.`;

const isCertificateEntry = (name: string): boolean =>
  /\.pdf$/i.test(name) && !/(^|\/)__MACOSX\//.test(name) && !/(^|\/)\./.test(name);
const baseName = (name: string): string => name.split("/").pop() ?? name;

/**
 * The PDF certificates inside a zip. Entries are counted and checked by their declared size
 * before anything is inflated, so a huge or crowded archive is refused instead of unpacked.
 * `alreadyCount` is how many certificates were picked before this zip.
 */
export function unpackCertificateZip(
  zipName: string,
  data: Uint8Array,
  alreadyCount: number,
): UnpackedPdf[] {
  const seen = { wanted: 0, oversize: null as string | null };
  const entries = unzipSync(data, {
    filter: (entry) => {
      if (!isCertificateEntry(entry.name)) return false;
      if (entry.originalSize > MAX_FILE_BYTES) {
        seen.oversize ??= entry.name;
        return false;
      }
      seen.wanted += 1;
      return alreadyCount + seen.wanted <= MAX_CERTIFICATE_FILES;
    },
  });
  if (seen.oversize) throw new Error(`${baseName(seen.oversize)} inside ${zipName} is over 3 MB.`);
  if (alreadyCount + seen.wanted > MAX_CERTIFICATE_FILES) throw new Error(TOO_MANY_CERTIFICATES);
  const out = Object.entries(entries).map(([name, bytes]) => {
    // A declared size can be wrong, so the real one is checked too.
    if (bytes.length > MAX_FILE_BYTES) {
      throw new Error(`${baseName(name)} inside ${zipName} is over 3 MB.`);
    }
    return { name: baseName(name), bytes };
  });
  if (!out.length) throw new Error(`${zipName} has no PDF certificates in it.`);
  return out;
}
