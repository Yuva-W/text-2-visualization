import AlgorithmStage from "./AlgorithmStage.jsx";

function EmptyStage({ children }) {
    return (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-line bg-ink-950 p-6 text-center">
            <p className="max-w-sm text-xs leading-5 text-mist">
                {children}
            </p>
        </div>
    );
}

function StackStage({ values }) {
    const items = Array.isArray(values) ? values : [];

    if (!items.length) {
        return <EmptyStage>This step has no stack contents.</EmptyStage>;
    }

    return (
        <div className="rounded-xl border border-line bg-ink-950 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                Stack · top is the last item
            </p>
            <div className="flex min-h-48 flex-col-reverse items-stretch justify-start gap-1">
                {items.slice(-12).map((value, reverseIndex) => {
                    const index = Math.max(0, items.length - 12) + reverseIndex;
                    const isTop = index === items.length - 1;

                    return (
                        <div
                            key={index}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 font-mono text-xs transition-colors ${
                                isTop
                                    ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                                    : "border-line bg-ink-800 text-mist"
                            }`}
                        >
                            <span className="truncate">{String(value)}</span>
                            <span className="ml-3 shrink-0 text-[10px] text-faint">
                                {isTop ? "top · " : ""}index {index}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function QueueStage({ values }) {
    const items = Array.isArray(values) ? values : [];

    if (!items.length) {
        return <EmptyStage>This step has no queue contents.</EmptyStage>;
    }

    return (
        <div className="rounded-xl border border-line bg-ink-950 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                Queue · front is the first item
            </p>
            <div className="flex min-h-28 items-center gap-2 overflow-x-auto pb-2">
                {items.slice(0, 16).map((value, index) => (
                    <div
                        key={index}
                        className={`flex min-w-16 flex-col items-center rounded-lg border px-3 py-2 font-mono text-xs ${
                            index === 0
                                ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                                : "border-line bg-ink-800 text-mist"
                        }`}
                    >
                        <span className="truncate">{String(value)}</span>
                        <span className="mt-1 text-[9px] text-faint">
                            {index === 0 ? "front" : `index ${index}`}
                        </span>
                    </div>
                ))}
                {items.length > 16 && (
                    <span className="shrink-0 text-[11px] text-faint">
                        +{items.length - 16} more
                    </span>
                )}
            </div>
        </div>
    );
}

function TreeNode({ node }) {
    if (!node) return null;

    const children = Array.isArray(node.children) ? node.children : [];
    const hasChildren = Boolean(node.left || node.right || children.length);

    return (
        <div className="flex flex-col items-center">
            <div
                className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] ${
                    node.truncated
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                        : "border-line-bright bg-ink-700 text-chalk"
                }`}
            >
                {String(node.label)}
            </div>
            {hasChildren && (
                <div className="mt-2 flex items-start justify-center gap-4 border-t border-line pt-2">
                    {node.left !== undefined && (
                        <TreeNode node={node.left} />
                    )}
                    {node.right !== undefined && (
                        <TreeNode node={node.right} />
                    )}
                    {children.map((child, index) => (
                        <TreeNode key={index} node={child} />
                    ))}
                </div>
            )}
        </div>
    );
}

function TreeStage({ tree }) {
    if (!tree) {
        return (
            <EmptyStage>
                This step has no tree snapshot. Give the root node a
                custom class with left/right (or children) attributes.
            </EmptyStage>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-line bg-ink-950 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-faint">
                Tree snapshot
            </p>
            <div className="flex min-w-max justify-center">
                <TreeNode node={tree} />
            </div>
        </div>
    );
}

function LinkedListStage({ nodes }) {
    const items = Array.isArray(nodes) ? nodes : [];

    if (!items.length) {
        return <EmptyStage>This step has no linked-list snapshot.</EmptyStage>;
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-line bg-ink-950 p-3">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-faint">
                Linked list · head is on the left
            </p>
            <div className="flex min-w-max items-center gap-2">
                {items.map((value, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div
                            className={`flex min-w-14 flex-col items-center rounded-lg border px-2 py-1.5 font-mono text-[11px] ${
                                index === 0
                                    ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                                    : "border-line bg-ink-800 text-mist"
                            }`}
                        >
                            <span>{String(value)}</span>
                            <span className="mt-0.5 text-[9px] text-faint">
                                {index}
                            </span>
                        </div>
                        {index < items.length - 1 && (
                            <span className="text-faint">→</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function GraphStage({ graph }) {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph?.edges) ? graph.edges : [];

    if (!nodes.length) {
        return <EmptyStage>This step has no graph snapshot.</EmptyStage>;
    }

    const width = 560;
    const height = 330;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(30, Math.min(width, height) / 2 - 52);
    const positions = new Map(
        nodes.map((node, index) => {
            const angle =
                (Math.PI * 2 * index) / Math.max(1, nodes.length) - Math.PI / 2;

            return [
                String(node),
                {
                    x:
                        nodes.length === 1
                            ? centerX
                            : centerX + radius * Math.cos(angle),
                    y:
                        nodes.length === 1
                            ? centerY
                            : centerY + radius * Math.sin(angle),
                },
            ];
        })
    );

    return (
        <div className="overflow-x-auto rounded-xl border border-line bg-ink-950 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                Graph · {nodes.length} nodes · {edges.length} edges
            </p>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="mx-auto h-auto w-full max-w-2xl"
                role="img"
                aria-label={`Graph with ${nodes.length} nodes and ${edges.length} edges`}
            >
                <defs>
                    <marker
                        id="trace-graph-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="3"
                        orient="auto"
                    >
                        <path d="M0,0 L0,6 L7,3 z" fill="#617582" />
                    </marker>
                </defs>
                {edges.map(([source, target], index) => {
                    const from = positions.get(String(source));
                    const to = positions.get(String(target));

                    if (!from || !to) return null;

                    return (
                        <line
                            key={index}
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke="#334b57"
                            strokeWidth="1.4"
                            markerEnd="url(#trace-graph-arrow)"
                        />
                    );
                })}
                {nodes.map((node) => {
                    const label = String(node);
                    const position = positions.get(label);

                    return (
                        <g key={label} transform={`translate(${position.x}, ${position.y})`}>
                            <circle
                                r="19"
                                fill="#14232d"
                                stroke="#79d7e8"
                                strokeWidth="1.5"
                            />
                            <text
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#e8eef2"
                                fontSize="10"
                                fontFamily="monospace"
                            >
                                {label.length > 8
                                    ? `${label.slice(0, 7)}…`
                                    : label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function CallStackStage({ frames }) {
    const items = Array.isArray(frames) ? frames : [];

    if (!items.length) {
        return <EmptyStage>This step has no call stack.</EmptyStage>;
    }

    return (
        <div className="rounded-xl border border-line bg-ink-950 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                Call stack · current frame on top
            </p>
            <div className="space-y-1">
                {items
                    .slice()
                    .reverse()
                    .map((frame, index) => (
                        <div
                            key={`${frame.function}-${frame.line}-${index}`}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 font-mono text-[11px] ${
                                index === 0
                                    ? "border-violet-400/60 bg-violet-500/15 text-violet-100"
                                    : "border-line bg-ink-800 text-mist"
                            }`}
                        >
                            <span className="truncate">
                                {frame.function === "<module>"
                                    ? "module"
                                    : frame.function}
                            </span>
                            <span className="ml-3 shrink-0 text-[10px] text-faint">
                                {frame.line ? `line ${frame.line}` : ""}
                            </span>
                        </div>
                    ))}
            </div>
        </div>
    );
}

function MatrixStage({ matrix, previousMatrix }) {
    const rows = Array.isArray(matrix?.rows) ? matrix.rows : [];

    if (!rows.length) {
        return <EmptyStage>This step has no table state.</EmptyStage>;
    }

    const previousRows = Array.isArray(previousMatrix?.rows)
        ? previousMatrix.rows
        : [];
    const columnCount = Math.max(...rows.map((row) => row.length));

    return (
        <div className="overflow-x-auto rounded-xl border border-line bg-ink-950 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                    Table · {matrix.name}
                </p>
                <span className="text-[10px] text-faint">
                    {rows.length} × {columnCount}
                </span>
            </div>
            <table className="min-w-full border-separate border-spacing-0 font-mono text-[11px]">
                <thead>
                    <tr>
                        <th className="sticky left-0 bg-ink-950 p-1" />
                        {Array.from({ length: columnCount }, (_, index) => (
                            <th
                                key={index}
                                className="p-1 text-center font-medium text-faint"
                            >
                                {index}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            <th className="sticky left-0 bg-ink-950 p-1 text-right font-medium text-faint">
                                {rowIndex}
                            </th>
                            {Array.from({ length: columnCount }, (_, columnIndex) => {
                                const value = row[columnIndex];
                                const changed =
                                    previousRows[rowIndex]?.[columnIndex] !==
                                    value;

                                return (
                                    <td
                                        key={columnIndex}
                                        className={`min-w-10 border border-line p-1.5 text-center transition-colors ${
                                            changed
                                                ? "bg-amber-500/20 text-amber-100"
                                                : "text-mist"
                                        }`}
                                    >
                                        {value === undefined ? "" : String(value)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TraceStage({ viewMode, frame, previousFrame, sortedIndices }) {
    const mode =
        viewMode && viewMode !== "auto"
            ? viewMode
            : frame?.matrix
              ? "matrix"
              : frame?.structure?.kind ||
                (frame?.array ? "array" : frame?.sequence ? "stack" : "callstack");

    if (mode === "stack") {
        return <StackStage values={frame?.sequence || frame?.array} />;
    }

    if (mode === "queue") {
        return <QueueStage values={frame?.sequence || frame?.array} />;
    }

    if (mode === "matrix") {
        return (
            <MatrixStage
                matrix={frame?.matrix}
                previousMatrix={previousFrame?.matrix}
            />
        );
    }

    if (mode === "tree") {
        return <TreeStage tree={frame?.structure?.root} />;
    }

    if (mode === "linkedlist") {
        return <LinkedListStage nodes={frame?.structure?.nodes} />;
    }

    if (mode === "graph") {
        return <GraphStage graph={frame?.structure} />;
    }

    if (mode === "callstack") {
        return <CallStackStage frames={frame?.callStack} />;
    }

    return (
        <AlgorithmStage
            array={frame?.array}
            highlights={frame?.highlights}
            sortedIndices={sortedIndices}
        />
    );
}

export default TraceStage;
