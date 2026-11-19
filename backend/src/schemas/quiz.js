import { z } from "zod";

export const quizQuestionSchema = z.object({
    prompt: z.string().trim().min(5).max(500),
    options: z
        .array(z.string().trim().min(1).max(240))
        .length(4),
    correctIndex: z.coerce.number().int().min(0).max(3),
    explanation: z.string().trim().min(5).max(800),
    concept: z.string().trim().min(1).max(80).optional(),
});

export const quizSchema = z.object({
    language: z.enum(["en", "hi", "kn"]).default("en"),
    title: z.string().trim().min(1).max(160),
    topic: z.string().trim().min(1).max(120).optional(),
    questions: z.array(quizQuestionSchema).min(3).max(5),
});
