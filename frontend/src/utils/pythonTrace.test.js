import assert from "node:assert/strict";
import test from "node:test";
import {
    MAX_TRACE_LINES,
    buildTraceVisualization,
    detectInputs,
    listTraceVariables,
} from "./pythonTrace.js";

test("detectInputs finds editable top-level literals only", () => {
    const inputs = detectInputs(`arr = [5, 3, 8, 1]
n = len(arr)
flag = True
name = "Ada"
if True:
    hidden = 1
`);

    assert.deepEqual(
        inputs.map((input) => input.name),
        ["arr", "flag", "name"]
    );
    assert.equal(inputs[0].value, "[5, 3, 8, 1]");
});

test("buildTraceVisualization computes array metrics and frames", () => {
    const code = `arr = [3, 1, 2]
if arr[0] > arr[1]:
    arr[0], arr[1] = arr[1], arr[0]
`;
    const events = [
        {
            line: 1,
            locals: { arr: [3, 1, 2] },
            callStack: [{ function: "<module>", line: 1 }],
        },
        {
            line: 2,
            locals: { arr: [3, 1, 2] },
            callStack: [{ function: "<module>", line: 2 }],
        },
        {
            line: 3,
            locals: { arr: [1, 3, 2] },
            callStack: [{ function: "<module>", line: 3 }],
        },
    ];

    const visualization = buildTraceVisualization(
        code,
        { events, metrics: { elapsedMs: 2.5 }, truncated: false },
        "en"
    );

    assert.equal(visualization.animation.viewMode, "array");
    assert.equal(visualization.animation.metrics.comparisons, 1);
    assert.equal(visualization.animation.metrics.writes, 2);
    assert.equal(visualization.animation.metrics.lineEvents, 3);
    assert.equal(visualization.animation.metrics.elapsedMs, 2.5);
    assert.ok(visualization.animation.frames.length >= 2);
    assert.deepEqual(
        visualization.animation.frames.at(-1).array,
        [1, 3, 2]
    );
});

test("buildTraceVisualization detects a DP matrix and renders changed cells", () => {
    const code = `dp = [[0, 0], [0, 0]]
dp[0][1] = 5
`;
    const events = [
        { line: 1, locals: { dp: [[0, 0], [0, 0]] } },
        { line: 2, locals: { dp: [[0, 5], [0, 0]] } },
    ];

    const visualization = buildTraceVisualization(code, { events }, "en");
    const frames = visualization.animation.frames;

    assert.equal(visualization.animation.viewMode, "matrix");
    assert.deepEqual(frames.at(-1).matrix.rows, [
        [0, 5],
        [0, 0],
    ]);
    assert.equal(visualization.animation.metrics.writes, 1);
});

test("buildTraceVisualization carries tree, linked-list, graph and call-stack snapshots", () => {
    const tree = {
        name: "root",
        kind: "tree",
        root: {
            label: 4,
            left: { label: 2, left: null, right: null },
            right: { label: 7, left: null, right: null },
        },
    };
    const events = [
        {
            line: 1,
            locals: { root: "<TreeNode>" },
            callStack: [{ function: "<module>", line: 1 }],
            structure: tree,
        },
        {
            line: 2,
            locals: {},
            callStack: [
                { function: "<module>", line: 2 },
                { function: "insert", line: 1 },
            ],
            structure: tree,
        },
    ];

    const visualization = buildTraceVisualization(
        "root = None\ninsert(root)\n",
        { events },
        "en",
        { viewMode: "tree" }
    );

    assert.equal(visualization.animation.viewMode, "tree");
    assert.equal(visualization.animation.frames.at(-1).structure.kind, "tree");
    assert.equal(
        visualization.animation.frames.at(-1).callStack.length,
        2
    );
    assert.deepEqual(
        listTraceVariables(events),
        ["root"]
    );
});

test("buildTraceVisualization starts a tree trace at the first tree snapshot", () => {
    const tree = {
        name: "root",
        kind: "tree",
        root: {
            label: 4,
            left: { label: 2, left: null, right: null },
            right: { label: 7, left: null, right: null },
        },
    };
    const events = [
        {
            line: 1,
            locals: {},
            callStack: [{ function: "<module>", line: 1 }],
            structure: null,
        },
        {
            line: 6,
            locals: { root: "<TreeNode>" },
            callStack: [{ function: "<module>", line: 6 }],
            structure: tree,
        },
    ];

    const visualization = buildTraceVisualization(
        "root = None\nroot = Node(4)\n",
        { events },
        "en"
    );

    assert.equal(visualization.animation.viewMode, "tree");
    assert.equal(visualization.animation.frames[0].structure.kind, "tree");
});

test("buildTraceVisualization supports string stacks and queues", () => {
    const code = `queue = []\nqueue.append("a")\nqueue.append("b")\nqueue.pop(0)\n`;
    const events = [
        { line: 1, locals: { queue: [] } },
        { line: 2, locals: { queue: ["a"] } },
        { line: 3, locals: { queue: ["a", "b"] } },
        { line: 4, locals: { queue: ["b"] } },
    ];

    const visualization = buildTraceVisualization(code, { events }, "en");
    const frames = visualization.animation.frames;

    assert.equal(visualization.animation.viewMode, "queue");
    assert.deepEqual(frames[0].sequence, ["a"]);
    assert.deepEqual(frames.at(-1).sequence, ["b"]);
    assert.equal(frames.at(-1).array, undefined);
    assert.equal(visualization.animation.metrics.writes, 2);
});

test("focus pins one data type instead of falling back to another", () => {
    const code = `arr = [1, 2]\ndp = [[0, 0], [0, 0]]\narr[0] = 5\n`;
    const events = [
        { line: 1, locals: { arr: [1, 2] } },
        { line: 2, locals: { arr: [1, 2], dp: [[0, 0], [0, 0]] } },
        { line: 3, locals: { arr: [5, 2], dp: [[0, 0], [0, 0]] } },
    ];

    const visualization = buildTraceVisualization(
        code,
        { events },
        "en",
        { focusVariable: "arr" }
    );

    assert.equal(visualization.animation.viewMode, "array");
    assert.equal(
        visualization.animation.frames.some((frame) => frame.matrix),
        false
    );
    assert.equal(visualization.animation.metrics.writes, 1);
    assert.deepEqual(
        listTraceVariables(events),
        ["arr", "dp"]
    );
});

test("buildTraceVisualization rejects snippets over the line limit", () => {
    const code = Array.from(
        { length: MAX_TRACE_LINES + 1 },
        (_, index) => `x${index} = ${index}`
    ).join("\n");

    assert.throws(
        () => buildTraceVisualization(code, { events: [] }, "en"),
        /up to 30 non-empty lines/
    );
});
