import * as Dialog from "@radix-ui/react-dialog";
import {
  BookOpenText,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  PenLine,
  Plus,
  Smile,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import {
  TyporaEditor,
  type TyporaClipboardImage,
  type TyporaEditorHandle,
  type TyporaImageInsert,
} from "../../components/TyporaEditor";
import {
  getDiaryBody,
  getDiaryDateKey,
  getDiaryMetadata,
  replaceDiaryBodyPreservingMetadata,
  type DiaryEntry,
  type DiaryMetadata,
  type DiaryMood,
  type DiaryTemplateId,
  type DiaryYearGroup,
} from "../../diaryModel";
import { createMarkdownImageToken } from "../../markdownImages";
import {
  createMarkdownTable,
  type TableSize,
} from "../../markdownCommands";
import {
  normalizeTagName,
} from "../../noteKnowledge";
import type { EditorMode, MarkdownDocument } from "../../types";
import type { TyporaEditCommand } from "../../editorCommands";
import {
  tableClipboardPayloadToText,
  type TableClipboardPayload,
} from "../../../../shared/tableClipboard";

export type DiaryWorkspaceHandle = {
  focusEditor: () => void;
  insertImage: (image: TyporaImageInsert) => void;
  insertMarkdown: (markdown: string) => void;
  insertTable: (size: TableSize) => boolean;
  pasteTableClipboardPayload: (payload: TableClipboardPayload) => boolean;
  runEditCommand: (command: TyporaEditCommand) => void;
  scrollToLine: (lineIndex: number) => void;
};

type DiaryWorkspaceProps = {
  document: MarkdownDocument | null;
  editorMode: EditorMode;
  metadata?: DiaryMetadata | null;
  moodOptions: readonly DiaryMood[];
  onChange: (content: string) => void;
  onCopyImage?: (image: TyporaClipboardImage) => boolean | Promise<boolean>;
  onCreateToday: () => void;
  onEditorContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
  onMoodChange: (mood?: DiaryMood) => void;
  onPaste: (event: ClipboardEvent<HTMLElement>) => void | Promise<void>;
  onPreviewImage?: (image: { alt?: string; src: string }) => void;
  onRequestTableInsert?: () => void;
  onTagsChange: (tags: string[]) => void;
  onTemplateChange: (templateId: DiaryTemplateId) => void;
  templateOptions: DiaryTemplateOption[];
  workspacePath?: string;
};

type DiaryTemplateOption = {
  description: string;
  label: string;
  preview: string;
  value: DiaryTemplateId;
};

type DiarySidebarPanelProps = {
  document: MarkdownDocument | null;
  entries: DiaryEntry[];
  groups: DiaryYearGroup[];
  initialView?: DiarySidebarView;
  onCreateDate: (dateKey: string) => void;
  onCreateToday: () => void;
  onDeleteEntry?: (entry: DiaryEntry) => void;
  onOpenEntry: (entry: DiaryEntry) => void;
  workspacePath?: string;
};

type DiarySidebarView = "tree" | "calendar" | "timeline";

type DiaryCalendarDay = {
  dateKey: string;
  day: number;
  entry?: DiaryEntry;
  inMonth: boolean;
  isToday: boolean;
};

const diarySidebarViewOptions: Array<{
  icon: typeof BookOpenText;
  label: string;
  value: DiarySidebarView;
}> = [
  { icon: BookOpenText, label: "树", value: "tree" },
  { icon: Calendar, label: "日历", value: "calendar" },
  { icon: Clock3, label: "时间线", value: "timeline" },
];

const diaryWeekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

const diaryMoodVisuals: Record<
  DiaryMood,
  {
    className: string;
    emoji: string;
  }
> = {
  开心: { className: "happy", emoji: "😊" },
  平静: { className: "calm", emoji: "😌" },
  疲惫: { className: "tired", emoji: "😴" },
  焦虑: { className: "anxious", emoji: "😟" },
  低落: { className: "down", emoji: "😔" },
  兴奋: { className: "excited", emoji: "🤩" },
};

function getActiveDiaryDateKey(document?: MarkdownDocument | null) {
  return document?.title.match(/^\d{4}-\d{2}-\d{2}$/) ? document.title : null;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthKeyFromDateKey(dateKey?: string | null) {
  return dateKey?.match(/^\d{4}-\d{2}/)?.[0] ?? getDiaryDateKey().slice(0, 7);
}

function parseMonthKey(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText) || new Date().getFullYear();
  const month = Math.max(1, Math.min(12, Number(monthText) || 1));

  return new Date(year, month - 1, 1);
}

function shiftMonthKey(monthKey: string, delta: number) {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() + delta);

  return formatDateKey(date).slice(0, 7);
}

function getMonthTitle(monthKey: string) {
  const date = parseMonthKey(monthKey);

  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function getTextareaLineHeight(textarea: HTMLTextAreaElement) {
  const computedStyle = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(computedStyle.lineHeight);

  if (Number.isFinite(lineHeight)) {
    return lineHeight;
  }

  const fontSize = Number.parseFloat(computedStyle.fontSize);

  return Number.isFinite(fontSize) ? fontSize * 1.8 : 24;
}

function getMarkdownOffsetAtLine(markdown: string, lineIndex: number) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const safeLineIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));

  return lines
    .slice(0, safeLineIndex)
    .reduce((offset, line) => offset + line.length + 1, 0);
}

function getDiaryBodyStartOffset(content: string, body: string) {
  if (!body) {
    return content.length;
  }

  const bodyStart = content.indexOf(body);

  return bodyStart >= 0 ? bodyStart : 0;
}

function centerTextareaLine(textarea: HTMLTextAreaElement, lineIndex: number) {
  const computedStyle = window.getComputedStyle(textarea);
  const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
  const lineHeight = getTextareaLineHeight(textarea);
  const targetCenter = paddingTop + lineIndex * lineHeight + lineHeight / 2;

  textarea.scrollTo({
    behavior: "smooth",
    top: Math.max(0, targetCenter - textarea.clientHeight / 2),
  });
}

function getCalendarDays(monthKey: string, entries: DiaryEntry[]): DiaryCalendarDay[] {
  const entryByDate = new Map(entries.map((entry) => [entry.dateKey, entry]));
  const firstDay = parseMonthKey(monthKey);
  const startDate = new Date(firstDay);
  const mondayBasedWeekday = (firstDay.getDay() + 6) % 7;
  const todayKey = getDiaryDateKey();

  startDate.setDate(firstDay.getDate() - mondayBasedWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    const dateKey = formatDateKey(date);

    return {
      dateKey,
      day: date.getDate(),
      entry: entryByDate.get(dateKey),
      inMonth: dateKey.startsWith(monthKey),
      isToday: dateKey === todayKey,
    };
  });
}

function DiaryMoodIcon({
  mood,
  size = "normal",
}: {
  mood: DiaryMood;
  size?: "compact" | "normal";
}) {
  const visual = diaryMoodVisuals[mood];

  return (
    <span
      className={[
        "diary-mood-icon",
        `diary-mood-icon-${visual.className}`,
        size === "compact" ? "diary-mood-icon-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={mood}
    >
      {visual.emoji}
    </span>
  );
}

function getDefaultExpandedGroups(
  groups: DiaryYearGroup[],
  activeDateKey: string | null,
) {
  const yearKeys = new Set<string>();
  const monthKeys = new Set<string>();
  const activeYear = groups.find((year) =>
    year.months.some((month) =>
      month.entries.some((entry) => entry.dateKey === activeDateKey),
    ),
  );
  const activeMonth = activeYear?.months.find((month) =>
    month.entries.some((entry) => entry.dateKey === activeDateKey),
  );
  const preferredYear = activeYear ?? groups[0];
  const preferredMonth = activeMonth ?? preferredYear?.months[0];

  if (preferredYear) {
    yearKeys.add(preferredYear.key);
  }

  if (preferredMonth) {
    monthKeys.add(preferredMonth.key);
  }

  return { monthKeys, yearKeys };
}

function areSetsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) {
    return false;
  }

  for (const item of left) {
    if (!right.has(item)) {
      return false;
    }
  }

  return true;
}

export function DiarySidebarPanel({
  document,
  entries,
  groups,
  initialView = "tree",
  onCreateDate,
  onCreateToday,
  onDeleteEntry,
  onOpenEntry,
  workspacePath,
}: DiarySidebarPanelProps) {
  const activeDateKey = getActiveDiaryDateKey(document);
  const [view, setView] = useState<DiarySidebarView>(initialView);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    getMonthKeyFromDateKey(activeDateKey),
  );
  const [expandedGroups, setExpandedGroups] = useState(() =>
    getDefaultExpandedGroups(groups, activeDateKey),
  );
  const [entryContextMenu, setEntryContextMenu] = useState<{
    entry: DiaryEntry;
    x: number;
    y: number;
  } | null>(null);
  const calendarDays = useMemo(
    () => getCalendarDays(calendarMonth, entries),
    [calendarMonth, entries],
  );

  useEffect(() => {
    if (!entryContextMenu) {
      return;
    }

    const close = () => setEntryContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", close);

    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", close);
    };
  }, [entryContextMenu]);

  useEffect(() => {
    if (activeDateKey) {
      setCalendarMonth(getMonthKeyFromDateKey(activeDateKey));
    }
  }, [activeDateKey]);

  useEffect(() => {
    setExpandedGroups((current) => {
      const validYearKeys = new Set(groups.map((year) => year.key));
      const validMonthKeys = new Set(
        groups.flatMap((year) => year.months.map((month) => month.key)),
      );
      const nextYearKeys = new Set(
        [...current.yearKeys].filter((key) => validYearKeys.has(key)),
      );
      const nextMonthKeys = new Set(
        [...current.monthKeys].filter((key) => validMonthKeys.has(key)),
      );
      const defaults = getDefaultExpandedGroups(groups, activeDateKey);

      if (activeDateKey || nextYearKeys.size === 0) {
        defaults.yearKeys.forEach((key) => nextYearKeys.add(key));
      }

      if (activeDateKey || nextMonthKeys.size === 0) {
        defaults.monthKeys.forEach((key) => nextMonthKeys.add(key));
      }

      if (
        areSetsEqual(current.yearKeys, nextYearKeys) &&
        areSetsEqual(current.monthKeys, nextMonthKeys)
      ) {
        return current;
      }

      return { monthKeys: nextMonthKeys, yearKeys: nextYearKeys };
    });
  }, [activeDateKey, groups]);

  function toggleYear(yearKey: string) {
    setExpandedGroups((current) => {
      const yearKeys = new Set(current.yearKeys);

      if (yearKeys.has(yearKey)) {
        yearKeys.delete(yearKey);
      } else {
        yearKeys.add(yearKey);
      }

      return { ...current, yearKeys };
    });
  }

  function toggleMonth(monthKey: string) {
    setExpandedGroups((current) => {
      const monthKeys = new Set(current.monthKeys);

      if (monthKeys.has(monthKey)) {
        monthKeys.delete(monthKey);
      } else {
        monthKeys.add(monthKey);
      }

      return { ...current, monthKeys };
    });
  }

  function openEntryContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    entry: DiaryEntry,
  ) {
    if (!onDeleteEntry) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setEntryContextMenu({
      entry,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function deleteContextEntry() {
    if (!entryContextMenu || !onDeleteEntry) {
      return;
    }

    const { entry } = entryContextMenu;

    setEntryContextMenu(null);
    onDeleteEntry(entry);
  }

  return (
    <section className="diary-sidebar-panel" aria-label="日记列表">
      <button
        className="diary-today-button"
        type="button"
        disabled={!workspacePath}
        onClick={onCreateToday}
      >
        <Plus size={16} />
        写今天日记
      </button>

      <div className="diary-sidebar-view-tabs" role="tablist" aria-label="日记视图">
        {diarySidebarViewOptions.map((option) => {
          const Icon = option.icon;

          return (
            <button
              className={view === option.value ? "diary-view-tab diary-view-tab-active" : "diary-view-tab"}
              key={option.value}
              type="button"
              role="tab"
              aria-selected={view === option.value}
              onClick={() => setView(option.value)}
            >
              <Icon size={14} />
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="diary-sidebar-scroll">
        {view === "tree" ? (
          <div className="diary-tree" aria-label="日记年月列表">
            {groups.length ? (
              groups.map((year) => {
                const isYearExpanded = expandedGroups.yearKeys.has(year.key);
                const yearEntryCount = year.months.reduce(
                  (total, month) => total + month.entries.length,
                  0,
                );

                return (
                  <section className="diary-year-group" key={year.key}>
                    <button
                      className="diary-group-toggle diary-year-toggle"
                      type="button"
                      aria-expanded={isYearExpanded}
                      onClick={() => toggleYear(year.key)}
                    >
                      {isYearExpanded ? (
                        <ChevronDown size={15} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                      <span>{year.label}</span>
                      <small>{yearEntryCount}篇</small>
                    </button>
                    {isYearExpanded ? (
                      <div className="diary-year-content">
                        {year.months.map((month) => {
                          const isMonthExpanded = expandedGroups.monthKeys.has(month.key);

                          return (
                            <section className="diary-month-group" key={month.key}>
                              <button
                                className="diary-group-toggle diary-month-toggle"
                                type="button"
                                aria-expanded={isMonthExpanded}
                                onClick={() => toggleMonth(month.key)}
                              >
                                {isMonthExpanded ? (
                                  <ChevronDown size={14} />
                                ) : (
                                  <ChevronRight size={14} />
                                )}
                                <span>{month.label}</span>
                                <small>{month.entries.length}篇</small>
                              </button>
                              {isMonthExpanded ? (
                                <div className="diary-entry-list">
                                  {month.entries.map((entry) => (
                                    <button
                                      className={[
                                        "diary-entry-row",
                                        entry.dateKey === activeDateKey
                                          ? "diary-entry-row-active"
                                          : "",
                                      ]
                                        .filter(Boolean)
                                        .join(" ")}
                                      key={entry.filePath}
                                      title={
                                        onDeleteEntry
                                          ? `${entry.dateKey} · 右键删除日记`
                                          : entry.dateKey
                                      }
                                      type="button"
                                      onContextMenu={(event) =>
                                        openEntryContextMenu(event, entry)
                                      }
                                      onClick={() => onOpenEntry(entry)}
                                    >
                                      <span className="diary-entry-day">
                                        {entry.dayLabel}
                                      </span>
                                      <span className="diary-entry-title">
                                        <FileText size={13} />
                                        {entry.dateKey}
                                      </span>
                                      {entry.mood ? (
                                        <DiaryMoodIcon mood={entry.mood} size="compact" />
                                      ) : null}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </section>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })
            ) : (
              <div className="diary-empty-tree">
                <CalendarDays size={18} />
                <strong>还没有日记</strong>
                <span>创建今天的日记后，会按年月出现在这里。</span>
              </div>
            )}
          </div>
        ) : null}

        {view === "calendar" ? (
          <section className="diary-calendar-view" aria-label="日记日历">
            <header className="diary-calendar-header">
              <button
                type="button"
                aria-label="上个月"
                onClick={() => setCalendarMonth((current) => shiftMonthKey(current, -1))}
              >
                <ChevronLeft size={14} />
              </button>
              <strong>{getMonthTitle(calendarMonth)}</strong>
              <button
                type="button"
                aria-label="下个月"
                onClick={() => setCalendarMonth((current) => shiftMonthKey(current, 1))}
              >
                <ChevronRight size={14} />
              </button>
            </header>
            <div className="diary-calendar-weekdays" aria-hidden="true">
              {diaryWeekdayLabels.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="diary-calendar-grid">
              {calendarDays.map((day) => (
                <button
                  className={[
                    "diary-calendar-day",
                    day.inMonth ? "" : "diary-calendar-day-muted",
                    day.isToday ? "diary-calendar-day-today" : "",
                    day.entry ? "diary-calendar-day-has-entry" : "",
                    day.dateKey === activeDateKey ? "diary-calendar-day-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={day.dateKey}
                  type="button"
                  title={
                    day.entry
                      ? onDeleteEntry
                        ? `打开 ${day.dateKey} · 右键删除日记`
                        : `打开 ${day.dateKey}`
                      : `补写 ${day.dateKey}`
                  }
                  onContextMenu={(event) => {
                    if (day.entry) {
                      openEntryContextMenu(event, day.entry);
                    }
                  }}
                  onClick={() => (day.entry ? onOpenEntry(day.entry) : onCreateDate(day.dateKey))}
                >
                  <span>{day.day}</span>
                  {day.entry?.mood ? (
                    <DiaryMoodIcon mood={day.entry.mood} size="compact" />
                  ) : day.entry ? (
                    <span className="diary-calendar-entry-mark" />
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {view === "timeline" ? (
          <section className="diary-timeline" aria-label="日记时间线">
            {entries.length ? (
              <div className="diary-timeline-track">
                {entries.map((entry) => (
                  <button
                    className={[
                      "diary-timeline-row",
                      entry.dateKey === activeDateKey
                        ? "diary-timeline-row-active"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={entry.filePath}
                    title={
                      onDeleteEntry
                        ? `${entry.dateKey} · 右键删除日记`
                        : entry.dateKey
                    }
                    type="button"
                    onContextMenu={(event) => openEntryContextMenu(event, entry)}
                    onClick={() => onOpenEntry(entry)}
                  >
                    <span className="diary-timeline-node" aria-hidden="true" />
                    <span className="diary-timeline-content">
                      <span className="diary-timeline-date">{entry.dateKey}</span>
                      {entry.mood || entry.tags.length ? (
                        <span className="diary-timeline-meta">
                          {entry.mood ? (
                            <span>
                              <DiaryMoodIcon mood={entry.mood} size="compact" />
                              {entry.mood}
                            </span>
                          ) : null}
                          {entry.tags.slice(0, 3).map((tag) => (
                            <span className="diary-timeline-tag" key={tag}>
                              #{tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      <span className="diary-timeline-summary">
                        {entry.summary || "暂无摘要"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="diary-empty-tree">
                <Clock3 size={18} />
                <strong>暂无时间线</strong>
                <span>写下第一篇日记后，这里会显示日期、心情和摘要。</span>
              </div>
            )}
          </section>
        ) : null}
      </div>
      {entryContextMenu && onDeleteEntry
        ? createPortal(
            <div
              className="diary-entry-context-menu"
              role="menu"
              style={{
                left: entryContextMenu.x,
                top: entryContextMenu.y,
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                className="diary-entry-context-menu-item diary-entry-context-menu-danger"
                type="button"
                role="menuitem"
                onClick={deleteContextEntry}
              >
                <Trash2 size={14} />
                删除日记
              </button>
            </div>,
            globalThis.document.body,
          )
        : null}
    </section>
  );
}

type DiaryMetadataBarProps = {
  metadata: DiaryMetadata;
  moodOptions: readonly DiaryMood[];
  onMoodChange: (mood?: DiaryMood) => void;
  onTagsChange: (tags: string[]) => void;
  onTemplateChange: (templateId: DiaryTemplateId) => void;
  templateOptions: DiaryTemplateOption[];
};

function DiaryMetadataBar({
  metadata,
  moodOptions,
  onMoodChange,
  onTagsChange,
  onTemplateChange,
  templateOptions,
}: DiaryMetadataBarProps) {
  const [tagDraft, setTagDraft] = useState("");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const activeTemplate =
    templateOptions.find((option) => option.value === metadata.templateId) ??
    templateOptions[0];

  useEffect(() => {
    setTagDraft("");
  }, [metadata.dateKey]);

  function addTag() {
    const normalizedTag = normalizeTagName(tagDraft);

    if (!normalizedTag) {
      return;
    }

    const nextTags = [
      ...metadata.tags.filter(
        (tag) => tag.toLocaleLowerCase() !== normalizedTag.toLocaleLowerCase(),
      ),
      normalizedTag,
    ];

    onTagsChange(nextTags);
    setTagDraft("");
  }

  function removeTag(tagToRemove: string) {
    onTagsChange(metadata.tags.filter((tag) => tag !== tagToRemove));
  }

  function chooseTemplate(templateId: DiaryTemplateId) {
    onTemplateChange(templateId);
    setIsTemplateDialogOpen(false);
  }

  return (
    <section className="diary-metadata-bar" aria-label="日记元数据">
      <div className="diary-metadata-group diary-metadata-mood">
        <span>
          <Smile size={14} />
          心情
        </span>
        <div className="diary-mood-options">
          {moodOptions.map((mood) => (
            <button
              className={[
                "diary-mood-chip",
                metadata.mood === mood ? "diary-mood-chip-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={mood}
              type="button"
              aria-pressed={metadata.mood === mood}
              onClick={() => onMoodChange(metadata.mood === mood ? undefined : mood)}
            >
              <DiaryMoodIcon mood={mood} />
              {mood}
            </button>
          ))}
        </div>
      </div>

      <div className="diary-metadata-group diary-metadata-tags">
        <span>
          <Tag size={14} />
          标签
        </span>
        <div className="diary-tag-list">
          {metadata.tags.map((tag) => (
            <span className="diary-tag-chip" key={tag}>
              #{tag}
              <button
                type="button"
                aria-label={`移除标签 ${tag}`}
                onClick={() => removeTag(tag)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <form
            className="diary-tag-form"
            onSubmit={(event) => {
              event.preventDefault();
              addTag();
            }}
          >
            <input
              type="text"
              value={tagDraft}
              placeholder="添加标签"
              onChange={(event) => setTagDraft(event.currentTarget.value)}
            />
            <button type="submit" disabled={!tagDraft.trim()}>
              <Plus size={12} />
            </button>
          </form>
        </div>
      </div>

      <div className="diary-metadata-group diary-template-field">
        <span>模板</span>
        <button
          className="diary-template-trigger"
          type="button"
          title="切换日记模板"
          onClick={() => setIsTemplateDialogOpen(true)}
        >
          <BookOpenText size={14} />
          {activeTemplate?.label ?? "选择模板"}
        </button>
        <Dialog.Root
          open={isTemplateDialogOpen}
          onOpenChange={setIsTemplateDialogOpen}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay diary-template-dialog-overlay" />
            <Dialog.Content className="diary-template-dialog">
              <div className="diary-template-dialog-header">
                <div>
                  <Dialog.Title className="diary-template-dialog-title">
                    选择日记模板
                  </Dialog.Title>
                  <Dialog.Description className="diary-template-dialog-description">
                    切换模板会保留已有内容，并按新模板整理正文。
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    className="icon-button diary-template-dialog-close"
                    type="button"
                    aria-label="关闭模板选择"
                  >
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>
              <div className="diary-template-grid">
                {templateOptions.map((option) => {
                  const isActive = option.value === metadata.templateId;

                  return (
                    <button
                      className={[
                        "diary-template-card",
                        isActive ? "diary-template-card-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => chooseTemplate(option.value)}
                    >
                      <span className="diary-template-card-head">
                        <strong>{option.label}</strong>
                        {isActive ? <CheckTemplateIcon /> : null}
                      </span>
                      <span className="diary-template-card-description">
                        {option.description}
                      </span>
                      <span className="diary-template-card-preview">
                        {option.preview}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </section>
  );
}

function CheckTemplateIcon() {
  return (
    <span className="diary-template-card-check" aria-hidden="true">
      <Check size={13} />
    </span>
  );
}

export const DiaryWorkspace = forwardRef<DiaryWorkspaceHandle, DiaryWorkspaceProps>(
  function DiaryWorkspace(
    {
      document,
      editorMode,
      metadata,
      moodOptions,
      onChange,
      onCopyImage,
      onCreateToday,
      onEditorContextMenu,
      onMoodChange,
      onPaste,
      onPreviewImage,
      onRequestTableInsert,
      onTagsChange,
      onTemplateChange,
      templateOptions,
      workspacePath,
    },
    ref,
  ) {
    const typoraEditorRef = useRef<TyporaEditorHandle | null>(null);
    const sourceEditorRef = useRef<HTMLTextAreaElement | null>(null);
    const typoraValue = useMemo(
      () => getDiaryBody(document?.content ?? ""),
      [document?.content],
    );
    const activeMetadata = useMemo(
      () =>
        document
          ? metadata ?? getDiaryMetadata(document.content, document.title)
          : null,
      [document, metadata],
    );

    function insertMarkdown(markdown: string) {
      if (editorMode === "typora" && typoraEditorRef.current) {
        typoraEditorRef.current.insertMarkdown(markdown);
        return;
      }

      const editor = sourceEditorRef.current;

      if (!document || !editor) {
        onChange(`${document?.content ?? ""}${markdown}`);
        return;
      }

      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const nextContent =
        document.content.slice(0, start) + markdown + document.content.slice(end);
      const nextCursor = start + markdown.length;

      onChange(nextContent);
      requestAnimationFrame(() => {
        editor.focus();
        editor.setSelectionRange(nextCursor, nextCursor);
      });
    }

    function insertImage(image: TyporaImageInsert) {
      if (editorMode === "typora" && typoraEditorRef.current) {
        typoraEditorRef.current.insertImage(image);
        return;
      }

      insertMarkdown(
        createMarkdownImageToken({
          alt: image.alt,
          source: image.source,
          title: image.title,
        }),
      );
    }

    function insertTable(size: TableSize) {
      if (editorMode === "preview") {
        return false;
      }

      if (editorMode === "typora" && typoraEditorRef.current) {
        return typoraEditorRef.current.insertTable(size);
      }

      const markdown = createMarkdownTable(size);
      const editor = sourceEditorRef.current;

      if (!document || !editor) {
        insertMarkdown(markdown);
        return true;
      }

      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const firstCellOffset = Math.max(0, markdown.indexOf("| ") + 2);
      const nextContent =
        document.content.slice(0, start) + markdown + document.content.slice(end);

      onChange(nextContent);
      requestAnimationFrame(() => {
        editor.focus();
        editor.setSelectionRange(
          start + firstCellOffset,
          start + firstCellOffset,
        );
      });
      return true;
    }

    function pasteTableClipboardPayload(payload: TableClipboardPayload) {
      if (editorMode === "preview") {
        return false;
      }

      if (editorMode === "typora" && typoraEditorRef.current) {
        return typoraEditorRef.current.pasteTableClipboardPayload(payload);
      }

      insertMarkdown(tableClipboardPayloadToText(payload));
      return true;
    }

    function runEditCommand(command: TyporaEditCommand) {
      if (editorMode === "typora" && typoraEditorRef.current) {
        typoraEditorRef.current.runEditCommand(command);
        return;
      }

      sourceEditorRef.current?.focus();

      if (
        command === "copy" ||
        command === "cut" ||
        command === "delete" ||
        command === "undo" ||
        command === "redo"
      ) {
        globalThis.document.execCommand(command);
      }
    }

    function scrollToLine(lineIndex: number) {
      if (editorMode === "typora" && typoraEditorRef.current) {
        typoraEditorRef.current.scrollToLine(lineIndex);
        return;
      }

      const editor = sourceEditorRef.current;

      if (!document || !editor) {
        return;
      }

      const body = getDiaryBody(document.content);
      const sourceOffset =
        getDiaryBodyStartOffset(document.content, body) +
        getMarkdownOffsetAtLine(body, lineIndex);

      editor.focus();
      editor.setSelectionRange(sourceOffset, sourceOffset);
      centerTextareaLine(editor, lineIndex);
    }

    useImperativeHandle(ref, () => ({
      focusEditor() {
        if (editorMode === "typora") {
          typoraEditorRef.current?.focusEditor();
          return;
        }

        sourceEditorRef.current?.focus();
      },
      insertImage,
      insertMarkdown,
      insertTable,
      pasteTableClipboardPayload,
      runEditCommand,
      scrollToLine,
    }));

    if (!document) {
      return (
        <section className="diary-editor-empty">
          <PenLine size={24} />
          <strong>{workspacePath ? "还没有日记" : "先打开一个本地文档目录"}</strong>
          <span>
            {workspacePath
              ? "写下今天的第一段想法，日记会保存在当前工作区里。"
              : "日记会跟随工作区保存，方便和笔记一起备份。"}
          </span>
          <button type="button" disabled={!workspacePath} onClick={onCreateToday}>
            <Plus size={16} />
            写今天日记
          </button>
        </section>
      );
    }

    return (
      <section className={`diary-editor diary-editor-${editorMode}`}>
        {activeMetadata ? (
          <DiaryMetadataBar
            metadata={activeMetadata}
            moodOptions={moodOptions}
            onMoodChange={onMoodChange}
            onTagsChange={onTagsChange}
            onTemplateChange={onTemplateChange}
            templateOptions={templateOptions}
          />
        ) : null}

        {editorMode === "typora" ? (
          <TyporaEditor
            ref={typoraEditorRef}
            documentId={`diary:${document.filePath ?? document.id}`}
            filePath={document.filePath}
            value={typoraValue}
            onChange={(body) =>
              onChange(
                replaceDiaryBodyPreservingMetadata(document.content, body),
              )
            }
            onContextMenu={onEditorContextMenu}
            onCopyImage={onCopyImage}
            onPaste={onPaste}
            onPreviewImage={onPreviewImage}
            onRequestTableInsert={onRequestTableInsert}
          />
        ) : null}

        {editorMode === "source" || editorMode === "split" ? (
          <textarea
            ref={sourceEditorRef}
            className="markdown-input diary-source-input"
            spellCheck={false}
            value={document.content}
            onChange={(event) => onChange(event.target.value)}
            onContextMenu={onEditorContextMenu}
            onPaste={onPaste}
          />
        ) : null}

        {editorMode === "split" || editorMode === "preview" ? (
          <article
            className="markdown-preview diary-preview"
            tabIndex={-1}
            onContextMenu={onEditorContextMenu}
          >
            <MarkdownRenderer
              filePath={document.filePath}
              onPreviewImage={onPreviewImage}
            >
              {typoraValue}
            </MarkdownRenderer>
          </article>
        ) : null}
      </section>
    );
  },
);
