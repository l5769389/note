import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeDashboard } from "../features/home/HomeDashboard";
import type {
  HomeCalendarDay,
  HomeSavedNote,
  HomeTodoItem,
} from "../features/home/homeModel";
import type { MarkdownDocument } from "../types";

function document(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
  return {
    content: "# Example",
    createdAt: "2026-01-01T00:00:00.000Z",
    documentType: "markdown",
    drawings: {},
    filePath: "D:/notes/example.md",
    id: "doc",
    title: "Example",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function calendarDay(overrides: Partial<HomeCalendarDay> = {}): HomeCalendarDay {
  return {
    dateKey: "2026-05-20",
    day: 20,
    inMonth: true,
    isSelected: true,
    isToday: false,
    ...overrides,
  };
}

function todo(overrides: Partial<HomeTodoItem> = {}): HomeTodoItem {
  return {
    createdAt: "2026-05-20T08:00:00.000Z",
    date: "2026-05-20",
    done: false,
    id: "todo-1",
    images: [],
    text: "整理会议笔记",
    ...overrides,
  };
}

function note(overrides: Partial<HomeSavedNote> = {}): HomeSavedNote {
  return {
    createdAt: "2026-05-20T09:00:00.000Z",
    id: "note-1",
    images: [],
    text: "一个临时想法",
    ...overrides,
  };
}

function renderHomeDashboard(
  overrides: Partial<Parameters<typeof HomeDashboard>[0]> = {},
) {
  return renderToStaticMarkup(
    <HomeDashboard
      activeDocument={null}
      activeNoteId={null}
      activeTodoItem={null}
      calendarDays={[calendarDay()]}
      calendarRef={null}
      draftImages={[]}
      hasCompletedTodos={false}
      hasMoreRecentDocuments={false}
      isCalendarOpen={false}
      isRecentExpanded={false}
      logoUrl="/icon.png"
      monthLabel="2026年5月"
      notes={[]}
      onChangeTodoYear={() => {}}
      onClearCompletedTodos={() => {}}
      onCreateDocument={() => {}}
      onDeleteNote={() => {}}
      onDeleteTodo={() => {}}
      onDraftPaste={() => {}}
      onOpenKnowledgeRelations={() => {}}
      onOpenNoteDialog={() => {}}
      onOpenRecentDocument={() => {}}
      onOpenRecentDocumentContextMenu={() => {}}
      onOpenWorkspaceFolder={() => {}}
      onPreviewImage={() => {}}
      onRemoveDraftImage={() => {}}
      onSelectCalendarDay={() => {}}
      onSelectNote={() => {}}
      onShiftTodoDate={() => {}}
      onShiftTodoMonth={() => {}}
      onSubmitTodo={() => {}}
      onTodoCalendarWheel={() => {}}
      onTodoDraftChange={() => {}}
      onTodoDragStart={() => {}}
      onTodoRowRef={() => {}}
      onToggleCalendar={() => {}}
      onToggleRecentExpanded={() => {}}
      onToggleTodo={() => {}}
      onUseToday={() => {}}
      recentDocuments={[]}
      remainingTodoCount={0}
      selectedMonthLabel="5月"
      selectedYear={2026}
      todoDateLabel="2026年5月20日"
      todoDateTitle="今日待办"
      todoDraft=""
      todoDrag={null}
      todoListRef={null}
      todoProgress={0}
      todoSelectedDate="2026-05-20"
      todayTodoDate="2026-05-20"
      visibleTodoItems={[]}
      workspacePath="D:/notes"
      yearOptions={[2025, 2026, 2027]}
      {...overrides}
    />,
  );
}

describe("HomeDashboard", () => {
  it("renders the home empty states", () => {
    const html = renderHomeDashboard();

    expect(html).toContain("工作台");
    expect(html).toContain("快捷操作");
    expect(html).toContain("还没有最近文档");
    expect(html).toContain("暂无待办");
    expect(html).toContain("保存后的便签会显示在这里");
  });

  it("renders recent documents, todos, and notes", () => {
    const html = renderHomeDashboard({
      activeNoteId: "note-1",
      notes: [note()],
      recentDocuments: [document()],
      remainingTodoCount: 1,
      visibleTodoItems: [todo()],
    });

    expect(html).toContain("Example.md");
    expect(html).toContain("D:/notes/");
    expect(html).toContain("整理会议笔记");
    expect(html).toContain("一个临时想法");
    expect(html).toContain("home-saved-note-active");
  });

  it("renders expanded recent and calendar controls", () => {
    const html = renderHomeDashboard({
      hasMoreRecentDocuments: true,
      isCalendarOpen: true,
      isRecentExpanded: true,
      recentDocuments: [document()],
    });

    expect(html).toContain("收起");
    expect(html).toContain("home-calendar-popover");
    expect(html).toContain("<option");
  });
});
