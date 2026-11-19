/* global importScripts, loadPyodide */

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// Pyodide's classic loader is intentionally loaded from a CDN. The worker
// keeps Python execution away from the app's main thread.
importScripts(`${PYODIDE_URL}pyodide.js`);

let pyodidePromise = null;

function getPyodide() {
    if (!pyodidePromise) {
        pyodidePromise = loadPyodide({ indexURL: PYODIDE_URL });
    }

    return pyodidePromise;
}

const TRACE_SCRIPT = `
import ast, collections, dis, json, math, re, sys, time, types

source = __t2v_student_code__
overrides = json.loads(__t2v_overrides_json__ or "{}")
events = []
max_events = 600
truncated = False
metrics = {
    "lineEvents": 0,
    "comparisons": 0,
    "writes": 0,
    "calls": 0,
    "elapsedMs": 0.0,
}
call_stack = []


class _TraceLimit(BaseException):
    pass


_ASSIGNMENT = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.+?)(\\s*#.*)?$")


def _apply_overrides(text, values):
    lines = text.split("\\n")
    applied = set()

    for index, line in enumerate(lines):
        match = _ASSIGNMENT.match(line)
        if not match:
            continue

        name = match.group(1)

        if name not in values or name in applied:
            continue

        value = str(values[name]).strip()

        if not value:
            raise ValueError("The value for " + name + " is empty")

        try:
            ast.literal_eval(value)
        except Exception as exc:
            raise ValueError("Invalid Python value for " + name + ": " + str(exc))

        comment = match.group(3) or ""
        lines[index] = name + " = " + value + comment
        applied.add(name)

    missing = [name for name in values if name not in applied]

    if missing:
        raise ValueError(
            "No top-level assignment found for: " + ", ".join(sorted(missing))
        )

    return "\\n".join(lines)


def _simple(value, depth=0):
    if depth > 4:
        return "..."

    if value is None or isinstance(value, (bool, int, str)):
        if isinstance(value, str) and len(value) > 80:
            return value[:77] + "..."
        return value

    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return str(value)
        return value

    if isinstance(value, (list, tuple, set, frozenset, collections.deque)):
        values = []
        for item in list(value)[:20]:
            values.append(_simple(item, depth + 1))
        return values

    if isinstance(value, dict):
        result = {}
        for key, item in list(value.items())[:8]:
            result[str(key)[:40]] = _simple(item, depth + 1)
        return result

    return str(value)[:80]


def _label(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return str(value)[:40]


def _tree_node(value, seen, depth):
    if value is None:
        return None

    if depth > 7:
        return {"label": "...", "truncated": True}

    ident = id(value)

    if ident in seen:
        return {"label": "cycle", "truncated": True}

    seen.add(ident)
    label = None

    for attr in ("val", "value", "key", "data"):
        if not hasattr(value, attr):
            continue
        try:
            candidate = getattr(value, attr)
        except Exception:
            continue
        if not callable(candidate) and not isinstance(
            candidate, (types.FunctionType, type, types.ModuleType)
        ):
            label = candidate
            break

    if label is None:
        label = type(value).__name__

    node = {"label": _label(label)}

    if hasattr(value, "left") or hasattr(value, "right"):
        node["left"] = _tree_node(getattr(value, "left", None), seen, depth + 1)
        node["right"] = _tree_node(getattr(value, "right", None), seen, depth + 1)
        return node

    children = getattr(value, "children", None)

    if isinstance(children, (list, tuple)):
        node["children"] = [
            _tree_node(child, seen, depth + 1) for child in list(children)[:8]
        ]

    return node


def _linked_nodes(value):
    nodes = []
    seen = set()
    current = value

    while current is not None and len(nodes) < 30:
        ident = id(current)

        if ident in seen:
            nodes.append("cycle")
            break

        seen.add(ident)
        label = None

        for attr in ("val", "value", "key", "data"):
            if not hasattr(current, attr):
                continue
            try:
                candidate = getattr(current, attr)
            except Exception:
                continue
            if not callable(candidate):
                label = candidate
                break

        nodes.append(_label(label if label is not None else type(current).__name__))
        current = getattr(current, "next", None)

    return nodes


def _graph(value):
    nodes = []
    edges = []
    seen_edges = set()

    for key, neighbors in list(value.items())[:30]:
        if not isinstance(neighbors, (list, tuple, set, frozenset)):
            return None

        source = _label(key)
        if source not in nodes:
            nodes.append(source)

        for neighbor in list(neighbors)[:20]:
            target = _label(neighbor)
            if target not in nodes:
                nodes.append(target)
            edge = (str(source), str(target))
            if edge not in seen_edges:
                seen_edges.add(edge)
                edges.append([source, target])

    if not edges or len(nodes) > 30:
        return None

    return {"nodes": nodes, "edges": edges}


def _structure_for(name, value):
    if isinstance(value, (types.FunctionType, type, types.ModuleType)):
        return None

    if isinstance(value, dict):
        graph = _graph(value)
        if graph:
            return {"name": name, "kind": "graph", **graph}

    if hasattr(value, "left") or hasattr(value, "right"):
        return {
            "name": name,
            "kind": "tree",
            "root": _tree_node(value, set(), 0),
        }

    children = getattr(value, "children", None)

    if isinstance(children, (list, tuple)):
        return {
            "name": name,
            "kind": "tree",
            "root": _tree_node(value, set(), 0),
        }

    if hasattr(value, "next") and any(
        hasattr(value, attr) for attr in ("val", "value", "key", "data")
    ):
        return {
            "name": name,
            "kind": "linkedlist",
            "nodes": _linked_nodes(value),
        }

    return None


def _snapshot_structure(local_values):
    preferred = ("root", "tree", "node", "head", "graph", "adj", "edges")
    names = list(local_values.keys())
    names.sort(key=lambda item: (0 if item in preferred else 1, item))

    for name in names:
        if name.startswith("__"):
            continue
        try:
            structure = _structure_for(name, local_values[name])
        except Exception:
            continue
        if structure:
            return structure

    return None


def _trace(frame, event, arg):
    if frame.f_code.co_filename != "<student>":
        return _trace

    if event == "call":
        call_stack.append({
            "function": frame.f_code.co_name,
            "line": frame.f_lineno or 1,
        })
        frame.f_trace_opcodes = True
        return _trace

    if event == "opcode":
        try:
            opcode = frame.f_code.co_code[frame.f_lasti]
            if isinstance(opcode, str):
                opcode = ord(opcode)
            opname = dis.opname[opcode]
        except Exception:
            return _trace

        if opname in ("COMPARE_OP", "IS_OP", "CONTAINS_OP"):
            metrics["comparisons"] += 1
        elif opname in ("STORE_SUBSCR", "STORE_ATTR", "LIST_APPEND", "SET_ADD", "MAP_ADD"):
            metrics["writes"] += 1
        elif opname in ("CALL", "CALL_FUNCTION_EX"):
            metrics["calls"] += 1

        return _trace

    if event == "line" or (event == "return" and len(events) > 0):
        if len(events) >= max_events:
            raise _TraceLimit()

        local_values = {}
        for name, value in frame.f_locals.items():
            if name.startswith("__"):
                continue
            local_values[name] = _simple(value)

        events.append({
            "line": frame.f_lineno,
            "event": event,
            "locals": local_values,
            "callStack": list(call_stack),
            "structure": _snapshot_structure(frame.f_locals),
        })
        metrics["lineEvents"] += 1

        if event == "return" and call_stack:
            call_stack.pop()

        return _trace

    if event == "return" and call_stack:
        call_stack.pop()

    return _trace


def _run():
    global truncated, source

    source = _apply_overrides(source, overrides)
    compiled = compile(source, "<student>", "exec")
    globals_dict = {"__name__": "__main__"}
    start = time.perf_counter()
    sys.settrace(_trace)

    try:
        exec(compiled, globals_dict)
    except _TraceLimit:
        truncated = True
    finally:
        sys.settrace(None)
        metrics["elapsedMs"] = round((time.perf_counter() - start) * 1000, 2)


_run()
json.dumps({"events": events, "truncated": truncated, "metrics": metrics})
`;

self.onmessage = async (event) => {
    const { id, code, overrides } = event.data || {};

    if (!id) return;

    try {
        self.postMessage({ id, status: "loading" });

        const pyodide = await getPyodide();

        self.postMessage({ id, status: "running" });
        pyodide.globals.set("__t2v_student_code__", code);
        pyodide.globals.set(
            "__t2v_overrides_json__",
            JSON.stringify(overrides || {})
        );

        const raw = await pyodide.runPythonAsync(TRACE_SCRIPT);
        const result = JSON.parse(String(raw));

        self.postMessage({
            id,
            status: "done",
            events: result.events || [],
            truncated: Boolean(result.truncated),
            metrics: result.metrics || {},
        });
    } catch (error) {
        self.postMessage({
            id,
            status: "error",
            error: String(error?.message || error),
        });
    }
};
