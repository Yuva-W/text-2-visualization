# Text 2 Visualization

Text 2 Visualization is an MCA major project that turns unstructured text, code, data, and questions from any subject into explanations and rendered visuals. It accepts prompts in English, Hindi, and Kannada. Students can ask about history, science, mathematics, business, literature, or programming and get a clear answer, with a chart, Mermaid diagram, table, or step-by-step animation when a visual genuinely helps. Code explanations can also be explored line by line, run through a real client-side Python tracer, opened in a what-if Trace Studio, raced against a second algorithm, turned into an interactive quiz, and tracked in an anonymous progress dashboard. The model returns a validated JSON object and the React frontend renders it; static visuals can be exported.

## Features

- **Regional-language prompts** – write prompts in English, Hindi, or Kannada. The language is detected automatically and can be overridden from the composer. Titles, summaries, chart labels, diagram nodes, tables, animation captions, quiz content, and trace captions are localized while JSON contracts stay stable.
- **Subject-aware intent detection** – the model decides whether the answer is best delivered as text, chart, diagram, table, or animation. It may include a visual without an explicit request when that clearly improves the explanation, and the chosen type is shown in the UI.
- **Explicit output picker** – the composer can request Auto, Explain, Chart, Diagram, Table, or Animation. Diagram can be narrowed to flowchart, sequence, mind map, timeline, state diagram, ER, class, Gantt chart, or journey map. The requested output type is rechecked on the server before the response is accepted.
- **Explanation plus visuals** – paste code, notes, data, or a process description and get a clear answer; a visual is added automatically when it helps. Ask for a specific visual explicitly, or use action buttons to change an existing visual, generate a quiz, or ask for a focused learning follow-up: simplify, give an example, common mistakes, or analogy.
- **Workbench UI** – a responsive dark workbench with an interactive capability deck in the empty state, a collapsible sidebar that becomes a mobile drawer, drag-and-drop PDF import, jump-to-latest, `/` and `Ctrl/⌘ K` composer focus, and reduced-motion support.
- **PDF text import** – import a text-based PDF from the composer. PDF.js extracts selectable text locally in the browser, inserts it into the message box for review, and never uploads the file. Imports are capped at 10 MB, 50 pages, and the 40,000-character message limit. Scanned or image-only PDFs need OCR before import.
- **Line/range code help** – rendered code blocks support line selection and an **Explain line** action. Shift-click extends the selection to a range. The selected line(s) and the surrounding snippet are sent as a text-only follow-up, so the answer stays focused.
- **Real Python tracing** – Python code blocks can be run locally with **Real trace**, which opens **Trace Studio**. Pyodide runs the snippet in a classic Web Worker while `sys.settrace` records line events, local values, call-stack snapshots, and tree/linked-list/graph state. The studio turns real execution into an inspectable timeline with array, stack, queue, DP-table, tree, linked-list, graph, and call-stack views. It also adds a what-if sandbox with editable top-level literal inputs, up to six rerun snapshots, comparison/write/call metrics, and an algorithm race that runs two snippets against the same inputs on a shared playback timeline. The first run downloads the runtime from jsDelivr; execution is capped at 600 events and 45 seconds, and snippets longer than 30 non-empty lines are rejected.
- **Interactive quizzes** – generate a multiple-choice quiz from any assistant explanation, answer it in the chat, and get server-side grading with per-question feedback. The default is 3 questions; the API accepts 3–5. The answer key stays on the server until an attempt is submitted. Quizzes can be retaken or regenerated.
- **Anonymous progress dashboard** – quiz attempts are associated with a random session ID stored in `localStorage` rather than an account. The dashboard shows quizzes taken, average and best scores, topic breakdowns, weak concepts, and recent attempts.
- **Charts** – bar, line, and pie charts rendered with Recharts, with an in-browser chart-type switcher.
- **Diagrams** – flowcharts, sequence diagrams, mind maps, timelines, state diagrams, ER diagrams, class diagrams, Gantt charts, and journey maps rendered from Mermaid source. Wide timelines and Gantt charts keep their intrinsic width and scroll horizontally so labels stay legible.
- **Tables** – structured comparison tables from unstructured notes.
- **Animated walkthroughs** – model-generated code explanations render as an animated array with compare/swap/sorted highlights, active pseudocode lines, and a variable watch. Process explanations for workflows, science cycles, or historical sequences render as a Mermaid flowchart with the current node highlighted. Both include play/pause, step controls, a scrubber, and speed selection.
- **Schema validation and retry** – model output is validated with Zod. If it is malformed, the validation error is sent back to the model once for a corrected response.
- **Conversation history** – previous messages and visualizations are sent to the model, so follow-ups like "make it a pie chart" or "add a payment node" work.
- **Persistence** – assistant messages store both text and their visualization object in MongoDB; quiz attempts are stored separately for progress.
- **Export** – charts and diagrams as SVG or PNG, tables as CSV.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS 4 |
| PDF text extraction | PDF.js (`pdfjs-dist`) in the browser |
| Client-side Python | Pyodide 0.26.4 in a classic Web Worker |
| Charts | Recharts |
| Diagrams | Mermaid |
| Backend | Node.js, Express 5 |
| Model | Groq (default `openai/gpt-oss-20b`) |
| Validation | Zod |
| Database | MongoDB with Mongoose |

## Project structure

```text
backend/
  server.js
  src/
    app.js
    config/db.js
    models/Thread.js
    models/Quiz.js
    models/QuizAttempt.js
    routes/chat.js
    routes/quiz.js
    schemas/visualization.js
    schemas/quiz.js
    services/aiService.js
frontend/
  src/
    components/
      CapabilityDeck.jsx
      Chat.jsx
      Sidebar.jsx
      Sidebar.css
      ChartView.jsx
      DiagramView.jsx
      TableView.jsx
      VisualizationPanel.jsx
      MessageActions.jsx
      AnimationView.jsx
      AlgorithmStage.jsx
      CodeBlock.jsx
      MarkdownMessage.jsx
      QuizCard.jsx
      ProgressModal.jsx
      RealTracePanel.jsx
      TraceCodePanel.jsx
      TraceFrameCard.jsx
      TraceStage.jsx
      TraceStudioPanel.jsx
    context/ChatContext.jsx
    services/api.js
    utils/export.js
    utils/limits.js
    utils/pdfText.js
    utils/pdfText.test.js
    utils/pythonTrace.js
    utils/pythonTrace.test.js
    utils/session.js
    workers/pythonTraceWorker.js
```

## Getting started

### 1. Configure the backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
# edit .env with your MongoDB URI and Groq API key
npm run dev
```

Required environment variables:

| Variable | Description |
| --- | --- |
| `PORT` | Express port (the frontend proxy expects `8000`) |
| `MONGO_URI` | MongoDB connection string |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | Optional model override (default `openai/gpt-oss-20b`) |

### 2. Start the frontend

The frontend requires Node.js 22.13 or newer; `pdfjs-dist` 6 declares that engine range.

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies `/threads`, `/chat`, `/quiz`, and `/progress` to `http://localhost:8000`.

For a deployed build, set `VITE_API_URL` to the backend origin before running `npm run build` (see `frontend/.env.example`). When it is empty, requests stay relative and rely on the Vite proxy during development.

Frontend checks:

```powershell
npm run lint
npm test
npm run build
```

The trace and PDF utilities use Node's built-in test runner, so no additional test dependency is required.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/threads` | List threads, newest first |
| `GET` | `/threads/:threadId` | Fetch one thread with messages |
| `DELETE` | `/threads/:threadId` | Delete a thread |
| `POST` | `/chat` | Send `{ threadId, message, language?, visualType?, diagramType? }` and receive a structured visualization |
| `POST` | `/quiz` | Generate a quiz from an assistant message |
| `POST` | `/quiz/:quizId/attempt` | Grade and store quiz answers |
| `GET` | `/progress?sessionId=...` | Load anonymous quiz progress |

`language` is optional and accepts `auto` (default), `en`, `hi`, or `kn`. `visualType` accepts `auto`, `text`, `chart`, `diagram`, `table`, or `animation`. `diagramType` accepts `auto`, `flowchart`, `sequence`, `mindmap`, `timeline`, `state`, `er`, `class`, `gantt`, or `journey` and is only valid with `visualType: "diagram"`. Messages can be up to 40,000 characters, which leaves room for pasted code. Conversation history is capped at the last 20 messages and an 80,000-character context budget.

Example response from `POST /chat`:

```json
{
  "reply": "Revenue grew from Q1 to Q3 before dipping in Q4.",
  "visualization": {
    "type": "chart",
    "language": "en",
    "title": "Quarterly Revenue",
    "summary": "Revenue grew from Q1 to Q3 before dipping in Q4.",
    "chart": {
      "chartType": "bar",
      "xLabel": "Quarter",
      "yLabel": "Revenue (USD thousands)",
      "series": [
        {
          "name": "Revenue",
          "data": [
            { "label": "Q1", "value": 120 },
            { "label": "Q2", "value": 150 },
            { "label": "Q3", "value": 190 },
            { "label": "Q4", "value": 170 }
          ]
        }
      ]
    }
  },
  "model": "openai/gpt-oss-20b"
}
```

An animation response uses `type: "animation"` and one of two payloads:

```json
{
  "type": "animation",
  "language": "en",
  "title": "Bubble Sort Walkthrough",
  "summary": "Bubble sort compares adjacent values and swaps them until the array is ordered.",
  "animation": {
    "animationType": "algorithm",
    "code": ["for j = 0 to n-2", "  if a[j] > a[j+1]", "    swap a[j], a[j+1]"],
    "frames": [
      {
        "caption": "Initial array before sorting.",
        "array": [5, 3, 8, 1],
        "codeLine": 1
      },
      {
        "caption": "Compare 5 and 3; they are out of order.",
        "array": [5, 3, 8, 1],
        "highlights": { "compare": [0, 1] },
        "codeLine": 2
      }
    ]
  }
}
```

For process animations, `animationType` is `"process"`, the payload includes a Mermaid flowchart, and each frame references one or more node IDs to highlight. Animation playback is interactive only; charts and diagrams keep SVG/PNG export and tables keep CSV export.

### Quiz API

Generate a quiz from a stored assistant explanation:

```http
POST /quiz
Content-Type: application/json

{
  "threadId": "thread-id",
  "messageIndex": 1,
  "sessionId": "browser-session-id",
  "language": "en",
  "count": 3
}
```

The response intentionally omits the answer key:

```json
{
  "quiz": {
    "quizId": "uuid",
    "title": "Bubble Sort Quiz",
    "topic": "Sorting Algorithm",
    "language": "en",
    "questions": [
      {
        "index": 0,
        "prompt": "What does the inner loop compare?",
        "options": ["Every pair", "Adjacent pairs in the unsorted part", "Only the first item", "The whole array"],
        "concept": "loop bounds"
      }
    ]
  }
}
```

Submit answers with one zero-based option index per question:

```http
POST /quiz/:quizId/attempt
Content-Type: application/json

{ "sessionId": "browser-session-id", "answers": [1, 2, 1] }
```

Grading reveals the correct indexes and explanations only after submission:

```json
{
  "attemptId": "uuid",
  "score": 2,
  "total": 3,
  "results": [
    {
      "index": 0,
      "prompt": "What does the inner loop compare?",
      "selectedIndex": 1,
      "correct": true,
      "correctIndex": 1,
      "explanation": "The inner loop stops before the sorted tail.",
      "concept": "loop bounds"
    }
  ]
}
```

`GET /progress?sessionId=...` returns `totalAttempts`, `averagePercent`, `bestPercent`, up to eight `topics`, up to five `weakConcepts`, and the ten most recent attempts. The session ID is generated in the browser and stored in `localStorage`; it is not an account.

### Real Python tracing

The **Real trace** action on a Python code block opens **Trace Studio**. It runs the snippet in a browser Web Worker with Pyodide and builds the timeline from actual execution, not model output. The runtime is loaded from `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/`, so the first run needs network access. The trace run itself stays in the browser; the tracer does not send the snippet to the backend.

### What-if sandbox

- Top-level literal assignments such as `arr = [5, 3, 8, 1]`, `n = 10`, or `name = "Ada"` become editable inputs. Expressions such as `n = len(arr)` stay in the code editor instead of becoming an input.
- **Edit code** exposes the source. **Run trace** reruns the current code with the current input values, and the run history keeps the last six traces so two input setups can be compared.
- Input overrides are applied in the worker by rewriting only the matching top-level assignment expressions. Each replacement is validated with `ast.literal_eval`, preserves the original line count, and leaves the rest of the snippet untouched.
- The metrics strip shows captured steps, comparisons, writes, calls, and elapsed interpreter time. Comparisons are counted from executed `if`/`elif`/`while` branch lines; writes are counted from changes to the focused array or DP matrix; calls come from increases in call-stack depth. Treat these as approximate operation counts, not a formal complexity proof. A truncated trace is marked and should not be used for a fair race comparison.

### Structures and views

Trace Studio can switch between these views at any step:

| View | What it shows |
| --- | --- |
| Array bars | Numeric arrays with compare/swap/active/sorted highlights |
| Stack | Primitive values with the top at the last position |
| Queue | Primitive values with the front at the first position |
| DP table | A list-of-lists matrix with changed cells highlighted |
| Tree | A snapshot of a node object with `left`/`right` or `children` links |
| Linked list | A snapshot of nodes connected through `next` |
| Graph | A circular graph layout from a dictionary adjacency list or edge list |
| Call stack | The Python call stack at the current event |

The **Focus** selector pins the variable to inspect when a snippet contains more than one array or structure. Each step also keeps up to eight simple variables and a call-stack snapshot in the side panel. Tree, linked-list, and graph snapshots are read from live Python objects; they are not inferred from the model's explanation.

### Algorithm race

Switch to **Algorithm race** to run the current snippet as Algorithm A and a second snippet as Algorithm B. Both use the same input overrides, share one playback timeline, and show metrics side by side. The default presets are bubble sort, insertion sort, and selection sort. Because the worker allows one trace at a time, A runs first and B runs second; the race is a comparison of captured traces, not a simultaneous execution. If one trace is shorter, its card stays on its final frame while the other continues.

Tracing is intentionally bounded:

- Up to 30 non-empty source lines per snippet.
- Up to 600 traced events; the response is sampled to at most 22 steps plus an initial frame.
- A 180-second first-run limit for downloading and loading the Pyodide runtime, then a 45-second execution timeout. The worker is terminated when either limit is hit.
- The main animated numeric array and the stack/queue sequence are capped at 20 items; the stack view shows the last 12 entries and the queue view shows the first 16. Up to 8 simple variables are shown per step.
- Standard Python only; code that waits for `input()`, performs long-running network access, or depends on extra packages is not supported.
- One trace request can be active at a time in the tab. Closing a loading trace cancels its worker.
- Input overrides only work for top-level literal assignments. To change a computed value, edit the code instead.

Trace Studio labels its captions and metric names in the selected output language where translations are available, while the surrounding player controls and application chrome remain in English.

A text explanation can carry an optional suggestion for the next learning step:

```json
{
  "type": "text",
  "language": "en",
  "title": "Bubble Sort Explained",
  "summary": "**What it does:** Sorts an array by repeatedly swapping adjacent values that are out of order. **How it works:** Compare each adjacent pair, swap them when the left value is larger, and repeat until no swaps remain. **Complexity:** O(n²) time and O(1) extra space.",
  "suggestion": {
    "label": "Animate this code",
    "prompt": "Animate the execution of this bubble sort code step by step",
    "reason": "An animation makes the swaps easier to follow."
  }
}
```

## Demo prompts

| Goal | Prompt |
| --- | --- |
| Code explanation | Explain this code line by line: `for i in range(n): if a[i] > a[i + 1]: swap(a[i], a[i + 1])` |
| Science explanation | Explain photosynthesis for a 10th-grade student. Use a visual if it helps. |
| History timeline | Give me a timeline of the main events of the French Revolution. |
| Project schedule | Create a Gantt chart for a two-week study plan: revision Jan 1–6, algebra Jan 3–8, biology Jan 7–12. |
| Code → visual | Paste code, then click **Visualize** (or type "Visualize this") |
| Explicit visual type | Choose **Table**, **Chart**, **Diagram**, or **Animation** in the composer before sending |
| Line/range explanation | Paste or ask for Python code, select a line (shift-click for a range) in the code block, then click **Explain line(s)** |
| Real Python trace | Click **Real trace** on a Python code block |
| What-if rerun | Open **Trace Studio**, change the detected `arr` input, and click **Run trace** |
| Algorithm race | Open **Algorithm race**, pick insertion sort, and click **Run race** |
| Quiz follow-up | Click **Quiz me** on an explanation, answer, and submit |
| Progress dashboard | Click **Progress** in the sidebar after submitting a quiz |
| English algorithm animation | Animate bubble sort on `[5, 3, 8, 1]` step by step |
| Hindi algorithm animation | बबल सॉर्ट को `[5, 3, 8, 1]` पर चरण-दर-चरण एनिमेशन में समझाएँ |
| Hindi chart | त्रैमासिक बिक्री को बार चार्ट में दिखाएँ: Q1 120, Q2 150, Q3 190, Q4 170 |
| Kannada process animation | ಆನ್‌ಲೈನ್ ಪಾವತಿ ಪ್ರಕ್ರಿಯೆಯನ್ನು ಹಂತ ಹಂತವಾಗಿ ಅನಿಮೇಷನ್‌ನಲ್ಲಿ ತೋರಿಸಿ |
| Hindi follow-up | इसे पाई चार्ट में बदलें |

## Reliability layer

1. The system prompt fixes the JSON contract and gives subject-aware rules for choosing an answer type and visualization.
2. The model is asked for JSON mode.
3. The response is parsed and validated against `backend/src/schemas/visualization.js`.
4. When the user selects a language explicitly, the service verifies the returned language code, script, animation captions, and suggestion labels/reasons. A mismatch is treated as invalid output and retried.
5. When the user requests a specific visual type, the prompt carries that requirement and the service checks the returned type again before accepting it. A forced type is retried once, then falls back to a text explanation when the source cannot support a valid visual.
6. Quiz generation checks the requested count and the language's script; the answer key and per-question explanations stay server-side until an attempt is graded.
7. Trace Studio timelines are built from bounded Pyodide events into the same animation shape used by model-generated animations; they are not model-generated. What-if overrides are validated before execution, and race metrics are computed from captured events, not from the model.
8. On failure, the raw response plus the validation error is sent back to the model for one retry.
9. If the attempts and the forced-visual text fallback all fail, the API returns `502` instead of rendering broken data.

## Limitations

- Tamil is not enabled yet; the supported UI languages are English, Hindi, and Kannada.
- The model can still misread ambiguous text, choose a less suitable visualization, or add a visual where a plain answer would be enough; select **Explain** to force text.
- Charts depend on numbers that are present in the input; the model is instructed not to invent data.
- Wide timelines and Gantt charts scroll inside their panel on narrow screens instead of shrinking into unreadable labels.
- PDF import extracts selectable text only. It runs in the browser and does not upload or store the file. Image-only/scanned PDFs require OCR first, encrypted PDFs must be unlocked, and imports stop at 10 MB, 50 pages, or the 40,000-character message limit. Layout, tables, and columns may come through as plain reading-order text.
- Standard animations are model-generated walkthroughs. **Trace Studio** is different: it executes Python locally, but it is limited to short standard-library snippets without interactive input or network access.
- Trace Studio needs the Pyodide CDN on first use, supports at most 30 non-empty lines, captures at most 600 events, allows up to 180 seconds for the first runtime load, and times out after 45 seconds of execution. A snippet that hits either limit or is blocked returns an error instead of a timeline.
- Comparison, write, and call counts are derived from executed branch lines and observed state changes, so they are approximate. They are useful for comparing two short traces, not for proving asymptotic complexity.
- What-if overrides only replace top-level literal assignments; arbitrary expression edits require the code editor. Algorithm races run sequentially because one trace can be active at a time.
- A strict Content-Security-Policy must allow the Pyodide CDN and WebAssembly (`script-src`/`worker-src` and `wasm-unsafe-eval`, depending on the policy) for real tracing to work. PDF import also needs the app's same-origin PDF.js worker (`worker-src 'self'`).
- Very large inputs are capped by the 40,000-character message limit. Conversation history is limited to the newest 20 messages within an 80,000-character budget.
- Mermaid syntax errors are shown with the raw source so the user can retry.
- Animation playback is interactive only; GIF/video export is not implemented.
- Regional-language glyphs in SVG/PNG exports use the fonts installed on the viewing machine, with Nirmala UI and Noto Sans font stacks as fallbacks.
- Authentication and per-user threads are not implemented yet. Quiz progress is anonymous and browser-session scoped; clearing site storage starts a new progress history.

## Roadmap

- Add Tamil and more regional languages
- JWT authentication with per-user threads and migration of anonymous quiz progress
- PPTX export using the review template
- Evaluation harness with 30–50 prompts across two Groq models, including regional-language and animation prompts
- Small user study measuring comprehension, cognitive load, and engagement against a ChatGPT + Mermaid baseline
- Expand the anonymous dashboard with follow-up usage, per-concept trends, and teacher-facing summaries
- Add trace export/permalink, user-selected sampling windows, step-into/over call controls, and structure snapshots for nested or custom node classes
- Report diagrams generated with the tool itself
