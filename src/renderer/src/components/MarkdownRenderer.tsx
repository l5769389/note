import "katex/dist/katex.min.css";

import {
  Children,
  cloneElement,
  isValidElement,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  CircleAlert,
  FileText,
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
import {
  getMarkdownAlertByPrefix,
  stripMarkdownAlertMarker,
} from "../markdownAlerts";
import { parseImageMeta } from "../imageMeta";
import { resolveDocumentResourceUrl } from "../localPreviewUrls";
import { isMindMapLanguage } from "../mindMapDocument";
import { isReactFlowLanguage } from "../reactFlowDocument";
import { isUniverSheetLanguage } from "../univerSheetDocument";
import type { TyporaAlertKind } from "../editorCommands";
import { findWikiLinkTokensInMarkdown } from "../wikiLinkTokens";

type MarkdownRendererProps = {
  children: string;
  filePath?: string;
  onEditMindMap?: (code: string) => void;
  onEditReactFlow?: (code: string) => void;
  onEditUniverSheet?: (code: string) => void;
  onOpenWikiLink?: (target: string) => void;
};

const safeEmbeddedImagePattern =
  /^data:image\/(?:png|jpe?g|gif|webp);base64,/i;
const localPreviewUrlPattern = /^typora-local:\/\//i;
const languagePattern = /language-(\S+)/;
const videoControlsSafeZone = 44;
const wikiLinkHrefPrefix = "notedock-wikilink:";
let markdownLanguagesRegistered = false;
let markdownLanguageRegistrationPromise: Promise<void> | null = null;

const MermaidDiagram = lazy(() =>
  import("./MermaidDiagram").then((module) => ({ default: module.MermaidDiagram })),
);
const ReactFlowDiagram = lazy(() =>
  import("./ReactFlowDiagram").then((module) => ({
    default: module.ReactFlowDiagram,
  })),
);
const MindMapDiagram = lazy(() =>
  import("./MindMapDiagram").then((module) => ({ default: module.MindMapDiagram })),
);
const UniverSheetPreview = lazy(() =>
  import("./UniverSheetPreview").then((module) => ({
    default: module.UniverSheetPreview,
  })),
);

function ensureMarkdownSyntaxLanguages() {
  if (markdownLanguagesRegistered) {
    return Promise.resolve();
  }

  markdownLanguageRegistrationPromise ??= import("../syntaxHighlighting").then(
    ({ registerMarkdownLanguages }) => {
      registerMarkdownLanguages(refractor);
      markdownLanguagesRegistered = true;
    },
  );

  return markdownLanguageRegistrationPromise;
}

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

function markdownUrlTransform(url: string, filePath?: string) {
  if (url.startsWith(wikiLinkHrefPrefix)) {
    return url;
  }

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

  if (url.startsWith(wikiLinkHrefPrefix)) {
    return url;
  }

  return markdownUrlTransform(url, filePath);
}

function renderWikiLinks(markdown: string) {
  const tokens = findWikiLinkTokensInMarkdown(markdown);

  if (!tokens.length) {
    return markdown;
  }

  let rendered = "";
  let cursor = 0;

  tokens.forEach((token) => {
    rendered += markdown.slice(cursor, token.from);
    rendered += `[${token.display}](${wikiLinkHrefPrefix}${encodeURIComponent(token.target)})`;
    cursor = token.to;
  });

  return rendered + markdown.slice(cursor);
}

function handleWikiLinkClick(
  event: MouseEvent<HTMLAnchorElement>,
  href: string | undefined,
  onOpenWikiLink: ((target: string) => void) | undefined,
) {
  if (!href?.startsWith(wikiLinkHrefPrefix)) {
    return;
  }

  event.preventDefault();
  onOpenWikiLink?.(decodeURIComponent(href.slice(wikiLinkHrefPrefix.length)));
}

function MarkdownAnchorRenderer({
  children,
  className,
  filePath,
  href,
  onOpenWikiLink,
  ...props
}: ComponentPropsWithoutRef<"a"> & Pick<MarkdownRendererProps, "filePath" | "onOpenWikiLink">) {
  const isWikiLink = href?.startsWith(wikiLinkHrefPrefix) ?? false;
  const renderedHref = getRenderedResourceUrl(href, filePath);
  const wikiTarget = isWikiLink
    ? decodeURIComponent(href?.slice(wikiLinkHrefPrefix.length) ?? "")
    : "";
  const normalizedClassName = [
    className,
    isWikiLink ? "markdown-wiki-link" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <a
      {...props}
      className={normalizedClassName || undefined}
      data-wiki-target={isWikiLink ? wikiTarget : undefined}
      href={renderedHref}
      onClick={(event) => handleWikiLinkClick(event, href, onOpenWikiLink)}
      title={isWikiLink ? `打开文档：${wikiTarget}` : props.title}
    >
      {isWikiLink ? (
        <>
          <FileText
            aria-hidden="true"
            className="markdown-wiki-link-icon"
            size={14}
            strokeWidth={2.15}
          />
          <span className="markdown-wiki-link-title">{children}</span>
        </>
      ) : (
        children
      )}
    </a>
  );
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
  const [languagesReady, setLanguagesReady] = useState(markdownLanguagesRegistered);

  useEffect(() => {
    if (!language || languagesReady) {
      return;
    }

    let isCancelled = false;

    ensureMarkdownSyntaxLanguages()
      .then(() => {
        if (!isCancelled) {
          setLanguagesReady(true);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLanguagesReady(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [language, languagesReady]);

  if (!language || !languagesReady) {
    return <code className={className}>{children}</code>;
  }

  const code = String(children ?? "").replace(/\n$/, "");

  let highlighted: { children: HighlightNode[] };

  try {
    highlighted = refractor.highlight(code, language) as unknown as {
      children: HighlightNode[];
    };
  } catch {
    return <code className={className}>{children}</code>;
  }

  return (
    <code className={className}>
      {highlighted.children.map((node, index) =>
        renderHighlightedNode(node, `code-${index}`),
      )}
    </code>
  );
}

function RichCodePreviewFallback({ label }: { label: string }) {
  return (
    <figure className="markdown-rich-preview-loading">
      <span>{label}</span>
    </figure>
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

function PreRenderer({
  children,
  filePath,
  onEditMindMap,
  onEditReactFlow,
  onEditUniverSheet,
}: {
  children?: ReactNode;
  filePath?: string;
  onEditMindMap?: (code: string) => void;
  onEditReactFlow?: (code: string) => void;
  onEditUniverSheet?: (code: string) => void;
}) {
  const child = Children.toArray(children)[0];

  if (
    isValidElement<{ children?: ReactNode; className?: string }>(child)
  ) {
    const language = child.props.className?.match(languagePattern)?.[1]?.toLowerCase();

    if (language === "mermaid") {
      const code = String(child.props.children ?? "").replace(/\n$/, "");
      return (
        <Suspense fallback={<RichCodePreviewFallback label="Mermaid" />}>
          <MermaidDiagram code={code} />
        </Suspense>
      );
    }

    if (language && isReactFlowLanguage(language)) {
      const code = String(child.props.children ?? "").replace(/\n$/, "");
      return (
        <Suspense fallback={<RichCodePreviewFallback label="React Flow" />}>
          <ReactFlowDiagram code={code} onEdit={onEditReactFlow} />
        </Suspense>
      );
    }

    if (language && isMindMapLanguage(language)) {
      const code = String(child.props.children ?? "").replace(/\n$/, "");
      return (
        <Suspense fallback={<RichCodePreviewFallback label="Mind Map" />}>
          <MindMapDiagram code={code} onEdit={onEditMindMap} />
        </Suspense>
      );
    }

    if (language && isUniverSheetLanguage(language)) {
      const code = String(child.props.children ?? "").replace(/\n$/, "");
      return (
        <Suspense fallback={<RichCodePreviewFallback label="在线表格" />}>
          <UniverSheetPreview
            code={code}
            filePath={filePath}
            onEdit={onEditUniverSheet}
          />
        </Suspense>
      );
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
        decoding={props.decoding ?? "async"}
        loading={props.loading ?? "lazy"}
        src={getRenderedResourceUrl(src, filePath)}
        style={imageStyle}
        title={meta.titleText || undefined}
      />
    </span>
  );
}

function MarkdownVideoRenderer({
  filePath,
  poster,
  src,
  style,
  ...props
}: ComponentPropsWithoutRef<"video"> & { filePath?: string }) {
  function togglePlayback(event: MouseEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    const rect = video.getBoundingClientRect();

    if (event.clientY >= rect.bottom - videoControlsSafeZone) {
      return;
    }

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  return (
    <video
      {...props}
      className={["markdown-video-player", props.className]
        .filter(Boolean)
        .join(" ")}
      controls={props.controls ?? true}
      onClick={togglePlayback}
      poster={getRenderedResourceUrl(poster, filePath)}
      preload={props.preload ?? "metadata"}
      src={getRenderedResourceUrl(src, filePath)}
      style={style}
    />
  );
}

function MarkdownSourceRenderer({
  filePath,
  src,
  ...props
}: ComponentPropsWithoutRef<"source"> & { filePath?: string }) {
  return <source {...props} src={getRenderedResourceUrl(src, filePath)} />;
}

function MarkdownListItemRenderer({
  checked,
  children,
  className,
  index: _index,
  node: _node,
  ordered: _ordered,
  ...props
}: ComponentPropsWithoutRef<"li"> & {
  checked?: boolean | null;
  index?: number;
  node?: unknown;
  ordered?: boolean;
}) {
  const childNodes = Children.toArray(children);
  const renderedCheckbox = childNodes.find(
    (child) =>
      isValidElement<ComponentPropsWithoutRef<"input">>(child) &&
      child.type === "input" &&
      child.props.type === "checkbox",
  );
  const checkboxChecked =
    typeof checked === "boolean"
      ? checked
      : isValidElement<ComponentPropsWithoutRef<"input">>(renderedCheckbox)
        ? renderedCheckbox.props.checked === true
        : null;
  const isTaskItem =
    checkboxChecked !== null || /\btask-list-item\b/.test(className ?? "");
  const taskChildren = isTaskItem
    ? childNodes.map((child) => {
        if (
          isValidElement<ComponentPropsWithoutRef<"input">>(child) &&
          child.type === "input" &&
          child.props.type === "checkbox"
        ) {
          return cloneElement(child, {
            "aria-label": checkboxChecked ? "已完成任务" : "未完成任务",
            checked: checkboxChecked ?? child.props.checked,
            className: [child.props.className, "markdown-task-checkbox"]
              .filter(Boolean)
              .join(" "),
            disabled: true,
            readOnly: true,
          });
        }

        return child;
      })
    : children;

  return (
    <li
      {...props}
      className={[
        className,
        isTaskItem ? "markdown-task-list-item" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-task-checked={
        checkboxChecked === null ? undefined : String(checkboxChecked)
      }
    >
      {isTaskItem && !renderedCheckbox ? (
        <input
          aria-label={checkboxChecked ? "已完成任务" : "未完成任务"}
          checked={checkboxChecked === true}
          className="markdown-task-checkbox"
          disabled
          readOnly
          type="checkbox"
        />
      ) : null}
      {taskChildren}
    </li>
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

export function MarkdownRenderer({
  children,
  filePath,
  onEditMindMap,
  onEditReactFlow,
  onEditUniverSheet,
  onOpenWikiLink,
}: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, ...props }: ComponentPropsWithoutRef<"a">) => (
          <MarkdownAnchorRenderer
            {...props}
            filePath={filePath}
            href={href}
            onOpenWikiLink={onOpenWikiLink}
          />
        ),
        blockquote: BlockquoteRenderer,
        code: CodeRenderer,
        li: MarkdownListItemRenderer,
        img: ({ src, ...props }: ComponentPropsWithoutRef<"img">) => (
          <MarkdownImageRenderer {...props} filePath={filePath} src={src} />
        ),
        source: ({ src, ...props }: ComponentPropsWithoutRef<"source">) => (
          <MarkdownSourceRenderer {...props} filePath={filePath} src={src} />
        ),
        video: ({ src, ...props }: ComponentPropsWithoutRef<"video">) => (
          <MarkdownVideoRenderer {...props} filePath={filePath} src={src} />
        ),
        pre: ({ children: preChildren }: { children?: ReactNode }) => (
          <PreRenderer
            filePath={filePath}
            onEditMindMap={onEditMindMap}
            onEditReactFlow={onEditReactFlow}
            onEditUniverSheet={onEditUniverSheet}
          >
            {preChildren}
          </PreRenderer>
        ),
      }}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      remarkPlugins={[remarkGfm, remarkDeflist, remarkMath]}
      urlTransform={(url) => markdownUrlTransform(url, filePath)}
    >
      {renderWikiLinks(children)}
    </ReactMarkdown>
  );
}

export function InlineMarkdownRenderer({
  children,
  filePath,
  onOpenWikiLink,
}: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, ...props }: ComponentPropsWithoutRef<"a">) => (
          <MarkdownAnchorRenderer
            {...props}
            filePath={filePath}
            href={href}
            onOpenWikiLink={onOpenWikiLink}
          />
        ),
        img: ({ src, ...props }: ComponentPropsWithoutRef<"img">) => (
          <MarkdownImageRenderer {...props} filePath={filePath} src={src} />
        ),
        source: ({ src, ...props }: ComponentPropsWithoutRef<"source">) => (
          <MarkdownSourceRenderer {...props} filePath={filePath} src={src} />
        ),
        video: ({ src, ...props }: ComponentPropsWithoutRef<"video">) => (
          <MarkdownVideoRenderer {...props} filePath={filePath} src={src} />
        ),
        p: ({ children: paragraphChildren }: { children?: ReactNode }) => (
          <>{paragraphChildren}</>
        ),
      }}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      remarkPlugins={[remarkGfm, remarkDeflist, remarkMath]}
      urlTransform={(url) => markdownUrlTransform(url, filePath)}
    >
      {renderWikiLinks(children)}
    </ReactMarkdown>
  );
}
