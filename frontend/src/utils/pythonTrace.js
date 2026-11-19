const TRACE_TIMEOUT_MS = 45000;
const RUNTIME_LOAD_TIMEOUT_MS = 180000;
const MAX_SAMPLED_EVENTS = 22;
export const MAX_TRACE_LINES = 30;

const EXECUTION_TIMEOUT_MESSAGE =
    "Python execution timed out. Check for an infinite loop and try a shorter snippet.";
const RUNTIME_LOAD_TIMEOUT_MESSAGE =
    "The Python runtime took too long to load. Check your network connection and try again.";

const TRACE_LABELS = {
    en: {
        title: "Real Python Execution",
        initial: "Starting state for the traced steps.",
        line: "Line",
        array: "Array is now",
        step: "execute this step",
        summary: (shown, total) =>
            `Created by running the code in a real Python interpreter in your browser. Showing ${shown} of ${total} captured steps.`,
        truncated:
            " The trace hit the safety step limit and was shortened.",
        metrics: {
            steps: "steps",
            comparisons: "comparisons",
            writes: "writes",
            calls: "calls",
            time: "time",
        },
    },
    hi: {
        title: "वास्तविक पायथन निष्पादन",
        initial: "ट्रेस किए गए चरणों की प्रारंभिक स्थिति।",
        line: "पंक्ति",
        array: "सरणी अब",
        step: "इस चरण को निष्पादित करें",
        summary: (shown, total) =>
            `आपके ब्राउज़र में वास्तविक पायथन इंटरप्रेटर में कोड चलाकर बनाया गया। ${total} में से ${shown} कैप्चर किए गए चरण दिखाए जा रहे हैं।`,
        truncated:
            " ट्रेस सुरक्षा चरण सीमा पर पहुँच गया और छोटा कर दिया गया।",
        metrics: {
            steps: "चरण",
            comparisons: "तुलनाएँ",
            writes: "लेखन",
            calls: "कॉल",
            time: "समय",
        },
    },
    kn: {
        title: "ನೈಜ ಪೈಥಾನ್ ಕಾರ್ಯಾಚರಣೆ",
        initial: "ಟ್ರೇಸ್ ಮಾಡಿದ ಹಂತಗಳ ಆರಂಭಿಕ ಸ್ಥಿತಿ.",
        line: "ಸಾಲು",
        array: "ಅರೇ ಈಗ",
        step: "ಈ ಹಂತವನ್ನು ಕಾರ್ಯಗತಗೊಳಿಸಿ",
        summary: (shown, total) =>
            `ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ನೈಜ ಪೈಥಾನ್ ಇಂಟರ್ಪ್ರಿಟರ್‌ನಲ್ಲಿ ಕೋಡ್ ಚಲಾಯಿಸಿ ರಚಿಸಲಾಗಿದೆ. ${total} ರಲ್ಲಿ ${shown} ಸೆರೆಹಿಡಿದ ಹಂತಗಳನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ.`,
        truncated:
            " ಟ್ರೇಸ್ ಸುರಕ್ಷತಾ ಹಂತದ ಮಿತಿಯನ್ನು ತಲುಪಿ ಚಿಕ್ಕದಾಗಿಸಲಾಗಿದೆ.",
        metrics: {
            steps: "ಹಂತಗಳು",
            comparisons: "ಹೋಲಿಕೆಗಳು",
            writes: "ಬರವಣಿಗೆಗಳು",
            calls: "ಕರೆಗಳು",
            time: "ಸಮಯ",
        },
    },
};

let worker = null;
let requestCounter = 0;
const activeRequests = new Map();

function armTimer(request, timeoutMs, message) {
    if (request.timer) {
        clearTimeout(request.timer);
    }

    request.timer = setTimeout(() => {
        if (!activeRequests.has(request.id)) return;

        activeRequests.delete(request.id);
        request.worker.terminate();

        if (worker === request.worker) {
            worker = null;
        }

        request.reject(new Error(message));
    }, timeoutMs);
}

function handleWorkerMessage(event) {
    const { id, status } = event.data || {};
    const request = activeRequests.get(id);

    if (!request) return;

    if (status === "loading" || status === "running") {
        request.onStatus?.(status);

        // Loading Pyodide downloads a large WebAssembly runtime on the first
        // run. Only start the execution clock once Python is actually ready,
        // otherwise a slow network is reported as an infinite-loop timeout.
        if (status === "running") {
            armTimer(
                request,
                request.executionTimeoutMs,
                EXECUTION_TIMEOUT_MESSAGE
            );
        }

        return;
    }

    if (request.timer) {
        clearTimeout(request.timer);
    }

    activeRequests.delete(id);

    if (status === "error") {
        request.reject(
            new Error(
                event.data?.error ||
                    "The Python interpreter could not run this code."
            )
        );
        return;
    }

    if (status === "done") {
        request.resolve({
            events: Array.isArray(event.data?.events)
                ? event.data.events
                : [],
            truncated: Boolean(event.data?.truncated),
            metrics:
                event.data?.metrics &&
                typeof event.data.metrics === "object"
                    ? event.data.metrics
                    : {},
        });
    }
}

function handleWorkerError(event) {
    const error = new Error(
        event?.message ||
            "The Python runtime failed to load. Check your network connection and try again."
    );

    for (const request of activeRequests.values()) {
        if (request.timer) {
            clearTimeout(request.timer);
        }
        request.reject(error);
    }

    activeRequests.clear();

    if (worker) {
        worker.terminate();
        worker = null;
    }
}

function getWorker() {
    if (!worker) {
        worker = new Worker(
            new URL("../workers/pythonTraceWorker.js", import.meta.url),
            { type: "classic" }
        );
        worker.addEventListener("message", handleWorkerMessage);
        worker.addEventListener("error", handleWorkerError);
    }

    return worker;
}

export function tracePython(
    code,
    { onStatus, timeoutMs = TRACE_TIMEOUT_MS, overrides = {} } = {}
) {
    if (activeRequests.size > 0) {
        return Promise.reject(
            new Error("A Python trace is already running. Wait for it to finish.")
        );
    }

    let activeWorker;

    try {
        activeWorker = getWorker();
    } catch (error) {
        return Promise.reject(
            new Error(
                error?.message ||
                    "The Python runtime could not start in this browser."
            )
        );
    }

    const id = ++requestCounter;

    return new Promise((resolve, reject) => {
        const request = {
            id,
            resolve,
            reject,
            worker: activeWorker,
            onStatus,
            executionTimeoutMs: timeoutMs,
            timer: null,
        };

        activeRequests.set(id, request);
        armTimer(
            request,
            RUNTIME_LOAD_TIMEOUT_MS,
            RUNTIME_LOAD_TIMEOUT_MESSAGE
        );

        activeWorker.postMessage({ id, code, overrides });
    });
}

export function cancelTrace() {
    if (activeRequests.size === 0) {
        return;
    }

    for (const request of activeRequests.values()) {
        if (request.timer) {
            clearTimeout(request.timer);
        }
        request.reject(new Error("Trace cancelled."));
    }

    activeRequests.clear();

    if (worker) {
        worker.terminate();
        worker = null;
    }
}

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

const INPUT_ASSIGNMENT_RE =
    /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*(?:#.*)?$/;

function isSimpleLiteral(rawValue) {
    const value = String(rawValue || "").trim();

    if (!value) return false;
    if (/\b(for|if|lambda|await|yield|import|from|def|class)\b/.test(value)) {
        return false;
    }

    let stripped = value.replace(
        /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
        "0"
    );
    stripped = stripped.replace(/\b(?:True|False|None)\b/g, "");
    stripped = stripped.replace(
        /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?j?/g,
        ""
    );

    return /^[\s[\]{}(),:]*$/.test(stripped);
}

export function detectInputs(code) {
    const inputs = [];
    const seen = new Set();
    const source = String(code || "").replace(/\r\n?/g, "\n");

    source.split("\n").forEach((line, index) => {
        const match = line.match(INPUT_ASSIGNMENT_RE);
        if (!match) return;

        const [, name, rawValue] = match;

        if (name.startsWith("_") || seen.has(name)) return;
        if (!isSimpleLiteral(rawValue)) return;

        seen.add(name);
        inputs.push({
            name,
            value: rawValue.trim(),
            codeValue: rawValue.trim(),
            line: index + 1,
        });
    });

    return inputs;
}

function isNumberArray(value, maxLength = 20) {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.length <= maxLength &&
        value.every(isFiniteNumber)
    );
}

function isPrimitiveSequence(value, maxLength = 20) {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.length <= maxLength &&
        value.every(
            (item) =>
                typeof item === "number" ||
                typeof item === "string" ||
                typeof item === "boolean" ||
                item === null
        )
    );
}

function isNumberMatrix(value) {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.length <= 12 &&
        value.every(
            (row) =>
                Array.isArray(row) &&
                row.length > 0 &&
                row.length <= 12 &&
                row.every(isFiniteNumber)
        )
    );
}

function pickArray(locals, focusVariable = "") {
    if (focusVariable) {
        return isNumberArray(locals[focusVariable])
            ? [...locals[focusVariable]]
            : null;
    }

    const preferredNames = [
        "arr",
        "a",
        "array",
        "nums",
        "numbers",
        "values",
        "data",
        "items",
        "list",
        "stack",
        "queue",
        "result",
        "output",
    ];

    for (const name of preferredNames) {
        if (isNumberArray(locals[name])) {
            return [...locals[name]];
        }
    }

    for (const [name, value] of Object.entries(locals)) {
        if (name === focusVariable) continue;
        if (isNumberArray(value)) {
            return [...value];
        }
    }

    return null;
}

function pickSequence(locals, focusVariable = "") {
    if (focusVariable) {
        return isPrimitiveSequence(locals[focusVariable])
            ? [...locals[focusVariable]]
            : null;
    }

    const preferredNames = [
        "arr",
        "a",
        "array",
        "nums",
        "numbers",
        "values",
        "data",
        "items",
        "list",
        "stack",
        "queue",
        "path",
        "visited",
        "order",
        "result",
        "output",
    ];

    for (const name of preferredNames) {
        if (isPrimitiveSequence(locals[name])) {
            return [...locals[name]];
        }
    }

    for (const [name, value] of Object.entries(locals)) {
        if (name === focusVariable) continue;
        if (isPrimitiveSequence(value)) {
            return [...value];
        }
    }

    return null;
}

function pickMatrix(locals, focusVariable = "") {
    if (focusVariable) {
        return isNumberMatrix(locals[focusVariable])
            ? {
                  name: focusVariable,
                  rows: locals[focusVariable].slice(0, 12).map((row) =>
                      row.slice(0, 12)
                  ),
              }
            : null;
    }

    const preferredNames = [
        "dp",
        "table",
        "matrix",
        "grid",
        "memo",
        "cache",
        "dist",
        "cost",
    ];

    for (const name of preferredNames) {
        if (isNumberMatrix(locals[name])) {
            return {
                name,
                rows: locals[name].slice(0, 12).map((row) =>
                    row.slice(0, 12)
                ),
            };
        }
    }

    for (const [name, value] of Object.entries(locals)) {
        if (isNumberMatrix(value)) {
            return {
                name,
                rows: value.slice(0, 12).map((row) => row.slice(0, 12)),
            };
        }
    }

    return null;
}

function pickStructure(event, focusVariable = "") {
    const structure =
        event?.structure && typeof event.structure === "object"
            ? event.structure
            : null;

    if (!structure) return null;
    if (focusVariable && structure.name !== focusVariable) return null;

    return structure;
}

function pickCallStack(event) {
    if (!Array.isArray(event?.callStack) || event.callStack.length === 0) {
        return null;
    }

    return event.callStack.slice(-20).map((frame) => ({
        function: String(frame?.function || "function").slice(0, 40),
        line: Number.isInteger(frame?.line) ? frame.line : null,
    }));
}

export function listTraceVariables(events) {
    const names = new Set();

    for (const event of Array.isArray(events) ? events : []) {
        const locals =
            event?.locals &&
            typeof event.locals === "object" &&
            !Array.isArray(event.locals)
                ? event.locals
                : {};

        for (const [name, value] of Object.entries(locals)) {
            if (name.startsWith("__")) continue;
            if (
                isNumberArray(value) ||
                isPrimitiveSequence(value) ||
                isNumberMatrix(value)
            ) {
                names.add(name);
            }
        }

        if (event?.structure?.name) {
            names.add(String(event.structure.name));
        }
    }

    return [...names].slice(0, 14);
}

function frameMatchesView(frame, viewMode) {
    if (!frame) return false;

    if (viewMode === "matrix") return Boolean(frame.matrix);

    if (
        viewMode === "tree" ||
        viewMode === "linkedlist" ||
        viewMode === "graph"
    ) {
        return frame.structure?.kind === viewMode;
    }

    if (viewMode === "callstack") {
        return Array.isArray(frame.callStack) && frame.callStack.length > 0;
    }

    if (viewMode === "array" || viewMode === "stack" || viewMode === "queue") {
        return Boolean(frame.array || frame.sequence);
    }

    return false;
}

function resolveViewMode({ requested, frames, code, focusVariable }) {
    if (requested && requested !== "auto") {
        return requested;
    }

    if (frames.some((frame) => frame.matrix)) {
        return "matrix";
    }

    const structure = frames.find((frame) => frame.structure)?.structure;

    if (structure?.kind) {
        return structure.kind;
    }

    if (frames.some((frame) => frame.array || frame.sequence)) {
        const focus = String(focusVariable || "").toLowerCase();
        const source = String(code || "").toLowerCase();
        const hasNumericArray = frames.some((frame) => frame.array);

        if (focus.includes("stack") || source.includes("stack")) {
            return "stack";
        }

        if (
            focus.includes("queue") ||
            source.includes("popleft") ||
            source.includes("pop(0)")
        ) {
            return "queue";
        }

        return hasNumericArray ? "array" : "stack";
    }

    if (
        frames.some(
            (frame) => Array.isArray(frame.callStack) && frame.callStack.length > 1
        )
    ) {
        return "callstack";
    }

    return "array";
}

function compactArray(value) {
    const parts = value.slice(0, 6).map((item) => {
        if (item === null) return "None";
        if (Array.isArray(item)) return "[...]";
        if (typeof item === "object") return "{...}";
        return String(item);
    });

    return `[${parts.join(", ")}${value.length > 6 ? ", …" : ""}]`.slice(
        0,
        80
    );
}

function pickVariables(locals) {
    const variables = {};
    let count = 0;

    for (const [name, value] of Object.entries(locals)) {
        if (count >= 8) break;
        if (!name || name.length > 40 || name.startsWith("__")) continue;

        if (typeof value === "boolean") {
            variables[name] = value;
        } else if (typeof value === "number") {
            variables[name] = Number.isFinite(value)
                ? value
                : String(value);
        } else if (typeof value === "string") {
            if (
                /^<(function|built-in function|class|module|method|bound method) /.test(
                    value
                )
            ) {
                continue;
            }

            variables[name] = value.slice(0, 80);
        } else if (Array.isArray(value)) {
            variables[name] = compactArray(value);
        } else if (value === null) {
            variables[name] = "None";
        } else {
            continue;
        }

        count += 1;
    }

    return variables;
}

function deriveArrayFocus(focusVariable, requestedViewMode, source) {
    if (focusVariable) return focusVariable;

    const lowerSource = String(source || "").toLowerCase();

    if (requestedViewMode === "stack") return "stack";
    if (requestedViewMode === "queue") return "queue";

    if (requestedViewMode === "auto") {
        if (/\bstack\b/.test(lowerSource)) return "stack";
        if (
            /\bqueue\b/.test(lowerSource) ||
            lowerSource.includes("popleft") ||
            lowerSource.includes("pop(0)")
        ) {
            return "queue";
        }
    }

    return "";
}

function computeTraceMetrics(
    events,
    sourceLines,
    focusVariable,
    arrayFocus,
    runtimeMetrics = {}
) {
    const comparisonLines = new Set();

    sourceLines.forEach((line, index) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) return;
        if (!/^(if|elif|while)\b/.test(trimmed)) return;
        if (!/(==|!=|<=|>=|<|>|\bin\b|\bis\b)/.test(trimmed)) return;

        comparisonLines.add(index + 1);
    });

    let comparisons = 0;
    let writes = 0;
    let calls = 0;
    let previousArray = null;
    let previousMatrix = null;
    let previousDepth = null;

    for (const event of events) {
        if (comparisonLines.has(event.line)) {
            comparisons += 1;
        }

        const depth = Array.isArray(event.callStack)
            ? event.callStack.length
            : 0;

        if (previousDepth !== null && depth > previousDepth) {
            calls += depth - previousDepth;
        }

        previousDepth = depth;

        const locals =
            event.locals &&
            typeof event.locals === "object" &&
            !Array.isArray(event.locals)
                ? event.locals
                : {};
        const array =
            pickArray(locals, arrayFocus) ||
            pickSequence(locals, arrayFocus);

        if (array && previousArray) {
            if (array.length !== previousArray.length) {
                writes += Math.abs(array.length - previousArray.length);
            } else {
                for (let index = 0; index < array.length; index += 1) {
                    if (array[index] !== previousArray[index]) {
                        writes += 1;
                    }
                }
            }
        }

        if (array) previousArray = array;

        const matrix = pickMatrix(locals, focusVariable);

        if (matrix && previousMatrix) {
            const rowCount = Math.max(
                matrix.rows.length,
                previousMatrix.rows.length
            );

            for (let row = 0; row < rowCount; row += 1) {
                const currentRow = matrix.rows[row] || [];
                const previousRow = previousMatrix.rows[row] || [];
                const columnCount = Math.max(
                    currentRow.length,
                    previousRow.length
                );

                for (let column = 0; column < columnCount; column += 1) {
                    if (currentRow[column] !== previousRow[column]) {
                        writes += 1;
                    }
                }
            }
        }

        if (matrix) previousMatrix = matrix;
    }

    return {
        ...runtimeMetrics,
        lineEvents: events.length,
        comparisons,
        writes,
        calls,
    };
}

function sampleEvenly(items, maxItems) {
    if (items.length <= maxItems) {
        return items;
    }

    const indices = new Set();
    const step = (items.length - 1) / (maxItems - 1);

    for (let index = 0; index < maxItems; index += 1) {
        indices.add(Math.round(index * step));
    }

    return [...indices]
        .sort((left, right) => left - right)
        .map((index) => items[index]);
}

export function buildTraceVisualization(
    code,
    traceResult,
    language = "en",
    options = {}
) {
    const normalizedLanguage = TRACE_LABELS[language] ? language : "en";
    const labels = TRACE_LABELS[normalizedLanguage];
    const source = String(code || "").replace(/\r\n?/g, "\n");
    const sourceLines = source.split("\n");
    const nonEmptyLines = sourceLines.filter(
        (line) => line.trim().length > 0
    );
    const requestedViewMode = options.viewMode || "auto";
    const focusVariable = String(options.focusVariable || "").trim();
    const arrayFocus = deriveArrayFocus(
        focusVariable,
        requestedViewMode,
        source
    );

    if (!nonEmptyLines.length) {
        throw new Error(
            "Real tracing needs a Python snippet with at least one line."
        );
    }

    if (nonEmptyLines.length > MAX_TRACE_LINES) {
        throw new Error(
            `Real tracing currently supports up to ${MAX_TRACE_LINES} non-empty lines. Shorten the snippet and try again.`
        );
    }

    const displayLines = [];
    const displayLineByOriginal = new Map();

    sourceLines.forEach((line, index) => {
        if (!line.trim()) return;

        const originalLine = index + 1;
        displayLines.push(line.slice(0, 200));
        displayLineByOriginal.set(originalLine, displayLines.length);
    });

    const events = Array.isArray(traceResult?.events)
        ? traceResult.events
        : [];

    if (!events.length) {
        throw new Error(
            "The code ran, but no traceable line events were captured. Try a snippet with assignments, loops, or function calls."
        );
    }

    const rawFrames = events.map((event) => {
        const originalLine = Number.isInteger(event.line)
            ? event.line
            : null;
        let displayLine = originalLine
            ? displayLineByOriginal.get(originalLine) || null
            : null;
        let sourceLine = originalLine
            ? String(sourceLines[originalLine - 1] || "")
                  .trim()
                  .slice(0, 160)
            : "";

        // Return events can point at a trailing blank line. Use the nearest
        // previous executable line so the final state still has useful code.
        if (originalLine && !displayLine) {
            for (let line = originalLine - 1; line >= 1; line -= 1) {
                if (displayLineByOriginal.has(line)) {
                    displayLine = displayLineByOriginal.get(line);
                    sourceLine = String(sourceLines[line - 1] || "")
                        .trim()
                        .slice(0, 160);
                    break;
                }
            }
        }

        const locals =
            event.locals &&
            typeof event.locals === "object" &&
            !Array.isArray(event.locals)
                ? event.locals
                : {};

        return {
            originalLine,
            displayLine,
            sourceLine,
            array: pickArray(locals, arrayFocus),
            sequence: pickSequence(locals, arrayFocus),
            matrix: pickMatrix(locals, focusVariable),
            variables: pickVariables(locals),
            callStack: pickCallStack(event),
            structure: pickStructure(event, focusVariable),
        };
    });

    const resolvedViewMode = resolveViewMode({
        requested: requestedViewMode,
        frames: rawFrames,
        code: source,
        focusVariable,
    });
    const preferredStateIndex = rawFrames.findIndex((frame) =>
        frameMatchesView(frame, resolvedViewMode)
    );
    const firstStateIndex =
        preferredStateIndex >= 0
            ? preferredStateIndex
            : rawFrames.findIndex(
                  (frame) =>
                      frame.array ||
                      frame.sequence ||
                      frame.matrix ||
                      frame.structure ||
                      (Array.isArray(frame.callStack) &&
                          frame.callStack.length > 1)
              );
    const traceFrames =
        firstStateIndex > 0 ? rawFrames.slice(firstStateIndex) : rawFrames;
    const sampled = sampleEvenly(traceFrames, MAX_SAMPLED_EVENTS);
    const first = sampled[0];
    const initialArray = first?.array || null;
    const initialSequence = first?.sequence || null;
    const initialMatrix = first?.matrix || null;
    const initialStructure = first?.structure || null;
    const initialCallStack = first?.callStack || null;
    const initialVariables = first?.variables || null;
    const frames = [
        {
            caption: labels.initial,
            ...(initialArray ? { array: initialArray } : {}),
            ...(initialSequence ? { sequence: initialSequence } : {}),
            ...(initialMatrix ? { matrix: initialMatrix } : {}),
            ...(initialStructure ? { structure: initialStructure } : {}),
            ...(initialCallStack ? { callStack: initialCallStack } : {}),
            ...(initialVariables &&
            Object.keys(initialVariables).length > 0
                ? { variables: initialVariables }
                : {}),
        },
    ];

    let previousArray = initialArray;

    for (const item of sampled) {
        const changedIndexes = [];

        if (
            item.array &&
            previousArray &&
            item.array.length === previousArray.length
        ) {
            for (let index = 0; index < item.array.length; index += 1) {
                if (item.array[index] !== previousArray[index]) {
                    changedIndexes.push(index);
                }
            }
        }

        const captionParts = [
            `${labels.line} ${item.displayLine ?? item.originalLine}: ${
                item.sourceLine || labels.step
            }`,
        ];

        if (changedIndexes.length) {
            captionParts.push(
                `${labels.array} ${item.array.join(", ")}.`
            );
        }

        frames.push({
            caption: captionParts.join(" ").slice(0, 600),
            ...(item.displayLine ? { codeLine: item.displayLine } : {}),
            ...(item.array ? { array: item.array } : {}),
            ...(item.sequence ? { sequence: item.sequence } : {}),
            ...(item.matrix ? { matrix: item.matrix } : {}),
            ...(item.structure ? { structure: item.structure } : {}),
            ...(item.callStack ? { callStack: item.callStack } : {}),
            ...(changedIndexes.length > 0
                ? {
                      highlights: {
                          swap: changedIndexes.slice(0, 20),
                      },
                  }
                : {}),
            ...(item.variables &&
            Object.keys(item.variables).length > 0
                ? { variables: item.variables }
                : {}),
        });

        if (item.array) {
            previousArray = item.array;
        }
    }

    const viewMode = resolvedViewMode;
    const summary = `${labels.summary(
        sampled.length,
        events.length
    )}${traceResult?.truncated ? labels.truncated : ""}`;
    const runtimeMetrics =
        traceResult?.metrics &&
        typeof traceResult.metrics === "object" &&
        !Array.isArray(traceResult.metrics)
            ? traceResult.metrics
            : {};
    const metrics = computeTraceMetrics(
        events,
        sourceLines,
        focusVariable,
        arrayFocus,
        runtimeMetrics
    );

    return {
        type: "animation",
        language: normalizedLanguage,
        title: labels.title,
        summary,
        animation: {
            animationType: "algorithm",
            code: displayLines,
            frames,
            viewMode,
            focusVariable: focusVariable || null,
            metrics,
            metricsLabels: labels.metrics,
            truncated: Boolean(traceResult?.truncated),
        },
    };
}
