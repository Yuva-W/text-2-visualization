
import { useEffect, useRef, useState } from "react";
import {
    useActiveThread,
    useChat,
    useThreads,
} from "../context/ChatContext.jsx";
import MarkdownMessage from "./MarkdownMessage.jsx";
import CapabilityDeck from "./CapabilityDeck.jsx";
import MessageActions from "./MessageActions.jsx";
import QuizCard from "./QuizCard.jsx";
import TraceStudioPanel from "./TraceStudioPanel.jsx";
import VisualizationPanel from "./VisualizationPanel.jsx";
import {
    generateQuiz as generateQuizApi,
    submitQuiz as submitQuizApi,
} from "../services/api.js";
import { getSessionId } from "../utils/session.js";
import { cancelTrace } from "../utils/pythonTrace.js";
import { MAX_MESSAGE_LENGTH } from "../utils/limits.js";
import {
    extractPdfText,
    mergePdfText,
    PDF_MIN_IMPORT_CHARS,
    validatePdfFile,
} from "../utils/pdfText.js";

const LANGUAGE_OPTIONS = [
    { value: "auto", label: "Auto" },
    { value: "en", label: "English" },
    { value: "hi", label: "Hindi" },
    { value: "kn", label: "Kannada" },
];

const OUTPUT_OPTIONS = [
    { value: "auto", label: "Auto" },
    { value: "text", label: "Explain" },
    { value: "chart", label: "Chart" },
    { value: "diagram", label: "Diagram" },
    { value: "table", label: "Table" },
    { value: "animation", label: "Animation" },
];

const DIAGRAM_OPTIONS = [
    { value: "auto", label: "Best diagram" },
    { value: "flowchart", label: "Flowchart" },
    { value: "sequence", label: "Sequence" },
    { value: "mindmap", label: "Mind map" },
    { value: "timeline", label: "Timeline" },
    { value: "state", label: "State diagram" },
    { value: "er", label: "ER diagram" },
    { value: "class", label: "Class diagram" },
    { value: "gantt", label: "Gantt chart" },
    { value: "journey", label: "Journey map" },
];

const VISUALIZATION_LABELS = {
    chart: "Chart",
    diagram: "Diagram",
    table: "Table",
    animation: "Animation",
};

const STARTERS = [
    {
        label: "Explain a loop",
        prompt: "Explain this code line by line:\n\nfor i in range(n):\n    if a[i] > a[i + 1]:\n        swap(a[i], a[i + 1])",
    },
    {
        label: "Chart a quarter",
        prompt: "Create a bar chart of quarterly revenue: Q1 120, Q2 150, Q3 190, Q4 170.",
    },
    {
        label: "Map a flow",
        prompt: "Draw a flowchart for a user login and authentication process.",
    },
];

function Chat() {
    const { messages, activeThreadId } = useActiveThread();
    const { threads } = useThreads();
    const { sendMessage, loading, error } = useChat();
    const activeThread = threads.find(
        (thread) => thread.threadId === activeThreadId
    );

    const [message, setMessage] = useState("");
    const [language, setLanguage] = useState("auto");
    const [outputType, setOutputType] = useState("auto");
    const [diagramType, setDiagramType] = useState("auto");
    const [quiz, setQuiz] = useState(null);
    const [traceState, setTraceState] = useState(null);
    const [pdfStatus, setPdfStatus] = useState(null);
    const [showJumpButton, setShowJumpButton] = useState(false);
    const [isDraggingPdf, setIsDraggingPdf] = useState(false);
    const messagesEndRef = useRef(null);
    const scrollAreaRef = useRef(null);
    const messageListRef = useRef(null);
    const inputRef = useRef(null);
    const pdfInputRef = useRef(null);
    const pdfRequestRef = useRef(0);
    const dragDepthRef = useRef(0);
    const stickToBottomRef = useRef(true);
    const hasMessages = messages.length > 0;
    const isImportingPdf = pdfStatus?.status === "reading";

    useEffect(() => {
        // A quiz, trace, and PDF status belong to the explanation in the
        // current thread.
        cancelTrace();
        pdfRequestRef.current += 1;
        dragDepthRef.current = 0;
        setQuiz(null);
        setTraceState(null);
        setPdfStatus(null);
        setShowJumpButton(false);
        setIsDraggingPdf(false);
    }, [activeThreadId]);

    useEffect(() => {
        stickToBottomRef.current = true;
        setShowJumpButton(false);

        const frame = requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "end",
            });
        });

        return () => cancelAnimationFrame(frame);
    }, [messages, loading]);

    useEffect(() => {
        if (!traceState) return undefined;

        const frame = requestAnimationFrame(() => {
            document
                .getElementById("real-trace-panel")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        return () => cancelAnimationFrame(frame);
    }, [traceState]);

    useEffect(() => {
        const container = scrollAreaRef.current;

        if (!container) return;

        const handleScroll = () => {
            const distance =
                container.scrollHeight -
                container.scrollTop -
                container.clientHeight;
            const nearBottom = distance < 120;

            stickToBottomRef.current = nearBottom;
            setShowJumpButton(hasMessages && distance > 280);
        };

        container.addEventListener("scroll", handleScroll, {
            passive: true,
        });

        return () => container.removeEventListener("scroll", handleScroll);
    }, [hasMessages]);

    useEffect(() => {
        const list = messageListRef.current;

        if (!list || typeof ResizeObserver === "undefined") return;

        // Diagrams render asynchronously and grow the list; keep the newest
        // content in view when the user has not scrolled away.
        const observer = new ResizeObserver(() => {
            if (stickToBottomRef.current) {
                messagesEndRef.current?.scrollIntoView({ block: "end" });
            }
        });

        observer.observe(list);

        return () => observer.disconnect();
    }, [hasMessages]);

    useEffect(() => {
        const element = inputRef.current;

        if (!element) return;

        element.style.height = "auto";
        element.style.height = `${Math.min(element.scrollHeight, 192)}px`;
    }, [message]);

    useEffect(() => {
        const handleShortcut = (event) => {
            const target = event.target;
            const isTyping =
                target instanceof HTMLElement &&
                (target.isContentEditable ||
                    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k"
            ) {
                event.preventDefault();
                inputRef.current?.focus();
                return;
            }

            if (
                event.key === "/" &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                !isTyping
            ) {
                event.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleShortcut);

        return () => window.removeEventListener("keydown", handleShortcut);
    }, []);

    const scrollToLatest = () => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
        });
        stickToBottomRef.current = true;
        setShowJumpButton(false);
    };

    const applyStarter = (prompt) => {
        // Choosing a starter replaces the draft and cancels any import that is
        // still running for the previous draft.
        pdfRequestRef.current += 1;
        setPdfStatus(null);
        setMessage(prompt);
        inputRef.current?.focus();
    };

    const importPdfFile = async (file) => {
        if (!file || loading || isImportingPdf) return;

        try {
            validatePdfFile(file);
        } catch (pdfError) {
            setPdfStatus({
                status: "error",
                fileName: file.name,
                message:
                    pdfError?.message ||
                    "The PDF could not be read. Try another file.",
            });
            return;
        }

        const draft = message.trimEnd();
        const separator = draft ? "\n\n" : "";
        const available =
            MAX_MESSAGE_LENGTH - draft.length - separator.length;

        if (available < PDF_MIN_IMPORT_CHARS) {
            setPdfStatus({
                status: "error",
                fileName: file.name,
                message:
                    "There is not enough room in the message for this PDF. Clear some text and try again.",
            });
            return;
        }

        const token = ++pdfRequestRef.current;
        setPdfStatus({
            status: "reading",
            fileName: file.name,
            page: 0,
            totalPages: 0,
        });

        try {
            const result = await extractPdfText(file, {
                maxChars: available,
                onProgress: (progress) => {
                    if (pdfRequestRef.current !== token) return;

                    setPdfStatus((current) =>
                        current?.status === "reading"
                            ? { ...current, ...progress }
                            : current
                    );
                },
            });

            if (pdfRequestRef.current !== token) return;

            const merged = mergePdfText(message, result.text);
            setMessage(merged.text);
            setPdfStatus({
                status: "success",
                fileName: file.name,
                pagesRead: result.pagesRead,
                pageCount: result.pageCount,
                chars: result.chars,
                truncated: result.truncated || merged.clipped,
                charLimitHit: result.charLimitHit || merged.clipped,
                pageLimitHit: result.pageLimitHit,
            });

            requestAnimationFrame(() => inputRef.current?.focus());
        } catch (pdfError) {
            if (pdfRequestRef.current !== token) return;

            setPdfStatus({
                status: "error",
                fileName: file.name,
                message:
                    pdfError?.message ||
                    "The PDF could not be read. Try another file.",
            });
        }
    };

    const handlePdfSelected = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (file) await importPdfFile(file);
    };

    const isFileDrag = (event) =>
        Array.from(event.dataTransfer?.types || []).includes("Files");

    const handleDragEnter = (event) => {
        if (!isFileDrag(event) || loading || isImportingPdf) return;

        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDraggingPdf(true);
    };

    const handleDragOver = (event) => {
        if (!isFileDrag(event) || loading || isImportingPdf) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = (event) => {
        if (!isFileDrag(event)) return;

        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

        if (dragDepthRef.current === 0) {
            setIsDraggingPdf(false);
        }
    };

    const handleDrop = async (event) => {
        if (!isFileDrag(event)) return;

        event.preventDefault();
        dragDepthRef.current = 0;
        setIsDraggingPdf(false);

        const file = event.dataTransfer.files?.[0];

        if (file) await importPdfFile(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const content = message.trim();

        if (!content || loading || isImportingPdf) return;

        setMessage("");
        setPdfStatus(null);
        await sendMessage(content, language, {
            visualType: outputType,
            diagramType:
                outputType === "diagram" ? diagramType : "auto",
        });
    };

    const handleKeyDown = (event) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
        ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
        }
    };

    const handleAction = (visualization, prompt, options = {}) => {
        if (!prompt || loading) return;

        const actionLanguage =
            language !== "auto"
                ? language
                : visualization?.language || "auto";

        sendMessage(prompt, actionLanguage, options);
    };

    const handleExplainLine = (
        messageIndex,
        { code, language: codeLanguage, line, endLine }
    ) => {
        if (loading || !code || !line) return;

        const visualization = messages[messageIndex]?.visualization;
        const actionLanguage =
            language !== "auto"
                ? language
                : visualization?.language || "auto";
        const fence = code.includes("```") ? "````" : "```";
        const fenceLanguage = codeLanguage || "";
        const isRange = Boolean(endLine && endLine !== line);
        const target = isRange
            ? `lines ${line}–${endLine}`
            : `line ${line}`;
        const request = isRange
            ? `Explain ${target} of this ${
                  codeLanguage || "code"
              } snippet in simple terms for a student. Explain what each line does, how the lines work together, and any values they change.`
            : `Explain ${target} of this ${
                  codeLanguage || "code"
              } snippet in simple terms for a student. Explain what the line does, how it fits into the surrounding code, and any values it changes.`;
        const prompt = `${request}\n\n${fence}${fenceLanguage}\n${code}\n${fence}`;

        sendMessage(prompt, actionLanguage, { visualType: "text" });
    };

    const handleTrace = (messageIndex, { code, language: codeLanguage }) => {
        if (loading || !code) return;

        const visualization = messages[messageIndex]?.visualization;
        const outputLanguage =
            language !== "auto"
                ? language
                : visualization?.language || "en";

        // If another trace is still loading, stop it before starting a new one.
        cancelTrace();
        setTraceState({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            messageIndex,
            code,
            codeLanguage: codeLanguage || "python",
            language: ["en", "hi", "kn"].includes(outputLanguage)
                ? outputLanguage
                : "en",
        });
    };

    const handleQuiz = async (messageIndex) => {
        if (
            loading ||
            !activeThreadId ||
            quiz?.status === "loading" ||
            quiz?.status === "submitting"
        ) {
            return;
        }

        const visualization = messages[messageIndex]?.visualization;
        const quizLanguage =
            language !== "auto"
                ? language
                : visualization?.language || "auto";

        setQuiz({
            status: "loading",
            messageIndex,
            data: null,
            result: null,
            error: "",
            round: 0,
        });

        try {
            const data = await generateQuizApi({
                threadId: activeThreadId,
                messageIndex,
                sessionId: getSessionId(),
                language: quizLanguage,
                count: 3,
            });

            setQuiz((current) =>
                current &&
                current.messageIndex === messageIndex &&
                current.status === "loading"
                    ? {
                          ...current,
                          status: "ready",
                          data: data.quiz,
                          error: "",
                      }
                    : current
            );
        } catch (err) {
            setQuiz((current) =>
                current && current.messageIndex === messageIndex
                    ? {
                          ...current,
                          status: "error",
                          error:
                              err.message ||
                              "The quiz could not be generated.",
                      }
                    : current
            );
        }
    };

    const handleQuizSubmit = async (answers) => {
        if (!quiz?.data || quiz.status === "submitting") return;

        const quizId = quiz.data.quizId;

        setQuiz((current) => ({
            ...current,
            status: "submitting",
            error: "",
        }));

        try {
            const data = await submitQuizApi(
                quizId,
                getSessionId(),
                answers
            );

            setQuiz((current) =>
                current?.data?.quizId === quizId
                    ? {
                          ...current,
                          status: "result",
                          result: data,
                          error: "",
                      }
                    : current
            );
        } catch (err) {
            setQuiz((current) =>
                current?.data?.quizId === quizId
                    ? {
                          ...current,
                          status: "ready",
                          error:
                              err.message || "The quiz could not be graded.",
                      }
                    : current
            );
        }
    };

    const handleQuizRetake = () => {
        setQuiz((current) =>
            current
                ? {
                      ...current,
                      status: "ready",
                      result: null,
                      error: "",
                      round: (current.round || 0) + 1,
                  }
                : current
        );
    };

    const handleQuizNew = () => {
        if (!quiz) return;
        handleQuiz(quiz.messageIndex);
    };

    const handleQuizClose = () => {
        setQuiz(null);
    };

    return (
        <div
            className="relative flex h-full min-h-0 flex-col"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line/70 bg-ink-900/60 px-4 py-2.5 backdrop-blur sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal shadow-[0_0_10px_rgba(201,242,122,0.65)]" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mist">
                        Workbench
                    </span>
                    <span className="hidden h-3 w-px bg-line-bright sm:block" />
                    <span className="hidden min-w-0 truncate text-xs text-faint sm:block">
                        {activeThread?.title || "New workspace"}
                    </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-faint md:inline">
                        EN · हिन्दी · ಕನ್ನಡ
                    </span>
                    <span className="rounded-full border border-line bg-ink-800 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-glacier">
                        Local trace
                    </span>
                </div>
            </header>

            <div className="relative min-h-0 flex-1">
                <div
                    ref={scrollAreaRef}
                    className="workbench-surface h-full overflow-y-auto px-4 py-6 sm:px-6"
                >
                {messages.length === 0 ? (
                    <div className="flex min-h-full items-center justify-center">
                        <div className="w-full max-w-2xl py-8">
                            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-signal">
                                <span className="h-px w-10 bg-signal/60" />
                                Text → Visual
                            </div>

                            <h1 className="hero-title mt-5 max-w-xl text-4xl font-semibold leading-[1.05] text-chalk sm:text-5xl">
                                Make any idea{" "}
                                <span className="text-signal">visible.</span>
                            </h1>

                            <p className="mt-4 max-w-xl text-sm leading-7 text-mist">
                                Ask about any subject—history, science, math,
                                code, or business. Get a clear answer, with the
                                right chart, diagram, timeline, table, or
                                walkthrough when it helps.
                            </p>

                            <CapabilityDeck />

                            <div className="mt-5 flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
                                    Try
                                </span>
                                {STARTERS.map((starter) => (
                                    <button
                                        key={starter.label}
                                        type="button"
                                        onClick={() =>
                                            applyStarter(starter.prompt)
                                        }
                                        className="rounded-full border border-line bg-ink-900/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-mist transition hover:border-signal/40 hover:bg-signal/5 hover:text-signal"
                                    >
                                        {starter.label}
                                    </button>
                                ))}
                            </div>

                            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                                Auto-detects English · हिन्दी · ಕನ್ನಡ
                            </p>

                            {error && (
                                <p className="mt-6 max-w-xl rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                    {error}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div
                        ref={messageListRef}
                        className="mx-auto w-full max-w-3xl space-y-8"
                    >
                        {messages.map((msg, index) => {
                            const hasQuiz =
                                msg.role === "assistant" &&
                                quiz?.messageIndex === index;
                            const hasTrace =
                                msg.role === "assistant" &&
                                traceState?.messageIndex === index;
                            const visualLabel =
                                msg.role === "assistant" &&
                                msg.visualization &&
                                msg.visualization.type !== "text"
                                    ? VISUALIZATION_LABELS[
                                          msg.visualization.type
                                      ] || msg.visualization.type
                                    : null;

                            return (
                                <div
                                    key={`${msg.role}-${index}`}
                                    className={`message-enter ${
                                        msg.role === "user"
                                            ? "flex justify-end"
                                            : "flex gap-3 sm:gap-4"
                                    }`}
                                >
                                    {msg.role === "assistant" && (
                                        <div className="hidden shrink-0 pt-5 sm:block">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-signal/25 bg-signal/10 font-mono text-[9px] font-semibold tracking-[0.08em] text-signal">
                                                AI
                                            </div>
                                        </div>
                                    )}

                                    <div
                                        className={
                                            msg.role === "user"
                                                ? "max-w-[92%] sm:max-w-[80%]"
                                                : "min-w-0 flex-1"
                                        }
                                    >
                                        {msg.role === "user" ? (
                                            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-2xl rounded-br-md border border-line-bright/60 bg-ink-800 px-4 py-3 text-sm leading-7 text-chalk shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                                                {msg.content}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em]">
                                                    <span className="text-faint">
                                                        Assistant
                                                    </span>
                                                    <span className="h-px flex-1 bg-line/70" />
                                                    {visualLabel && (
                                                        <span className="text-glacier">
                                                            {visualLabel}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="rounded-2xl border border-line bg-ink-900/80 px-4 py-4 text-sm leading-7 text-chalk shadow-[0_18px_40px_rgba(0,0,0,0.14)] sm:px-5">
                                                    <MarkdownMessage
                                                    content={msg.content || ""}
                                                    disabled={loading}
                                                    onExplainLine={(
                                                        codeBlock
                                                    ) =>
                                                        handleExplainLine(
                                                            index,
                                                            codeBlock
                                                        )
                                                    }
                                                    onTrace={(codeBlock) =>
                                                        handleTrace(
                                                            index,
                                                            codeBlock
                                                        )
                                                    }
                                                />
                                                <VisualizationPanel
                                                    visualization={
                                                        msg.visualization
                                                    }
                                                />
                                                {hasTrace && (
                                                    <TraceStudioPanel
                                                        key={traceState.id}
                                                        code={
                                                            traceState.code
                                                        }
                                                        language={
                                                            traceState.language
                                                        }
                                                        onClose={() =>
                                                            setTraceState(null)
                                                        }
                                                    />
                                                )}
                                                <MessageActions
                                                    visualization={
                                                        msg.visualization
                                                    }
                                                    disabled={loading}
                                                    onAction={(prompt, options) =>
                                                        handleAction(
                                                            msg.visualization,
                                                            prompt,
                                                            options
                                                        )
                                                    }
                                                    onQuiz={() =>
                                                        handleQuiz(index)
                                                    }
                                                />

                                                {hasQuiz && (
                                                    <QuizCard
                                                        key={`${
                                                            quiz.data?.quizId ||
                                                            "pending"
                                                        }-${
                                                            quiz.round || 0
                                                        }`}
                                                        quiz={quiz.data}
                                                        status={quiz.status}
                                                        result={quiz.result}
                                                        error={quiz.error}
                                                        onSubmit={
                                                            handleQuizSubmit
                                                        }
                                                        onRetake={
                                                            handleQuizRetake
                                                        }
                                                        onNewQuiz={
                                                            handleQuizNew
                                                        }
                                                        onClose={
                                                            handleQuizClose
                                                        }
                                                    />
                                                )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {loading && (
                            <div className="flex gap-3 sm:gap-4">
                                <div className="hidden shrink-0 pt-1 sm:block">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-signal/25 bg-signal/10 font-mono text-[9px] font-semibold tracking-[0.08em] text-signal">
                                        AI
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-2xl border border-line bg-ink-900/70 px-4 py-3">
                                    <span className="flex gap-1">
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-signal [animation-delay:-0.3s]" />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-glacier [animation-delay:-0.15s]" />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-signal/60" />
                                    </span>
                                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist">
                                        Composing response
                                    </span>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {error}
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}
                </div>

                {showJumpButton && (
                    <button
                        type="button"
                        onClick={scrollToLatest}
                        className="jump-button absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line-bright bg-ink-900/95 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-mist shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur transition hover:border-signal/50 hover:text-chalk active:scale-95"
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
                                d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            />
                        </svg>
                        Latest
                    </button>
                )}
            </div>

            <div className="shrink-0 border-t border-line/60 bg-ink-950/70 px-4 pb-4 pt-3 backdrop-blur sm:px-6">
                <form
                    onSubmit={handleSubmit}
                    className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-ink-900/95 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition focus-within:border-signal/40 focus-within:shadow-[0_0_0_1px_rgba(201,242,122,0.12),0_20px_60px_rgba(0,0,0,0.4)]"
                >
                    <div className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-2">
                        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-faint">
                            Prompt
                        </span>
                        <span
                            className={`font-mono text-[10px] tabular-nums ${
                                message.length >= MAX_MESSAGE_LENGTH
                                    ? "text-red-300"
                                    : "text-faint"
                            }`}
                            title={`Messages can contain up to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters`}
                        >
                            {message.length.toLocaleString()} /{" "}
                            {MAX_MESSAGE_LENGTH.toLocaleString()}
                        </span>
                    </div>

                    <div className="px-3 pt-2 sm:px-4">
                        <textarea
                            ref={inputRef}
                            rows={1}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything, paste notes, or import a PDF..."
                            aria-label="Message"
                            maxLength={MAX_MESSAGE_LENGTH}
                            disabled={loading || isImportingPdf}
                            className="max-h-48 min-h-12 w-full resize-none overflow-y-auto bg-transparent px-1 py-2 text-sm leading-7 text-chalk outline-none placeholder:text-faint disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
                        />

                        {pdfStatus && (
                            <div
                                aria-live="polite"
                                className={`mb-2 flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[11px] leading-4 ${
                                    pdfStatus.status === "error"
                                        ? "border-red-400/25 bg-red-500/10 text-red-200"
                                        : pdfStatus.status === "success"
                                          ? "border-signal/30 bg-signal/5 text-signal"
                                          : "border-line bg-ink-800 text-mist"
                                }`}
                            >
                                {pdfStatus.status === "reading" && (
                                    <span className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line-bright border-t-signal" />
                                )}
                                <span className="min-w-0 flex-1 break-words">
                                    {pdfStatus.status === "reading" ? (
                                        <>
                                            <span className="font-semibold">
                                                Reading {pdfStatus.fileName}
                                            </span>{" "}
                                            {pdfStatus.page > 0 &&
                                                pdfStatus.totalPages > 0 && (
                                                    <span className="ml-1 text-faint">
                                                        page {pdfStatus.page} of{" "}
                                                        {pdfStatus.totalPages}
                                                    </span>
                                                )}
                                        </>
                                    ) : pdfStatus.status === "success" ? (
                                        <>
                                            <span className="font-semibold">
                                                Imported {pdfStatus.fileName}
                                            </span>{" "}
                                            <span className="ml-1">
                                                {pdfStatus.chars.toLocaleString()}{" "}
                                                characters from{" "}
                                                {pdfStatus.pagesRead}{" "}
                                                {pdfStatus.pagesRead === 1
                                                    ? "page"
                                                    : "pages"}
                                                {pdfStatus.pageCount >
                                                pdfStatus.pagesRead
                                                    ? ` of ${pdfStatus.pageCount}`
                                                    : ""}
                                                .
                                            </span>{" "}
                                            {pdfStatus.truncated && (
                                                <span className="ml-1">
                                                    {pdfStatus.charLimitHit
                                                        ? "Text was shortened to fit the message limit."
                                                        : `Only the first ${pdfStatus.pagesRead} pages were read.`}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-semibold">
                                                {pdfStatus.fileName}:
                                            </span>{" "}
                                            {pdfStatus.message}
                                        </>
                                    )}
                                </span>
                                {pdfStatus.status !== "reading" && (
                                    <button
                                        type="button"
                                        onClick={() => setPdfStatus(null)}
                                        aria-label="Dismiss PDF import status"
                                        title="Dismiss"
                                        className="shrink-0 rounded p-0.5 text-current opacity-70 transition hover:opacity-100"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-line/60 px-3 py-2.5 sm:px-4">
                        <input
                            ref={pdfInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handlePdfSelected}
                            disabled={loading || isImportingPdf}
                            tabIndex={-1}
                            aria-label="Choose a PDF file"
                            className="sr-only"
                        />
                        <button
                            type="button"
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={loading || isImportingPdf}
                            aria-label="Import PDF"
                            title="Import text from a text-based PDF (processed in your browser)"
                            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-mist transition hover:border-line-bright hover:text-chalk disabled:cursor-not-allowed disabled:opacity-50"
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
                                    strokeWidth={1.8}
                                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                                />
                            </svg>
                            <span className="hidden sm:inline">
                                {isImportingPdf ? "Reading" : "PDF"}
                            </span>
                        </button>

                        <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-ink-800 py-1 pl-2 pr-1">
                            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                                Lang
                            </span>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                disabled={loading}
                                aria-label="Output language"
                                title="Output language"
                                className="shrink-0 cursor-pointer bg-transparent text-[11px] text-mist outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {LANGUAGE_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-ink-800 py-1 pl-2 pr-1">
                            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                                Output
                            </span>
                            <select
                                value={outputType}
                                onChange={(e) => {
                                    const nextType = e.target.value;
                                    setOutputType(nextType);

                                    if (nextType !== "diagram") {
                                        setDiagramType("auto");
                                    }
                                }}
                                disabled={loading}
                                aria-label="Output type"
                                title="Output type"
                                className="shrink-0 cursor-pointer bg-transparent text-[11px] text-mist outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {OUTPUT_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {outputType === "diagram" && (
                            <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-ink-800 py-1 pl-2 pr-1">
                                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                                    Diagram
                                </span>
                                <select
                                    value={diagramType}
                                    onChange={(e) =>
                                        setDiagramType(e.target.value)
                                    }
                                    disabled={loading}
                                    aria-label="Diagram type"
                                    title="Diagram type"
                                    className="shrink-0 cursor-pointer bg-transparent text-[11px] text-mist outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {DIAGRAM_OPTIONS.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        <button
                            type="submit"
                            disabled={
                                !message.trim() ||
                                loading ||
                                isImportingPdf
                            }
                            className="ml-auto flex items-center gap-2 rounded-lg bg-signal px-3.5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-signal-dim disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {loading ? "Sending" : "Send"}
                            <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 12h16m0 0l-6-6m6 6l-6 6"
                                />
                            </svg>
                        </button>
                    </div>
                </form>

                <div className="mx-auto mt-3 flex max-w-3xl flex-col gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-faint sm:flex-row sm:items-center sm:justify-between">
                    <span>
                        Enter to send · Shift+Enter newline · / to focus
                    </span>
                    <span>PDF file stays local</span>
                </div>
            </div>

            {isDraggingPdf && (
                <div className="drop-overlay pointer-events-none absolute inset-3 z-40 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-signal/60 bg-ink-950/85 px-6 text-center backdrop-blur-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-signal/30 bg-signal/10 text-signal">
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
                                strokeWidth={1.8}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                    </div>
                    <p className="mt-3 font-display text-lg font-semibold text-chalk">
                        Drop to import PDF
                    </p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                        Text is extracted locally, then added to your prompt
                    </p>
                </div>
            )}
        </div>
    );
}

export default Chat;
