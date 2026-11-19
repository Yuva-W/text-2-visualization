import ReactMarkdown from "react-markdown";
import CodeBlock from "./CodeBlock.jsx";

function MarkdownMessage({
    content,
    onExplainLine,
    onTrace,
    disabled = false,
}) {
    const components = {
        pre({ children }) {
            const child = Array.isArray(children) ? children[0] : children;

            if (!child || !child.props) {
                return <pre>{children}</pre>;
            }

            const className = child.props.className || "";
            const language =
                className.match(/language-([\w-]+)/)?.[1] || "";
            const rawCode = Array.isArray(child.props.children)
                ? child.props.children.join("")
                : child.props.children;
            const code = String(rawCode ?? "").replace(/\n$/, "");

            return (
                <CodeBlock
                    code={code}
                    language={language}
                    onExplainLine={onExplainLine}
                    onTrace={onTrace}
                    disabled={disabled}
                />
            );
        },
    };

    return (
        <div className="message-markdown">
            <ReactMarkdown components={components}>
                {content || ""}
            </ReactMarkdown>
        </div>
    );
}

export default MarkdownMessage;
