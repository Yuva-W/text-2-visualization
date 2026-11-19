import test from "node:test";
import assert from "node:assert/strict";

import {
    PDF_MAX_FILE_BYTES,
    PDF_MIN_IMPORT_CHARS,
    extractPdfText,
    formatFileSize,
    mergePdfText,
    normalizePdfText,
    validatePdfFile,
} from "./pdfText.js";

test("validatePdfFile accepts PDFs by MIME type or extension", () => {
    assert.doesNotThrow(() =>
        validatePdfFile({
            name: "notes.pdf",
            type: "application/pdf",
            size: 1024,
        })
    );
    assert.doesNotThrow(() =>
        validatePdfFile({
            name: "notes.PDF",
            type: "",
            size: 1024,
        })
    );
});

test("validatePdfFile rejects non-PDF and empty files", () => {
    assert.throws(
        () =>
            validatePdfFile({
                name: "notes.txt",
                type: "text/plain",
                size: 1024,
            }),
        /Only PDF files/
    );
    assert.throws(
        () =>
            validatePdfFile({
                name: "empty.pdf",
                type: "application/pdf",
                size: 0,
            }),
        /empty/
    );
});

test("validatePdfFile rejects oversized PDFs", () => {
    assert.throws(
        () =>
            validatePdfFile({
                name: "huge.pdf",
                type: "application/pdf",
                size: PDF_MAX_FILE_BYTES + 1,
            }),
        /too large/
    );
});

test("formatFileSize formats bytes, kilobytes, and megabytes", () => {
    assert.equal(formatFileSize(0), "0 B");
    assert.equal(formatFileSize(512), "512 B");
    assert.equal(formatFileSize(2048), "2 KB");
    assert.equal(formatFileSize(2 * 1024 * 1024), "2.0 MB");
});

test("normalizePdfText trims whitespace and keeps paragraph breaks", () => {
    assert.equal(
        normalizePdfText("  Hello   PDF\r\n\r\n\r\nNext\tline  \n"),
        "Hello PDF\n\nNext line"
    );
});

test("mergePdfText adds imported text to an empty draft", () => {
    const result = mergePdfText("", "PDF text");

    assert.equal(result.text, "PDF text");
    assert.equal(result.clipped, false);
});

test("mergePdfText appends imported text to an existing draft", () => {
    const result = mergePdfText("Summarize this:", "PDF text");

    assert.equal(result.text, "Summarize this:\n\nPDF text");
    assert.equal(result.clipped, false);
});

test("mergePdfText clips imported text to the message limit", () => {
    const result = mergePdfText("", "x".repeat(200), 120);

    assert.equal(result.text.length, 120);
    assert.equal(result.clipped, true);
});

test("mergePdfText rejects imports without enough room", () => {
    assert.throws(
        () =>
            mergePdfText(
                "x".repeat(120 - PDF_MIN_IMPORT_CHARS + 1),
                "PDF text",
                120
            ),
        /not enough room/i
    );
});

test("extractPdfText rejects imports without enough room", async () => {
    await assert.rejects(
        extractPdfText(
            {
                name: "notes.pdf",
                type: "application/pdf",
                size: 1024,
            },
            { maxChars: PDF_MIN_IMPORT_CHARS - 1 }
        ),
        /not enough room/i
    );
});
