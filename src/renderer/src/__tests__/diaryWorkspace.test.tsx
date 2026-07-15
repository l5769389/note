import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DiarySidebarPanel,
  DiaryWorkspace,
} from "../features/diary/DiaryWorkspace";
import {
  createDiaryInitialContent,
  diaryMoodValues,
  diaryTemplateOptions,
  getDiaryMetadata,
  updateDiaryMetadata,
} from "../diaryModel";

describe("DiarySidebarPanel", () => {
  it("renders the diary tab content without the standalone workspace header", () => {
    const html = renderToStaticMarkup(
      <DiarySidebarPanel
        document={null}
        entries={[]}
        groups={[]}
        onCreateDate={() => {}}
        onCreateToday={() => {}}
        onOpenEntry={() => {}}
        workspacePath="D:/notes"
      />,
    );

    expect(html).toContain("写今天日记");
    expect(html).toContain("日历");
    expect(html).toContain("时间线");
    expect(html).toContain("还没有日记");
    expect(html).not.toContain("noteDock");
    expect(html).not.toContain("关闭日记");
    expect(html).not.toContain("diary-sidebar-header");
  });

  it("renders diary groups as collapsible year and month rows", () => {
    const entry = {
      dateKey: "2026-07-08",
      dayLabel: "8日",
      filePath: "D:/notes/日记/2026/07/2026-07-08.md",
      monthKey: "2026-07",
      monthLabel: "7月",
      mood: "平静" as const,
      summary: "今天记录了项目进展。",
      tags: ["项目"],
      templateId: "blank" as const,
      title: "2026-07-08",
      year: "2026",
    };
    const html = renderToStaticMarkup(
      <DiarySidebarPanel
        document={{
          content: "",
          createdAt: "2026-07-08T00:00:00.000Z",
          documentType: "markdown",
          drawings: {},
          filePath: "D:/notes/日记/2026/07/2026-07-08.md",
          id: "diary-2026-07-08",
          title: "2026-07-08",
          updatedAt: "2026-07-08T00:00:00.000Z",
        }}
        entries={[entry]}
        groups={[
          {
            key: "2026",
            label: "2026年",
            months: [
              {
                entries: [
                  entry,
                ],
                key: "2026-07",
                label: "7月",
              },
            ],
          },
        ]}
        onCreateDate={() => {}}
        onCreateToday={() => {}}
        onDeleteEntry={() => {}}
        onOpenEntry={() => {}}
        workspacePath="D:/notes"
      />,
    );

    expect(html).toContain("diary-group-toggle");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("1篇");
    expect(html).toContain("diary-entry-day");
    expect(html).toContain("8日");
    expect(html).toContain("右键删除日记");
  });

  it("uses补写 copy for blank calendar days", () => {
    const html = renderToStaticMarkup(
      <DiarySidebarPanel
        document={null}
        entries={[]}
        groups={[]}
        initialView="calendar"
        onCreateDate={() => {}}
        onCreateToday={() => {}}
        onOpenEntry={() => {}}
        workspacePath="D:/notes"
      />,
    );

    expect(html).toContain("补写");
    expect(html).not.toContain("创建 20");
  });

  it("renders timeline entries on an axis without default mood", () => {
    const html = renderToStaticMarkup(
      <DiarySidebarPanel
        document={null}
        entries={[
          {
            dateKey: "2026-07-08",
            dayLabel: "8日",
            filePath: "D:/notes/日记/2026/07/2026-07-08.md",
            monthKey: "2026-07",
            monthLabel: "7月",
            summary: "今天记录了项目进展。",
            tags: ["项目"],
            templateId: "blank",
            title: "2026-07-08",
            year: "2026",
          },
        ]}
        groups={[]}
        initialView="timeline"
        onCreateDate={() => {}}
        onCreateToday={() => {}}
        onOpenEntry={() => {}}
        workspacePath="D:/notes"
      />,
    );

    expect(html).toContain("diary-timeline-track");
    expect(html).toContain("diary-timeline-node");
    expect(html).toContain("diary-timeline-content");
    expect(html).not.toContain("diary-mood-icon");
  });

  it("renders diary metadata controls without a diary title header", () => {
    const content = updateDiaryMetadata(
      createDiaryInitialContent("2026-07-08"),
      {
        mood: "开心",
        tags: ["项目"],
      },
    );
    const html = renderToStaticMarkup(
      <DiaryWorkspace
        document={{
          content,
          createdAt: "2026-07-08T00:00:00.000Z",
          documentType: "markdown",
          drawings: {},
          filePath: "D:/notes/日记/2026/07/2026-07-08.md",
          id: "diary-2026-07-08",
          title: "2026-07-08",
          updatedAt: "2026-07-08T00:00:00.000Z",
        }}
        editorMode="preview"
        metadata={getDiaryMetadata(content)}
        moodOptions={diaryMoodValues}
        onChange={() => {}}
        onCreateToday={() => {}}
        onMoodChange={() => {}}
        onPaste={() => {}}
        onTagsChange={() => {}}
        onTemplateChange={() => {}}
        templateOptions={diaryTemplateOptions}
        workspacePath="D:/notes"
      />,
    );

    expect(html).toContain("diary-metadata-bar");
    expect(html).toContain("diary-editor-preview");
    expect(html).toContain("diary-preview");
    expect(html).toContain("心情");
    expect(html).toContain("diary-mood-icon");
    expect(html).toContain("标签");
    expect(html).toContain("#项目");
    expect(html).toContain("模板");
    expect(html).toContain("diary-template-trigger");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("文件路径");
  });
});
