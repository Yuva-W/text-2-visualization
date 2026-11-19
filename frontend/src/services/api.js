// Vite proxies these routes during development. A deployed build can point at
// a separate backend with VITE_API_URL (for example https://api.example.com).
const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const getThreads = async () => {
    const response = await fetch(`${API_URL}/threads`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to fetch threads");
    }

    return data;
};

const getThread = async (threadId) => {
    const response = await fetch(
        `${API_URL}/threads/${threadId}`
    );
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to fetch thread");
    }

    return data;
};

const deleteThread = async (threadId) => {
    const response = await fetch(
        `${API_URL}/threads/${threadId}`,
        {
            method: "DELETE",
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to delete thread");
    }

    return data;
};

const sendMessage = async (
    threadId,
    message,
    language = "auto",
    options = {}
) => {
    const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            threadId,
            message,
            language,
            visualType: options.visualType || "auto",
            diagramType: options.diagramType || "auto",
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to get AI response");
    }

    return data;
};

const generateQuiz = async ({
    threadId,
    messageIndex,
    sessionId,
    language = "auto",
    count = 3,
}) => {
    const response = await fetch(`${API_URL}/quiz`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            threadId,
            messageIndex,
            sessionId,
            language,
            count,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to generate a quiz");
    }

    return data;
};

const submitQuiz = async (quizId, sessionId, answers) => {
    const response = await fetch(
        `${API_URL}/quiz/${encodeURIComponent(quizId)}/attempt`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ sessionId, answers }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to submit the quiz");
    }

    return data;
};

const getProgress = async (sessionId) => {
    const response = await fetch(
        `${API_URL}/progress?sessionId=${encodeURIComponent(sessionId)}`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to load progress");
    }

    return data;
};

export {
    getThreads,
    getThread,
    deleteThread,
    sendMessage,
    generateQuiz,
    submitQuiz,
    getProgress,
};