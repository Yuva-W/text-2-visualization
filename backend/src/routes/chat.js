import express from "express";
import getResponse, { getModelName } from "../services/aiService.js";
import Thread from "./../models/Thread.js";

const router = express.Router();

const MAX_TITLE_LENGTH = 60;
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_CHARS = 80000;
const MAX_MESSAGE_LENGTH = 40000;
const SUPPORTED_LANGUAGES = new Set(["auto", "en", "hi", "kn"]);
const SUPPORTED_VISUAL_TYPES = new Set([
    "auto",
    "text",
    "chart",
    "diagram",
    "table",
    "animation",
]);
const SUPPORTED_DIAGRAM_TYPES = new Set([
    "auto",
    "flowchart",
    "sequence",
    "mindmap",
    "timeline",
    "state",
    "er",
    "class",
    "gantt",
    "journey",
]);

function truncateTitle(message) {
    const firstLine =
        message
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean) || message;
    const clean = firstLine.replace(/\s+/g, " ").trim();

    if (/^```/.test(clean)) {
        return "Code explanation";
    }

    if (clean.length <= MAX_TITLE_LENGTH) {
        return clean;
    }

    return `${clean.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

function toPlainVisualization(visualization) {
    if (!visualization) return null;

    if (typeof visualization.toObject === "function") {
        return visualization.toObject();
    }

    return visualization;
}

function buildHistory(messages) {
    const history = [];
    let totalChars = 0;

    for (
        let index = messages.length - 1;
        index >= 0 && history.length < MAX_HISTORY_MESSAGES;
        index -= 1
    ) {
        const message = messages[index];
        const visualization = toPlainVisualization(message.visualization);
        const content =
            message.role === "assistant" && visualization
                ? JSON.stringify(visualization)
                : message.content || "";

        // Always keep the newest message, then stop once the context budget
        // is reached. This protects long code pastes from overflowing the
        // model context.
        if (
            history.length > 0 &&
            totalChars + content.length > MAX_HISTORY_CHARS
        ) {
            break;
        }

        history.push({ role: message.role, content });
        totalChars += content.length;
    }

    return history.reverse();
}

// Get all threads
router.get("/threads", async (req, res) => {
    try {
        const threads = await Thread.find({}).sort({ updatedAt: -1 });
        res.status(200).json(threads);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "failed to fetch threads" });
    }
});

// Get single thread
router.get("/threads/:threadId", async (req, res) => {
    const { threadId } = req.params;

    try {
        const thread = await Thread.findOne({ threadId });

        if (!thread) {
            return res.status(404).json({
                error: "No thread found.!",
            });
        }

        return res.status(200).json(thread);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "failed to fetch thread" });
    }
});

// Delete Single thread
router.delete("/threads/:threadId", async (req, res) => {
    const { threadId } = req.params;

    try {
        const thread = await Thread.findOneAndDelete({ threadId });

        if (!thread) {
            return res.status(404).json({ error: "thread not found" });
        }

        return res.status(200).json({
            success: true,
            message: "deleted.",
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "failed to delete thread" });
    }
});

// Create new chat / continue an existing one
router.post("/chat", async (req, res) => {
    const {
        threadId,
        message,
        language = "auto",
        visualType = "auto",
        diagramType = "auto",
    } = req.body || {};

    if (typeof threadId !== "string" || !threadId.trim()) {
        return res.status(400).json({ error: "threadId is required" });
    }

    if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "message is required" });
    }

    if (typeof language !== "string" || !SUPPORTED_LANGUAGES.has(language)) {
        return res.status(400).json({
            error: "language must be one of auto, en, hi, kn",
        });
    }

    if (
        typeof visualType !== "string" ||
        !SUPPORTED_VISUAL_TYPES.has(visualType)
    ) {
        return res.status(400).json({
            error: "visualType must be one of auto, text, chart, diagram, table, animation",
        });
    }

    if (
        typeof diagramType !== "string" ||
        !SUPPORTED_DIAGRAM_TYPES.has(diagramType)
    ) {
        return res.status(400).json({
            error: "diagramType must be one of auto, flowchart, sequence, mindmap, timeline, state, er, class, gantt, journey",
        });
    }

    if (diagramType !== "auto" && visualType !== "diagram") {
        return res.status(400).json({
            error: "diagramType can only be used when visualType is diagram",
        });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({
            error: `message must be at most ${MAX_MESSAGE_LENGTH} characters; paste the relevant code or a smaller section`,
        });
    }

    const trimmedMessage = message.trim();

    try {
        let thread = await Thread.findOne({ threadId });

        if (!thread) {
            // create new thread
            thread = new Thread({
                threadId,
                title: truncateTitle(trimmedMessage),
                messages: [
                    {
                        role: "user",
                        content: trimmedMessage,
                    },
                ],
            });
        } else {
            thread.messages.push({
                role: "user",
                content: trimmedMessage,
            });
        }

        // Persist the user message before calling the model. If the model
        // fails, the browser and database still agree on what was sent and
        // the thread can be continued or reloaded.
        thread.updatedAt = new Date();
        await thread.save();

        const history = buildHistory(thread.messages);
        const visualization = await getResponse(history, {
            language,
            visualType,
            diagramType,
        });
        const reply = visualization.summary;

        thread.messages.push({
            role: "assistant",
            content: reply,
            visualization,
        });
        thread.updatedAt = new Date();

        await thread.save();

        return res.status(200).json({
            reply,
            visualization,
            model: getModelName(),
        });
    } catch (error) {
        console.log(error);
        return res.status(502).json({
            error:
                error.message ||
                "failed to generate a visualization from the model",
        });
    }
});

export default router;
