import type { ReactNode } from "react";
import { refractor } from "refractor/core";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { registerMarkdownLanguages } from "../syntaxHighlighting";

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

export function MarkdownRenderer({ children }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        code: CodeRenderer,
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
