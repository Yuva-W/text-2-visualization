import { useEffect, useState } from "react";

const VISUAL_OPTIONS = [
    { label: "Best fit", visualType: "auto" },
    { label: "Chart", visualType: "chart" },
    { label: "Diagram", visualType: "diagram" },
    { label: "Table", visualType: "table" },
    { label: "Animation", visualType: "animation" },
];

const CHANGE_OPTIONS = [
    { label: "Chart", visualType: "chart" },
    { label: "Diagram", visualType: "diagram" },
    { label: "Table", visualType: "table" },
    { label: "Animation", visualType: "animation" },
];

const LEARNING_ACTIONS = [
    {
        label: "Simplify",
        prompt: (suffix) =>
            `Explain your earlier explanation${suffix} in simpler language for a beginner. Use short sentences and a small example if helpful. Return a text explanation only.`,
    },
    {
        label: "Give an example",
        prompt: (suffix) =>
            `Give one concrete, worked example that helps a student understand your earlier explanation${suffix}. Return a text explanation only.`,
    },
    {
        label: "Common mistakes",
        prompt: (suffix) =>
            `List the most common mistakes or misconceptions students have about the topic in your earlier explanation${suffix}, and explain how to avoid each one. Return a text explanation only.`,
    },
    {
        label: "Analogy",
        prompt: (suffix) =>
            `Give a clear real-world analogy for the topic in your earlier explanation${suffix}, then explain where the analogy breaks down. Return a text explanation only.`,
    },
];

const CHIP_CLASS =
    "rounded-lg border border-line bg-ink-800/70 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-mist transition hover:border-glacier/50 hover:bg-ink-800 hover:text-chalk disabled:cursor-not-allowed disabled:opacity-40";

function MenuButton({ label, expanded, onClick, disabled }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-haspopup="menu"
            aria-expanded={expanded}
            className={`${CHIP_CLASS} inline-flex items-center gap-1`}
        >
            {label}
            <svg
                className={`h-3 w-3 transition-transform ${
                    expanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 9l6 6 6-6"
                />
            </svg>
        </button>
    );
}

function MenuItem({ children, onClick, disabled }) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            disabled={disabled}
            className="w-full rounded-md px-3 py-2 text-left text-xs text-mist transition hover:bg-ink-700 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
        >
            {children}
        </button>
    );
}

function MessageActions({ visualization, onAction, onQuiz, disabled }) {
    const [visualMenuOpen, setVisualMenuOpen] = useState(false);
    const [learnMenuOpen, setLearnMenuOpen] = useState(false);

    useEffect(() => {
        if (!visualMenuOpen && !learnMenuOpen) return undefined;

        const handlePointerDown = (event) => {
            if (!event.target.closest("[data-actions-menu]")) {
                setVisualMenuOpen(false);
                setLearnMenuOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setVisualMenuOpen(false);
                setLearnMenuOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [visualMenuOpen, learnMenuOpen]);

    if (!visualization) return null;

    const title = visualization.title?.trim();
    const suffix = title ? ` titled "${title}"` : "";
    const suggestion =
        visualization.suggestion?.label && visualization.suggestion?.prompt
            ? visualization.suggestion
            : null;

    const isText = visualization.type === "text";
    const actions = [];

    if (isText) {
        actions.push({
            label: "Quiz me",
            onClick: () =>
                onQuiz
                    ? onQuiz()
                    : onAction(
                          `Quiz me on your earlier explanation${suffix}. Give 3 short questions and put the answers at the end.`,
                          { visualType: "text" }
                      ),
        });
    } else if (visualization.type === "chart") {
        actions.push({
            label: "Explain the trend",
            onClick: () =>
                onAction(
                    `Explain the main trend in the chart${suffix} in simple terms for a student.`,
                    { visualType: "text" }
                ),
        });
    } else if (visualization.type === "diagram") {
        actions.push({
            label: "Explain this diagram",
            onClick: () =>
                onAction(
                    `Explain the diagram${suffix} step by step in simple terms for a student.`,
                    { visualType: "text" }
                ),
        });
    } else if (visualization.type === "table") {
        actions.push({
            label: "Explain this table",
            onClick: () =>
                onAction(
                    `Explain the key takeaways from the table${suffix} in simple terms for a student.`,
                    { visualType: "text" }
                ),
        });
    } else if (visualization.type === "animation") {
        actions.push({
            label: "Explain this animation",
            onClick: () =>
                onAction(
                    `Explain the animation${suffix} step by step in simple terms for a student.`,
                    { visualType: "text" }
                ),
        });
    }

    const visibleActions = suggestion
        ? actions.filter((action) => action.label !== suggestion.label)
        : actions;

    const closeMenus = () => {
        setVisualMenuOpen(false);
        setLearnMenuOpen(false);
    };

    const handleVisualChoice = (visualType) => {
        closeMenus();
        onAction(
            isText
                ? `Create ${
                      visualType === "auto"
                          ? "the best visualization"
                          : `a ${visualType} visualization`
                  } for your earlier explanation${suffix}.`
                : `Recreate the earlier visualization${suffix} as a ${visualType} visualization. Keep the same data, topic, and language.`,
            { visualType }
        );
    };

    const handleLearningChoice = (action) => {
        closeMenus();
        onAction(action.prompt(suffix), { visualType: "text" });
    };

    const hasMenu =
        isText ||
        visualization.type === "chart" ||
        visualization.type === "diagram" ||
        visualization.type === "table" ||
        visualization.type === "animation";

    if (!suggestion && visibleActions.length === 0 && !hasMenu) return null;

    return (
        <div className="mt-4 border-t border-line/60 pt-3">
            <div className="flex flex-wrap items-center gap-2">
                {suggestion && (
                    <button
                        type="button"
                        onClick={() => onAction(suggestion.prompt)}
                        disabled={disabled}
                        title={suggestion.reason || undefined}
                        className="rounded-lg border border-glacier/40 bg-glacier/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-glacier transition hover:border-glacier hover:bg-glacier/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <span className="mr-1 text-[9px] font-semibold text-glacier/70">
                            Suggested
                        </span>
                        {suggestion.label}
                    </button>
                )}

                {visibleActions.map((action) => (
                    <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        disabled={disabled}
                        className={CHIP_CLASS}
                    >
                        {action.label}
                    </button>
                ))}

                {hasMenu && (
                    <div className="relative" data-actions-menu>
                        <MenuButton
                            label={isText ? "Visualize" : "Change visual"}
                            expanded={visualMenuOpen}
                            onClick={() =>
                                setVisualMenuOpen((open) => !open)
                            }
                            disabled={disabled}
                        />

                        {visualMenuOpen && (
                            <div
                                role="menu"
                                aria-label={
                                    isText
                                        ? "Choose a visualization type"
                                        : "Choose a new visualization type"
                                }
                                className="absolute left-0 top-full z-20 mt-1 w-44 rounded-xl border border-line bg-ink-900 p-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                            >
                                {(isText
                                    ? VISUAL_OPTIONS
                                    : CHANGE_OPTIONS
                                ).map((option) => (
                                    <MenuItem
                                        key={option.visualType}
                                        onClick={() =>
                                            handleVisualChoice(
                                                option.visualType
                                            )
                                        }
                                        disabled={disabled}
                                    >
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {isText && (
                    <div className="relative" data-actions-menu>
                        <MenuButton
                            label="Learn more"
                            expanded={learnMenuOpen}
                            onClick={() =>
                                setLearnMenuOpen((open) => !open)
                            }
                            disabled={disabled}
                        />

                        {learnMenuOpen && (
                            <div
                                role="menu"
                                aria-label="More learning actions"
                                className="absolute left-0 top-full z-20 mt-1 w-44 rounded-xl border border-line bg-ink-900 p-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                            >
                                {LEARNING_ACTIONS.map((action) => (
                                    <MenuItem
                                        key={action.label}
                                        onClick={() =>
                                            handleLearningChoice(action)
                                        }
                                        disabled={disabled}
                                    >
                                        {action.label}
                                    </MenuItem>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {suggestion?.reason && (
                <p className="mt-1.5 text-[11px] leading-5 text-glacier/60">
                    {suggestion.reason}
                </p>
            )}
        </div>
    );
}

export default MessageActions;
