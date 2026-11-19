import mongoose from "mongoose";

const quizResultSchema = new mongoose.Schema(
    {
        concept: { type: String, default: "" },
        correct: { type: Boolean, required: true },
    },
    { _id: false }
);

const quizAttemptSchema = new mongoose.Schema({
    attemptId: {
        type: String,
        unique: true,
        required: true,
    },
    quizId: {
        type: String,
        required: true,
        index: true,
    },
    sessionId: {
        type: String,
        required: true,
        index: true,
        maxlength: 100,
    },
    quizTitle: {
        type: String,
        default: "",
    },
    topic: {
        type: String,
        default: "",
    },
    language: {
        type: String,
        enum: ["en", "hi", "kn"],
        default: "en",
    },
    score: {
        type: Number,
        required: true,
    },
    total: {
        type: Number,
        required: true,
    },
    results: {
        type: [quizResultSchema],
        default: [],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const QuizAttempt =
    mongoose.models.quizAttempt ||
    mongoose.model("quizAttempt", quizAttemptSchema);

export default QuizAttempt;
