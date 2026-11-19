import { MAX_MESSAGE_LENGTH } from "./limits.js";

export const PDF_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PDF_MAX_PAGES = 50;
export const PDF_MIN_IMPORT_CHARS = 100;

let pdfjsPromise = null;

export class PdfImportError extends Error {
    constructor(message) {
        super(message);
        this.name = "PdfImportError";
    }
}

export function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validatePdfFile(file) {
    if (!file) {
        throw new PdfImportError("Choose a PDF file first.");
    }

    const name = String(file.name || "");
    const type = String(file.type || "");

    if (!/\.pdf$/i.test(name) && type !== "application/pdf") {
        throw new PdfImportError("Only PDF files are supported.");
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
        throw new PdfImportError("The selected PDF is empty.");
    }

    if (file.size > PDF_MAX_FILE_BYTES) {
        throw new PdfImportError(
            `That PDF is too large. Choose a file under ${formatFileSize(
                PDF_MAX_FILE_BYTES
            )}.`
        );
    }
}

export function normalizePdfText(value) {
    return String(value || "")
        .replace(/\r\n?/g, "\n")
        .replace(/\t/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

export function mergePdfText(
    draft,
    imported,
    maxChars = MAX_MESSAGE_LENGTH
) {
    const base = String(draft || "").trimEnd();
    const separator = base ? "\n\n" : "";
    const available = Math.max(0, maxChars - base.length - separator.length);

    if (available < PDF_MIN_IMPORT_CHARS) {
        throw new PdfImportError(
            "There is not enough room in the message for this PDF. Clear some text and try again."
        );
    }

    const text = String(imported || "").slice(0, available);

    return {
        text: `${base}${separator}${text}`,
        clipped: text.length < String(imported || "").length,
    };
}

function pageTextFromItems(items) {
    let text = "";

    for (const item of items || []) {
        const value = typeof item?.str === "string" ? item.str : "";

        text += value;

        if (item?.hasEOL) {
            text += "\n";
        } else if (value && !/\s$/.test(value)) {
            text += " ";
        }
    }

    return normalizePdfText(text);
}

function getPdfjs() {
    if (!pdfjsPromise) {
        pdfjsPromise = Promise.all([
            import("pdfjs-dist"),
            import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ])
            .then(([pdfjs, worker]) => {
                pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
                return pdfjs;
            })
            .catch((error) => {
                pdfjsPromise = null;
                throw error;
            });
    }

    return pdfjsPromise;
}

function toPdfImportError(error) {
    if (error instanceof PdfImportError) return error;

    const name = String(error?.name || "");
    const message = String(error?.message || "");

    if (name === "PasswordException" || /password/i.test(message)) {
        return new PdfImportError(
            "This PDF is password-protected. Remove the password and try again."
        );
    }

    if (
        name === "InvalidPDFException" ||
        /invalid pdf|structure/i.test(message)
    ) {
        return new PdfImportError(
            "This PDF could not be read. It may be corrupted or malformed."
        );
    }

    return new PdfImportError(
        "The PDF could not be read. Check that it is a valid, text-based PDF."
    );
}

export async function extractPdfText(
    file,
    { maxChars = MAX_MESSAGE_LENGTH, onProgress } = {}
) {
    validatePdfFile(file);

    const limit = Math.min(
        MAX_MESSAGE_LENGTH,
        Math.floor(maxChars) || 0
    );

    if (limit < PDF_MIN_IMPORT_CHARS) {
        throw new PdfImportError(
            "There is not enough room in the message for this PDF. Clear some text and try again."
        );
    }

    let pdfjs;
    let loadingTask = null;

    try {
        onProgress?.({ stage: "loading", page: 0, totalPages: 0 });
        try {
            pdfjs = await getPdfjs();
        } catch {
            throw new PdfImportError(
                "The PDF reader could not start. Reload the page and try again."
            );
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        loadingTask = pdfjs.getDocument({
            data: bytes,
            isEvalSupported: false,
        });
        const pdf = await loadingTask.promise;

        const pageCount = pdf.numPages;

        if (!pageCount) {
            throw new PdfImportError("This PDF does not contain any pages.");
        }

        const pagesToRead = Math.min(pageCount, PDF_MAX_PAGES);
        const chunks = [];
        let used = 0;
        let pagesRead = 0;
        let charLimitHit = false;

        for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
            onProgress?.({
                stage: "reading",
                page: pageNumber,
                totalPages: pagesToRead,
            });

            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            pagesRead = pageNumber;

            const pageText = pageTextFromItems(content.items);
            page.cleanup?.();

            if (!pageText) continue;

            const header =
                pageCount > 1 ? `--- Page ${pageNumber} ---\n` : "";
            const chunk = `${chunks.length ? "\n\n" : ""}${header}${pageText}`;
            const remaining = limit - used;

            if (remaining <= 0) {
                charLimitHit = true;
                break;
            }

            if (chunk.length > remaining) {
                chunks.push(chunk.slice(0, remaining));
                used = limit;
                charLimitHit = true;
                break;
            }

            chunks.push(chunk);
            used += chunk.length;

            if (used >= limit && pageNumber < pagesToRead) {
                charLimitHit = true;
                break;
            }
        }

        const text = chunks.join("").trim();

        if (!text) {
            throw new PdfImportError(
                "No selectable text was found. This looks like a scanned PDF; run OCR first or paste the text manually."
            );
        }

        const pageLimitHit = pagesToRead < pageCount;

        return {
            text,
            pageCount,
            pagesRead,
            chars: text.length,
            truncated: charLimitHit || pageLimitHit,
            charLimitHit,
            pageLimitHit,
        };
    } catch (error) {
        throw toPdfImportError(error);
    } finally {
        if (loadingTask) {
            await loadingTask.destroy().catch(() => {});
        }
    }
}
