import { extractText, getDocumentProxy } from "unpdf";

/**
 * The PDF's own text layer, used for the deterministic screen (Social Security numbers,
 * payroll-register signals) before the file goes anywhere else. A scanned PDF has no text
 * layer; the model's own contains_ssn flag covers that case after the read.
 */
export async function pdfTextLayer(
  bytes: Uint8Array,
): Promise<{ text: string; pages: number } | null> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join("\n") : String(result.text ?? "");
    return { text, pages: result.totalPages };
  } catch (err) {
    console.warn("[premiumflag] no text layer:", err instanceof Error ? err.message : err);
    return null;
  }
}
