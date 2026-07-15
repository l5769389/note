import { describe, expect, it } from "vitest";
import {
  applyDiaryTemplateWithCarryover,
  createDiaryInitialContent,
  enrichDiaryEntryWithContent,
  getDiaryDateKey,
  getDiaryBody,
  getDiaryEntriesFromTree,
  getDiaryFilePath,
  getDiaryMetadata,
  getDiaryMonthDirectoryPath,
  getDiaryRootPath,
  groupDiaryEntries,
  isDiaryDocumentContent,
  isPathInsideDiaryRoot,
  removeDiaryRootFromDirectoryTree,
  updateDiaryMetadata,
} from "../diaryModel";
import type { DirectoryTreeItem } from "../types";

describe("diaryModel", () => {
  it("creates workspace diary paths", () => {
    expect(getDiaryRootPath("/Users/jun/Notes")).toBe("/Users/jun/Notes/日记");
    expect(getDiaryMonthDirectoryPath("/Users/jun/Notes", "2026-07-08")).toBe(
      "/Users/jun/Notes/日记/2026/07",
    );
    expect(getDiaryFilePath("/Users/jun/Notes", "2026-07-08")).toBe(
      "/Users/jun/Notes/日记/2026/07/2026-07-08.md",
    );
  });

  it("formats local date keys and initial content", () => {
    expect(getDiaryDateKey(new Date(2026, 6, 8))).toBe("2026-07-08");
    const content = createDiaryInitialContent("2026-07-08");

    expect(isDiaryDocumentContent(content)).toBe(true);
    expect(getDiaryMetadata(content)).toMatchObject({
      dateKey: "2026-07-08",
      isDiary: true,
      tags: [],
      templateId: "blank",
    });
    expect(getDiaryMetadata(content).mood).toBeUndefined();
    expect(content).not.toContain("diary-mood");
    expect(getDiaryBody(content)).toBe("");
    expect(getDiaryBody(createDiaryInitialContent("2026-07-08", "daily-review"))).toContain(
      "今日回顾",
    );
  });

  it("updates diary metadata and applies templates with content carryover", () => {
    const content = createDiaryInitialContent("2026-07-08");
    const withMetadata = updateDiaryMetadata(content, {
      mood: "平静",
      tags: ["学习", "学习", "#项目 记录"],
    });

    expect(getDiaryMetadata(withMetadata)).toMatchObject({
      mood: "平静",
      tags: ["学习", "项目-记录"],
    });

    const withTemplate = applyDiaryTemplateWithCarryover(withMetadata, "study-log");
    expect(getDiaryMetadata(withTemplate).templateId).toBe("study-log");
    expect(getDiaryBody(withTemplate)).toContain("今日学习");

    const preservedBody = applyDiaryTemplateWithCarryover(
      updateDiaryMetadata(`${content}已有内容`, { templateId: "blank" }),
      "work-log",
    );
    expect(getDiaryMetadata(preservedBody).templateId).toBe("work-log");
    expect(getDiaryBody(preservedBody)).toContain("## 今日工作");
    expect(getDiaryBody(preservedBody)).toContain("## 其他记录");
    expect(getDiaryBody(preservedBody)).toContain("已有内容");
  });

  it("carries matching heading content and appends unmatched diary notes", () => {
    const content = `${createDiaryInitialContent(
      "2026-07-08",
    )}开头散记\n\n## 今日工作\n\n完成 A\n\n## 灵感\n\n点子 B`;
    const switched = applyDiaryTemplateWithCarryover(content, "work-log");
    const body = getDiaryBody(switched);

    expect(getDiaryMetadata(switched).templateId).toBe("work-log");
    expect(getDiaryMetadata(switched).mood).toBeUndefined();
    expect(switched).not.toContain("diary-mood");
    expect(body).toContain("## 今日工作\n\n完成 A");
    expect(body).toContain("## 进展");
    expect(body).toContain("## 风险与待办");
    expect(body).toContain("## 其他记录");
    expect(body).toContain("开头散记");
    expect(body).toContain("## 灵感\n\n点子 B");
    expect(body).not.toContain("notedock-type");
  });

  it("identifies and removes diary files from normal workspace trees", () => {
    const tree: DirectoryTreeItem = {
      name: "notes",
      path: "/Users/jun/Notes",
      type: "directory",
      children: [
        {
          name: "todo.md",
          path: "/Users/jun/Notes/todo.md",
          type: "file",
        },
        {
          name: "manual-diary.md",
          path: "/Users/jun/Notes/manual-diary.md",
          type: "file",
        },
        {
          name: "日记",
          path: "/Users/jun/Notes/日记",
          type: "directory",
          children: [
            {
              name: "2026",
              path: "/Users/jun/Notes/日记/2026",
              type: "directory",
              children: [
                {
                  name: "2026-07-09.md",
                  path: "/Users/jun/Notes/日记/2026/07/2026-07-09.md",
                  type: "file",
                },
              ],
            },
          ],
        },
      ],
    };

    expect(
      isPathInsideDiaryRoot(
        "/Users/jun/Notes/日记/2026/07/2026-07-09.md",
        "/Users/jun/Notes",
      ),
    ).toBe(true);
    expect(
      removeDiaryRootFromDirectoryTree(tree, "/Users/jun/Notes", [
        "/Users/jun/Notes/manual-diary.md",
      ])?.children,
    ).toEqual([
      {
        name: "todo.md",
        path: "/Users/jun/Notes/todo.md",
        type: "file",
      },
    ]);
  });

  it("reads diary entries from a directory tree and sorts newest first", () => {
    const tree: DirectoryTreeItem = {
      name: "日记",
      path: "/notes/日记",
      type: "directory",
      children: [
        {
          name: "2026",
          path: "/notes/日记/2026",
          type: "directory",
          children: [
            {
              name: "07",
              path: "/notes/日记/2026/07",
              type: "directory",
              children: [
                {
                  name: "2026-07-08.md",
                  path: "/notes/日记/2026/07/2026-07-08.md",
                  type: "file",
                },
                {
                  name: "random.md",
                  path: "/notes/日记/2026/07/random.md",
                  type: "file",
                },
              ],
            },
            {
              name: "06",
              path: "/notes/日记/2026/06",
              type: "directory",
              children: [
                {
                  name: "2026-06-30.md",
                  path: "/notes/日记/2026/06/2026-06-30.md",
                  type: "file",
                },
              ],
            },
          ],
        },
      ],
    };

    const entries = getDiaryEntriesFromTree(tree);

    expect(entries.map((entry) => entry.dateKey)).toEqual([
      "2026-07-08",
      "2026-06-30",
    ]);
    expect(groupDiaryEntries(entries)).toEqual([
      {
        key: "2026",
        label: "2026年",
        months: [
          {
            key: "2026-07",
            label: "7月",
            entries: [entries[0]],
          },
          {
            key: "2026-06",
            label: "6月",
            entries: [entries[1]],
          },
        ],
      },
    ]);
  });

  it("enriches diary entries with frontmatter and body summary", () => {
    const entry = {
      dateKey: "2026-07-08",
      dayLabel: "8日",
      filePath: "/notes/日记/2026/07/2026-07-08.md",
      monthKey: "2026-07",
      monthLabel: "7月",
      tags: [],
      templateId: "blank" as const,
      title: "2026-07-08",
      year: "2026",
    };
    const content = `${createDiaryInitialContent("2026-07-08")}\n今天读完了数据库章节。`;

    expect(enrichDiaryEntryWithContent(entry, content)).toMatchObject({
      dateKey: "2026-07-08",
      summary: "今天读完了数据库章节。",
      tags: [],
      templateId: "blank",
    });
  });
});
