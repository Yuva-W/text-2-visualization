import { useEffect, useRef } from "react";

function TraceCodePanel({ code, activeLine, compact = false, label = "Code" }) {
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;

        if (!container || !activeLine) return;

        const line = container.querySelector(`[data-line="${activeLine}"]`);

        if (!line) return;

        const top = line.offsetTop;
        const bottom = top + line.offsetHeight;

        if (top < container.scrollTop) {
            container.scrollTop = Math.max(0, top - 8);
        } else if (bottom > container.scrollTop + container.clientHeight) {
            container.scrollTop = bottom - container.clientHeight + 8;
        }
    }, [activeLine]);

    const lines = Array.isArray(code) ? code : [];

    if (!lines.length) return null;

    return (
        <div className="rounded-xl border border-line bg-ink-950 p-2">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                    {label}
                </span>
                <span className="text-[10px] text-faint">
                    {lines.length} lines
                </span>
            </div>
            <div
                ref={containerRef}
                className={`relative overflow-auto rounded-lg bg-ink-950/40 py-1 font-mono text-[11px] leading-5 ${
                    compact ? "max-h-40" : "max-h-72"
                }`}
            >
                {lines.map((line, index) => {
                    const lineNumber = index + 1;
                    const isActive = activeLine === lineNumber;

                    return (
                        <div
                            key={index}
                            data-line={lineNumber}
                            className={`flex gap-3 whitespace-pre px-2 py-0.5 transition-colors ${
                                isActive
                                    ? "bg-glacier/15 text-glacier"
                                    : "text-mist"
                            }`}
                        >
                            <span
                                className={`w-4 shrink-0 select-none text-right ${
                                    isActive ? "text-glacier" : "text-faint"
                                }`}
                            >
                                {lineNumber}
                            </span>
                            <span className="min-w-0">{line}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default TraceCodePanel;
