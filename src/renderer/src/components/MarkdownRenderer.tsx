import type { ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownRendererProps = {
  children: string;
};

const safeEmbeddedImagePattern =
  /^data:image\/(?:png|jpe?g|gif|webp);base64,/i;

function markdownUrlTransform(url: string) {
  if (safeEmbeddedImagePattern.test(url)) {
    return url;
  }

  return defaultUrlTransform(url);
}

export function MarkdownRenderer({ children }: MarkdownRendererProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={markdownUrlTransform}>
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
