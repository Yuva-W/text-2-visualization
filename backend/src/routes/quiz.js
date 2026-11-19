import express from "express";
import { randomUUID } from "node:crypto";
import { generateQuiz } from "../services/aiService.js";
import Thread from "../models/Thread.js";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";

const router = express.Router();

const SUPPORTED_LANGUAGES = new Set(["auto", "en", "hi", "kn"]);
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 5;
const MAX_SESSION_ID_LENGTH = 100;

function isValidSessionId(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= MAX_SESSION_ID_LENGTH
    );
}

function findQuizContext(thread, messageIndex) {
    let index = Number.isInteger(messageIndex)
        ? messageIndex
        : thread.messages.length - 1;

    if (index < 0 || index >= thread.messages.length) {
        index = thread.messages.length - 1;
    }

    if (thread.messages[index]?.role !== "assistant") {
        for (let i = index; i >= 0; i -= 1) {
            if (thread.messages[i]?.role === "assistant") {
                index = i;
                break;
            }
        }
    }

    const target = thread.messages[index];

    if (!target || target.role !== "assistant") {
        const error = new Error(
            "an assistant explanation is required before generating a quiz"
        );
        error.status = 400;
        throw error;
    }

    const sourceQuestion =
        [...thread.messages.slice(0, index)]
            .reverse()
            .find((message) => message.role === "user")?.content || "";

    const visual = target.visualization
        ? JSON.stringify(target.visualization)
        : "";

    return {
        messageIndex: index,
        explanation: `${target.content || ""}\n\n${visual}`.trim(),
        sourceQuestion,
        language: target.visualization?.language || "auto",
    };
}

function toPublicQuiz(quiz) {
    return {
        quizId: quiz.quizId,
        title: quiz.title,
        topic: quiz.topic || quiz.title,
        language: quiz.language,
        questions: quiz.questions.map((question, index) => ({
            index,
            prompt: question.prompt,
            options: question.options,
            concept: question.concept || quiz.topic || quiz.title,
        })),
    };
}

// Generate a multiple-choice quiz from a previous explanation.
router.post("/quiz", async (req, res) => {
    const {
        threadId,
        messageIndex,
        sessionId,
        language = "auto",
        count = 3,
    } = req.body || {};

    if (typeof threadId !== "string" || !threadId.trim()) {
        return res.status(400).json({ error: "threadId is required" });
    }

    if (!isValidSessionId(sessionId)) {
        return res.status(400).json({
            error: `sessionId is required and must be at most ${MAX_SESSION_ID_LENGTH} characters`,
        });
    }

    if (typeof language !== "string" || !SUPPORTED_LANGUAGES.has(language)) {
        return res.status(400).json({
            error: "language must be one of auto, en, hi, kn",
        });
    }

    if (
        !Number.isInteger(count) ||
        count < MIN_QUESTIONS ||
        count > MAX_QUESTIONS
    ) {
        return res.status(400).json({
            error: `count must be an integer between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}`,
        });
    }

    try {
        const thread = await Thread.findOne({ threadId });

        if (!thread) {
            return res.status(404).json({ error: "thread not found" });
        }

        const context = findQuizContext(thread, messageIndex);
        const quizLanguage =
            language === "auto" ? context.language : language;
        const quiz = await generateQuiz({
            explanation: context.explanation,
            sourceQuestion: context.sourceQuestion,
            language: quizLanguage,
            count,
        });

        const quizId = randomUUID();
        const quizDoc = await Quiz.create({
            quizId,
            threadId,
            messageIndex: context.messageIndex,
            sessionId: sessionId.trim(),
            language: quiz.language,
            title: quiz.title,
            topic: quiz.topic || quiz.title,
            questions: quiz.questions.map((question) => ({
                ...question,
                concept: question.concept || quiz.topic || quiz.title,
            })),
        });

        return res.status(200).json({
            quiz: toPublicQuiz(quizDoc),
        });
    } catch (error) {
        console.log(error);
        return res.status(error.status || 502).json({
            error: error.message || "failed to generate a quiz",
        });
    }
});

// Grade and store an attempt. The answer key stays on the server.
router.post("/quiz/:quizId/attempt", async (req, res) => {
    const { quizId } = req.params;
    const { sessionId, answers } = req.body || {};

    if (!isValidSessionId(sessionId)) {
        return res.status(400).json({
            error: `sessionId is required and must be at most ${MAX_SESSION_ID_LENGTH} characters`,
        });
    }

    try {
        const quiz = await Quiz.findOne({ quizId });

        if (!quiz) {
            return res.status(404).json({ error: "quiz not found" });
        }

        if (
            !Array.isArray(answers) ||
            answers.length !== quiz.questions.length
        ) {
            return res.status(400).json({
                error: `answers must contain one selection for each of the ${quiz.questions.length} questions`,
            });
        }

        const invalidAnswer = answers.some(
            (answer, index) =>
                !Number.isInteger(answer) ||
                answer < 0 ||
                answer >= quiz.questions[index].options.length
        );

        if (invalidAnswer) {
            return res.status(400).json({
                error: "each answer must be a valid option index",
            });
        }

        const results = quiz.questions.map((question, index) => {
            const selectedIndex = answers[index];
            const correct = selectedIndex === question.correctIndex;

            return {
                index,
                prompt: question.prompt,
                selectedIndex,
                correct,
                correctIndex: question.correctIndex,
                explanation: question.explanation,
                concept: question.concept || quiz.topic || quiz.title,
            };
        });

        const score = results.filter((result) => result.correct).length;
        const attemptId = randomUUID();

        await QuizAttempt.create({
            attemptId,
            quizId,
            sessionId: sessionId.trim(),
            quizTitle: quiz.title,
            topic: quiz.topic || quiz.title,
            language: quiz.language,
            score,
            total: quiz.questions.length,
            results: results.map((result) => ({
                concept: result.concept,
                correct: result.correct,
            })),
        });

        return res.status(200).json({
            attemptId,
            score,
            total: quiz.questions.length,
            results,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "failed to grade the quiz" });
    }
});

// Session-scoped learning progress for the anonymous dashboard.
router.get("/progress", async (req, res) => {
    const { sessionId } = req.query;

    if (!isValidSessionId(sessionId)) {
        return res.status(400).json({
            error: `sessionId is required and must be at most ${MAX_SESSION_ID_LENGTH} characters`,
        });
    }

    try {
        const attempts = await QuizAttempt.find({ sessionId: sessionId.trim() })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        const totalAttempts = attempts.length;
        const scoreTotal = attempts.reduce(
            (sum, attempt) => sum + attempt.score,
            0
        );
        const questionTotal = attempts.reduce(
            (sum, attempt) => sum + attempt.total,
            0
        );
        const averagePercent = questionTotal
            ? Math.round((scoreTotal / questionTotal) * 100)
            : 0;
        const bestPercent = attempts.length
            ? Math.max(
                  ...attempts.map((attempt) =>
                      attempt.total
                          ? Math.round(
                                (attempt.score / attempt.total) * 100
                            )
                          : 0
                  )
              )
            : 0;

        const topicMap = new Map();

        for (const attempt of attempts) {
            const key = attempt.topic || attempt.quizTitle || "General";
            const current = topicMap.get(key) || {
                topic: key,
                attempts: 0,
                score: 0,
                total: 0,
            };

            current.attempts += 1;
            current.score += attempt.score;
            current.total += attempt.total;
            topicMap.set(key, current);
        }

        const topics = [...topicMap.values()]
            .map((topic) => ({
                ...topic,
                averagePercent: topic.total
                    ? Math.round((topic.score / topic.total) * 100)
                    : 0,
            }))
            .sort((a, b) => b.attempts - a.attempts)
            .slice(0, 8);

        const conceptMap = new Map();

        for (const attempt of attempts) {
            for (const result of attempt.results || []) {
                const key = result.concept || attempt.topic || "General";
                const current = conceptMap.get(key) || {
                    concept: key,
                    total: 0,
                    correct: 0,
                };

                current.total += 1;
                current.correct += result.correct ? 1 : 0;
                conceptMap.set(key, current);
            }
        }

        const weakConcepts = [...conceptMap.values()]
            .filter(
                (concept) =>
                    concept.total > 0 && concept.correct < concept.total
            )
            .map((concept) => ({
                ...concept,
                accuracy: Math.round(
                    (concept.correct / concept.total) * 100
                ),
            }))
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, 5);

        const recent = attempts.slice(0, 10).map((attempt) => ({
            attemptId: attempt.attemptId,
            quizTitle: attempt.quizTitle,
            topic: attempt.topic,
            language: attempt.language,
            score: attempt.score,
            total: attempt.total,
            createdAt: attempt.createdAt,
        }));

        return res.status(200).json({
            totalAttempts,
            averagePercent,
            bestPercent,
            topics,
            weakConcepts,
            recent,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            error: "failed to load progress",
        });
    }
});

export default router;
