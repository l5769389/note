import {
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Fragment,
  type ClipboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { getDocumentDisplayName, getDocumentPathPreview } from "../../documentModel";
import {
  formatRecentTimestamp,
  getRecentDocumentTimestamp,
  normalizeFilePathKey,
} from "../../workspaceDisplay";
import type { MarkdownDocument } from "../../types";
import { HomeQuickAction } from "./HomeQuickAction";
import {
  HomeTodoDragPreview,
  HomeTodoDropSlot,
  HomeTodoRow,
} from "./HomeTodoList";
import {
  homeCalendarWeekdayLabels,
  type HomeCalendarDay,
  type HomeImageAttachment,
  type HomeSavedNote,
  type HomeTodoDragState,
  type HomeTodoItem,
} from "./homeModel";

type HomeDashboardProps = {
  activeDocument?: MarkdownDocument | null;
  activeNoteId: string | null;
  activeTodoItem: HomeTodoItem | null;
  calendarDays: HomeCalendarDay[];
  calendarRef: Ref<HTMLDivElement>;
  draftImages: HomeImageAttachment[];
  hasCompletedTodos: boolean;
  hasMoreRecentDocuments: boolean;
  isCalendarOpen: boolean;
  isRecentExpanded: boolean;
  logoUrl: string;
  monthLabel: string;
  notes: HomeSavedNote[];
  onChangeTodoYear: (year: number) => void;
  onClearCompletedTodos: () => void;
  onCreateDocument: () => void;
  onDeleteNote: (noteId: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onDraftPaste: (event: ClipboardEvent<HTMLInputElement>) => void | Promise<void>;
  onOpenKnowledgeRelations: () => void;
  onOpenNoteDialog: () => void;
  onOpenRecentDocument: (document: MarkdownDocument) => void | Promise<void>;
  onOpenRecentDocumentContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    document: MarkdownDocument,
  ) => void;
  onOpenWorkspaceFolder: () => void | Promise<void>;
  onPreviewImage: (image: HomeImageAttachment) => void;
  onRemoveDraftImage: (imageId: string) => void;
  onSelectCalendarDay: (dateKey: string) => void;
  onSelectNote: (noteId: string) => void;
  onShiftTodoDate: (days: number) => void;
  onShiftTodoMonth: (months: number) => void;
  onSubmitTodo: () => void;
  onTodoCalendarWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onTodoDraftChange: (value: string) => void;
  onTodoDragStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    todoId: string,
  ) => void;
  onTodoRowRef: (todoId: string, node: HTMLDivElement | null) => void;
  onToggleCalendar: () => void;
  onToggleRecentExpanded: () => void;
  onToggleTodo: (todoId: string) => void;
  onUseToday: () => void;
  recentDocuments: MarkdownDocument[];
  getDocumentPathLabel?: (document: MarkdownDocument) => string;
  remainingTodoCount: number;
  selectedMonthLabel: string;
  selectedYear: number;
  showNotePanel?: boolean;
  showTodoPanel?: boolean;
  todoDateLabel: string;
  todoDateTitle: string;
  todoDraft: string;
  todoDrag: HomeTodoDragState | null;
  todoListRef: Ref<HTMLDivElement>;
  todoProgress: number;
  todoSelectedDate: string;
  todayTodoDate: string;
  visibleTodoItems: HomeTodoItem[];
  workspacePath?: string;
  yearOptions: number[];
};

function isSameDashboardDocument(
  left?: MarkdownDocument | null,
  right?: MarkdownDocument | null,
) {
  if (!left || !right) {
    return false;
  }

  if (left.id === right.id) {
    return true;
  }

  return Boolean(
    left.filePath &&
      right.filePath &&
      normalizeFilePathKey(left.filePath) === normalizeFilePathKey(right.filePath),
  );
}

export function HomeDashboard({
  activeDocument,
  activeNoteId,
  activeTodoItem,
  calendarDays,
  calendarRef,
  draftImages,
  hasCompletedTodos,
  hasMoreRecentDocuments,
  isCalendarOpen,
  isRecentExpanded,
  logoUrl,
  monthLabel,
  notes,
  onChangeTodoYear,
  onClearCompletedTodos,
  onCreateDocument,
  onDeleteNote,
  onDeleteTodo,
  onDraftPaste,
  onOpenKnowledgeRelations,
  onOpenNoteDialog,
  onOpenRecentDocument,
  onOpenRecentDocumentContextMenu,
  onOpenWorkspaceFolder,
  onPreviewImage,
  onRemoveDraftImage,
  onSelectCalendarDay,
  onSelectNote,
  onShiftTodoDate,
  onShiftTodoMonth,
  onSubmitTodo,
  onTodoCalendarWheel,
  onTodoDraftChange,
  onTodoDragStart,
  onTodoRowRef,
  onToggleCalendar,
  onToggleRecentExpanded,
  onToggleTodo,
  onUseToday,
  recentDocuments,
  getDocumentPathLabel,
  remainingTodoCount,
  selectedMonthLabel,
  selectedYear,
  showNotePanel = true,
  showTodoPanel = true,
  todoDateLabel,
  todoDateTitle,
  todoDraft,
  todoDrag,
  todoListRef,
  todoProgress,
  todoSelectedDate,
  todayTodoDate,
  visibleTodoItems,
  workspacePath,
  yearOptions,
}: HomeDashboardProps) {
  const hasVisibleTodos = visibleTodoItems.length > 0 || Boolean(todoDrag);
  const showSideColumn = showTodoPanel || showNotePanel;
  const sideColumnIsSinglePanel = showTodoPanel !== showNotePanel;

  return (
    <section className="welcome-home">
      <section
        className={[
          "home-dashboard",
          showSideColumn ? "" : "home-dashboard-side-hidden",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <section className="home-main-column">
          <section className="home-brand-panel" aria-label="工作台">
            <div className="home-brand-logo">
              <img src={logoUrl} alt="" draggable={false} />
            </div>
            <div className="home-brand-copy">
              <span>noteDock</span>
              <h1>工作台</h1>
              <p>开始今天的整理、阅读与写作。</p>
            </div>
            <div className="home-hero-visual" aria-hidden="true">
              <div className="home-hero-sheet">
                <span />
                <span />
                <span />
              </div>
              <div className="home-hero-fold" />
              <div className="home-hero-pencil" />
            </div>
          </section>

          <section className="home-shortcut-panel" aria-label="快捷操作">
            <header className="home-section-header">
              <h2>快捷操作</h2>
            </header>
            <div className="home-brand-actions">
              <HomeQuickAction
                icon={<FilePlus2 size={18} />}
                label="新建文档"
                onClick={onCreateDocument}
              />
              <HomeQuickAction
                icon={<FolderOpen size={18} />}
                label="打开文件夹"
                onClick={() => void onOpenWorkspaceFolder()}
              />
              <HomeQuickAction
                icon={<BookOpenText size={18} />}
                label="知识关系"
                onClick={onOpenKnowledgeRelations}
              />
            </div>
          </section>

          <section
            className={
              isRecentExpanded
                ? "recent-documents recent-documents-expanded"
                : "recent-documents"
            }
          >
            <div className="recent-header">
              <h2>最近文档</h2>
              {hasMoreRecentDocuments && (
                <button
                  type="button"
                  aria-expanded={isRecentExpanded}
                  onClick={onToggleRecentExpanded}
                >
                  {isRecentExpanded ? "收起" : "更多"}
                  <ChevronRight
                    className={isRecentExpanded ? "recent-more-icon-expanded" : undefined}
                    size={16}
                  />
                </button>
              )}
            </div>
            <div
              className={
                isRecentExpanded ? "recent-list recent-list-expanded" : "recent-list"
              }
            >
              {recentDocuments.length ? (
                recentDocuments.map((document) => {
                  const isActiveRecentDocument = isSameDashboardDocument(
                    activeDocument,
                    document,
                  );

                  return (
                    (() => {
                      const pathLabel =
                        getDocumentPathLabel?.(document) ??
                        getDocumentPathPreview(document, workspacePath);

                      return (
                    <button
                      aria-current={isActiveRecentDocument ? "page" : undefined}
                      data-document-path={document.filePath}
                      data-document-title={getDocumentDisplayName(document)}
                      data-testid="recent-document"
                      className={[
                        "recent-row",
                        isActiveRecentDocument ? "recent-row-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={document.id}
                      title={`${getDocumentDisplayName(document)}\n${pathLabel}`}
                      type="button"
                      onClick={() => void onOpenRecentDocument(document)}
                      onContextMenu={(event) =>
                        onOpenRecentDocumentContextMenu(event, document)
                      }
                    >
                      <FileText size={16} />
                      <strong>{getDocumentDisplayName(document)}</strong>
                      <span>{pathLabel}</span>
                      <time dateTime={getRecentDocumentTimestamp(document)}>
                        {formatRecentTimestamp(getRecentDocumentTimestamp(document))}
                      </time>
                    </button>
                      );
                    })()
                  );
                })
              ) : (
                <div className="recent-empty">
                  <strong>还没有最近文档</strong>
                  <span>打开文件夹或新建文档后，这里会显示最近访问的笔记。</span>
                </div>
              )}
            </div>
          </section>
        </section>

        {showSideColumn ? (
        <section
          className={[
            "home-side-column",
            sideColumnIsSinglePanel ? "home-side-column-single" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="今日安排"
        >
          {showTodoPanel ? (
          <section className="home-todo-panel" aria-label="今日待办">
            <div className="home-todo-header">
              <div className="home-todo-title">
                <span>工作台</span>
                <h1>{todoDateTitle}</h1>
                <div
                  className="home-todo-progress"
                  aria-hidden="true"
                  title={`${todoProgress}%`}
                >
                  <span style={{ width: `${todoProgress}%` }} />
                </div>
              </div>
              <strong>{remainingTodoCount} 项未完成</strong>
            </div>

            <div
              className="home-todo-date-bar"
              aria-label="切换待办日期"
              ref={calendarRef}
            >
              <button
                type="button"
                aria-label="前一天"
                title="前一天"
                onClick={() => onShiftTodoDate(-1)}
              >
                <ChevronLeft size={15} />
              </button>
              <button
                className="home-todo-date-trigger"
                type="button"
                aria-expanded={isCalendarOpen}
                aria-label={`选择日期，当前为 ${todoDateLabel}`}
                onClick={onToggleCalendar}
              >
                <CalendarDays size={15} />
                <span>{todoDateLabel}</span>
              </button>
              <button
                type="button"
                aria-label="后一天"
                title="后一天"
                onClick={() => onShiftTodoDate(1)}
              >
                <ChevronRight size={15} />
              </button>
              {todoSelectedDate !== todayTodoDate ? (
                <button
                  className="home-todo-today-button"
                  type="button"
                  onClick={onUseToday}
                >
                  今天
                </button>
              ) : null}
              {isCalendarOpen ? (
                <div
                  className="home-calendar-popover"
                  role="dialog"
                  aria-label="选择待办日期"
                  onWheel={onTodoCalendarWheel}
                >
                  <div className="home-calendar-header">
                    <button
                      type="button"
                      aria-label="上个月"
                      onClick={() => onShiftTodoMonth(-1)}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <div className="home-calendar-current" title={monthLabel}>
                      <label className="home-calendar-year-field">
                        <select
                          aria-label="选择年份"
                          value={selectedYear}
                          onChange={(event) =>
                            onChangeTodoYear(Number(event.target.value))
                          }
                        >
                          {yearOptions.map((year) => (
                            <option key={year} value={year}>
                              {year}年
                            </option>
                          ))}
                        </select>
                      </label>
                      <strong>{selectedMonthLabel}</strong>
                    </div>
                    <button
                      type="button"
                      aria-label="下个月"
                      onClick={() => onShiftTodoMonth(1)}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  <div className="home-calendar-weekdays" aria-hidden="true">
                    {homeCalendarWeekdayLabels.map((weekday) => (
                      <span key={weekday}>{weekday}</span>
                    ))}
                  </div>
                  <div className="home-calendar-grid">
                    {calendarDays.map((day) => (
                      <button
                        className={[
                          "home-calendar-day",
                          day.inMonth ? "" : "home-calendar-day-muted",
                          day.isToday ? "home-calendar-day-today" : "",
                          day.isSelected ? "home-calendar-day-selected" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={day.dateKey}
                        type="button"
                        aria-pressed={day.isSelected}
                        onClick={() => onSelectCalendarDay(day.dateKey)}
                      >
                        {day.day}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <form
              className="home-todo-form"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmitTodo();
              }}
            >
              <input
                aria-label="添加待办"
                placeholder="添加待办"
                value={todoDraft}
                onChange={(event) => onTodoDraftChange(event.currentTarget.value)}
                onPaste={(event) => void onDraftPaste(event)}
              />
              <button
                type="submit"
                disabled={!todoDraft.trim() && draftImages.length === 0}
              >
                <Plus size={15} />
                添加
              </button>
            </form>
            <div
              className={
                draftImages.length
                  ? "home-draft-images"
                  : "home-draft-images home-draft-images-empty"
              }
              aria-label="待办草稿图片"
            >
              {draftImages.length
                ? draftImages.map((image) => (
                    <span className="home-draft-image" key={image.id}>
                      <button
                        className="home-draft-image-preview"
                        type="button"
                        aria-label={`浏览图片 ${image.fileName}`}
                        onClick={() => onPreviewImage(image)}
                      >
                        <img alt={image.fileName} src={image.dataUrl} draggable={false} />
                      </button>
                      <button
                        className="home-draft-image-remove"
                        type="button"
                        aria-label="移除图片"
                        onClick={() => onRemoveDraftImage(image.id)}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                : null}
            </div>

            <div
              className={
                todoDrag ? "home-todo-list home-todo-list-dragging" : "home-todo-list"
              }
              ref={todoListRef}
            >
              {hasVisibleTodos ? (
                <>
                  {visibleTodoItems.map((item, index) => (
                    <Fragment key={item.id}>
                      {todoDrag?.insertIndex === index ? <HomeTodoDropSlot /> : null}
                      <HomeTodoRow
                        item={item}
                        onDelete={onDeleteTodo}
                        onDragStart={onTodoDragStart}
                        onPreviewImage={onPreviewImage}
                        onToggle={onToggleTodo}
                        rowRef={onTodoRowRef}
                      />
                    </Fragment>
                  ))}
                  {todoDrag?.insertIndex === visibleTodoItems.length ? (
                    <HomeTodoDropSlot />
                  ) : null}
                </>
              ) : (
                <div className="home-todo-empty">
                  <strong>暂无待办</strong>
                  <span>把今天要处理的笔记、阅读或整理任务放在这里。</span>
                </div>
              )}
            </div>

            {todoDrag && activeTodoItem ? (
              <div
                className="home-todo-drag-layer"
                style={{
                  height: todoDrag.height,
                  left: todoDrag.left,
                  top: todoDrag.pointerY - todoDrag.offsetY,
                  width: todoDrag.width,
                }}
              >
                <HomeTodoDragPreview item={activeTodoItem} />
              </div>
            ) : null}

            {hasCompletedTodos ? (
              <button
                className="home-todo-clear"
                type="button"
                onClick={onClearCompletedTodos}
              >
              清除已完成
            </button>
          ) : null}
          </section>
          ) : null}

          {showNotePanel ? (
          <section className="home-note-panel home-note-panel-side" aria-label="灵感便签">
            <header className="home-section-header">
              <div>
                <h2>灵感便签</h2>
                <span>把临时想法收在这里</span>
              </div>
              <button
                className="home-note-entry-button"
                type="button"
                onClick={onOpenNoteDialog}
              >
                <Plus size={15} />
                新建
              </button>
            </header>
            <div className="home-saved-notes" aria-label="已保存便签">
              {notes.length ? (
                notes.map((note) => (
                  <article
                    className={
                      note.id === activeNoteId
                        ? "home-saved-note home-saved-note-active"
                        : "home-saved-note"
                    }
                    key={note.id}
                    onClick={() => onSelectNote(note.id)}
                  >
                    <div>
                      <p>{note.text}</p>
                      {note.images?.length ? (
                        <div className="home-inline-image-strip" aria-label="便签图片">
                          {note.images.map((image) => (
                            <button
                              className="home-inline-image-preview"
                              type="button"
                              aria-label={`浏览图片 ${image.fileName}`}
                              key={image.id}
                              onClick={() => {
                                onSelectNote(note.id);
                                onPreviewImage(image);
                              }}
                            >
                              <img
                                alt={image.fileName}
                                src={image.dataUrl}
                                draggable={false}
                              />
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <time dateTime={note.createdAt}>
                        {formatRecentTimestamp(note.createdAt)}
                      </time>
                    </div>
                    <button
                      className="home-saved-note-delete"
                      type="button"
                      aria-label="删除便签"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </article>
                ))
              ) : (
                <div className="home-saved-notes-empty">
                  保存后的便签会显示在这里。
                </div>
              )}
            </div>
          </section>
          ) : null}
        </section>
        ) : null}
      </section>
    </section>
  );
}
