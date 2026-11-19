import { useEffect, useState } from "react";
import "./Sidebar.css";
import { useThreads, useActiveThread } from "../context/ChatContext.jsx";
import ProgressModal from "./ProgressModal.jsx";

const COLLAPSED_KEY = "t2v.sidebar.collapsed";

function Sidebar() {
    const [progressOpen, setProgressOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => {
        try {
            const stored = window.localStorage.getItem(COLLAPSED_KEY);

            if (stored !== null) return stored === "1";

            return window.matchMedia("(max-width: 900px)").matches;
        } catch {
            return false;
        }
    });
    const { threads, createThread, deleteThread } = useThreads();

    const { activeThreadId, switchThread } = useActiveThread();

    useEffect(() => {
        try {
            window.localStorage.setItem(
                COLLAPSED_KEY,
                collapsed ? "1" : "0"
            );
        } catch {
            // The sidebar remains usable if storage is unavailable.
        }
    }, [collapsed]);

    const handleDeleteThread = async (e, threadId) => {
        e.stopPropagation();

        if (window.confirm("Delete this thread?")) {
            await deleteThread(threadId);
        }
    };

    return (
        <>
            {!collapsed && (
                <button
                    type="button"
                    aria-label="Close sidebar"
                    onClick={() => setCollapsed(true)}
                    className="sidebar-scrim"
                />
            )}

            <aside
                className={`sidebar flex h-full min-h-0 flex-col px-2 py-3 ${
                    collapsed ? "sidebar-collapsed" : ""
                }`}
            >
                {collapsed ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center gap-2">
                        <span
                            title="Text 2 Visualization"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-signal/30 bg-signal/10 text-signal shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
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
                                    d="M4 19V10m5 9V5m5 14v-7m5 7V8"
                                />
                            </svg>
                        </span>

                        <button
                            onClick={createThread}
                            aria-label="New Chat"
                            title="New Chat"
                            className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-signal text-ink-950 transition hover:bg-signal-dim active:scale-95"
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
                                    d="M12 5v14m-7-7h14"
                                />
                            </svg>
                        </button>

                        <button
                            onClick={() => setProgressOpen(true)}
                            aria-label="Progress"
                            title="Progress"
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-ink-800/60 text-glacier transition hover:border-line-bright hover:bg-ink-800 hover:text-chalk active:scale-95"
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
                                    d="M4 19h16M7 16V9m5 7V5m5 11v-4"
                                />
                            </svg>
                        </button>

                        <div className="mt-1 h-px w-7 bg-line/70" />

                        <div className="mt-auto flex flex-col items-center gap-3 pt-3">
                            <span
                                title="Pyodide local trace"
                                className="h-1.5 w-1.5 rounded-full bg-signal/80"
                            />

                            <button
                                onClick={() => setCollapsed(false)}
                                aria-label="Expand sidebar"
                                title="Expand sidebar"
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-ink-800/60 text-faint transition hover:border-line-bright hover:text-chalk active:scale-95"
                            >
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
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2.5 px-2 pb-4 pt-1">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-signal/30 bg-signal/10 text-signal shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
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
                                        d="M4 19V10m5 9V5m5 14v-7m5 7V8"
                                    />
                                </svg>
                            </span>

                            <div className="min-w-0">
                                <p className="font-display truncate text-[15px] font-semibold leading-tight tracking-tight text-chalk">
                                    Text 2 Visualization
                                </p>
                                <p className="brand-sub font-mono text-[8px] uppercase tracking-[0.24em] text-faint">
                                    Visual workbench
                                </p>
                            </div>

                            <button
                                onClick={() => setCollapsed(true)}
                                aria-label="Collapse sidebar"
                                title="Collapse sidebar"
                                className="sidebar-collapse-toggle ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint transition hover:bg-ink-800 hover:text-chalk active:scale-95"
                            >
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
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                            </button>
                        </div>

                        <button
                            onClick={createThread}
                            aria-label="+ New Chat"
                            className="mb-2 flex w-full items-center justify-between rounded-xl bg-signal px-3 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-signal-dim active:scale-[0.99]"
                        >
                            <span className="flex items-center gap-2">
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
                                        d="M12 5v14m-7-7h14"
                                    />
                                </svg>
                                New Chat
                            </span>
                            <span
                                aria-hidden="true"
                                className="font-mono text-[9px] uppercase tracking-[0.14em] opacity-60"
                            >
                                Start
                            </span>
                        </button>

                        <button
                            onClick={() => setProgressOpen(true)}
                            className="mb-4 flex w-full items-center gap-2 rounded-xl border border-line bg-ink-800/60 px-3 py-2 text-sm text-mist transition hover:border-line-bright hover:bg-ink-800 hover:text-chalk active:scale-[0.99]"
                        >
                            <svg
                                className="h-4 w-4 text-glacier"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.8}
                                    d="M4 19h16M7 16V9m5 7V5m5 11v-4"
                                />
                            </svg>
                            Progress
                            <span
                                aria-hidden="true"
                                className="ml-auto font-mono text-[10px] text-faint"
                            >
                                →
                            </span>
                        </button>

                        <div className="mb-4 h-px bg-line/70" />

                        <section className="min-h-0 flex-1 overflow-y-auto">
                            <div className="mb-2 flex items-center justify-between px-2">
                                <h3 className="font-mono text-[9px] uppercase tracking-[0.22em] text-faint">
                                    Threads
                                </h3>
                                <span className="font-mono text-[9px] tabular-nums text-faint">
                                    {String(threads.length).padStart(2, "0")}
                                </span>
                            </div>

                            <div className="space-y-1">
                                {threads.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-line px-3 py-4 text-xs leading-5 text-faint">
                                        No threads yet. Start a workspace and
                                        ask something.
                                    </p>
                                ) : (
                                    threads.map((thread) => {
                                        const isActive =
                                            activeThreadId === thread.threadId;

                                        return (
                                            <div
                                                key={thread.threadId}
                                                className={`group relative flex items-center gap-1 rounded-xl border transition ${
                                                    isActive
                                                        ? "border-line bg-ink-800"
                                                        : "border-transparent hover:border-line/60 hover:bg-ink-800/50"
                                                }`}
                                            >
                                                {isActive && (
                                                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-signal" />
                                                )}

                                                <button
                                                    onClick={() =>
                                                        switchThread(
                                                            thread.threadId
                                                        )
                                                    }
                                                    title={
                                                        thread.title ||
                                                        "New thread"
                                                    }
                                                    className={`min-w-0 flex-1 truncate rounded-xl py-2.5 pl-3 pr-2 text-left text-sm transition ${
                                                        isActive
                                                            ? "text-chalk"
                                                            : "text-mist group-hover:text-chalk"
                                                    }`}
                                                >
                                                    {thread.title ||
                                                        "New thread"}
                                                </button>

                                                <button
                                                    onClick={(e) =>
                                                        handleDeleteThread(
                                                            e,
                                                            thread.threadId
                                                        )
                                                    }
                                                    title="Delete thread"
                                                    aria-label={`Delete ${
                                                        thread.title ||
                                                        "thread"
                                                    }`}
                                                    className="mr-1.5 rounded p-1 text-faint opacity-100 transition hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
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
                                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v12m-6 0h12a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                        />
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </section>

                        <footer className="mt-3 border-t border-line/60 px-2 pt-3">
                            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal/80" />
                                Pyodide local trace
                            </div>
                            <p className="mt-1.5 text-[10px] text-faint/80">
                                English · हिन्दी · ಕನ್ನಡ
                            </p>
                        </footer>
                    </>
                )}
            </aside>

            <ProgressModal
                open={progressOpen}
                onClose={() => setProgressOpen(false)}
            />
        </>
    );
}

export default Sidebar;
