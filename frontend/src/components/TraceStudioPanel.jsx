import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TraceFrameCard from "./TraceFrameCard.jsx";
import {
    MAX_TRACE_LINES,
    buildTraceVisualization,
    cancelTrace,
    detectInputs,
    listTraceVariables,
    tracePython,
} from "../utils/pythonTrace.js";

const SPEEDS = [0.5, 1, 1.5, 2];

const RUNTIME_LABELS = {
    loading: "Loading the Python runtime...",
    running: "Running your code...",
};

const VIEW_OPTIONS = [
    { value: "auto", label: "Auto" },
    { value: "array", label: "Array bars" },
    { value: "stack", label: "Stack" },
    { value: "queue", label: "Queue" },
    { value: "matrix", label: "DP table" },
    { value: "tree", label: "Tree" },
    { value: "linkedlist", label: "Linked list" },
    { value: "graph", label: "Graph" },
    { value: "callstack", label: "Call stack" },
];

const RACE_PRESETS = [
    {
        label: "Bubble sort",
        code: `arr = [5, 3, 8, 1]
n = len(arr)
for i in range(n):
    swapped = False
    for j in range(n - i - 1):
        if arr[j] > arr[j + 1]:
            arr[j], arr[j + 1] = arr[j + 1], arr[j]
            swapped = True
    if not swapped:
        break
`,
    },
    {
        label: "Insertion sort",
        code: `arr = [5, 3, 8, 1]
for i in range(1, len(arr)):
    key = arr[i]
    j = i - 1
    while j >= 0 and arr[j] > key:
        arr[j + 1] = arr[j]
        j -= 1
    arr[j + 1] = key
`,
    },
    {
        label: "Selection sort",
        code: `arr = [5, 3, 8, 1]
for i in range(len(arr)):
    min_idx = i
    for j in range(i + 1, len(arr)):
        if arr[j] < arr[min_idx]:
            min_idx = j
    arr[i], arr[min_idx] = arr[min_idx], arr[i]
`,
    },
];

const DEFAULT_RACE_CODE = RACE_PRESETS[1].code;

function countNonEmptyLines(code) {
    return String(code || "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .filter((line) => line.trim().length > 0).length;
}

function validateSource(code, label) {
    const count = countNonEmptyLines(code);

    if (count === 0) {
        return `${label} needs a Python snippet with at least one line.`;
    }

    if (count > MAX_TRACE_LINES) {
        return `${label} supports up to ${MAX_TRACE_LINES} non-empty lines. Shorten the snippet and try again.`;
    }

    return "";
}

function inputsToOverrides(inputs) {
    const overrides = {};

    for (const input of inputs) {
        if (!input?.name) continue;
        overrides[input.name] = input.value;
    }

    return overrides;
}

function summarizeInputs(inputs) {
    const parts = inputs
        .map((input) => `${input.name}=${input.value}`)
        .join(", ");

    return parts.length > 48 ? `${parts.slice(0, 45)}...` : parts;
}

function formatMetric(value, key) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return "—";
    }

    if (key === "elapsedMs") {
        return `${value < 10 ? value.toFixed(2) : value.toFixed(1)} ms`;
    }

    return value.toLocaleString();
}

function metricWinner(left, right) {
    if (
        typeof left !== "number" ||
        typeof right !== "number" ||
        !Number.isFinite(left) ||
        !Number.isFinite(right) ||
        left === right
    ) {
        return "";
    }

    return left < right ? "a" : "b";
}

function collectViews(frames) {
    const views = new Set(["auto", "array", "stack", "queue"]);

    const hasNumericArray = frames.some((frame) => frame.array);
    const hasSequence = frames.some(
        (frame) => frame.array || frame.sequence
    );

    if (!hasNumericArray) views.delete("array");
    if (!hasSequence) {
        views.delete("stack");
        views.delete("queue");
    }

    if (frames.some((frame) => frame.matrix)) views.add("matrix");
    if (frames.some((frame) => frame.structure?.kind === "tree")) {
        views.add("tree");
    }
    if (frames.some((frame) => frame.structure?.kind === "linkedlist")) {
        views.add("linkedlist");
    }
    if (frames.some((frame) => frame.structure?.kind === "graph")) {
        views.add("graph");
    }
    if (frames.some((frame) => frame.callStack?.length)) views.add("callstack");

    return views;
}

function MetricsStrip({ metrics = {}, labels = {}, truncated = false }) {
    const items = [
        { key: "lineEvents", label: labels.steps || "steps" },
        { key: "comparisons", label: labels.comparisons || "comparisons" },
        { key: "writes", label: labels.writes || "writes" },
        { key: "calls", label: labels.calls || "calls" },
        { key: "elapsedMs", label: labels.time || "time" },
    ];

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {items.map((item) => (
                <span
                    key={item.key}
                    className="rounded-md border border-line bg-ink-800 px-2 py-1 text-[10px] text-mist"
                >
                    <span className="font-semibold text-chalk">
                        {formatMetric(metrics[item.key], item.key)}
                    </span>{" "}
                    {item.label}
                </span>
            ))}
            {truncated && (
                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                    trace truncated
                </span>
            )}
        </div>
    );
}

function MetricComparison({ metricsA, metricsB, labels, truncatedA, truncatedB }) {
    const rows = [
        { key: "comparisons", label: labels.comparisons || "comparisons" },
        { key: "writes", label: labels.writes || "writes" },
        { key: "lineEvents", label: labels.steps || "steps" },
        { key: "calls", label: labels.calls || "calls" },
        { key: "elapsedMs", label: labels.time || "time", noWinner: true },
    ];
    const comparable = !truncatedA && !truncatedB;

    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1 px-0.5 text-[10px] uppercase tracking-wider text-faint">
                <span>Metric</span>
                <span>Algorithm A vs Algorithm B</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                {rows.map((row) => {
                const winner =
                    comparable && !row.noWinner
                        ? metricWinner(metricsA[row.key], metricsB[row.key])
                        : "";

                return (
                    <div
                        key={row.key}
                        className="flex items-center justify-between gap-2 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px]"
                    >
                        <span className="capitalize text-faint">
                            {row.label}
                        </span>
                        <span className="flex items-center gap-1.5 font-mono">
                            <span
                                className={
                                    winner === "a" ? "text-signal" : "text-mist"
                                }
                            >
                                {formatMetric(metricsA[row.key], row.key)}
                            </span>
                            <span className="text-faint">vs</span>
                            <span
                                className={
                                    winner === "b" ? "text-signal" : "text-mist"
                                }
                            >
                                {formatMetric(metricsB[row.key], row.key)}
                            </span>
                        </span>
                    </div>
                );
                })}
            </div>
        </div>
    );
}

function PlayerControls({
    index,
    lastIndex,
    total,
    speed,
    onSpeedChange,
    playing,
    onPrevious,
    onTogglePlay,
    onNext,
    onReplay,
    onScrub,
}) {
    return (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-ink-800 px-2 py-2">
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={onPrevious}
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
                    onClick={onTogglePlay}
                    aria-label={playing ? "Pause" : "Play"}
                    title={playing ? "Pause (Space)" : "Play (Space)"}
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
                    onClick={onNext}
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
                    onClick={onReplay}
                    aria-label="Replay trace"
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
                onChange={(event) => onScrub(Number(event.target.value))}
                aria-label="Trace step"
                aria-valuetext={`${index + 1} of ${total}`}
                className="h-1.5 min-w-24 flex-1 cursor-pointer accent-blue-400 disabled:cursor-not-allowed"
            />

            <span className="shrink-0 text-[11px] tabular-nums text-mist">
                {index + 1} / {total}
            </span>

            <select
                value={speed}
                onChange={(event) => onSpeedChange(Number(event.target.value))}
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
    );
}

function TraceStudioPanel({ code, language = "en", onClose }) {
    const [mode, setMode] = useState("trace");
    const [sourceCode, setSourceCode] = useState(code);
    const [inputs, setInputs] = useState(() => detectInputs(code));
    const [showEditor, setShowEditor] = useState(false);
    const [runs, setRuns] = useState([]);
    const [activeRunId, setActiveRunId] = useState("");
    const [status, setStatus] = useState("loading");
    const [runtimeStatus, setRuntimeStatus] = useState("loading");
    const [error, setError] = useState("");
    const [viewMode, setViewMode] = useState("auto");
    const [focusVariable, setFocusVariable] = useState("");
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [raceCode, setRaceCode] = useState(DEFAULT_RACE_CODE);
    const [race, setRace] = useState(null);
    const [raceStatus, setRaceStatus] = useState("idle");
    const [raceRuntimeStatus, setRaceRuntimeStatus] = useState("loading");
    const [raceError, setRaceError] = useState("");
    const startedRef = useRef(false);
    const mountedRef = useRef(true);
    const runSeqRef = useRef(1);
    const runTokenRef = useRef(0);
    const raceTokenRef = useRef(0);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    const activeRun = useMemo(
        () => runs.find((run) => run.id === activeRunId) || runs[0] || null,
        [runs, activeRunId]
    );

    const visualization = useMemo(() => {
        if (!activeRun) return null;

        try {
            return buildTraceVisualization(
                activeRun.code,
                {
                    events: activeRun.events,
                    metrics: activeRun.metrics,
                    truncated: activeRun.truncated,
                },
                language,
                { viewMode, focusVariable }
            );
        } catch {
            return null;
        }
    }, [activeRun, language, viewMode, focusVariable]);

    const frames = useMemo(
        () =>
            Array.isArray(visualization?.animation?.frames)
                ? visualization.animation.frames
                : [],
        [visualization]
    );
    const total = frames.length;
    const variableOptions = useMemo(
        () => (activeRun ? listTraceVariables(activeRun.events) : []),
        [activeRun]
    );
    const availableViews = useMemo(() => collectViews(frames), [frames]);
    const viewChoices = useMemo(
        () =>
            VIEW_OPTIONS.filter(
                (option) =>
                    option.value === "auto" || availableViews.has(option.value)
            ),
        [availableViews]
    );

    const executeTrace = useCallback(
        async (nextCode = sourceCode, nextInputs = inputs) => {
            const validation = validateSource(nextCode, "Real tracing");

            if (validation) {
                setError(validation);
                setStatus("error");
                return null;
            }

            const token = ++runTokenRef.current;
            setStatus("loading");
            setRuntimeStatus("loading");
            setError("");
            setPlaying(false);
            setIndex(0);

            try {
                const result = await tracePython(nextCode, {
                    overrides: inputsToOverrides(nextInputs),
                    onStatus: (nextStatus) => {
                        if (mountedRef.current) {
                            setRuntimeStatus(nextStatus);
                        }
                    },
                });

                if (!mountedRef.current || token !== runTokenRef.current) {
                    return null;
                }

                const sequence = runSeqRef.current;
                runSeqRef.current += 1;

                const run = {
                    id: `${Date.now()}-${sequence}`,
                    label: `Run ${sequence}`,
                    sequence,
                    code: nextCode,
                    inputs: nextInputs.map((input) => ({ ...input })),
                    inputSummary: summarizeInputs(nextInputs),
                    events: result.events,
                    metrics: result.metrics,
                    truncated: result.truncated,
                };

                setRuns((previous) => [run, ...previous].slice(0, 6));
                setActiveRunId(run.id);
                setFocusVariable("");
                setViewMode("auto");
                setStatus("ready");
                setIndex(0);
                setPlaying(false);

                return run;
            } catch (nextError) {
                if (!mountedRef.current || token !== runTokenRef.current) {
                    return null;
                }

                if (nextError?.message === "Trace cancelled.") {
                    return null;
                }

                setError(
                    nextError.message ||
                        "The Python trace could not be generated for this snippet."
                );
                setStatus("error");
                return null;
            }
        },
        [sourceCode, inputs]
    );

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        executeTrace(sourceCode, inputs);
    }, [executeTrace, sourceCode, inputs]);

    const invalidateRace = () => {
        if (raceStatus === "loading") return;
        if (raceStatus === "idle" && !race) return;

        setRaceStatus("idle");
        setRaceError("");
        setRace(null);
        setPlaying(false);
        setIndex(0);
    };

    const handleSourceChange = (value) => {
        setSourceCode(value);
        invalidateRace();

        const detected = detectInputs(value);
        setInputs((previous) =>
            detected.map((input) => {
                const oldInput = previous.find(
                    (item) => item.name === input.name
                );

                if (
                    oldInput &&
                    oldInput.line === input.line &&
                    oldInput.codeValue === input.codeValue
                ) {
                    return { ...input, value: oldInput.value };
                }

                return input;
            })
        );
    };

    const handleInputChange = (name, value) => {
        invalidateRace();
        setInputs((previous) =>
            previous.map((input) =>
                input.name === name ? { ...input, value } : input
            )
        );
    };

    const handleRaceCodeChange = (value) => {
        invalidateRace();
        setRaceCode(value);
    };

    const handleFocusChange = (value) => {
        setFocusVariable(value);
        setViewMode("auto");
        setIndex(0);
        setPlaying(false);
    };

    const handleRun = () => {
        executeTrace(sourceCode, inputs);
    };

    const handleSelectRun = (run) => {
        setActiveRunId(run.id);
        if (run.code) setSourceCode(run.code);
        if (Array.isArray(run.inputs)) {
            setInputs(run.inputs.map((input) => ({ ...input })));
        }
        setFocusVariable("");
        setViewMode("auto");
        setIndex(0);
        setPlaying(false);
    };

    const executeRace = useCallback(async () => {
        const errorA = validateSource(sourceCode, "Algorithm A");
        const errorB = validateSource(raceCode, "Algorithm B");

        if (errorA || errorB) {
            setRaceError(errorA || errorB);
            setRaceStatus("error");
            return;
        }

        const token = ++raceTokenRef.current;
        const overrides = inputsToOverrides(inputs);
        setRaceStatus("loading");
        setRaceError("");
        setRaceRuntimeStatus("loading");
        setRace(null);
        setPlaying(false);
        setIndex(0);

        try {
            const resultA = await tracePython(sourceCode, {
                overrides,
                onStatus: (nextStatus) => {
                    if (mountedRef.current) {
                        setRaceRuntimeStatus(nextStatus);
                    }
                },
            });

            if (!mountedRef.current || token !== raceTokenRef.current) {
                return;
            }

            const resultB = await tracePython(raceCode, {
                overrides,
                onStatus: (nextStatus) => {
                    if (mountedRef.current) {
                        setRaceRuntimeStatus(nextStatus);
                    }
                },
            });

            if (!mountedRef.current || token !== raceTokenRef.current) {
                return;
            }

            setRace({
                a: {
                    code: sourceCode,
                    events: resultA.events,
                    metrics: resultA.metrics,
                    truncated: resultA.truncated,
                },
                b: {
                    code: raceCode,
                    events: resultB.events,
                    metrics: resultB.metrics,
                    truncated: resultB.truncated,
                },
            });
            setRaceStatus("ready");
            setFocusVariable("");
            setViewMode("auto");
            setPlaying(false);
            setIndex(0);
        } catch (nextError) {
            if (!mountedRef.current || token !== raceTokenRef.current) {
                return;
            }

            if (nextError?.message === "Trace cancelled.") {
                return;
            }

            setRaceError(
                nextError.message ||
                    "The algorithm race could not be completed."
            );
            setRaceStatus("error");
        }
    }, [sourceCode, raceCode, inputs]);

    const raceVisualizationA = useMemo(() => {
        if (!race?.a) return null;

        try {
            return buildTraceVisualization(
                race.a.code,
                race.a,
                language,
                { viewMode, focusVariable }
            );
        } catch {
            return null;
        }
    }, [race, language, viewMode, focusVariable]);

    const raceVisualizationB = useMemo(() => {
        if (!race?.b) return null;

        try {
            return buildTraceVisualization(
                race.b.code,
                race.b,
                language,
                { viewMode, focusVariable }
            );
        } catch {
            return null;
        }
    }, [race, language, viewMode, focusVariable]);

    const raceFramesA = useMemo(
        () =>
            Array.isArray(raceVisualizationA?.animation?.frames)
                ? raceVisualizationA.animation.frames
                : [],
        [raceVisualizationA]
    );
    const raceFramesB = useMemo(
        () =>
            Array.isArray(raceVisualizationB?.animation?.frames)
                ? raceVisualizationB.animation.frames
                : [],
        [raceVisualizationB]
    );
    const raceTotal = Math.max(raceFramesA.length, raceFramesB.length);
    const playerTotal = mode === "race" ? raceTotal : total;
    const playerLastIndex = Math.max(0, playerTotal - 1);
    const raceViews = useMemo(
        () =>
            new Set([
                ...collectViews(raceFramesA),
                ...collectViews(raceFramesB),
            ]),
        [raceFramesA, raceFramesB]
    );
    const activeViewChoices = useMemo(
        () =>
            mode === "race"
                ? VIEW_OPTIONS.filter(
                      (option) =>
                          option.value === "auto" ||
                          raceViews.has(option.value)
                  )
                : viewChoices,
        [mode, raceViews, viewChoices]
    );

    useEffect(() => {
        if (!playing || playerTotal < 2 || index >= playerLastIndex) {
            return undefined;
        }

        const captionLength =
            mode === "race"
                ? raceFramesA[index]?.caption?.length || 0
                : frames[index]?.caption?.length || 0;
        const duration =
            Math.min(5000, Math.max(1500, captionLength * 40)) / speed;
        const timer = setTimeout(() => {
            const next = Math.min(index + 1, playerLastIndex);
            setIndex(next);

            if (next >= playerLastIndex) {
                setPlaying(false);
            }
        }, duration);

        return () => clearTimeout(timer);
    }, [
        playing,
        playerTotal,
        index,
        playerLastIndex,
        speed,
        mode,
        raceFramesA,
        frames,
    ]);

    const goToStep = (nextIndex) => {
        setPlaying(false);
        setIndex(Math.max(0, Math.min(playerLastIndex, nextIndex)));
    };

    const togglePlay = () => {
        if (playerTotal < 2) return;

        if (index >= playerLastIndex) {
            setIndex(0);
            setPlaying(true);
            return;
        }

        setPlaying((value) => !value);
    };

    const replay = () => {
        setIndex(0);
        setPlaying(playerTotal > 1);
    };

    const handleKeyDown = (event) => {
        const tagName = event.target?.tagName;

        if (["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(tagName)) {
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
            goToStep(playerLastIndex);
        }
    };

    const switchMode = (nextMode) => {
        setMode(nextMode);
        setPlaying(false);
        setIndex(0);
    };

    const handleClose = () => {
        if (status === "loading" || raceStatus === "loading") {
            cancelTrace();
        }

        onClose();
    };

    const metricsLabels =
        visualization?.animation?.metricsLabels ||
        raceVisualizationA?.animation?.metricsLabels ||
        {};
    const raceVariableOptions = useMemo(() => {
        if (!race) return [];

        return [
            ...new Set([
                ...listTraceVariables(race.a.events),
                ...listTraceVariables(race.b.events),
            ]),
        ].slice(0, 14);
    }, [race]);
    const isBusy = status === "loading" || raceStatus === "loading";

    return (
        <section
            id="real-trace-panel"
            className="mt-4 overflow-hidden rounded-2xl border border-line bg-ink-900"
        >
            <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                            Local execution
                        </span>
                        <span className="text-[10px] text-faint">
                            WebAssembly Python
                        </span>
                    </div>
                    <h3 className="text-sm font-semibold text-chalk">
                        Trace Studio
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-4 text-faint">
                        Change inputs, rerun the code, race two algorithms, and
                        inspect the call stack and data structures — all from a
                        real Python interpreter in your browser.
                    </p>
                    <div
                        role="group"
                        aria-label="Trace Studio mode"
                        className="mt-2 flex flex-wrap gap-1.5"
                    >
                        <button
                            type="button"
                            onClick={() => switchMode("trace")}
                            aria-pressed={mode === "trace"}
                            disabled={isBusy}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                mode === "trace"
                                    ? "bg-signal text-ink-950"
                                    : "border border-line-bright text-mist hover:border-line-bright hover:text-signal"
                            }`}
                        >
                            Single trace
                        </button>
                        <button
                            type="button"
                            onClick={() => switchMode("race")}
                            aria-pressed={mode === "race"}
                            disabled={isBusy}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                mode === "race"
                                    ? "bg-signal text-ink-950"
                                    : "border border-line-bright text-mist hover:border-line-bright hover:text-signal"
                            }`}
                        >
                            Algorithm race
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close trace studio"
                    title="Close"
                    className="rounded-md p-1 text-faint transition hover:bg-ink-700 hover:text-signal"
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
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </header>

            <div className="space-y-3 p-3">
                <div className="rounded-xl border border-line bg-ink-800 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                                What-if inputs
                            </p>
                            <p className="mt-1 text-[11px] leading-4 text-faint">
                                Edit a top-level literal assignment, then rerun.
                                The code below stays editable too.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => setShowEditor((value) => !value)}
                                className="rounded-lg border border-line-bright px-2.5 py-1 text-[11px] text-mist transition hover:border-line-bright hover:text-signal"
                            >
                                {showEditor ? "Hide code" : "Edit code"}
                            </button>
                            {mode === "trace" && (
                                <button
                                    type="button"
                                    onClick={handleRun}
                                    disabled={status === "loading"}
                                    className="rounded-lg bg-signal px-2.5 py-1 text-[11px] font-semibold text-ink-950 transition hover:bg-signal-dim disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Run trace
                                </button>
                            )}
                        </div>
                    </div>

                    {inputs.length > 0 ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {inputs.map((input) => (
                                <label
                                    key={input.name}
                                    className="block min-w-0"
                                >
                                    <span className="mb-1 flex items-center justify-between gap-2">
                                        <span className="font-mono text-[11px] text-sky-300">
                                            {input.name}
                                        </span>
                                        <span className="text-[9px] text-faint">
                                            line {input.line}
                                        </span>
                                    </span>
                                    <input
                                        type="text"
                                        value={input.value}
                                        onChange={(event) =>
                                            handleInputChange(
                                                input.name,
                                                event.target.value
                                            )
                                        }
                                        disabled={isBusy}
                                        spellCheck={false}
                                        className="w-full rounded-md border border-line-bright bg-ink-950 px-2 py-1.5 font-mono text-[11px] text-chalk outline-none transition focus:border-glacier disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                </label>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-2 rounded-lg border border-dashed border-line bg-ink-950 px-3 py-2 text-[11px] leading-4 text-faint">
                            No editable top-level literals were detected. Use
                            Edit code to change a value, or add a line such as
                            <span className="font-mono text-mist">
                                {" "}
                                arr = [5, 3, 8, 1]
                            </span>
                            .
                        </p>
                    )}

                    {showEditor && (
                        <label className="mt-2 block">
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-faint">
                                Python source
                            </span>
                            <textarea
                                value={sourceCode}
                                onChange={(event) =>
                                    handleSourceChange(event.target.value)
                                }
                                disabled={isBusy}
                                spellCheck={false}
                                rows={10}
                                className="w-full resize-y rounded-lg border border-line-bright bg-ink-950 p-2 font-mono text-[11px] leading-5 text-chalk outline-none transition focus:border-glacier disabled:cursor-not-allowed disabled:opacity-60"
                            />
                        </label>
                    )}

                    <p className="mt-2 text-[10px] leading-4 text-faint">
                        Values are replaced only for top-level assignments. The
                        interpreter still runs in a Web Worker with a step
                        limit and a timeout.
                    </p>
                </div>

                {mode === "trace" ? (
                    <>
                        {status === "loading" && (
                            <div
                                className="flex items-start gap-3 rounded-xl border border-line bg-ink-800 p-4"
                                aria-live="polite"
                            >
                                <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line-bright border-t-white" />
                                <div>
                                    <p className="text-sm text-chalk">
                                        {RUNTIME_LABELS[runtimeStatus] ||
                                            RUNTIME_LABELS.loading}
                                    </p>
                                    <p className="mt-1 text-[11px] leading-4 text-faint">
                                        The first run downloads the Python
                                        runtime and can take a while on a slow
                                        connection.
                                    </p>
                                </div>
                            </div>
                        )}

                        {status === "error" && (
                            <div aria-live="polite">
                                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-red-950/40 p-3 text-xs leading-5 text-red-300">
                                    {error ||
                                        "The Python trace could not be created."}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={handleRun}
                                        className="rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-signal-dim"
                                    >
                                        Try again
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="rounded-lg border border-line-bright px-3 py-1.5 text-xs text-mist transition hover:border-line-bright hover:text-signal"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}

                        {status === "ready" && (
                            <>
                                <div className="space-y-2 rounded-xl border border-line bg-ink-800 p-3">
                                    <div className="flex flex-wrap items-end justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                                                Run history
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                                {runs.map((run) => (
                                                    <button
                                                        key={run.id}
                                                        type="button"
                                                        onClick={() =>
                                                            handleSelectRun(run)
                                                        }
                                                        title={
                                                            run.inputSummary ||
                                                            "default input"
                                                        }
                                                        className={`max-w-48 truncate rounded-md border px-2 py-1 text-left text-[10px] transition ${
                                                            activeRun?.id ===
                                                            run.id
                                                                ? "border-glacier/60 bg-glacier/15 text-glacier"
                                                                : "border-line-bright text-mist hover:border-line-bright hover:text-signal"
                                                        }`}
                                                    >
                                                        <span className="font-semibold">
                                                            {run.label}
                                                        </span>
                                                        {run.inputSummary && (
                                                            <span className="ml-1 text-faint">
                                                                {run.inputSummary}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-end gap-2">
                                            <label className="text-[10px] text-faint">
                                                <span className="mb-1 block uppercase tracking-wider">
                                                    View
                                                </span>
                                                <select
                                                    value={viewMode}
                                                    onChange={(event) =>
                                                        setViewMode(
                                                            event.target.value
                                                        )
                                                    }
                                                    className="cursor-pointer rounded-md border border-line-bright bg-ink-800 px-1.5 py-1 text-[11px] text-mist outline-none transition hover:border-line-bright focus:border-glacier"
                                                >
                                                    {activeViewChoices.map(
                                                        (option) => (
                                                            <option
                                                                key={option.value}
                                                                value={option.value}
                                                            >
                                                                {option.label}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </label>

                                            {variableOptions.length > 0 && (
                                                <label className="text-[10px] text-faint">
                                                    <span className="mb-1 block uppercase tracking-wider">
                                                        Focus
                                                    </span>
                                                    <select
                                                        value={focusVariable}
                                                        onChange={(event) =>
                                                            handleFocusChange(
                                                                event.target.value
                                                            )
                                                        }
                                                        className="max-w-36 cursor-pointer rounded-md border border-line-bright bg-ink-800 px-1.5 py-1 text-[11px] text-mist outline-none transition hover:border-line-bright focus:border-glacier"
                                                    >
                                                        <option value="">
                                                            Auto
                                                        </option>
                                                        {variableOptions.map(
                                                            (name) => (
                                                                <option
                                                                    key={name}
                                                                    value={name}
                                                                >
                                                                    {name}
                                                                </option>
                                                            )
                                                        )}
                                                    </select>
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <MetricsStrip
                                        metrics={
                                            visualization?.animation?.metrics ||
                                            activeRun?.metrics
                                        }
                                        labels={metricsLabels}
                                        truncated={activeRun?.truncated}
                                    />
                                    {visualization?.summary && (
                                        <p className="text-[10px] leading-4 text-faint">
                                            {visualization.summary}
                                        </p>
                                    )}
                                </div>

                                {visualization ? (
                                    <div
                                        tabIndex={0}
                                        role="group"
                                        aria-label="Trace Studio player"
                                        onKeyDown={handleKeyDown}
                                        className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
                                    >
                                        <TraceFrameCard
                                            visualization={visualization}
                                            index={index}
                                            viewMode={viewMode}
                                            label="Trace run"
                                        />
                                        <PlayerControls
                                            index={index}
                                            lastIndex={playerLastIndex}
                                            total={playerTotal}
                                            speed={speed}
                                            onSpeedChange={setSpeed}
                                            playing={playing}
                                            onPrevious={() =>
                                                goToStep(index - 1)
                                            }
                                            onTogglePlay={togglePlay}
                                            onNext={() => goToStep(index + 1)}
                                            onReplay={replay}
                                            onScrub={goToStep}
                                        />
                                    </div>
                                ) : (
                                    <p className="rounded-lg bg-red-950/30 p-3 text-xs text-red-300">
                                        The trace was captured, but this view
                                        could not be built. Try Auto view or
                                        rerun the snippet.
                                    </p>
                                )}

                                <p className="text-center text-[10px] text-faint">
                                    Use the controls or arrow keys to inspect
                                    each step. Changes are local to this trace.
                                </p>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {raceStatus === "loading" && (
                            <div
                                className="flex items-start gap-3 rounded-xl border border-line bg-ink-800 p-4"
                                aria-live="polite"
                            >
                                <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line-bright border-t-white" />
                                <div>
                                    <p className="text-sm text-chalk">
                                        {RUNTIME_LABELS[raceRuntimeStatus] ||
                                            RUNTIME_LABELS.loading}
                                    </p>
                                    <p className="mt-1 text-[11px] leading-4 text-faint">
                                        Running Algorithm A, then Algorithm B
                                        with the same inputs.
                                    </p>
                                </div>
                            </div>
                        )}

                        {raceStatus === "error" && (
                            <div aria-live="polite">
                                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-red-950/40 p-3 text-xs leading-5 text-red-300">
                                    {raceError ||
                                        "The algorithm race could not be completed."}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={executeRace}
                                        className="rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-signal-dim"
                                    >
                                        Try again
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="rounded-lg border border-line-bright px-3 py-1.5 text-xs text-mist transition hover:border-line-bright hover:text-signal"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 rounded-xl border border-line bg-ink-800 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                                        Algorithm B
                                    </p>
                                    <p className="mt-1 text-[11px] leading-4 text-faint">
                                        Algorithm A is the code in the
                                        What-if inputs box. Both snippets run
                                        with the same overrides.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={executeRace}
                                    disabled={raceStatus === "loading"}
                                    className="rounded-lg bg-signal px-2.5 py-1 text-[11px] font-semibold text-ink-950 transition hover:bg-signal-dim disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Run race
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="mr-1 text-[10px] text-faint">
                                    Presets
                                </span>
                                {RACE_PRESETS.map((preset) => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() =>
                                            handleRaceCodeChange(preset.code)
                                        }
                                        disabled={raceStatus === "loading"}
                                        className="rounded-md border border-line-bright px-2 py-1 text-[10px] text-mist transition hover:border-line-bright hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleRaceCodeChange(sourceCode)
                                    }
                                    disabled={raceStatus === "loading"}
                                    className="rounded-md border border-line-bright px-2 py-1 text-[10px] text-mist transition hover:border-line-bright hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Copy A
                                </button>
                            </div>

                            <textarea
                                value={raceCode}
                                onChange={(event) =>
                                    handleRaceCodeChange(event.target.value)
                                }
                                disabled={raceStatus === "loading"}
                                spellCheck={false}
                                rows={9}
                                aria-label="Algorithm B Python code"
                                className="w-full resize-y rounded-lg border border-line-bright bg-ink-950 p-2 font-mono text-[11px] leading-5 text-chalk outline-none transition focus:border-glacier disabled:cursor-not-allowed disabled:opacity-60"
                            />

                            <p className="text-[10px] leading-4 text-faint">
                                Keep the same input variable name in both
                                snippets (for example,{" "}
                                <span className="font-mono text-mist">
                                    arr
                                </span>
                                ) so they receive the same values. The metrics
                                below are approximate operation counts from the
                                captured line events and state changes.
                            </p>
                        </div>

                        {raceStatus === "idle" && (
                            <p className="rounded-lg border border-dashed border-line bg-ink-950 px-3 py-2 text-[11px] leading-4 text-faint">
                                Pick a preset or paste a second algorithm, then
                                choose Run race. Both snippets must fit within{" "}
                                {MAX_TRACE_LINES} non-empty lines.
                            </p>
                        )}

                        {raceStatus === "ready" && race && (
                            <>
                                <div className="space-y-2 rounded-xl border border-line bg-ink-800 p-3">
                                    <div className="flex flex-wrap items-end justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                                                Race result
                                            </p>
                                            <p className="mt-1 text-[11px] leading-4 text-faint">
                                                A and B share a timeline. The
                                                cards stay on their final frame
                                                if one algorithm finishes first.
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-end gap-2">
                                            <label className="text-[10px] text-faint">
                                                <span className="mb-1 block uppercase tracking-wider">
                                                    View
                                                </span>
                                                <select
                                                    value={viewMode}
                                                    onChange={(event) =>
                                                        setViewMode(
                                                            event.target.value
                                                        )
                                                    }
                                                    className="cursor-pointer rounded-md border border-line-bright bg-ink-800 px-1.5 py-1 text-[11px] text-mist outline-none transition hover:border-line-bright focus:border-glacier"
                                                >
                                                    {activeViewChoices.map(
                                                        (option) => (
                                                            <option
                                                                key={option.value}
                                                                value={option.value}
                                                            >
                                                                {option.label}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </label>

                                            {raceVariableOptions.length > 0 && (
                                                <label className="text-[10px] text-faint">
                                                    <span className="mb-1 block uppercase tracking-wider">
                                                        Focus
                                                    </span>
                                                    <select
                                                        value={focusVariable}
                                                        onChange={(event) =>
                                                            handleFocusChange(
                                                                event.target.value
                                                            )
                                                        }
                                                        className="max-w-36 cursor-pointer rounded-md border border-line-bright bg-ink-800 px-1.5 py-1 text-[11px] text-mist outline-none transition hover:border-line-bright focus:border-glacier"
                                                    >
                                                        <option value="">
                                                            Auto
                                                        </option>
                                                        {raceVariableOptions.map(
                                                            (name) => (
                                                                <option
                                                                    key={name}
                                                                    value={name}
                                                                >
                                                                    {name}
                                                                </option>
                                                            )
                                                        )}
                                                    </select>
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <MetricComparison
                                        metricsA={
                                            raceVisualizationA?.animation
                                                ?.metrics ||
                                            race.a.metrics ||
                                            {}
                                        }
                                        metricsB={
                                            raceVisualizationB?.animation
                                                ?.metrics ||
                                            race.b.metrics ||
                                            {}
                                        }
                                        labels={
                                            raceVisualizationA?.animation
                                                ?.metricsLabels ||
                                            metricsLabels
                                        }
                                        truncatedA={race.a.truncated}
                                        truncatedB={race.b.truncated}
                                    />

                                    {(race.a.truncated ||
                                        race.b.truncated) && (
                                        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] leading-4 text-amber-200">
                                            One trace hit the safety step
                                            limit, so operation counts are not
                                            a fair comparison.
                                        </p>
                                    )}
                                </div>

                                {raceVisualizationA && raceVisualizationB ? (
                                    <div
                                        tabIndex={0}
                                        role="group"
                                        aria-label="Algorithm race player"
                                        onKeyDown={handleKeyDown}
                                        className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
                                    >
                                        <div className="grid gap-2 xl:grid-cols-2">
                                            <TraceFrameCard
                                                visualization={raceVisualizationA}
                                                index={index}
                                                viewMode={viewMode}
                                                compact
                                                label="Algorithm A"
                                            />
                                            <TraceFrameCard
                                                visualization={raceVisualizationB}
                                                index={index}
                                                viewMode={viewMode}
                                                compact
                                                label="Algorithm B"
                                            />
                                        </div>

                                        <PlayerControls
                                            index={index}
                                            lastIndex={playerLastIndex}
                                            total={playerTotal}
                                            speed={speed}
                                            onSpeedChange={setSpeed}
                                            playing={playing}
                                            onPrevious={() =>
                                                goToStep(index - 1)
                                            }
                                            onTogglePlay={togglePlay}
                                            onNext={() => goToStep(index + 1)}
                                            onReplay={replay}
                                            onScrub={goToStep}
                                        />
                                    </div>
                                ) : (
                                    <p className="rounded-lg bg-red-950/30 p-3 text-xs text-red-300">
                                        One or both traces could not be built.
                                        Try Auto view, or rerun with shorter
                                        snippets.
                                    </p>
                                )}

                                <p className="text-center text-[10px] text-faint">
                                    Lighter metrics are better for comparisons,
                                    writes, and steps. Timing is shown for
                                    context only.
                                </p>
                            </>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}

export default TraceStudioPanel;
