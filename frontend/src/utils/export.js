function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const EXPORT_FONT_FAMILY =
    '"Segoe UI", "Nirmala UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Kannada", Arial, Helvetica, sans-serif';

function serializeSvg(container) {
    // Charts and diagrams can contain small decorative SVGs (legend icons,
    // markers), so export the largest one instead of the first one.
    const svg = [...container.querySelectorAll("svg")]
        .map((element) => ({
            element,
            area: (() => {
                const rect = element.getBoundingClientRect();
                return rect.width * rect.height;
            })(),
        }))
        .sort((a, b) => b.area - a.area)[0]?.element;

    if (!svg) {
        throw new Error("No SVG found to export");
    }

    const { width, height } = svg.getBoundingClientRect();
    const clone = svg.cloneNode(true);
    const fontFamily =
        window.getComputedStyle(container).fontFamily || EXPORT_FONT_FAMILY;

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", Math.ceil(width || 800));
    clone.setAttribute("height", Math.ceil(height || 480));
    clone.setAttribute("font-family", fontFamily);

    clone.querySelectorAll("text, tspan").forEach((node) => {
        node.setAttribute("font-family", fontFamily);
    });

    const fontStyle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "style"
    );

    fontStyle.textContent = `text, tspan, .label { font-family: ${EXPORT_FONT_FAMILY} !important; }`;

    const background = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
    );

    background.setAttribute("width", "100%");
    background.setAttribute("height", "100%");
    background.setAttribute("fill", "#0a1117");

    clone.insertBefore(background, clone.firstChild);
    clone.insertBefore(fontStyle, background.nextSibling);

    return {
        markup: new XMLSerializer().serializeToString(clone),
        width: Math.ceil(width || 800),
        height: Math.ceil(height || 480),
    };
}

export function exportSvg(container, filename) {
    const { markup } = serializeSvg(container);
    const blob = new Blob([markup], {
        type: "image/svg+xml;charset=utf-8",
    });

    downloadBlob(blob, filename);
}

export async function exportPng(container, filename) {
    const { markup, width, height } = serializeSvg(container);
    const svgBlob = new Blob([markup], {
        type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
        const image = new Image();

        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error("Failed to render PNG"));
            image.src = svgUrl;
        });

        const scale = 2;
        const canvas = document.createElement("canvas");

        canvas.width = width * scale;
        canvas.height = height * scale;

        const context = canvas.getContext("2d");

        context.fillStyle = "#0a1117";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const pngBlob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png")
        );

        if (!pngBlob) {
            throw new Error("Failed to create PNG");
        }

        downloadBlob(pngBlob, filename);
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

export function exportCsv(table, filename) {
    const escape = (value) => {
        const text = String(value ?? "");

        if (/[",\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }

        return text;
    };

    const lines = [
        table.columns.map(escape).join(","),
        ...table.rows.map((row) => row.map(escape).join(",")),
    ];
    const blob = new Blob([`\ufeff${lines.join("\n")}`], {
        type: "text/csv;charset=utf-8",
    });

    downloadBlob(blob, filename);
}

export function slugify(value, fallback = "visualization") {
    const slug = String(value || "")
        .normalize("NFC")
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);

    return slug || fallback;
}
