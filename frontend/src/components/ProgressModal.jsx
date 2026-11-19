import { useEffect, useState } from "react";
import { getProgress } from "../services/api.js";
import { getSessionId } from "../utils/session.js";

function StatCard({ label, value }) {
    return (
        <div className="rounded-xl border border-line bg-ink-800 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                {label}
            </p>
            <p className="mt-1 text-xl font-semibold text-chalk">{value}</p>
        </div>
    );
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

function ProgressModal({ open, onClose }) {
    const [status, setStatus] = useState("idle");
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return undefined;

        let cancelled = false;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStatus("loading");
        setError("");

        getProgress(getSessionId())
            .then((data) => {
                if (!cancelled) {
                    setProgress(data);
                    setStatus("ready");
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err.message || "Failed to load progress");
                    setStatus("error");
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    const retry = () => {
        setStatus("loading");
        setError("");

        getProgress(getSessionId())
            .then((data) => {
                setProgress(data);
                setStatus("ready");
            })
            .catch((err) => {
                setError(err.message || "Failed to load progress");
                setStatus("error");
            });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="progress-title"
        >
            <button
                type="button"
                aria-label="Close progress"
                onClick={onClose}
                className="absolute inset-0 cursor-default bg-ink-950/80"
            />

            <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-ink-900 shadow-2xl">
                <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-ink-900 px-5 py-4">
                    <div>
                        <h2
                            id="progress-title"
                            className="text-lg font-semibold text-chalk"
                        >
                            Your progress
                        </h2>
                        <p className="mt-0.5 text-xs text-faint">
                            Quiz attempts from this browser session
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close progress"
                        title="Close"
                        className="rounded-md p-1 text-faint transition hover:bg-ink-700 hover:text-signal"
                    >
                        <svg
                            className="h-5 w-5"
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

                <div className="p-5">
                    {status === "loading" && (
                        <div className="space-y-3" aria-live="polite">
                            <div className="grid grid-cols-2 gap-3">
                                {[0, 1, 2, 3].map((item) => (
                                    <div
                                        key={item}
                                        className="h-20 animate-pulse rounded-xl bg-ink-800"
                                    />
                                ))}
                            </div>
                            <div className="h-28 animate-pulse rounded-xl bg-ink-800" />
                        </div>
                    )}

                    {status === "error" && (
                        <div aria-live="polite">
                            <p className="rounded-lg bg-red-950/40 p-3 text-sm text-red-300">
                                {error}
                            </p>
                            <button
                                type="button"
                                onClick={retry}
                                className="mt-3 rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-signal-dim"
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {status === "ready" && progress && (
                        <>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <StatCard
                                    label="Quizzes taken"
                                    value={progress.totalAttempts}
                                />
                                <StatCard
                                    label="Average"
                                    value={`${progress.averagePercent}%`}
                                />
                                <StatCard
                                    label="Best score"
                                    value={`${progress.bestPercent}%`}
                                />
                                <StatCard
                                    label="Topics"
                                    value={progress.topics?.length || 0}
                                />
                            </div>

                            {progress.totalAttempts === 0 && (
                                <div className="mt-5 rounded-xl border border-dashed border-line bg-ink-800 p-6 text-center">
                                    <p className="text-sm font-medium text-chalk">
                                        No quiz attempts yet
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-faint">
                                        Open an explanation and choose{" "}
                                        <span className="text-mist">
                                            Quiz me
                                        </span>{" "}
                                        to start tracking your progress.
                                    </p>
                                </div>
                            )}

                            {progress.weakConcepts?.length > 0 && (
                                <section className="mt-6">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
                                        Needs practice
                                    </h3>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {progress.weakConcepts.map(
                                            (concept) => (
                                                <span
                                                    key={concept.concept}
                                                    className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200"
                                                >
                                                    {concept.concept}
                                                    <span className="ml-1 text-amber-300/60">
                                                        {concept.accuracy}%
                                                    </span>
                                                </span>
                                            )
                                        )}
                                    </div>
                                </section>
                            )}

                            {progress.topics?.length > 0 && (
                                <section className="mt-6">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
                                        Topics
                                    </h3>
                                    <div className="mt-2 space-y-1.5">
                                        {progress.topics.map((topic) => (
                                            <div
                                                key={topic.topic}
                                                className="flex items-center justify-between gap-3 rounded-lg bg-ink-800 px-3 py-2"
                                            >
                                                <span className="min-w-0 truncate text-sm text-mist">
                                                    {topic.topic}
                                                </span>
                                                <span className="shrink-0 text-xs text-faint">
                                                    {topic.attempts} quiz
                                                    {topic.attempts === 1
                                                        ? ""
                                                        : "zes"}{" "}
                                                    · {topic.averagePercent}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {progress.recent?.length > 0 && (
                                <section className="mt-6">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
                                        Recent attempts
                                    </h3>
                                    <div className="mt-2 space-y-1.5">
                                        {progress.recent.map((attempt) => {
                                            const percent = attempt.total
                                                ? Math.round(
                                                      (attempt.score /
                                                          attempt.total) *
                                                          100
                                                  )
                                                : 0;

                                            return (
                                                <div
                                                    key={attempt.attemptId}
                                                    className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm text-mist">
                                                            {attempt.quizTitle ||
                                                                "Quiz"}
                                                        </p>
                                                        <p className="text-[11px] text-faint">
                                                            {attempt.topic}
                                                            {attempt.topic &&
                                                            formatDate(
                                                                attempt.createdAt
                                                            )
                                                                ? " · "
                                                                : ""}
                                                            {formatDate(
                                                                attempt.createdAt
                                                            )}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                            percent >= 80
                                                                ? "bg-signal/10 text-signal"
                                                                : percent >= 50
                                                                  ? "bg-amber-500/10 text-amber-300"
                                                                  : "bg-red-500/10 text-red-300"
                                                        }`}
                                                    >
                                                        {attempt.score}/
                                                        {attempt.total}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}
                        </>
                    )}

                    <p className="mt-6 text-[10px] leading-4 text-faint">
                        Progress is anonymous and stored for this browser
                        session only. It is not linked to an account.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ProgressModal;
