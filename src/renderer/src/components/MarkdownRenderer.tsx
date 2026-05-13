import { Children, isValidElement, type ReactNode } from "react";
import { refractor } from "refractor/core";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./MermaidDiagram";
import { registerMarkdownLanguages } from "../syntaxHighlighting";
import { getMarkdownAlertByMarker } from "../markdownAlerts";

type MarkdownRendererProps = {
  children: string;
};

const safeEmbeddedImagePattern =
  /^data:image\/(?:png|jpe?g|gif|webp);base64,/i;
const languagePattern = /language-(\S+)/;

type HighlightNode = {
  children?: HighlightNode[];
  properties?: {
    className?: string[] | string;
  };
  type: string;
  value?: string;
};

registerMarkdownLanguages(refractor);

function markdownUrlTransform(url: string) {
  if (safeEmbeddedImagePattern.test(url)) {
    return url;
  }

  return defaultUrlTransform(url);
}

function renderHighlightedNode(node: HighlightNode, key: string): ReactNode {
  if (node.type === "text") {
    return node.value ?? "";
  }

  if (node.type !== "element") {
    return null;
  }

  const className = node.properties?.className;
  const normalizedClassName = Array.isArray(className)
    ? className.join(" ")
    : className;

  return (
    <span className={normalizedClassName} key={key}>
      {node.children?.map((child, index) =>
        renderHighlightedNode(child, `${key}-${index}`),
      )}
    </span>
  );
}

function CodeRenderer({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const language = className?.match(languagePattern)?.[1];

  if (!language || !refractor.registered(language)) {
    return <code className={className}>{children}</code>;
  }

  const code = String(children ?? "").replace(/\n$/, "");
  const highlighted = refractor.highlight(code, language) as unknown as {
    children: HighlightNode[];
  };

  return (
    <code className={className}>
      {highlighted.children.map((node, index) =>
        renderHighlightedNode(node, `code-${index}`),
      )}
    </code>
  );
}

function getReactNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getReactNodeText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getReactNodeText(node.props.children);
  }

  return "";
}

function getMarkdownAlert(children: ReactNode) {
  const firstChild = Children.toArray(children)[0];
  const marker = getReactNodeText(firstChild).trim();
  return getMarkdownAlertByMarker(marker);
}

function PreRenderer({ children }: { children?: ReactNode }) {
  const child = Children.toArray(children)[0];

  if (
    isValidElement<{ children?: ReactNode; className?: string }>(child)
  ) {
    const language = child.props.className?.match(languagePattern)?.[1]?.toLowerCase();

    if (language === "mermaid") {
      const code = String(child.props.children ?? "").replace(/\n$/, "");
      return <MermaidDiagram code={code} />;
    }
  }

  return <pre>{children}</pre>;
}

function BlockquoteRenderer({ children }: { children?: ReactNode }) {
  const alert = getMarkdownAlert(children);

  if (!alert) {
    return <blockquote>{children}</blockquote>;
  }

  return (
    <blockquote className={`markdown-alert markdown-alert-${alert.kind}`}>
      <div className="markdown-alert-title">{alert.title}</div>
      {Children.toArray(children).slice(1)}
    </blockquote>
  );
}

export function MarkdownRenderer({ children }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        blockquote: BlockquoteRenderer,
        code: CodeRenderer,
        pre: PreRenderer,
      }}
      remarkPlugins={[remarkGfm]}
      urlTransform={markdownUrlTransform}
    >
      {children}
    </ReactMarkdown>
  );
}

export function InlineMarkdownRenderer({ children }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children: paragraphChildren }: { children?: ReactNode }) => (
          <>{paragraphChildren}</>
        ),
      }}
      remarkPlugins={[remarkGfm]}
      urlTransform={markdownUrlTransform}
    >
      {children}
    </ReactMarkdown>
  );
}
