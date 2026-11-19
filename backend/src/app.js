import express from 'express';
import "dotenv/config";
import cors from 'cors';
import chat from "./routes/chat.js";
import quiz from "./routes/quiz.js";

const app = express();

// Messages can be up to 40,000 characters. Regional-language text uses up to
// three bytes per character, so the default 100 KB body limit rejects valid
// inputs. Keep the JSON limit aligned with the route-level character cap.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cors());

app.use("/", chat);
app.use("/", quiz);

// Keep API errors JSON so the frontend can always show a useful message
// instead of failing while parsing Express's default HTML error page.
app.use((req, res) => {
    res.status(404).json({ error: "route not found" });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const status = error.status || error.statusCode || 500;
    let message = "internal server error";

    if (status === 413) {
        message =
            "request body is too large; messages can be up to 40000 characters";
    } else if (status === 400) {
        message = "invalid JSON request body";
    }

    if (status >= 500) {
        console.error(error);
    }

    return res.status(status).json({ error: message });
});

export default app;