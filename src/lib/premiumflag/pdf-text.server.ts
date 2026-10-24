import { extractText, getDocumentProxy } from "unpdf";

/**
 * The PDF's own text layer, page by page, used for the deterministic screen (Social Security
 * numbers, payroll-register signals, scanned pages) before the file goes anywhere else.
 */
export async function pdfTextLayer(
  bytes: Uint8Array,
): Promise<{ pageTexts: string[]; pages: number } | null> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: false });
    const pageTexts = Array.isArray(result.text)
      ? result.text.map((t) => String(t ?? ""))
      : [String(result.text ?? "")];
    return { pageTexts, pages: result.totalPages };
  } catch (err) {
    console.warn("[premiumflag] no text layer:", err instanceof Error ? err.message : err);
    return null;
  }
}
