import { useState } from "react";

const LANGUAGE_LABELS = {
    en: "English",
    hi: "Hindi",
    kn: "Kannada",
};

const OPTION_LETTERS = ["A", "B", "C", "D"];

function scoreMessage(percent) {
    if (percent >= 80) {
        return "Strong understanding. Try a new quiz to check another angle.";
    }

    if (percent >= 50) {
        return "You are getting there. Review the explanations below.";
    }

    return "Review the explanations and retake the quiz.";
}

function QuizCard({
    quiz,
    status,
    result,
    error,
    onSubmit,
    onRetake,
    onNewQuiz,
    onClose,
}) {
    const questions = quiz?.questions || [];
    const [answers, setAnswers] = useState(() =>
        Array(questions.length).fill(null)
    );

    const isLoading = status === "loading";
    const isSubmitting = status === "submitting";
    const results = result?.results || null;
    const allAnswered =
        questions.length > 0 &&
        answers.every((answer) => Number.isInteger(answer));
    const percent =
        result && result.total
            ? Math.round((result.score / result.total) * 100)
            : 0;

    const updateAnswer = (questionIndex, optionIndex) => {
        setAnswers((current) => {
            const next = [...current];
            next[questionIndex] = optionIndex;
            return next;
        });
    };

    return (
        <section
            lang={quiz?.language || undefined}
            className="mt-4 overflow-hidden rounded-2xl border border-line bg-ink-900"
        >
            <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-signal/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-signal">
                            Knowledge check
                        </span>
                        {quiz?.topic && (
                            <span className="truncate text-[11px] text-faint">
                                {quiz.topic}
                            </span>
                        )}
                        {LANGUAGE_LABELS[quiz?.language] && (
                            <span className="rounded-full bg-glacier/10 px-2 py-0.5 text-[10px] font-semibold text-glacier">
                                {LANGUAGE_LABELS[quiz.language]}
                            </span>
                        )}
                    </div>
                    <h3 className="truncate text-sm font-semibold text-chalk">
                        {isLoading
                            ? "Building your quiz"
                            : quiz?.title || "Practice quiz"}
                    </h3>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close quiz"
                    title="Close quiz"
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

            <div className="p-4">
                {isLoading && (
                    <div className="space-y-3" aria-live="polite">
                        <p className="text-sm text-mist">
                            Creating 3 questions from the explanation above...
                        </p>
                        <div className="h-2 w-2/3 animate-pulse rounded bg-ink-700/70" />
                        <div className="h-2 w-1/2 animate-pulse rounded bg-ink-700/70" />
                        <div className="h-20 animate-pulse rounded-xl bg-ink-800" />
                    </div>
                )}

                {status === "error" && !quiz && (
                    <div aria-live="polite">
                        <p className="rounded-lg bg-red-950/40 p-3 text-sm text-red-300">
                            {error || "The quiz could not be generated."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={onNewQuiz}
                                className="rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-signal-dim"
                            >
                                Try again
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-line-bright px-3 py-1.5 text-xs text-mist transition hover:border-line-bright hover:text-signal"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {quiz && !isLoading && (
                    <>
                        {result && (
                            <div
                                className="mb-4 rounded-xl border border-line bg-ink-800 p-3"
                                aria-live="polite"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                                            Score
                                        </p>
                                        <p className="text-2xl font-semibold text-chalk">
                                            {result.score}{" "}
                                            <span className="text-sm font-normal text-mist">
                                                / {result.total}
                                            </span>
                                        </p>
                                    </div>
                                    <p className="text-lg font-semibold text-signal">
                                        {percent}%
                                    </p>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-mist">
                                    {scoreMessage(percent)}
                                </p>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700/70">
                                    <div
                                        className="h-full rounded-full bg-signal transition-[width]"
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <p
                                className="mb-3 rounded-lg bg-red-950/40 p-3 text-sm text-red-300"
                                aria-live="polite"
                            >
                                {error}
                            </p>
                        )}

                        <div className="space-y-4">
                            {questions.map((question, questionIndex) => {
                                const questionResult =
                                    results?.[questionIndex];
                                const selectedIndex = questionResult
                                    ? questionResult.selectedIndex
                                    : answers[questionIndex];
                                const correctIndex =
                                    questionResult?.correctIndex;
                                const showAnswer = Boolean(questionResult);

                                return (
                                    <fieldset
                                        key={questionIndex}
                                        className="min-w-0"
                                    >
                                        <legend className="mb-2 text-sm font-medium leading-6 text-chalk">
                                            <span className="mr-1 text-faint">
                                                {questionIndex + 1}.
                                            </span>
                                            {question.prompt}
                                        </legend>

                                        <div className="space-y-1.5">
                                            {question.options.map(
                                                (option, optionIndex) => {
                                                    const isSelected =
                                                        selectedIndex ===
                                                        optionIndex;
                                                    const isCorrectOption =
                                                        showAnswer &&
                                                        correctIndex ===
                                                            optionIndex;
                                                    const isWrongSelection =
                                                        showAnswer &&
                                                        isSelected &&
                                                        !questionResult.correct;

                                                    let optionClass =
                                                        "border-line bg-ink-800 text-mist hover:border-line-bright";

                                                    if (isCorrectOption) {
                                                        optionClass =
                                                            "border-signal/50 bg-signal/10 text-signal";
                                                    } else if (
                                                        isWrongSelection
                                                    ) {
                                                        optionClass =
                                                            "border-red-500/50 bg-red-500/10 text-red-100";
                                                    } else if (
                                                        isSelected &&
                                                        !showAnswer
                                                    ) {
                                                        optionClass =
                                                            "border-glacier/60 bg-glacier/10 text-glacier";
                                                    } else if (showAnswer) {
                                                        optionClass =
                                                            "border-line bg-ink-800 text-faint";
                                                    }

                                                    return (
                                                        <label
                                                            key={optionIndex}
                                                            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5 transition ${optionClass} ${
                                                                showAnswer ||
                                                                isSubmitting
                                                                    ? "cursor-default"
                                                                    : ""
                                                            }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name={`quiz-${quiz.quizId}-${questionIndex}`}
                                                                value={
                                                                    optionIndex
                                                                }
                                                                checked={
                                                                    isSelected
                                                                }
                                                                onChange={() =>
                                                                    updateAnswer(
                                                                        questionIndex,
                                                                        optionIndex
                                                                    )
                                                                }
                                                                disabled={
                                                                    showAnswer ||
                                                                    isSubmitting
                                                                }
                                                                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-blue-500"
                                                            />
                                                            <span className="flex min-w-0 gap-2">
                                                                <span className="font-semibold text-faint">
                                                                    {
                                                                        OPTION_LETTERS[
                                                                            optionIndex
                                                                        ]
                                                                    }
                                                                </span>
                                                                <span className="break-words">
                                                                    {option}
                                                                </span>
                                                            </span>
                                                        </label>
                                                    );
                                                }
                                            )}
                                        </div>

                                        {questionResult && (
                                            <div
                                                className={`mt-2 rounded-lg border px-3 py-2 ${
                                                    questionResult.correct
                                                        ? "border-signal/30 bg-signal/5"
                                                        : "border-red-500/30 bg-red-500/5"
                                                }`}
                                            >
                                                <p
                                                    className={`text-xs font-semibold ${
                                                        questionResult.correct
                                                            ? "text-signal"
                                                            : "text-red-300"
                                                    }`}
                                                >
                                                    {questionResult.correct
                                                        ? "Correct"
                                                        : "Review this one"}
                                                </p>
                                                {!questionResult.correct && (
                                                    <p className="mt-1 text-xs text-signal">
                                                        Correct answer:{" "}
                                                        {
                                                            question.options[
                                                                questionResult
                                                                    .correctIndex
                                                            ]
                                                        }
                                                    </p>
                                                )}
                                                <p className="mt-1 text-xs leading-5 text-mist">
                                                    {
                                                        questionResult.explanation
                                                    }
                                                </p>
                                            </div>
                                        )}
                                    </fieldset>
                                );
                            })}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            {!results ? (
                                <button
                                    type="button"
                                    onClick={() => onSubmit(answers)}
                                    disabled={!allAnswered || isSubmitting}
                                    className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-signal-dim disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {isSubmitting
                                        ? "Grading..."
                                        : "Submit answers"}
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={onRetake}
                                        className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-signal-dim"
                                    >
                                        Retake
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onNewQuiz}
                                        className="rounded-lg border border-line-bright px-3 py-2 text-sm text-mist transition hover:border-line-bright hover:text-signal"
                                    >
                                        New quiz
                                    </button>
                                </>
                            )}

                            {!results && (
                                <span className="text-[11px] text-faint">
                                    {allAnswered
                                        ? "Ready to submit"
                                        : "Answer every question to submit"}
                                </span>
                            )}
                        </div>

                        <p className="mt-3 text-[10px] leading-4 text-faint">
                            Quiz answers are stored for this browser session so
                            you can track progress. This is practice, not a
                            graded exam.
                        </p>
                    </>
                )}
            </div>
        </section>
    );
}

export default QuizCard;
