import { useEffect, useRef, useState } from "react";
import ChartView from "./ChartView.jsx";
import DiagramView from "./DiagramView.jsx";
import TableView from "./TableView.jsx";
import AnimationView from "./AnimationView.jsx";
import {
    exportCsv,
    exportPng,
    exportSvg,
    slugify,
} from "../utils/export.js";

const TYPE_LABELS = {
    chart: "Chart",
    diagram: "Diagram",
    table: "Table",
    animation: "Animation",
};

const LANGUAGE_LABELS = {
    en: "English",
    hi: "Hindi",
    kn: "Kannada",
};

const DIAGRAM_LABELS = {
    flowchart: "Flowchart",
    sequence: "Sequence",
    mindmap: "Mind map",
    timeline: "Timeline",
    state: "State diagram",
    er: "ER diagram",
    class: "Class diagram",
    gantt: "Gantt chart",
    journey: "Journey map",
};

const ANIMATION_LABELS = {
    algorithm: "Algorithm",
    process: "Process",
};

const EXPORT_BUTTON_CLASS =
    "rounded-md border border-line bg-ink-800 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-mist transition hover:border-glacier/50 hover:text-chalk";

function VisualizationPanel({ visualization }) {
    const containerRef = useRef(null);
    const [exportError, setExportError] = useState("");

    useEffect(() => {
        // Clear a stale export error when another visualization is selected.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExportError("");
    }, [visualization]);

    if (!visualization || visualization.type === "text") {
        return null;
    }

    const { type, title, chart, diagram, table, animation, language } =
        visualization;
    const filenameBase = slugify(title);

    const detail =
        type === "chart"
            ? chart?.chartType
            : type === "diagram"
              ? DIAGRAM_LABELS[diagram?.diagramType] || diagram?.diagramType
              : type === "animation"
                ? ANIMATION_LABELS[animation?.animationType] ||
                  animation?.animationType
                : `${table?.rows?.length || 0} rows`;

    const handleExport = async (format) => {
        setExportError("");

        try {
            if (format === "svg") {
                exportSvg(containerRef.current, `${filenameBase}.svg`);
            } else if (format === "png") {
                await exportPng(containerRef.current, `${filenameBase}.png`);
            } else if (format === "csv" && table) {
                exportCsv(table, `${filenameBase}.csv`);
            }
        } catch (error) {
            setExportError(error.message || "Export failed");
        }
    };

    return (
        <section
            lang={language || undefined}
            className="mt-4 overflow-hidden rounded-xl border border-line bg-ink-950/50"
        >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-ink-900/60 px-4 py-3">
                <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-glacier/25 bg-glacier/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-glacier">
                            <span className="h-1 w-1 rounded-full bg-glacier" />
                            {TYPE_LABELS[type] || type}
                        </span>
                        {LANGUAGE_LABELS[language] && (
                            <span className="rounded-full border border-signal/25 bg-signal/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-signal">
                                {LANGUAGE_LABELS[language]}
                            </span>
                        )}
                        {detail && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                                {detail}
                            </span>
                        )}
                    </div>

                    <h3 className="font-display truncate text-[15px] font-semibold tracking-tight text-chalk">
                        {title}
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    {(type === "chart" || type === "diagram") && (
                        <>
                            <button
                                type="button"
                                onClick={() => handleExport("svg")}
                                className={EXPORT_BUTTON_CLASS}
                            >
                                SVG
                            </button>
                            <button
                                type="button"
                                onClick={() => handleExport("png")}
                                className={EXPORT_BUTTON_CLASS}
                            >
                                PNG
                            </button>
                        </>
                    )}

                    {type === "table" && (
                        <button
                            type="button"
                            onClick={() => handleExport("csv")}
                            className={EXPORT_BUTTON_CLASS}
                        >
                            CSV
                        </button>
                    )}

                    {type === "animation" && (
                        <span className="rounded-md border border-line bg-ink-800 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                            Interactive
                        </span>
                    )}
                </div>
            </header>

            <div ref={containerRef} className="p-4">
                {type === "chart" && chart && <ChartView chart={chart} />}
                {type === "diagram" && diagram && (
                    <DiagramView code={diagram.mermaid} />
                )}
                {type === "table" && table && <TableView table={table} />}
                {type === "animation" && animation && (
                    <AnimationView animation={animation} />
                )}

                {((type === "chart" && !chart) ||
                    (type === "diagram" && !diagram) ||
                    (type === "table" && !table) ||
                    (type === "animation" && !animation)) && (
                    <p className="p-4 text-sm text-red-400">
                        The visualization payload is missing.
                    </p>
                )}
            </div>

            {exportError && (
                <p className="border-t border-line px-4 py-2 text-xs text-red-400">
                    {exportError}
                </p>
            )}
        </section>
    );
}

export default VisualizationPanel;
