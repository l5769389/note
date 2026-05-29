import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders task list states with visible checkboxes", () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer>{"- [ ] 未完成\n- [x] 已完成"}</MarkdownRenderer>,
    );

    expect(html).toContain("markdown-task-list-item");
    expect(html).toContain("markdown-task-checkbox");
    expect(html).toContain('data-task-checked="false"');
    expect(html).toContain('data-task-checked="true"');
    expect(html).toContain('aria-label="未完成任务"');
    expect(html).toContain('aria-label="已完成任务"');
  });

  it("renders wiki links without rewriting code spans", () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer>{"See [[Daily Note|today]] and `[[Code]]`."}</MarkdownRenderer>,
    );

    expect(html).toContain('href="notedock-wikilink:Daily%20Note"');
    expect(html).toContain('markdown-wiki-link-kind">文档</span>');
    expect(html).toContain('markdown-wiki-link-title">today</span>');
    expect(html).toContain("[[Code]]");
  });
});
