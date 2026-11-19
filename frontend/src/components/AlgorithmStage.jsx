const BAR_CLASSES = {
swap: "animation-bar-swap bg-pink-500",
compare: "animation-bar-compare bg-amber-400",
active: "animation-bar-active bg-glacier",
sorted: "bg-signal",
default: "bg-slate-500/80",
};

function formatValue(value) {
if (Number.isInteger(value)) {
return String(value);
}

return String(Number(value.toFixed(2)));
}

function AlgorithmStage({ array, highlights, sortedIndices }) {
const values = Array.isArray(array) ? array : [];

if (!values.length) {
return (
    <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-line bg-ink-950 p-6 text-center">
        <p className="text-sm text-mist">
            This step has no array state. Follow the highlighted code
            line.
        </p>
    </div>
);
}

const compare = new Set(highlights?.compare || []);
const swap = new Set(highlights?.swap || []);
const active = new Set(highlights?.active || []);
const sorted = new Set(sortedIndices || []);

const minValue = Math.min(0, ...values);
const maxValue = Math.max(0, ...values);
const span = maxValue - minValue || 1;
const zeroBottom = ((0 - minValue) / span) * 100;

const stateFor = (index) => {
if (swap.has(index)) return "swap";
if (compare.has(index)) return "compare";
if (active.has(index)) return "active";
if (sorted.has(index)) return "sorted";
return "default";
};

return (
<div className="rounded-xl border border-line bg-ink-950 p-3">
    <div
        role="img"
        aria-label={`Array values: ${values.join(", ")}`}
        className="relative flex h-56 items-stretch gap-1 sm:gap-1.5"
    >
        <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line"
            style={{ bottom: `${zeroBottom}%` }}
        />

        {values.map((value, index) => {
            const state = stateFor(index);
            const bottom =
                value >= 0
                    ? zeroBottom
                    : ((value - minValue) / span) * 100;
            const height = (Math.abs(value) / span) * 100;

            return (
                <div
                    key={index}
                    className="relative min-w-0 flex-1"
                >
                    <div
                        title={`Index ${index}: ${formatValue(value)}`}
                        className={`animation-bar absolute w-full rounded-t-md transition-[height,bottom,background-color,box-shadow] duration-300 ease-out ${BAR_CLASSES[state]}`}
                        style={{
                            bottom: `${bottom}%`,
                            height: `${height}%`,
                        }}
                    />
                </div>
            );
        })}
    </div>

    <div className="mt-2 flex gap-1 sm:gap-1.5">
        {values.map((value, index) => (
            <span
                key={index}
                className="min-w-0 flex-1 truncate text-center text-[11px] font-medium text-mist"
            >
                {formatValue(value)}
            </span>
        ))}
    </div>

    <div className="mt-0.5 flex gap-1 sm:gap-1.5">
        {values.map((_, index) => (
            <span
                key={index}
                className="min-w-0 flex-1 text-center text-[10px] text-faint"
            >
                {index}
            </span>
        ))}
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-faint">
        {[
            ["bg-amber-400", "Compare"],
            ["bg-pink-500", "Swap"],
            ["bg-glacier", "Active"],
            ["bg-signal", "Sorted"],
        ].map(([color, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-sm ${color}`} />
                {label}
            </span>
        ))}
    </div>
</div>
);
}

export default AlgorithmStage;
