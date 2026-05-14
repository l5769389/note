import "katex/dist/katex.min.css";

import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import {
  CircleAlert,
  Info,
  Lightbulb,
  OctagonAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { refractor } from "refractor/core";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkDeflist from "remark-deflist";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { MermaidDiagram } from "./MermaidDiagram";
import { registerMarkdownLanguages } from "../syntaxHighlighting";
import {
  getMarkdownAlertByPrefix,
  stripMarkdownAlertMarker,
} from "../markdownAlerts";
import { parseImageMeta } from "../imageMeta";
import { resolveDocumentResourceUrl } from "../localPreviewUrls";
import type { TyporaAlertKind } from "../editorCommands";

type MarkdownRendererProps = {
  children: string;
  filePath?: string;
};

const safeEmbeddedImagePattern =
  /^data:image\/(?:png|jpe?g|gif|webp);base64,/i;
const localPreviewUrlPattern = /^typora-local:\/\//i;
const languagePattern = /language-(\S+)/;

const markdownAlertIcons: Record<TyporaAlertKind, LucideIcon> = {
  caution: OctagonAlert,
  important: CircleAlert,
  note: Info,
  tip: Lightbulb,
  warning: TriangleAlert,
};

function MarkdownAlertIcon({ kind }: { kind: TyporaAlertKind }) {
  const Icon = markdownAlertIcons[kind] ?? Info;

  return (
    <span className="markdown-alert-icon" aria-hidden="true">
      <Icon size={15} strokeWidth={2.35} />
    </span>
  );
}

type HighlightNode = {
  children?: HighlightNode[];
  properties?: {
    className?: string[] | string;
  };
  type: string;
  value?: string;
};

registerMarkdownLanguages(refractor);

function markdownUrlTransform(url: string, filePath?: string) {
  if (safeEmbeddedImagePattern.test(url)) {
    return url;
  }

  const resolvedUrl = resolveDocumentResourceUrl(url, filePath) ?? url;

  if (localPreviewUrlPattern.test(resolvedUrl)) {
    return resolvedUrl;
  }

  return defaultUrlTransform(resolvedUrl);
}

function getRenderedResourceUrl(url: string | undefined, filePath?: string) {
  if (!url) {
    return url;
  }

  return markdownUrlTransform(url, filePath);
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
  return getMarkdownAlertByPrefix(marker);
}

function stripAlertMarkerFromNode(node: ReactNode): ReactNode {
  if (typeof node === "string") {
    return stripMarkdownAlertMarker(node);
  }

  if (typeof node === "number") {
    return node;
  }

  if (Array.isArray(node)) {
    let hasStrippedMarker = false;

    return node
      .map((child) => {
        if (hasStrippedMarker) {
          return child;
        }

        const nextChild = stripAlertMarkerFromNode(child);
        hasStrippedMarker = getReactNodeText(child) !== getReactNodeText(nextChild);
        return nextChild;
      })
      .filter((child) => getReactNodeText(child).trim().length > 0);
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    const nextChildren = stripAlertMarkerFromNode(node.props.children);

    if (!getReactNodeText(nextChildren).trim()) {
      return null;
    }

    return cloneElement(node, node.props, nextChildren);
  }

  return node;
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

function MarkdownImageRenderer({
  filePath,
  src,
  style,
  title,
  ...props
}: ComponentPropsWithoutRef<"img"> & { filePath?: string }) {
  const meta = parseImageMeta(title);
  const imageStyle = {
    ...style,
    ...(meta.width ? { width: `${meta.width}px` } : {}),
  };

  return (
    <span className={`markdown-image-frame markdown-image-${meta.align}`}>
      <img
        {...props}
        src={getRenderedResourceUrl(src, filePath)}
        style={imageStyle}
        title={meta.titleText || undefined}
      />
    </span>
  );
}

function BlockquoteRenderer({ children }: { children?: ReactNode }) {
  const alert = getMarkdownAlert(children);

  if (!alert) {
    return <blockquote>{children}</blockquote>;
  }

  const normalizedChildren = Children.toArray(children);
  const firstChild = stripAlertMarkerFromNode(normalizedChildren[0]);
  const bodyChildren = [
    ...(firstChild ? [firstChild] : []),
    ...normalizedChildren.slice(1),
  ];

  return (
    <blockquote className={`markdown-alert markdown-alert-${alert.kind}`}>
      <div className="markdown-alert-title">
        <MarkdownAlertIcon kind={alert.kind} />
        <span>{alert.title}</span>
      </div>
      {bodyChildren}
    </blockquote>
  );
}

export function MarkdownRenderer({ children, filePath }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, ...props }: ComponentPropsWithoutRef<"a">) => (
          <a {...props} href={getRenderedResourceUrl(href, filePath)} />
        ),
        blockquote: BlockquoteRenderer,
        code: CodeRenderer,
        img: ({ src, ...props }: ComponentPropsWithoutRef<"img">) => (
          <MarkdownImageRenderer {...props} filePath={filePath} src={src} />
        ),
        pre: PreRenderer,
      }}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      remarkPlugins={[remarkGfm, remarkDeflist, remarkMath]}
      urlTransform={(url) => markdownUrlTransform(url, filePath)}
    >
      {children}
    </ReactMarkdown>
  );
}

export function InlineMarkdownRenderer({ children, filePath }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, ...props }: ComponentPropsWithoutRef<"a">) => (
          <a {...props} href={getRenderedResourceUrl(href, filePath)} />
        ),
        img: ({ src, ...props }: ComponentPropsWithoutRef<"img">) => (
          <MarkdownImageRenderer {...props} filePath={filePath} src={src} />
        ),
        p: ({ children: paragraphChildren }: { children?: ReactNode }) => (
          <>{paragraphChildren}</>
        ),
      }}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      remarkPlugins={[remarkGfm, remarkDeflist, remarkMath]}
      urlTransform={(url) => markdownUrlTransform(url, filePath)}
    >
      {children}
    </ReactMarkdown>
  );
}
