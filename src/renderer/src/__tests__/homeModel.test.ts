import { describe, expect, it, vi } from "vitest";
import {
  formatHomeTodoDateKey,
  getHomeTodoCalendarDays,
  getHomeTodoDateKeyFromCreatedAt,
  getHomeTodoDateTitle,
  homeQuickNoteImagesStorageKey,
  homeQuickNoteStorageKey,
  homeSavedNotesStorageKey,
  homeTodoStorageKey,
  loadHomeQuickNote,
  loadHomeQuickNoteImages,
  loadHomeSavedNotes,
  loadHomeTodoItems,
  normalizeHomeImageAttachments,
  parseHomeTodoDateKey,
  reorderHomeTodoItems,
  reorderHomeTodoItemsForDate,
  shiftHomeTodoDateKey,
  shiftHomeTodoMonthKey,
} from "../features/home/homeModel";

function createStorage(values: Record<string, string>) {
  return {
    getItem: (key: string) => values[key] ?? null,
  } as Storage;
}

describe("home model", () => {
  it("formats, parses and shifts todo date keys", () => {
    expect(formatHomeTodoDateKey(new Date(2026, 4, 9))).toBe("2026-05-09");
    expect(parseHomeTodoDateKey("2026-02-29")).toBeNull();
    expect(shiftHomeTodoDateKey("2026-05-09", 1)).toBe("2026-05-10");
    expect(shiftHomeTodoMonthKey("2026-01-31", 1)).toBe("2026-02-28");
    expect(getHomeTodoDateKeyFromCreatedAt("2026-05-09T12:00:00.000Z")).toBe(
      "2026-05-09",
    );
  });

  it("builds stable calendar days around the selected month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 9));

    const days = getHomeTodoCalendarDays("2026-05-09");

    expect(days).toHaveLength(42);
    expect(days.some((day) => day.dateKey === "2026-05-09" && day.isSelected)).toBe(
      true,
    );
    expect(days.some((day) => day.dateKey === "2026-05-09" && day.isToday)).toBe(
      true,
    );
    expect(getHomeTodoDateTitle("2026-05-09")).toBe("今日待办");
    expect(getHomeTodoDateTitle("2026-05-10")).toBe("明日待办");

    vi.useRealTimers();
  });

  it("normalizes image attachments and drops unsupported values", () => {
    const images = normalizeHomeImageAttachments([
      {
        dataUrl: "data:image/png;base64,aaa",
        fileName: "demo.png",
        id: "1",
        mimeType: "image/png",
      },
      {
        dataUrl: "data:video/mp4;base64,aaa",
        fileName: "demo.mp4",
        id: "2",
        mimeType: "video/mp4",
      },
    ]);

    expect(images).toEqual([
      {
        dataUrl: "data:image/png;base64,aaa",
        fileName: "demo.png",
        id: "1",
        mimeType: "image/png",
      },
    ]);
  });

  it("loads home storage without changing existing keys or data shape", () => {
    const storage = createStorage({
      [homeQuickNoteStorageKey]: "quick note",
      [homeQuickNoteImagesStorageKey]: JSON.stringify([
        {
          dataUrl: "data:image/png;base64,aaa",
          fileName: "note.png",
          id: "image-1",
          mimeType: "image/png",
        },
      ]),
      [homeSavedNotesStorageKey]: JSON.stringify([
        {
          createdAt: "2026-05-09T08:00:00.000Z",
          id: "note-1",
          images: [],
          text: "saved",
        },
      ]),
      [homeTodoStorageKey]: JSON.stringify([
        {
          createdAt: "2026-05-09T08:00:00.000Z",
          done: false,
          id: "todo-1",
          text: "todo",
        },
      ]),
    });

    expect(loadHomeQuickNote(storage)).toBe("quick note");
    expect(loadHomeQuickNoteImages(storage)).toHaveLength(1);
    expect(loadHomeSavedNotes(storage)).toEqual([
      {
        createdAt: "2026-05-09T08:00:00.000Z",
        id: "note-1",
        images: [],
        text: "saved",
      },
    ]);
    expect(loadHomeTodoItems(storage)).toEqual([
      {
        createdAt: "2026-05-09T08:00:00.000Z",
        date: "2026-05-09",
        done: false,
        id: "todo-1",
        images: [],
        text: "todo",
      },
    ]);
  });

  it("reorders todos globally and within a selected date", () => {
    const items = [
      {
        createdAt: "2026-05-09T08:00:00.000Z",
        date: "2026-05-09",
        done: false,
        id: "a",
        text: "A",
      },
      {
        createdAt: "2026-05-09T09:00:00.000Z",
        date: "2026-05-09",
        done: false,
        id: "b",
        text: "B",
      },
      {
        createdAt: "2026-05-10T09:00:00.000Z",
        date: "2026-05-10",
        done: false,
        id: "c",
        text: "C",
      },
    ];

    expect(reorderHomeTodoItems(items, "b", 0).map((item) => item.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(
      reorderHomeTodoItemsForDate(items, "2026-05-09", "b", 0).map((item) => item.id),
    ).toEqual(["b", "a", "c"]);
    expect(reorderHomeTodoItems(items, "missing", 0)).toBe(items);
  });
});
