import { useEffect, useMemo, useRef, useState } from "react";
import AlgorithmStage from "./AlgorithmStage.jsx";
import DiagramView from "./DiagramView.jsx";

const SPEEDS = [0.5, 1, 1.5, 2];

function formatVariable(value) {
    if (typeof value === "boolean") {
        return value ? "true" : "false";
    }

    return String(value);
}

function AnimationView({ animation }) {
    const frames = useMemo(
        () =>
            Array.isArray(animation?.frames) ? animation.frames : [],
        [animation]
    );
    const total = frames.length;
    const lastIndex = Math.max(0, total - 1);

    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const codeContainerRef = useRef(null);

    useEffect(() => {
        // A different animation was selected; start from its first step.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIndex(0);
        setPlaying(false);
    }, [animation]);

    useEffect(() => {
        if (!playing || total < 2 || index >= lastIndex) {
            return undefined;
        }

        const captionLength = frames[index]?.caption?.length || 0;
        const duration =
            Math.min(5000, Math.max(1500, captionLength * 40)) / speed;
        const timer = setTimeout(() => {
            setIndex((current) => Math.min(current + 1, lastIndex));

            if (index + 1 >= lastIndex) {
                setPlaying(false);
            }
        }, duration);

        return () => clearTimeout(timer);
    }, [playing, index, lastIndex, speed, total, frames]);

    const frame = frames[Math.min(index, lastIndex)] || {};
    const codeLines = Array.isArray(animation?.code) ? animation.code : [];
    const activeCodeLine = Number.isInteger(frame.codeLine)
        ? frame.codeLine
        : null;

    const arrayState = useMemo(() => {
        for (let i = Math.min(index, frames.length - 1); i >= 0; i -= 1) {
            if (frames[i]?.array?.length) {
                return frames[i].array;
            }
        }

        return null;
    }, [frames, index]);

    const sortedIndices = useMemo(() => {
        const sorted = new Set();

        for (let i = 0; i <= index && i < frames.length; i += 1) {
            frames[i]?.highlights?.sorted?.forEach((value) => {
                sorted.add(value);
            });
        }

        return [...sorted];
    }, [frames, index]);

    const variables = useMemo(() => {
        for (let i = index; i >= 0; i -= 1) {
            const frameVariables = frames[i]?.variables;

            if (
                frameVariables &&
                Object.keys(frameVariables).length > 0
            ) {
                return frameVariables;
            }
        }

        return null;
    }, [frames, index]);

    useEffect(() => {
        const container = codeContainerRef.current;

        if (!container || !activeCodeLine) return;

        const line = container.querySelector(
            `[data-line="${activeCodeLine}"]`
        );

        if (!line) return;

        const lineTop = line.offsetTop;
        const lineBottom = lineTop + line.offsetHeight;

        if (lineTop < container.scrollTop) {
            container.scrollTop = Math.max(0, lineTop - 8);
        } else if (
            lineBottom >
            container.scrollTop + container.clientHeight
        ) {
            container.scrollTop =
                lineBottom - container.clientHeight + 8;
        }
    }, [activeCodeLine, index]);

    if (!total) {
        return (
            <p className="rounded-xl bg-red-950/30 p-4 text-sm text-red-400">
                This animation does not contain any steps.
            </p>
        );
    }

    const hasSidePanel = codeLines.length > 0 || Boolean(variables);

    const goToStep = (nextIndex) => {
        setPlaying(false);
        setIndex(Math.max(0, Math.min(lastIndex, nextIndex)));
    };

    const togglePlay = () => {
        if (total < 2) return;

        if (index >= lastIndex) {
            setIndex(0);
            setPlaying(true);
            return;
        }

        setPlaying((value) => !value);
    };

    const replay = () => {
        setIndex(0);
        setPlaying(total > 1);
    };

    const handleKeyDown = (event) => {
        const tagName = event.target?.tagName;

        if (
            ["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(tagName)
        ) {
            return;
        }

        if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            togglePlay();
        } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            goToStep(index - 1);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            goToStep(index + 1);
        } else if (event.key === "Home") {
            event.preventDefault();
            goToStep(0);
        } else if (event.key === "End") {
            event.preventDefault();
            goToStep(lastIndex);
        }
    };

    return (
        <div
            tabIndex={0}
            role="group"
            aria-label="Animated visualization player"
            onKeyDown={handleKeyDown}
            className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
        >
            <div
                className={`grid gap-3 ${
                    hasSidePanel
                        ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)]"
                        : ""
                }`}
            >
                <div className="min-w-0 space-y-3">
                    <div className="rounded-xl border border-line bg-ink-800 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-glacier">
                                Step {index + 1} of {total}
                            </span>
                            <span className="text-[10px] capitalize text-faint">
                                {animation.animationType}
                            </span>
                        </div>
                        <p
                            aria-live="polite"
                            className="mt-1 text-sm leading-6 text-chalk"
                        >
                            {frame.caption}
                        </p>
                    </div>

                    {animation.animationType === "process" ? (
                        <div className="rounded-xl border border-line bg-ink-950 p-3">
                            {animation.mermaid ? (
                                <DiagramView
                                    code={animation.mermaid}
                                    highlightIds={frame.nodeIds}
                                />
                            ) : (
                                <p className="p-4 text-sm text-red-400">
                                    The process diagram is missing.
                                </p>
                            )}
                        </div>
                    ) : (
                        <AlgorithmStage
                            array={arrayState}
                            highlights={frame.highlights}
                            sortedIndices={sortedIndices}
                        />
                    )}
                </div>

                {hasSidePanel && (
                    <aside className="min-w-0 space-y-3">
                        {variables && (
                            <div className="rounded-xl border border-line bg-ink-950 p-2">
                                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                                    Variables
                                </p>
                                <div className="flex flex-wrap gap-1.5 p-1">
                                    {Object.entries(variables).map(
                                        ([name, value]) => (
                                            <span
                                                key={name}
                                                className="max-w-full truncate rounded-md bg-ink-700 px-2 py-1 font-mono text-[11px]"
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

                        {codeLines.length > 0 && (
                            <div className="rounded-xl border border-line bg-ink-950 p-2">
                                <div className="mb-1 flex items-center justify-between gap-2 px-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                                        Pseudocode
                                    </span>
                                    <span className="text-[10px] text-faint">
                                        {codeLines.length} lines
                                    </span>
                                </div>
                                <div
                                    ref={codeContainerRef}
                                    className="relative max-h-64 overflow-auto rounded-lg bg-ink-950/40 py-1 font-mono text-[11px] leading-5"
                                >
                                    {codeLines.map((line, lineIndex) => {
                                        const lineNumber = lineIndex + 1;
                                        const isActive =
                                            activeCodeLine === lineNumber;

                                        return (
                                            <div
                                                key={lineIndex}
                                                data-line={lineNumber}
                                                className={`flex gap-3 whitespace-pre px-2 py-0.5 transition-colors ${
                                                    isActive
                                                        ? "bg-glacier/15 text-glacier"
                                                        : "text-mist"
                                                }`}
                                            >
                                                <span
                                                    className={`w-4 shrink-0 select-none text-right ${
                                                        isActive
                                                            ? "text-glacier"
                                                            : "text-faint"
                                                    }`}
                                                >
                                                    {lineNumber}
                                                </span>
                                                <span className="min-w-0">
                                                    {line}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </aside>
                )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-ink-800 px-2 py-2">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => goToStep(index - 1)}
                        disabled={index === 0}
                        aria-label="Previous step"
                        title="Previous step (Left arrow)"
                        className="rounded-md p-1.5 text-mist transition hover:bg-ink-700 hover:text-signal disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </button>

                    <button
                        type="button"
                        onClick={togglePlay}
                        aria-label={playing ? "Pause" : "Play"}
                        title={
                            playing
                                ? "Pause (Space)"
                                : "Play (Space)"
                        }
                        className="rounded-md bg-signal p-1.5 text-ink-950 transition hover:bg-signal-dim"
                    >
                        {playing ? (
                            <svg
                                className="h-4 w-4"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <rect x="6" y="5" width="4" height="14" rx="1" />
                                <rect x="14" y="5" width="4" height="14" rx="1" />
                            </svg>
                        ) : (
                            <svg
                                className="h-4 w-4"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => goToStep(index + 1)}
                        disabled={index === lastIndex}
                        aria-label="Next step"
                        title="Next step (Right arrow)"
                        className="rounded-md p-1.5 text-mist transition hover:bg-ink-700 hover:text-signal disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </button>

                    <button
                        type="button"
                        onClick={replay}
                        aria-label="Replay animation"
                        title="Replay"
                        className="rounded-md p-1.5 text-mist transition hover:bg-ink-700 hover:text-signal"
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v6h6M20 20v-6h-6M5.5 9a7 7 0 0111.8-2.4L20 10M18.5 15a7 7 0 01-11.8 2.4L4 14"
                            />
                        </svg>
                    </button>
                </div>

                <input
                    type="range"
                    min={0}
                    max={lastIndex}
                    step={1}
                    value={index}
                    disabled={total < 2}
                    onChange={(event) => goToStep(Number(event.target.value))}
                    aria-label="Animation step"
                    aria-valuetext={`${index + 1} of ${total}`}
                    className="h-1.5 min-w-24 flex-1 cursor-pointer accent-blue-400 disabled:cursor-not-allowed"
                />

                <span className="shrink-0 text-[11px] tabular-nums text-mist">
                    {index + 1} / {total}
                </span>

                <select
                    value={speed}
                    onChange={(event) => setSpeed(Number(event.target.value))}
                    aria-label="Playback speed"
                    title="Playback speed"
                    className="shrink-0 cursor-pointer rounded-md border border-line-bright bg-ink-800 px-1.5 py-1 text-[11px] text-mist outline-none transition hover:border-line-bright focus:border-glacier"
                >
                    {SPEEDS.map((option) => (
                        <option key={option} value={option}>
                            {option}×
                        </option>
                    ))}
                </select>
            </div>

            <p className="mt-2 text-center text-[10px] text-faint">
                Use the controls or arrow keys to walk through each step.
            </p>
        </div>
    );
}

export default AnimationView;
