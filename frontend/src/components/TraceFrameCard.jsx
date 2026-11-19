import { useMemo } from "react";
import TraceCodePanel from "./TraceCodePanel.jsx";
import TraceStage from "./TraceStage.jsx";

function formatVariable(value) {
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
}

function TraceFrameCard({
    visualization,
    index,
    viewMode = "auto",
    compact = false,
    label = "Trace",
}) {
    const frames = useMemo(
        () =>
            Array.isArray(visualization?.animation?.frames)
                ? visualization.animation.frames
                : [],
        [visualization]
    );
    const total = frames.length;
    const safeIndex = Math.max(0, Math.min(index, total - 1));
    const frame = frames[safeIndex] || {};
    const previousFrame = safeIndex > 0 ? frames[safeIndex - 1] : null;
    const activeLine = Number.isInteger(frame.codeLine)
        ? frame.codeLine
        : null;
    const resolvedViewMode =
        viewMode === "auto"
            ? visualization?.animation?.viewMode || "auto"
            : viewMode;

    const sortedIndices = useMemo(() => {
        const sorted = new Set();

        for (let step = 0; step <= safeIndex && step < total; step += 1) {
            frames[step]?.highlights?.sorted?.forEach((value) => {
                sorted.add(value);
            });
        }

        return [...sorted];
    }, [frames, safeIndex, total]);

    if (!total) {
        return (
            <p className="rounded-xl bg-red-950/30 p-4 text-sm text-red-400">
                This trace does not contain any steps.
            </p>
        );
    }

    const variables = frame.variables;
    const callStack = frame.callStack;
    const showSideCallStack =
        Boolean(callStack?.length) && resolvedViewMode !== "callstack";
    const hasSidePanel =
        Boolean(variables && Object.keys(variables).length > 0) ||
        showSideCallStack;

    return (
        <div className="min-w-0 rounded-xl border border-line bg-ink-800 p-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-glacier">
                    {label}
                </span>
                <span className="text-[10px] tabular-nums text-faint">
                    Step {safeIndex + 1} of {total}
                </span>
            </div>

            <div
                className={`grid gap-2 ${
                    hasSidePanel && !compact
                        ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]"
                        : ""
                }`}
            >
                <div className="min-w-0 space-y-2">
                    <div className="rounded-lg border border-line bg-ink-800 px-3 py-2">
                        <p
                            aria-live="polite"
                            className="text-xs leading-5 text-chalk"
                        >
                            {frame.caption}
                        </p>
                    </div>

                    <TraceCodePanel
                        code={visualization?.animation?.code}
                        activeLine={activeLine}
                        compact={compact}
                    />

                    <TraceStage
                        viewMode={resolvedViewMode}
                        frame={frame}
                        previousFrame={previousFrame}
                        sortedIndices={sortedIndices}
                    />
                </div>

                {hasSidePanel && (
                    <aside className="min-w-0 space-y-2">
                        {variables && Object.keys(variables).length > 0 && (
                            <div className="rounded-lg border border-line bg-ink-950 p-2">
                                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                                    Variables
                                </p>
                                <div className="flex flex-wrap gap-1.5 p-1">
                                    {Object.entries(variables).map(
                                        ([name, value]) => (
                                            <span
                                                key={name}
                                                className="max-w-full truncate rounded-md bg-ink-700 px-2 py-1 font-mono text-[10px]"
                                            >
                                                <span className="text-faint">
                                                    {name}
                                                </span>
                                                <span className="text-faint">
                                                    {" = "}
                                                </span>
                                                <span className="text-signal">
                                                    {formatVariable(value)}
                                                </span>
                                            </span>
                                        )
                                    )}
                                </div>
                            </div>
                        )}

                        {showSideCallStack && (
                            <div className="rounded-lg border border-line bg-ink-950 p-2">
                                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                                    Call stack
                                </p>
                                <div className="space-y-1 p-1">
                                    {callStack
                                        .slice()
                                        .reverse()
                                        .map((stackFrame, stackIndex) => (
                                            <div
                                                key={`${stackFrame.function}-${stackFrame.line}-${stackIndex}`}
                                                className="flex items-center justify-between gap-2 rounded-md bg-ink-700 px-2 py-1 font-mono text-[10px]"
                                            >
                                                <span className="truncate text-violet-200">
                                                    {stackFrame.function ===
                                                    "<module>"
                                                        ? "module"
                                                        : stackFrame.function}
                                                </span>
                                                <span className="shrink-0 text-faint">
                                                    {stackFrame.line
                                                        ? `L${stackFrame.line}`
                                                        : ""}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </aside>
                )}
            </div>
        </div>
    );
}

export default TraceFrameCard;
