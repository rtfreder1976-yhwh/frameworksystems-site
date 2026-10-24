/** Upload limits shared by the page and the server. */

export const MAX_FILE_BYTES = 3 * 1024 * 1024;

/** One bill's certificates. Each PDF is its own paid read, so the cap applies before any read starts. */
export const MAX_CERTIFICATE_FILES = 60;

/** A zip of certificates, as picked. Its PDFs are still checked one by one. */
export const MAX_ZIP_BYTES = 50 * 1024 * 1024;
