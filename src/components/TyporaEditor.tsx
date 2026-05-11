import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
} from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";

type MarkdownBlock = {
  end: number;
  key: string;
  start: number;
  text: string;
};

type TyporaEditorProps = {
  onChange: (value: string) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  value: string;
};

export type TyporaEditorHandle = {
  insertMarkdown: (markdown: string) => void;
};

const blockPattern = /\S[\s\S]*?(?=\n{2,}\S|$)/g;

function parseMarkdownBlocks(value: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];

  for (const match of value.matchAll(blockPattern)) {
    const rawText = match[0];
    const text = rawText.replace(/\n+$/, "");
    const start = match.index ?? 0;

    blocks.push({
      end: start + text.length,
      key: `${start}:${text.length}`,
      start,
      text,
    });
  }

  if (!blocks.length) {
    return [
      {
        end: value.length,
        key: "empty",
        start: 0,
        text: value,
      },
    ];
  }

  return blocks;
}

function replaceBlock(
  value: string,
  block: MarkdownBlock,
  nextBlockText: string,
) {
  return `${value.slice(0, block.start)}${nextBlockText}${value.slice(block.end)}`;
}

function blockKind(text: string) {
  const trimmed = text.trimStart();

  if (/^#{1,6}\s/.test(trimmed)) {
    return "heading";
  }

  if (/^(```|~~~)/.test(trimmed)) {
    return "code";
  }

  if (/^>/.test(trimmed)) {
    return "quote";
  }

  if (/^(\||[-*+]\s|\d+\.\s)/.test(trimmed)) {
    return "dense";
  }

  return "paragraph";
}

export const TyporaEditor = forwardRef<TyporaEditorHandle, TyporaEditorProps>(
  function TyporaEditor({ onChange, onPaste, value }, ref) {
    const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
    const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const blocks = useMemo(() => parseMarkdownBlocks(value), [value]);

    useEffect(() => {
      if (
        activeBlockIndex !== null &&
        activeBlockIndex > Math.max(blocks.length - 1, 0)
      ) {
        setActiveBlockIndex(blocks.length - 1);
      }
    }, [activeBlockIndex, blocks.length]);

    useEffect(() => {
      const textarea = activeTextareaRef.current;

      if (!textarea) {
        return;
      }

      textarea.style.height = "0px";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }, [activeBlockIndex, value]);

    useEffect(() => {
      activeTextareaRef.current?.focus();
    }, [activeBlockIndex]);

    useImperativeHandle(
      ref,
      () => ({
        insertMarkdown(markdown: string) {
          const textarea = activeTextareaRef.current;
          const block =
            activeBlockIndex === null ? null : blocks[activeBlockIndex] ?? null;

          if (!textarea || !block) {
            const separator = value.length > 0 && !value.endsWith("\n") ? "\n" : "";
            onChange(`${value}${separator}${markdown}`);
            return;
          }

          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const nextBlockText = `${block.text.slice(0, start)}${markdown}${block.text.slice(end)}`;

          onChange(replaceBlock(value, block, nextBlockText));
          requestAnimationFrame(() => {
            const nextCursor = start + markdown.length;
            activeTextareaRef.current?.focus();
            activeTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
          });
        },
      }),
      [activeBlockIndex, blocks, onChange, value],
    );

    return (
      <article className="typora-editor" aria-label="Typora 风格编辑器">
        {blocks.map((block, index) => {
          const isActive = activeBlockIndex === index;
          const kind = blockKind(block.text);

          if (isActive) {
            return (
              <textarea
                ref={activeTextareaRef}
                className={`typora-block-input typora-block-${kind}`}
                key={block.key}
                spellCheck={false}
                value={block.text}
                onBlur={() => setActiveBlockIndex(null)}
                onChange={(event) => {
                  onChange(replaceBlock(value, block, event.target.value));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.currentTarget.blur();
                  }
                }}
                onPaste={onPaste}
              />
            );
          }

          return (
            <div
              className={`typora-rendered-block typora-rendered-${kind}`}
              key={block.key}
              role="button"
              tabIndex={0}
              onClick={() => setActiveBlockIndex(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setActiveBlockIndex(index);
                }
              }}
            >
              <MarkdownRenderer>{block.text}</MarkdownRenderer>
            </div>
          );
        })}
      </article>
    );
  },
);
