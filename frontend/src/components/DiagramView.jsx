import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

const FONT_FAMILY =
    '"Segoe UI", "Nirmala UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Kannada", Arial, Helvetica, sans-serif';

// Mermaid renders through temporary DOM nodes keyed by the ID it receives.
// A global sequence keeps every render unique, even across StrictMode effect
// replays, remounts, and multiple diagrams on the same page.
let renderSequence = 0;

mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "dark",
    fontFamily: FONT_FAMILY,
    // SVG text labels keep PNG export from tainting the canvas.
    htmlLabels: false,
    // We render errors ourselves; Mermaid's built-in error diagram can leave
    // temporary DOM nodes behind.
    suppressErrorRendering: true,
    // Timelines and gantt charts have a natural horizontal reading direction.
    // Keep their intrinsic width so labels stay legible and let the wrapper
    // scroll instead of shrinking the whole diagram into unreadable type.
    gantt: {
        useMaxWidth: false,
        barHeight: 24,
        fontSize: 12,
        sectionFontSize: 12,
    },
    timeline: {
        useMaxWidth: false,
    },
    themeVariables: {
        background: "#0a1117",
        primaryColor: "#14232d",
        primaryTextColor: "#e8eef2",
        primaryBorderColor: "#334b57",
        secondaryColor: "#0e1922",
        tertiaryColor: "#0e1922",
        lineColor: "#617582",
        edgeLabelBackground: "#0e1922",
        clusterBkg: "#0a1117",
        titleColor: "#e8eef2",
    },
});

function DiagramView({ code, highlightIds }) {
    const [svg, setSvg] = useState("");
    const [error, setError] = useState("");
    const containerRef = useRef(null);
    const highlightKey = Array.isArray(highlightIds)
        ? highlightIds.join("|")
        : "";
    const isWideDiagram = /^\s*(timeline|gantt)\b/m.test(code);

    useEffect(() => {
        let cancelled = false;

        async function renderDiagram() {
            setError("");
            setSvg("");

            // Mermaid keeps temporary elements under the ID it is given.
            // StrictMode intentionally runs this effect twice, so reusing one
            // ID lets one render remove the other render's container and
            // triggers "Cannot read properties of null (reading 'firstChild')".
            const renderId = `mermaid-diagram-${++renderSequence}`;

            // Mermaid treats __name__ as Markdown emphasis inside diagrams.
            // Swap Python dunders for same-length placeholders while
            // rendering, then restore the underscores in the SVG. Limit this
            // to class diagrams so intentional Markdown emphasis in other
            // diagram types is left alone.
            const isClassDiagram = /^\s*classDiagram\b/m.test(code);
            const renderCode = isClassDiagram
                ? code.replace(
                      /__([A-Za-z][A-Za-z0-9_]*)__/g,
                      "@@$1@@"
                  )
                : code;

            try {
                const result = await mermaid.render(renderId, renderCode);

                if (!cancelled) {
                    setSvg(
                        isClassDiagram
                            ? result.svg.replace(
                                  /@@([A-Za-z][A-Za-z0-9_]*)@@/g,
                                  "__$1__"
                              )
                            : result.svg
                    );
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err?.message || "The diagram could not be rendered"
                    );
                }
            } finally {
                document.getElementById(renderId)?.remove();
            }
        }

        renderDiagram();

        return () => {
            cancelled = true;
        };
    }, [code]);

    useEffect(() => {
        const root = containerRef.current;

        if (!root) return;

        const activeIds = highlightKey ? highlightKey.split("|") : [];
        const activeSet = new Set(activeIds);

        root.querySelectorAll("g.node").forEach((node) => {
            const dataId = node.getAttribute("data-id");
            const elementId = node.id || "";
            const isActive =
                (dataId && activeSet.has(dataId)) ||
                activeIds.some((nodeId) => {
                    const escaped = nodeId.replace(
                        /[.*+?^${}()|[\]\\]/g,
                        "\\$&"
                    );

                    return new RegExp(
                        `(^|-)${escaped}(-\\d+)?$`
                    ).test(elementId);
                });

            node.classList.toggle("is-highlighted", Boolean(isActive));
        });
    }, [svg, highlightKey]);

    if (error) {
        return (
            <div className="space-y-3">
                <p className="rounded-lg bg-red-950/40 p-3 text-sm text-red-400">
                    {error}
                </p>
                <pre className="overflow-x-auto rounded-lg bg-ink-950/60 p-3 text-xs text-mist">
                    {code}
                </pre>
            </div>
        );
    }

    if (!svg) {
        return (
            <p className="p-6 text-center text-sm text-mist">
                Rendering diagram...
            </p>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`mermaid-output flex w-full overflow-x-auto ${
                isWideDiagram ? "mermaid-wide" : "justify-center"
            }`}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

export default DiagramView;
