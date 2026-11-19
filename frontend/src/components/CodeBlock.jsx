import { useEffect, useRef, useState } from "react";

const PYTHON_LANGUAGES = new Set(["python", "py", "python3"]);

const BUTTON_CLASS =
    "rounded-md border border-line bg-ink-800 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-mist transition hover:border-glacier/50 hover:text-chalk disabled:cursor-not-allowed disabled:opacity-40";

function languageLabel(language) {
    if (!language) return "Code";

    return language.length <= 12
        ? language.toUpperCase()
        : language.slice(0, 12).toUpperCase();
}

function CodeBlock({ code, language, onExplainLine, onTrace, disabled }) {
    const [selectedRange, setSelectedRange] = useState(null);
    const [copyState, setCopyState] = useState("idle");
    const copyTimer = useRef(null);

    useEffect(
        () => () => {
            if (copyTimer.current) {
                clearTimeout(copyTimer.current);
            }
        },
        []
    );

    const normalizedLanguage = String(language || "").toLowerCase();
    const lines = code.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
    const isPython =
        PYTHON_LANGUAGES.has(normalizedLanguage) ||
        (!normalizedLanguage &&
            /\b(def |class |import |from |print\(|for .+ in |while |if __name__)/.test(
                code
            ));
    const canTrace = Boolean(onTrace) && isPython;

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopyState("copied");
        } catch {
            setCopyState("error");
        }

        if (copyTimer.current) {
            clearTimeout(copyTimer.current);
        }

        copyTimer.current = setTimeout(() => setCopyState("idle"), 1600);
    };

    const selectLine = (lineNumber, extend = false) => {
        if (disabled) return;

        setSelectedRange((current) => {
            if (!current) {
                return { start: lineNumber, end: lineNumber };
            }

            if (!extend) {
                if (
                    current.start === lineNumber &&
                    current.end === lineNumber
                ) {
                    return null;
                }

                return { start: lineNumber, end: lineNumber };
            }

            if (
                current.start === lineNumber &&
                current.end === lineNumber
            ) {
                return null;
            }

            return { start: current.start, end: lineNumber };
        });
    };

    const rangeStart = selectedRange
        ? Math.min(selectedRange.start, selectedRange.end)
        : null;
    const rangeEnd = selectedRange
        ? Math.max(selectedRange.start, selectedRange.end)
        : null;
    const hasSelection = rangeStart !== null;
    const isRange = hasSelection && rangeStart !== rangeEnd;

    return (
        <div className="my-3 overflow-hidden rounded-xl border border-line bg-ink-950">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-ink-900/80 px-2.5 py-1.5">
                <span className="mr-auto font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                    {languageLabel(language)}
                </span>

                <button
                    type="button"
                    onClick={copyCode}
                    className={BUTTON_CLASS}
                    title="Copy code"
                >
                    {copyState === "copied"
                        ? "Copied"
                        : copyState === "error"
                          ? "Copy failed"
                          : "Copy"}
                </button>

                {onExplainLine && (
                    <button
                        type="button"
                        onClick={() =>
                            onExplainLine({
                                code,
                                language: normalizedLanguage,
                                line: rangeStart,
                                endLine: rangeEnd,
                            })
                        }
                        disabled={disabled || !hasSelection}
                        className={BUTTON_CLASS}
                        title={
                            hasSelection
                                ? isRange
                                    ? `Explain lines ${rangeStart}–${rangeEnd}`
                                    : `Explain line ${rangeStart}`
                                : "Select a line first"
                        }
                    >
                        {hasSelection
                            ? isRange
                                ? `Explain lines ${rangeStart}–${rangeEnd}`
                                : `Explain line ${rangeStart}`
                            : "Explain line"}
                    </button>
                )}

                {canTrace && (
                    <button
                        type="button"
                        onClick={() =>
                            onTrace({
                                code,
                                language: normalizedLanguage || "python",
                            })
                        }
                        disabled={disabled}
                        className={BUTTON_CLASS}
                        title="Run this code in a real Python interpreter in your browser"
                    >
                        Real trace
                    </button>
                )}
            </div>

            <div className="max-h-96 overflow-auto">
                <div
                    role="group"
                    aria-label="Code snippet. Click a line, or shift-click another line for a range, to explain it."
                    className="min-w-max py-1 font-mono text-[12px] leading-5"
                >
                    {lines.map((line, index) => {
                        const lineNumber = index + 1;
                        const isSelected =
                            hasSelection &&
                            lineNumber >= rangeStart &&
                            lineNumber <= rangeEnd;

                        return (
                            <div
                                key={lineNumber}
                                role="button"
                                tabIndex={disabled ? -1 : 0}
                                aria-label={`Select line ${lineNumber}`}
                                aria-pressed={isSelected}
                                onClick={(event) =>
                                    selectLine(lineNumber, event.shiftKey)
                                }
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "Enter" ||
                                        event.key === " "
                                    ) {
                                        event.preventDefault();
                                        selectLine(
                                            lineNumber,
                                            event.shiftKey
                                        );
                                    }
                                }}
                                className={`flex border-l-2 transition-colors ${
                                    isSelected
                                        ? "border-glacier/50 bg-glacier/10"
                                        : "border-transparent hover:bg-ink-800"
                                } ${
                                    disabled
                                        ? "cursor-not-allowed"
                                        : "cursor-pointer"
                                }`}
                            >
                                <span
                                    className={`w-10 shrink-0 select-none border-r border-line px-2 text-right ${
                                        isSelected
                                            ? "text-glacier"
                                            : "text-faint"
                                    }`}
                                >
                                    {lineNumber}
                                </span>
                                <span className="whitespace-pre px-3 text-chalk">
                                    {line || " "}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {hasSelection && !disabled && (
                <p className="border-t border-line px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-glacier/70">
                    {isRange
                        ? `Lines ${rangeStart}–${rangeEnd} selected.`
                        : `Line ${rangeStart} selected.`}{" "}
                    Shift-click another line (or use Shift+Enter) to extend
                    the range, then click the Explain button.
                </p>
            )}
        </div>
    );
}

export default CodeBlock;
