import mongoose from "mongoose";

const quizQuestionSchema = new mongoose.Schema(
    {
        prompt: { type: String, required: true },
        options: { type: [String], required: true },
        correctIndex: { type: Number, required: true },
        explanation: { type: String, required: true },
        concept: { type: String, default: "" },
    },
    { _id: false }
);

const quizSchema = new mongoose.Schema({
    quizId: {
        type: String,
        unique: true,
        required: true,
    },
    threadId: {
        type: String,
        required: true,
        index: true,
    },
    messageIndex: {
        type: Number,
        default: null,
    },
    sessionId: {
        type: String,
        required: true,
        index: true,
        maxlength: 100,
    },
    language: {
        type: String,
        enum: ["en", "hi", "kn"],
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    topic: {
        type: String,
        default: "",
    },
    questions: {
        type: [quizQuestionSchema],
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Quiz = mongoose.models.quiz || mongoose.model("quiz", quizSchema);

export default Quiz;
