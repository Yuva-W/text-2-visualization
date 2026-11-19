import { useEffect, useState } from "react";

const CAPABILITIES = [
    {
        id: "explain",
        index: "01",
        label: "Explain",
        hint: "Line by line, in plain language",
    },
    {
        id: "visualize",
        index: "02",
        label: "Visualize",
        hint: "Charts, diagrams, and tables",
    },
    {
        id: "trace",
        index: "03",
        label: "Trace",
        hint: "Watch Python execute",
    },
];

const EXPLAIN_LINES = [
    "for i in range(n):",
    "    if a[i] > a[i + 1]:",
    "        swap(a[i], a[i + 1])",
];

const EXPLAIN_NOTES = [
    "Repeat the pass once for every position in the list.",
    "Compare each value with the one immediately after it.",
    "When the pair is out of order, swap them and keep going.",
];

const CHART_VALUES = [42, 68, 52, 84, 61];
const CHART_VIEWS = ["Bar", "Line", "Table"];

const TRACE_FRAMES = [
    {
        values: [5, 3, 8, 1],
        compare: [0, 1],
        vars: "i=0  j=0",
        line: 3,
        code: "if a[j] > a[j + 1]:",
        note: "Compare 5 and 3 — out of order.",
    },
    {
        values: [3, 5, 8, 1],
        swap: [0, 1],
        vars: "i=0  j=0",
        line: 4,
        code: "swap(a[j], a[j + 1])",
        note: "Swap the pair, then move right.",
    },
    {
        values: [3, 5, 8, 1],
        compare: [1, 2],
        vars: "i=0  j=1",
        line: 3,
        code: "if a[j] > a[j + 1]:",
        note: "Compare 5 and 8 — already ordered.",
    },
    {
        values: [3, 5, 1, 8],
        swap: [2, 3],
        vars: "i=0  j=2",
        line: 4,
        code: "swap(a[j], a[j + 1])",
        note: "Swap 8 and 1; the pass continues.",
    },
];

function ExplainPreview() {
    const [activeLine, setActiveLine] = useState(1);

    return (
        <div className="grid w-full gap-2 sm:h-full sm:grid-cols-[1.05fr_1fr]">
            <div className="flex h-full flex-col rounded-xl border border-line bg-ink-950/70 p-2.5">
                <div className="mb-1.5 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.16em] text-faint">
                    <span>Python</span>
                    <span className="text-glacier">Click a line</span>
                </div>

                <div className="space-y-0.5" role="group" aria-label="Example code lines">
                    {EXPLAIN_LINES.map((line, index) => {
                        const isActive = activeLine === index;

                        return (
                            <button
                                key={line}
                                type="button"
                                onClick={() => setActiveLine(index)}
                                aria-pressed={isActive}
                                className={`flex w-full gap-2 rounded-md px-2 py-1 text-left font-mono text-[10px] transition active:scale-[0.99] ${
                                    isActive
                                        ? "bg-glacier/10 text-glacier"
                                        : "text-mist hover:bg-ink-800/80 hover:text-chalk"
                                }`}
                            >
                                <span
                                    className={`w-3 shrink-0 text-right ${
                                        isActive ? "text-glacier" : "text-faint"
                                    }`}
                                >
                                    {index + 1}
                                </span>
                                <code className="whitespace-pre">
                                    {line}
                                </code>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-line/60 pt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-faint">
                    <span>{EXPLAIN_LINES.length} lines</span>
                    <span>Python 3</span>
                </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-line bg-ink-950/70 p-3">
                <div>
                    <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-faint">
                        Plain English
                    </p>
                    <p
                        key={activeLine}
                        className="capability-swap mt-2 text-[11px] leading-5 text-mist"
                    >
                        {EXPLAIN_NOTES[activeLine]}
                    </p>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-2 font-mono text-[8px] uppercase tracking-[0.14em] text-faint">
                    <span className="h-1 w-1 rounded-full bg-signal" />
                    Line {activeLine + 1} selected
                </div>
            </div>
        </div>
    );
}

function BarPreview() {
    return (
        <div className="flex h-full items-end gap-2 px-1">
            {CHART_VALUES.map((value, index) => (
                <div
                    key={index}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                >
                    <div
                        className={`capability-bar w-full rounded-t-sm ${
                            index === 3
                                ? "bg-gradient-to-t from-signal/25 to-signal"
                                : "bg-gradient-to-t from-glacier/15 to-glacier/80"
                        }`}
                        style={{
                            height: `${value}%`,
                            animationDelay: `${index * 45}ms`,
                        }}
                        title={`${value}`}
                    />
                    <span className="text-center font-mono text-[7px] text-faint">
                        {index + 1}
                    </span>
                </div>
            ))}
        </div>
    );
}

function LinePreview() {
    const points = CHART_VALUES.map((value, index) => {
        const x = 12 + index * 44;
        const y = 78 - (value / 100) * 58;

        return `${x},${y}`;
    }).join(" ");

    return (
        <svg
            className="h-full w-full"
            viewBox="0 0 200 88"
            role="img"
            aria-label="A small line chart preview"
        >
            {[22, 44, 66].map((y) => (
                <line
                    key={y}
                    x1="8"
                    x2="192"
                    y1={y}
                    y2={y}
                    stroke="#22343e"
                    strokeDasharray="2 4"
                />
            ))}
            <polyline
                className="capability-line"
                points={points}
                fill="none"
                stroke="#79d7e8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
            />
            {CHART_VALUES.map((value, index) => {
                const x = 12 + index * 44;
                const y = 78 - (value / 100) * 58;

                return (
                    <circle
                        key={value}
                        cx={x}
                        cy={y}
                        r="2.5"
                        fill={index === 3 ? "#c9f27a" : "#79d7e8"}
                    />
                );
            })}
        </svg>
    );
}

function TablePreview() {
    return (
        <div className="h-full overflow-hidden rounded-md border border-line">
            <div className="grid grid-cols-[1fr_auto] border-b border-line bg-ink-800 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-faint">
                <span>Item</span>
                <span>Value</span>
            </div>
            {CHART_VALUES.slice(0, 3).map((value, index) => (
                <div
                    key={index}
                    className="grid grid-cols-[1fr_auto] border-b border-line/60 px-2 py-1 text-[10px] text-mist last:border-b-0"
                >
                    <span>Row {index + 1}</span>
                    <span className="font-mono tabular-nums text-chalk">
                        {value}
                    </span>
                </div>
            ))}
        </div>
    );
}

function VisualizePreview() {
    const [view, setView] = useState("Bar");

    return (
        <div className="flex w-full flex-col rounded-xl border border-line bg-ink-950/70 p-3 sm:h-full">
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-faint">
                    One dataset, many views
                </span>

                <div className="flex gap-0.5 rounded-md border border-line bg-ink-900 p-0.5">
                    {CHART_VIEWS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setView(option)}
                            aria-pressed={view === option}
                            className={`rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] transition active:scale-95 ${
                                view === option
                                    ? "bg-signal text-ink-950"
                                    : "text-faint hover:text-chalk"
                            }`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>

            <div
                key={view}
                className="capability-preview mt-2 min-h-[92px] flex-1"
            >
                {view === "Bar" && <BarPreview />}
                {view === "Line" && <LinePreview />}
                {view === "Table" && <TablePreview />}
            </div>
        </div>
    );
}

function TracePreview() {
    const [step, setStep] = useState(0);
    const [playing, setPlaying] = useState(false);
    const frame = TRACE_FRAMES[step];

    useEffect(() => {
        if (!playing) return undefined;

        const timer = window.setInterval(() => {
            setStep((current) => (current + 1) % TRACE_FRAMES.length);
        }, 1100);

        return () => window.clearInterval(timer);
    }, [playing]);

    const move = (direction) => {
        setPlaying(false);
        setStep(
            (current) =>
                (current + direction + TRACE_FRAMES.length) %
                TRACE_FRAMES.length
        );
    };

    return (
        <div className="flex w-full flex-col rounded-xl border border-line bg-ink-950/70 p-3 sm:h-full">
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-faint">
                    Live execution
                </span>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => move(-1)}
                        aria-label="Previous trace step"
                        title="Previous step"
                        className="rounded-md border border-line bg-ink-800 p-1 text-mist transition hover:border-line-bright hover:text-chalk active:scale-95"
                    >
                        <svg
                            className="h-3 w-3"
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
                        onClick={() => setPlaying((current) => !current)}
                        aria-label={
                            playing ? "Pause trace preview" : "Play trace preview"
                        }
                        title={playing ? "Pause" : "Play"}
                        className="rounded-md bg-signal p-1 text-ink-950 transition hover:bg-signal-dim active:scale-95"
                    >
                        {playing ? (
                            <svg
                                className="h-3 w-3"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <rect x="6" y="5" width="4" height="14" rx="1" />
                                <rect x="14" y="5" width="4" height="14" rx="1" />
                            </svg>
                        ) : (
                            <svg
                                className="h-3 w-3"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path d="M8 5.5v13a1 1 0 001.5.86l10-6.5a1 1 0 000-1.72l-10-6.5A1 1 0 008 5.5z" />
                            </svg>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => move(1)}
                        aria-label="Next trace step"
                        title="Next step"
                        className="rounded-md border border-line bg-ink-800 p-1 text-mist transition hover:border-line-bright hover:text-chalk active:scale-95"
                    >
                        <svg
                            className="h-3 w-3"
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
                </div>
            </div>

            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <div className="flex items-center justify-center gap-1.5 rounded-lg border border-line/60 bg-ink-900/40 px-2 py-2.5">
                    {frame.values.map((value, index) => {
                        const isSwap = frame.swap?.includes(index);
                        const isCompare = frame.compare?.includes(index);

                        return (
                            <div
                                key={`${value}-${index}`}
                                className={`capability-cell flex h-8 w-8 items-center justify-center rounded-md border font-mono text-xs transition-all duration-300 ${
                                    isSwap
                                        ? "border-signal/60 bg-signal/20 text-signal"
                                        : isCompare
                                          ? "border-glacier/60 bg-glacier/15 text-glacier"
                                          : "border-line bg-ink-900 text-mist"
                                }`}
                            >
                                {value}
                            </div>
                        );
                    })}
                </div>

                <div className="flex min-w-[88px] flex-col justify-between rounded-lg border border-line/60 bg-ink-900/40 px-2.5 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-faint">
                            Frame
                        </span>
                        <span className="font-display text-base font-semibold leading-none text-signal">
                            {String(step + 1).padStart(2, "0")}
                            <span className="text-[9px] font-normal text-faint">
                                /{String(TRACE_FRAMES.length).padStart(2, "0")}
                            </span>
                        </span>
                    </div>

                    <div className="mt-2 flex gap-0.5">
                        {TRACE_FRAMES.map((_, index) => (
                            <span
                                key={index}
                                className={`h-0.5 flex-1 rounded-full transition-colors ${
                                    index <= step ? "bg-signal" : "bg-line"
                                }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-2 flex items-center gap-2 rounded-md border border-line/60 bg-ink-950/80 px-2 py-1.5 font-mono text-[9px]">
                <span className="shrink-0 text-faint">L{frame.line}</span>
                <code className="truncate text-glacier">{frame.code}</code>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2">
                <p className="text-[10px] text-mist">{frame.note}</p>
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-faint">
                    {frame.vars}
                </span>
            </div>
        </div>
    );
}

function CapabilityDeck() {
    const [active, setActive] = useState("explain");

    return (
        <section
            className="mt-8 max-w-2xl overflow-hidden rounded-2xl border border-line bg-ink-900/75 shadow-[0_22px_60px_rgba(0,0,0,0.22)]"
            aria-label="Capability previews"
        >
            <div className="grid grid-cols-3 border-b border-line/70" role="tablist">
                {CAPABILITIES.map((capability) => {
                    const isActive = active === capability.id;

                    return (
                        <button
                            key={capability.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => setActive(capability.id)}
                            className={`group relative px-3 py-2.5 text-left transition active:scale-[0.99] ${
                                isActive
                                    ? "bg-ink-800"
                                    : "hover:bg-ink-800/50"
                            }`}
                        >
                            <span
                                className={`absolute inset-x-0 bottom-0 h-px transition ${
                                    isActive ? "bg-signal" : "bg-transparent"
                                }`}
                            />
                            <span
                                className={`font-mono text-[8px] uppercase tracking-[0.16em] ${
                                    isActive ? "text-signal" : "text-faint"
                                }`}
                            >
                                {capability.index}
                            </span>
                            <span
                                className={`ml-1.5 text-xs font-semibold ${
                                    isActive
                                        ? "text-chalk"
                                        : "text-mist group-hover:text-chalk"
                                }`}
                            >
                                {capability.label}
                            </span>
                            <span className="mt-1 hidden text-[9px] leading-3 text-faint sm:block">
                                {capability.hint}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div
                className="capability-preview flex min-h-[148px] p-3 sm:h-[202px]"
                role="tabpanel"
                key={active}
            >
                {active === "explain" && <ExplainPreview />}
                {active === "visualize" && <VisualizePreview />}
                {active === "trace" && <TracePreview />}
            </div>
        </section>
    );
}

export default CapabilityDeck;
