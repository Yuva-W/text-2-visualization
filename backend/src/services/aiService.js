import { OpenAI } from "openai";
import {
    formatValidationError,
    visualizationSchema,
} from "../schemas/visualization.js";
import { quizSchema } from "../schemas/quiz.js";

const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    // Do not let a stalled upstream request hang the HTTP request forever.
    // Retries are handled below so validation errors can be repaired.
    timeout: 90000,
    maxRetries: 0,
});

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const MAX_ATTEMPTS = 2;
const MAX_OUTPUT_TOKENS = 8192;

const LANGUAGE_NAMES = {
    en: "English",
    hi: "Hindi",
    kn: "Kannada",
};

const LANGUAGE_SCRIPTS = {
    en: "Latin",
    hi: "Devanagari",
    kn: "Kannada",
};

const LANGUAGE_SCRIPT_PATTERNS = {
    hi: /[\u0900-\u097F]/,
    kn: /[\u0C80-\u0CFF]/,
};

const DIAGRAM_KEYWORDS = {
    flowchart: "flowchart TD or flowchart LR",
    sequence: "sequenceDiagram",
    mindmap: "mindmap",
    timeline: "timeline",
    state: "stateDiagram-v2",
    er: "erDiagram",
    class: "classDiagram",
    gantt: "gantt",
    journey: "journey",
};

function buildVisualOverride(visualType, diagramType) {
    if (!visualType || visualType === "auto") {
        return "";
    }

    if (visualType === "text") {
        return `VISUAL TYPE OVERRIDE - HIGH PRIORITY:
The student explicitly selected "Explain only". Return "type": "text" with the full answer in "summary". Do not include a chart, diagram, table, or animation payload. Do not return a visual even if the message mentions one.`;
    }

    if (visualType === "chart") {
        return `VISUAL TYPE OVERRIDE - HIGH PRIORITY:
The student explicitly selected "Chart". Return "type": "chart" with a complete valid chart payload. Choose bar, line, or pie based on the data. This selection is itself an explicit visual request. The chart must contain at least one series with at least one data point. If the content truly has no numeric data that can support a faithful chart, return "type": "text" and explain what data is missing instead of inventing values or returning an empty chart.`;
    }

    if (visualType === "diagram") {
        const requestedType =
            diagramType && diagramType !== "auto" ? diagramType : null;
        const subtypeInstruction = requestedType
            ? `Use "diagramType": "${requestedType}" and start the Mermaid source with ${DIAGRAM_KEYWORDS[requestedType]}.`
            : "Choose the most suitable diagramType and start the Mermaid source with its matching keyword.";

        return `VISUAL TYPE OVERRIDE - HIGH PRIORITY:
The student explicitly selected "Diagram". Return "type": "diagram" with a complete valid diagram payload containing non-empty Mermaid source. ${subtypeInstruction} This selection is itself an explicit visual request. Do not return an animation. If the requested diagram type cannot represent the content, use "type": "text" and explain the limitation instead of returning invalid Mermaid.`;
    }

    if (visualType === "table") {
        return `VISUAL TYPE OVERRIDE - HIGH PRIORITY:
The student explicitly selected "Table". Return "type": "table" with a complete valid table payload. Use exact values from the source. This selection is itself an explicit visual request. The table must contain at least one column and at least one row; never return an empty row list. If the content cannot be represented as a useful table, return "type": "text" and explain why.`;
    }

    if (visualType === "animation") {
        return `VISUAL TYPE OVERRIDE - HIGH PRIORITY:
The student explicitly selected "Animation". Return "type": "animation" with a complete valid animation payload containing at least 2 frames. Choose "animationType": "algorithm" for code, arrays, sorting, searching, or execution steps, and "process" for workflows, procedures, cycles, or other ordered stages. This selection is itself an explicit visual request. If the content cannot be animated faithfully, return "type": "text" and explain what is missing instead of inventing execution steps or returning an empty animation.`;
    }

    return "";
}

function buildSystemPrompt(
    language = "auto",
    visualType = "auto",
    diagramType = "auto"
) {
    const sections = [];

    if (language && language !== "auto" && LANGUAGE_NAMES[language]) {
        const languageName = LANGUAGE_NAMES[language];
        const scriptName = LANGUAGE_SCRIPTS[language];
        const scriptNote =
            language === "en" ? "" : ` (${scriptName} script)`;

        sections.push(`LANGUAGE OVERRIDE - HIGHEST PRIORITY:
The user selected ${languageName}. The JSON must have "language": "${language}", and every user-facing string must be written in ${languageName}${scriptNote} even if the user's message is in another language. This applies to the title, summary, chart axis and category labels, table cells, Mermaid node labels, animation captions, and suggestion labels and reasons. Do not return prose in a different language.`);
    }

    const visualOverride = buildVisualOverride(visualType, diagramType);

    if (visualOverride) {
        sections.push(visualOverride);
    }

    sections.push(SYSTEM_PROMPT);

    if (language && language !== "auto" && LANGUAGE_NAMES[language]) {
        sections.push(
            `FINAL LANGUAGE CHECK: Set "language" to "${language}" and write every user-facing string in ${LANGUAGE_NAMES[language]}${language === "en" ? "" : ` (${LANGUAGE_SCRIPTS[language]} script)`}.`
        );
    }

    if (visualType && visualType !== "auto") {
        if (visualType === "text") {
            sections.push(
                `FINAL OUTPUT TYPE CHECK - HIGHEST PRIORITY: The student selected "Explain only" in the UI. Set "type" to "text" and do not return any visual payload, even if the message mentions a chart, diagram, table, or animation.`
            );
        } else if (visualType === "diagram") {
            const requestedType =
                diagramType && diagramType !== "auto" ? diagramType : null;
            const diagramCheck = requestedType
                ? ` Set "diagramType" to "${requestedType}" and start the Mermaid source with ${DIAGRAM_KEYWORDS[requestedType]}.`
                : "";

            sections.push(
                `FINAL OUTPUT TYPE CHECK - HIGHEST PRIORITY: The student selected "Diagram" in the UI. This selection is an explicit visual request. Set "type" to "diagram" and include a valid diagram payload.${diagramCheck} Do not return "type": "text" merely because the user did not type a visual verb.`
            );
        } else {
            sections.push(
                `FINAL OUTPUT TYPE CHECK - HIGHEST PRIORITY: The student selected "${visualType}" in the UI. This selection is an explicit visual request. Set "type" to "${visualType}" and include its complete payload. Do not return "type": "text" merely because the user did not type a visual verb.`
            );
        }
    }

    return sections.join("\n\n");
}

const QUIZ_SYSTEM_PROMPT = `You create short multiple-choice quizzes for students from an explanation of any learning topic—code, data, a process, a concept, an event, or a text.

Always reply with exactly one JSON object. Do not wrap it in markdown fences and do not add prose before or after it.

The JSON object has this shape:
{
  "language": "en" | "hi" | "kn",
  "title": "short quiz title",
  "topic": "short topic label",
  "questions": [
    {
      "prompt": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctIndex": 0,
      "explanation": "why the correct answer is right and why a common wrong option is wrong",
      "concept": "short concept or skill label"
    }
  ]
}

Quiz rules:
- Create exactly the requested number of questions. The default is 3 and the allowed range is 3-5.
- Every question must have exactly 4 options, exactly one correct answer, and a zero-based "correctIndex".
- Test understanding, not trivia. Do not use trick questions. Cover different concepts from the explanation.
- Make distractors plausible and mutually exclusive. Do not use "all of the above" or "none of the above".
- Keep each question and explanation short enough to read on a phone.
- Base every question only on the provided explanation and source. Do not invent facts, numbers, or code behavior.
- Do not reveal the answer inside the question or the options.
- Keep code identifiers, formulas, and widely used technical terms unchanged when translating would reduce clarity.

Language rules:
- Use the same language as the explanation. Set "language" to "en", "hi", or "kn".
- Write the title, topic, question prompts, options, and explanations in that language.
- If a language override is appended, use that language and set "language" to its code regardless of the explanation.
- Write Hindi in Devanagari script and Kannada in Kannada script.
- Return only the JSON object, with no markdown fences or extra prose.`;

const SYSTEM_PROMPT = `You are Text 2 Visualization, a general learning assistant for students of any subject. You explain ideas clearly and choose a faithful visual when it makes the answer easier to understand.

Always reply with exactly one JSON object. Do not wrap it in markdown fences and do not add prose before or after it.

The JSON object has this shape:
{
  "type": "chart" | "diagram" | "table" | "text" | "animation",
  "language": "en" | "hi" | "kn",
  "title": "short descriptive title",
  "summary": "1-3 sentence explanation of the visual, or the full answer when type is text",
  "chart": {
    "chartType": "bar" | "line" | "pie",
    "xLabel": "axis label",
    "yLabel": "axis label",
    "series": [
      { "name": "series name", "data": [ { "label": "category", "value": 12.5 } ] }
    ]
  },
  "diagram": {
    "diagramType": "flowchart" | "sequence" | "mindmap" | "timeline" | "state" | "er" | "class" | "gantt" | "journey",
    "mermaid": "valid Mermaid source without markdown fences"
  },
  "table": {
    "columns": ["Column A", "Column B"],
    "rows": [["cell 1", "cell 2"]]
  },
  "animation": {
    "animationType": "algorithm" | "process",
    "code": ["line 1 of pseudocode", "line 2"],
    "mermaid": "flowchart TD ...",
    "frames": [
      {
        "caption": "what happens in this step",
        "codeLine": 2,
        "array": [5, 3, 8, 1],
        "highlights": { "compare": [0, 1], "swap": [], "active": [], "sorted": [3] },
        "variables": { "i": 0, "swapped": true },
        "nodeIds": ["A", "B"]
      }
    ]
  },
  "suggestion": {
    "label": "short action label",
    "prompt": "complete follow-up request",
    "reason": "why this visual helps"
  }
}

Rules:
- Answer the student's actual question first. "summary" must stand on its own even when a visual is included.
- Choose the response type that best fits the content. You may include a visual without an explicit visual request when it clearly improves the answer; do not add one merely for decoration.
- Include only the payload that matches "type". Omit the other payload fields.
- Use "text" for conversation, definitions, opinions, short factual answers, clarifications, or when no faithful visual or structured data is possible.
- Use "chart" for quantitative data: comparisons, trends, distributions, or part-to-whole values. Use bar for categories, line for change over time, and pie only for a single-series part-to-whole.
- Use "table" when exact facts, multiple attributes, dates, vocabulary, or structured details matter more than a picture.
- Use "diagram" for relationships and structures: processes, cause and effect, hierarchies, cycles, timelines, state changes, classifications, and entity relationships. Choose the best subtype and start "mermaid" with its matching keyword:
  - flowchart -> flowchart TD/LR for processes, cause-effect chains, and decisions
  - sequence -> sequenceDiagram for interactions between actors over time
  - mindmap -> mindmap for concepts, themes, and relationships
  - timeline -> timeline for chronological events
  - state -> stateDiagram-v2 for stages, cycles, or state transitions
  - er -> erDiagram for data entities and relationships
  - class -> classDiagram for object-oriented structures
  - gantt -> gantt for schedules and project phases
  - journey -> journey for user or customer experience steps
- Use "animation" only when ordered execution or a step-by-step process is the point and at least 3 faithful stages can be shown. Choose "algorithm" for code/array execution and "process" for other procedures or workflows. Prefer a static diagram when sequence is not essential.
- If the student explicitly selects or requests a visual type, honor it. If that type cannot represent the content faithfully, return "text" and explain what is missing instead of inventing data or steps.
- A code snippet, dataset, article, or process description is not by itself a visual request, but it may justify a visual when the visual genuinely helps.
- If the student asks to explain an existing visual, choose "text" even when a visual type is mentioned.

Subject guidance:
- History and humanities: prefer timeline, cause-effect flowchart, mindmap, or comparison table.
- Science and engineering: prefer process/cycle diagrams, state diagrams, tables, or annotated flowcharts.
- Mathematics and statistics: prefer line/bar charts for supplied numeric data, tables for exact values, and text for derivations.
- Business and economics: prefer charts, flowcharts, journey maps, gantt charts, or comparison tables.
- Literature and languages: prefer character/theme mindmaps, timelines, or comparison tables.
- Programming and algorithms: prefer text explanations; use algorithm animation when execution order is the point.

Student interaction rules:
- For code explanations, structure "summary" in Markdown: what the code does, how it works step by step, time and space complexity, and edge cases or common mistakes. For other subjects, use a clear explanation with headings, examples, or steps as appropriate.
- If the student asks for both an explanation and a visual, choose the best visual and use "summary" for the explanation.
- Optional "suggestion": include at most one when the current response is "text" and a visual would genuinely help. "label" is a short button label, "prompt" is a complete follow-up request that can be sent on its own, and "reason" is one short sentence for the student. Omit it or set it to null when no visual is needed.
- When the student asks for a quiz or to check their understanding, choose "text" and give 3 short questions with an answer key at the end.

Language rules:
- Detect the language of the user's latest message. Hindi or romanized Hindi (Hinglish) means "hi". Kannada or romanized Kannada means "kn". English or any other language means "en".
- Set "language" to the language used for every user-facing string.
- Write title, summary, chart labels, table cells, diagram node labels, animation captions, and suggestion labels/reasons in that language. Keep JSON keys and enum values in English.
- Write Hindi in Devanagari script and Kannada in Kannada script, even when the user typed Latin script.
- Keep numbers, code, variable names, node IDs, and widely used technical terms unchanged when translating them would reduce clarity.
- If a language override is appended to this prompt, use that language for all user-facing strings and set "language" to its code, regardless of the input language.
- Follow-up edits keep the language of the earlier visualization unless the user asks to switch languages.

Animation rules:
- "animationType": "algorithm" for code, sorting, searching, arrays, recursion, or any step-by-step execution trace. Include "code" with 3-24 short pseudocode lines. Include the complete current "array" on every frame when an array is involved; use 4-16 numbers. Use zero-based indexes in "highlights". Use "sorted" for indexes already in their final position. Include "codeLine" and "variables" when they help a student follow the trace.
- "animationType": "process" for business workflows, science cycles, historical sequences, protocols, and procedures. Include a valid "mermaid" flowchart with explicit node IDs, then reference only those IDs in "nodeIds". Do not include "array", "codeLine", or "variables" for process animations.
- Every frame needs a short "caption". The first frame shows the initial state. Use 3-20 frames and never invent execution steps. A trace must be the real execution of the shown code or process.
- When the user asks to animate an earlier diagram or process, reuse its nodes, labels, and language.
- Mermaid labels that contain spaces, punctuation, or regional scripts must be quoted, for example: A["ग्राहक योजना चुनता है"] and C{"Approved?"}. Never put unescaped double quotes inside a label.

Other rules:
- Never invent numbers, dates, names, citations, entities, events, or execution steps that are not present in the user's text, prior conversation, or reliable knowledge. If a visual would require invented facts, use "text" and explain what is missing.
- Do not claim false precision. Keep qualitative diagrams qualitative, and only chart numbers that are supplied or reliably derived by a stated rule.
- If the answer depends on recent or current information that may have changed, say that it may be outdated instead of inventing facts.
- For pie charts include exactly one series. For all charts, prefer at most 12 data points per series and keep labels short.
- Table cells must be strings. Do not include a header row in "rows".
- If the user asks to modify, restyle, or change the type or language of an earlier visualization, return the complete updated JSON using the earlier visualization in the conversation history.
- Keep "summary" focused. Use the full code explanation structure for code; keep other summaries clear and factual.

Example chart:
{"type":"chart","language":"en","title":"Quarterly Revenue","summary":"Revenue grew from Q1 to Q3 before dipping in Q4.","chart":{"chartType":"bar","xLabel":"Quarter","yLabel":"Revenue (USD thousands)","series":[{"name":"Revenue","data":[{"label":"Q1","value":120},{"label":"Q2","value":150},{"label":"Q3","value":190},{"label":"Q4","value":170}]}]}}

Example Hindi chart:
{"type":"chart","language":"hi","title":"त्रैमासिक बिक्री","summary":"पहली तिमाही से तीसरी तिमाही तक बिक्री बढ़ी, फिर चौथी तिमाही में घटी।","chart":{"chartType":"bar","xLabel":"तिमाही","yLabel":"बिक्री (हज़ार में)","series":[{"name":"बिक्री","data":[{"label":"तिमाही 1","value":120},{"label":"तिमाही 2","value":150},{"label":"तिमाही 3","value":190},{"label":"तिमाही 4","value":170}]}]}}

Example Kannada table:
{"type":"table","language":"kn","title":"ಯೋಜನೆಗಳ ಹೋಲಿಕೆ","summary":"ಯೋಜನೆಗಳು ಮುಖ್ಯವಾಗಿ ಬೆಲೆ ಮತ್ತು ಸಂಗ್ರಹಣೆಯಲ್ಲಿ ಭಿನ್ನವಾಗಿವೆ.","table":{"columns":["ಯೋಜನೆ","ಬೆಲೆ","ಸಂಗ್ರಹಣೆ"],"rows":[["ಉಚಿತ","₹0","2 GB"],["ಪ್ರೊ","₹12","100 GB"],["ಟೀಮ್","₹30","1 TB"]]}}

Example Kannada chart:
{"type":"chart","language":"kn","title":"ತ್ರೈಮಾಸಿಕ ಆದಾಯ","summary":"ಮೊದಲ ತ್ರೈಮಾಸಿಕದಿಂದ ಮೂರನೇ ತ್ರೈಮಾಸಿಕದವರೆಗೆ ಆದಾಯ ಹೆಚ್ಚಿದೆ, ನಂತರ ಕೊನೆಯ ತ್ರೈಮಾಸಿಕದಲ್ಲಿ ಇಳಿದಿದೆ.","chart":{"chartType":"bar","xLabel":"ತ್ರೈಮಾಸಿಕ","yLabel":"ಆದಾಯ (ಸಾವಿರದಲ್ಲಿ)","series":[{"name":"ಆದಾಯ","data":[{"label":"ತ್ರೈಮಾಸಿಕ 1","value":120},{"label":"ತ್ರೈಮಾಸಿಕ 2","value":150},{"label":"ತ್ರೈಮಾಸಿಕ 3","value":190},{"label":"ತ್ರೈಮಾಸಿಕ 4","value":170}]}]}}

Example diagram:
{"type":"diagram","language":"en","title":"Payment Flow","summary":"A customer pays through the gateway and receives a confirmation.","diagram":{"diagramType":"flowchart","mermaid":"flowchart TD\\n  A[Customer selects plan] --> B[Gateway authorizes payment]\\n  B --> C{Approved?}\\n  C -->|Yes| D[Provision account]\\n  C -->|No| E[Show failure message]"}}

Example timeline:
{"type":"diagram","language":"en","title":"Timeline of the French Revolution","summary":"The Revolution began with a political and financial crisis, ended the monarchy, and eventually led to Napoleon's rise.","diagram":{"diagramType":"timeline","mermaid":"timeline\\n  title French Revolution\\n  1789 : Estates-General meets\\n  1789 : Storming of the Bastille\\n  1791 : Constitutional monarchy\\n  1793 : Reign of Terror begins\\n  1799 : Napoleon takes power"}}

Example table:
{"type":"table","language":"en","title":"Plan Comparison","summary":"The three plans differ mainly in price and storage.","table":{"columns":["Plan","Price","Storage"],"rows":[["Free","$0","2 GB"],["Pro","$12","100 GB"],["Team","$30","1 TB"]]}}

Example text:
{"type":"text","language":"en","title":"Welcome","summary":"Ask about any subject—history, science, math, code, business, or everyday ideas. I will give a clear answer and add a chart, diagram, timeline, table, or walkthrough when it helps."}

Example code explanation:
{"type":"text","language":"en","title":"Bubble Sort Explained","summary":"**What it does:** Sorts an array by repeatedly swapping adjacent values that are out of order. **How it works:** Compare each adjacent pair, swap them when the left value is larger, and repeat until no swaps remain. **Complexity:** O(n²) time and O(1) extra space.","suggestion":{"label":"Animate this code","prompt":"Animate the execution of this bubble sort code step by step","reason":"An animation makes the swaps easier to follow."}}

Example algorithm animation:
{"type":"animation","language":"en","title":"Bubble Sort Walkthrough","summary":"Bubble sort compares adjacent values and swaps them until the array is ordered.","animation":{"animationType":"algorithm","code":["for i = 0 to n-2","  for j = 0 to n-2-i","    if a[j] > a[j+1]","      swap a[j], a[j+1]"],"frames":[{"caption":"Initial array before sorting.","array":[5,3,8,1],"codeLine":1},{"caption":"Compare 5 and 3; they are out of order.","array":[5,3,8,1],"highlights":{"compare":[0,1]},"codeLine":3},{"caption":"Swap 5 and 3.","array":[3,5,8,1],"highlights":{"swap":[0,1]},"codeLine":4},{"caption":"Compare 8 and 1; they are out of order.","array":[3,5,8,1],"highlights":{"compare":[2,3]},"codeLine":3},{"caption":"Swap 8 and 1; 8 reaches its sorted position.","array":[3,5,1,8],"highlights":{"swap":[2,3],"sorted":[3]},"codeLine":4}]}}

Example process animation:
{"type":"animation","language":"en","title":"Payment Process Walkthrough","summary":"The payment flow checks authorization before provisioning an account.","animation":{"animationType":"process","mermaid":"flowchart TD\\n  A[Customer selects plan] --> B[Gateway authorizes]\\n  B --> C{Approved?}\\n  C -->|Yes| D[Provision account]\\n  C -->|No| E[Show failure message]","frames":[{"caption":"The customer selects a plan.","nodeIds":["A"]},{"caption":"The payment gateway authorizes the card.","nodeIds":["B"]},{"caption":"When approved, the account is provisioned.","nodeIds":["C","D"]},{"caption":"When declined, the customer sees a failure message.","nodeIds":["C","E"]}]}}`;

function assertRequestedLanguage(visualization, language) {
    if (!language || language === "auto") {
        return;
    }

    if (visualization.language !== language) {
        throw new Error(
            `the requested language is "${language}", but the JSON used "${visualization.language}"`
        );
    }

    const pattern = LANGUAGE_SCRIPT_PATTERNS[language];

    if (!pattern) {
        return;
    }

    const neededFields = [visualization.title, visualization.summary];

    if (neededFields.some((value) => !pattern.test(value))) {
        throw new Error(
            `the title and summary must be written in ${LANGUAGE_NAMES[language]} script`
        );
    }

    if (
        visualization.animation?.frames.some(
            (frame) => !pattern.test(frame.caption)
        )
    ) {
        throw new Error(
            `every animation caption must be written in ${LANGUAGE_NAMES[language]} script`
        );
    }

    if (visualization.suggestion) {
        const suggestionFields = [
            visualization.suggestion.label,
            visualization.suggestion.reason,
        ].filter(Boolean);

        if (suggestionFields.some((value) => !pattern.test(value))) {
            throw new Error(
                `the suggestion label and reason must be written in ${LANGUAGE_NAMES[language]} script`
            );
        }
    }
}

function assertRequestedVisualType(visualization, visualType, diagramType) {
    if (!visualType || visualType === "auto") {
        return;
    }

    // The prompt explicitly allows the model to return an explanation when
    // the source cannot support the requested visual. Accept that fallback
    // instead of turning a missing-data case into a 502.
    if (visualization.type === "text") {
        return;
    }

    if (visualization.type !== visualType) {
        throw new Error(
            `the student selected "${visualType}", but the JSON used "${visualization.type}"`
        );
    }

    if (
        visualType === "diagram" &&
        diagramType &&
        diagramType !== "auto" &&
        visualization.diagram?.diagramType !== diagramType
    ) {
        throw new Error(
            `the student selected the "${diagramType}" diagram type, but the JSON used "${visualization.diagram?.diagramType}"`
        );
    }
}

function extractJson(raw) {
    if (typeof raw !== "string") {
        throw new Error("The model returned an empty response");
    }

    const withoutFences = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    try {
        return JSON.parse(withoutFences);
    } catch {
        const start = withoutFences.indexOf("{");
        const end = withoutFences.lastIndexOf("}");

        if (start === -1 || end === -1 || end <= start) {
            throw new Error("No JSON object found in the model response");
        }

        return JSON.parse(withoutFences.slice(start, end + 1));
    }
}

async function requestCompletion(messages, useJsonMode) {
    const completion = await client.chat.completions.create({
        model: MODEL,
        messages,
        temperature: 0.2,
        max_tokens: MAX_OUTPUT_TOKENS,
        ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
    });

    const raw = completion.choices?.[0]?.message?.content;

    if (!raw) {
        throw new Error("The model returned an empty response");
    }

    return raw;
}

function buildQuizSystemPrompt(language = "auto") {
    if (!language || language === "auto" || !LANGUAGE_NAMES[language]) {
        return QUIZ_SYSTEM_PROMPT;
    }

    const languageName = LANGUAGE_NAMES[language];
    const scriptName = LANGUAGE_SCRIPTS[language];
    const scriptNote = language === "en" ? "" : ` (${scriptName} script)`;

    return `LANGUAGE OVERRIDE - HIGHEST PRIORITY:
The quiz must use ${languageName}${scriptNote}. The JSON must have "language": "${language}", and the title, topic, every question prompt, every option, and every explanation must be written in ${languageName}${scriptNote} even if the explanation is in another language. Keep code identifiers and formulas unchanged when translating them would reduce clarity.

${QUIZ_SYSTEM_PROMPT}

FINAL LANGUAGE CHECK: Set "language" to "${language}" and write every user-facing quiz string in ${languageName}${scriptNote}.`;
}

function assertQuizLanguage(quiz, language) {
    if (!language || language === "auto") {
        return;
    }

    if (quiz.language !== language) {
        throw new Error(
            `the requested quiz language is "${language}", but the JSON used "${quiz.language}"`
        );
    }

    const pattern = LANGUAGE_SCRIPT_PATTERNS[language];

    if (!pattern) {
        return;
    }

    const titleFields = [quiz.title, ...quiz.questions.map((q) => q.prompt)];

    if (titleFields.some((value) => !pattern.test(value))) {
        throw new Error(
            `the quiz title and question prompts must be written in ${LANGUAGE_NAMES[language]} script`
        );
    }

    if (quiz.questions.some((q) => !pattern.test(q.explanation))) {
        throw new Error(
            `every quiz explanation must be written in ${LANGUAGE_NAMES[language]} script`
        );
    }
}

function truncateText(value, maxLength) {
    const text = String(value || "");

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength)}\n...[truncated]`;
}

async function generateQuiz({
    explanation,
    sourceQuestion = "",
    language = "auto",
    count = 3,
}) {
    const messages = [
        {
            role: "system",
            content: buildQuizSystemPrompt(language),
        },
        {
            role: "user",
            content: `Source question or code:
${truncateText(sourceQuestion, 8000) || "(not provided)"}

Explanation to quiz:
${truncateText(explanation, 14000)}

Create exactly ${count} multiple-choice questions from this explanation. Use exactly 4 options per question and return only the JSON object.`,
        },
    ];

    let lastError = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        let raw;

        try {
            raw = await requestCompletion(messages, true);
        } catch (requestError) {
            // Some Groq models reject response_format; fall back to prompt-only JSON.
            if (attempt > 0) {
                throw requestError;
            }

            lastError = requestError;
            raw = await requestCompletion(messages, false);
        }

        try {
            const parsed = extractJson(raw);
            const quiz = quizSchema.parse(parsed);

            assertQuizLanguage(quiz, language);

            if (quiz.questions.length !== count) {
                throw new Error(
                    `expected ${count} quiz questions, received ${quiz.questions.length}`
                );
            }

            return quiz;
        } catch (error) {
            lastError = error;

            messages.push(
                { role: "assistant", content: raw },
                {
                    role: "user",
                    content: `That response was invalid: ${formatValidationError(error)}. Return only a corrected JSON object that follows the required quiz schema.`,
                }
            );
        }
    }

    const error = new Error(
        "The model did not return a valid quiz after two attempts"
    );
    error.cause = lastError;
    throw error;
}

async function getResponse(history, options = {}, allowTextFallback = true) {
    const messages = [
        {
            role: "system",
            content: buildSystemPrompt(
                options.language,
                options.visualType,
                options.diagramType
            ),
        },
        ...history,
    ];

    let lastError = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        let raw;

        try {
            raw = await requestCompletion(messages, true);
        } catch (requestError) {
            // Some Groq models reject response_format; fall back to prompt-only JSON.
            if (attempt > 0) {
                throw requestError;
            }

            lastError = requestError;
            raw = await requestCompletion(messages, false);
        }

        try {
            const parsed = extractJson(raw);
            const visualization = visualizationSchema.parse(parsed);

            assertRequestedLanguage(visualization, options.language);
            assertRequestedVisualType(
                visualization,
                options.visualType,
                options.diagramType
            );

            return visualization;
        } catch (error) {
            lastError = error;

            messages.push(
                { role: "assistant", content: raw },
                {
                    role: "user",
                    content: `That response was invalid: ${formatValidationError(error)}. Return only a corrected JSON object that follows the required schema.${
                        options.visualType &&
                        options.visualType !== "auto" &&
                        options.visualType !== "text"
                            ? ` If the content cannot support a valid ${options.visualType}, return a valid "text" visualization that explains what data is missing.`
                            : ""
                    }`,
                }
            );
        }
    }

    // A forced visual can fail twice when the source has no usable data.
    // Retry once as a plain explanation so the user still gets an answer.
    if (
        allowTextFallback &&
        options.visualType &&
        options.visualType !== "auto" &&
        options.visualType !== "text"
    ) {
        try {
            return await getResponse(
                history,
                {
                    ...options,
                    visualType: "text",
                    diagramType: "auto",
                },
                false
            );
        } catch (fallbackError) {
            lastError = fallbackError;
        }
    }

    const error = new Error(
        "The model did not return a valid visualization after retrying"
    );
    error.cause = lastError;
    throw error;
}

export function getModelName() {
    return MODEL;
}

export { generateQuiz };
export default getResponse;
