export const homeRecentDocumentLimit = 3;
export const homeTodoStorageKey = "notedock:home-todos";
export const homeQuickNoteStorageKey = "notedock:home-quick-note";
export const homeQuickNoteImagesStorageKey = "notedock:home-quick-note-images";
export const homeSavedNotesStorageKey = "notedock:home-saved-notes";
export const homeCalendarWeekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

const homeCalendarRecentYearRadius = 1;

export type HomeImageAttachment = {
  dataUrl: string;
  fileName: string;
  id: string;
  mimeType: string;
};

export type HomeSavedNote = {
  createdAt: string;
  id: string;
  images?: HomeImageAttachment[];
  text: string;
};

export type HomeTodoItem = {
  createdAt: string;
  date: string;
  done: boolean;
  id: string;
  images?: HomeImageAttachment[];
  text: string;
};

export type HomeTodoDragState = {
  height: number;
  id: string;
  insertIndex: number;
  left: number;
  offsetY: number;
  pointerId: number;
  pointerY: number;
  width: number;
};

export type HomeCalendarDay = {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
};

type HomeStorage = Pick<Storage, "getItem">;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getHomeStorage(): HomeStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function createHomeTodoId() {
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createHomeSavedNoteId() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createHomeImageAttachmentId() {
  return `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatHomeTodoDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseHomeTodoDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function normalizeHomeTodoDateKey(
  value: unknown,
  fallbackDateKey = formatHomeTodoDateKey(),
) {
  if (typeof value === "string" && parseHomeTodoDateKey(value)) {
    return value;
  }

  return fallbackDateKey;
}

export function getHomeTodoDateKeyFromCreatedAt(createdAt: string) {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return formatHomeTodoDateKey();
  }

  return formatHomeTodoDateKey(createdDate);
}

export function shiftHomeTodoDateKey(dateKey: string, offset: number) {
  const date = parseHomeTodoDateKey(dateKey) ?? new Date();
  date.setDate(date.getDate() + offset);

  return formatHomeTodoDateKey(date);
}

export function shiftHomeTodoMonthKey(dateKey: string, offset: number) {
  const date = parseHomeTodoDateKey(dateKey) ?? new Date();
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + offset;
  const targetMonthLastDay = new Date(targetYear, targetMonth + 1, 0).getDate();

  return formatHomeTodoDateKey(
    new Date(
      targetYear,
      targetMonth,
      Math.min(date.getDate(), targetMonthLastDay),
    ),
  );
}

export function setHomeTodoYearKey(dateKey: string, year: number) {
  const date = parseHomeTodoDateKey(dateKey) ?? new Date();
  const normalizedYear = Number.isFinite(year) ? Math.trunc(year) : date.getFullYear();
  const targetMonth = date.getMonth();
  const targetMonthLastDay = new Date(normalizedYear, targetMonth + 1, 0).getDate();

  return formatHomeTodoDateKey(
    new Date(
      normalizedYear,
      targetMonth,
      Math.min(date.getDate(), targetMonthLastDay),
    ),
  );
}

export function getHomeTodoYearOptions(dateKey: string) {
  const selectedDate = parseHomeTodoDateKey(dateKey) ?? new Date();
  const currentYear = new Date().getFullYear();
  const selectedYear = selectedDate.getFullYear();
  const years = new Set<number>();

  for (
    let year = currentYear - homeCalendarRecentYearRadius;
    year <= currentYear + homeCalendarRecentYearRadius;
    year += 1
  ) {
    years.add(year);
  }

  years.add(selectedYear);

  return [...years].sort((first, second) => first - second);
}

export function getHomeTodoCalendarDays(dateKey: string): HomeCalendarDay[] {
  const selectedDate = parseHomeTodoDateKey(dateKey) ?? new Date();
  const selectedMonth = selectedDate.getMonth();
  const firstDay = new Date(selectedDate.getFullYear(), selectedMonth, 1);
  const mondayStartOffset = (firstDay.getDay() + 6) % 7;
  const gridStartDate = new Date(firstDay);
  gridStartDate.setDate(firstDay.getDate() - mondayStartOffset);
  const todayKey = formatHomeTodoDateKey();

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStartDate);
    date.setDate(gridStartDate.getDate() + index);
    const dayDateKey = formatHomeTodoDateKey(date);

    return {
      dateKey: dayDateKey,
      day: date.getDate(),
      inMonth: date.getMonth() === selectedMonth,
      isSelected: dayDateKey === dateKey,
      isToday: dayDateKey === todayKey,
    };
  });
}

export function formatHomeTodoDateLabel(dateKey: string) {
  const date = parseHomeTodoDateKey(dateKey) ?? new Date();

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatHomeTodoMonthLabel(dateKey: string) {
  const date = parseHomeTodoDateKey(dateKey) ?? new Date();

  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function getRelativeHomeTodoDateOffset(dateKey: string) {
  const selectedDate = parseHomeTodoDateKey(dateKey);

  if (!selectedDate) {
    return null;
  }

  const today = parseHomeTodoDateKey(formatHomeTodoDateKey()) ?? new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  return Math.round((selectedDate.getTime() - today.getTime()) / msPerDay);
}

export function getHomeTodoDateTitle(dateKey: string) {
  const relativeOffset = getRelativeHomeTodoDateOffset(dateKey);

  if (relativeOffset === 0) {
    return "今日待办";
  }

  if (relativeOffset === 1) {
    return "明日待办";
  }

  if (relativeOffset === -1) {
    return "昨日待办";
  }

  const selectedDate = parseHomeTodoDateKey(dateKey) ?? new Date();
  const currentYear = new Date().getFullYear();
  const prefix =
    selectedDate.getFullYear() === currentYear
      ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`
      : `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`;

  return `${prefix}待办`;
}

export function reorderHomeTodoItemsForDate(
  items: HomeTodoItem[],
  dateKey: string,
  activeTodoId: string,
  insertIndex: number,
) {
  const datedItems = items.filter((item) => item.date === dateKey);
  const reorderedDatedItems = reorderHomeTodoItems(
    datedItems,
    activeTodoId,
    insertIndex,
  );

  if (reorderedDatedItems === datedItems) {
    return items;
  }

  let datedItemIndex = 0;

  return items.map((item) =>
    item.date === dateKey ? reorderedDatedItems[datedItemIndex++] : item,
  );
}

export function normalizeHomeImageAttachments(value: unknown): HomeImageAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((image): image is HomeImageAttachment =>
      Boolean(
        image &&
          typeof image.id === "string" &&
          typeof image.dataUrl === "string" &&
          typeof image.fileName === "string" &&
          typeof image.mimeType === "string" &&
          image.mimeType.startsWith("image/"),
      ),
    )
    .slice(0, 8);
}

export function loadHomeQuickNote(storage = getHomeStorage()) {
  if (!storage) {
    return "";
  }

  try {
    return storage.getItem(homeQuickNoteStorageKey) ?? "";
  } catch {
    return "";
  }
}

export function loadHomeQuickNoteImages(storage = getHomeStorage()): HomeImageAttachment[] {
  if (!storage) {
    return [];
  }

  try {
    return normalizeHomeImageAttachments(
      JSON.parse(storage.getItem(homeQuickNoteImagesStorageKey) ?? "[]"),
    );
  } catch {
    return [];
  }
}

export function loadHomeSavedNotes(storage = getHomeStorage()): HomeSavedNote[] {
  if (!storage) {
    return [];
  }

  try {
    const rawNotes = storage.getItem(homeSavedNotesStorageKey);

    if (!rawNotes) {
      return [];
    }

    const parsedNotes = JSON.parse(rawNotes);

    if (!Array.isArray(parsedNotes)) {
      return [];
    }

    return parsedNotes
      .filter((note): note is HomeSavedNote =>
        Boolean(
          note &&
            typeof note.id === "string" &&
            typeof note.text === "string" &&
            typeof note.createdAt === "string",
        ),
      )
      .map((note) => ({
        ...note,
        images: normalizeHomeImageAttachments(note.images),
      }))
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function loadHomeTodoItems(storage = getHomeStorage()): HomeTodoItem[] {
  if (!storage) {
    return [];
  }

  try {
    const rawItems = storage.getItem(homeTodoStorageKey);

    if (!rawItems) {
      return [];
    }

    const parsedItems = JSON.parse(rawItems);

    if (!Array.isArray(parsedItems)) {
      return [];
    }

    return parsedItems
      .map((item): HomeTodoItem | null => {
        if (
          !item ||
          typeof item.id !== "string" ||
          typeof item.text !== "string" ||
          typeof item.done !== "boolean" ||
          typeof item.createdAt !== "string"
        ) {
          return null;
        }

        return {
          createdAt: item.createdAt,
          date: normalizeHomeTodoDateKey(
            item.date,
            getHomeTodoDateKeyFromCreatedAt(item.createdAt),
          ),
          done: item.done,
          id: item.id,
          images: normalizeHomeImageAttachments(item.images),
          text: item.text,
        };
      })
      .filter((item): item is HomeTodoItem => Boolean(item))
      .slice(0, 80);
  } catch {
    return [];
  }
}

export function reorderHomeTodoItems(
  items: HomeTodoItem[],
  activeTodoId: string,
  insertIndex: number,
) {
  const activeIndex = items.findIndex((item) => item.id === activeTodoId);

  if (activeIndex < 0) {
    return items;
  }

  const activeItem = items[activeIndex];
  const nextItems = items.filter((item) => item.id !== activeTodoId);
  const targetIndex = clamp(insertIndex, 0, nextItems.length);

  nextItems.splice(targetIndex, 0, activeItem);

  const didOrderChange = nextItems.some((item, index) => item.id !== items[index]?.id);

  return didOrderChange ? nextItems : items;
}
