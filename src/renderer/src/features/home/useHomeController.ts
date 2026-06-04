import {
  useEffect,
  useMemo,
  useRef,
  type ClipboardEvent,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  getClipboardDirectMediaAction,
  normalizeDataUrlMimeType,
  readBrowserClipboardMedia,
  shouldTryClipboardMediaFallback,
  createTimestampedImageName,
} from "../../mediaImport";
import { fileToDataUrl } from "../../services/imageUpload";
import type { MarkdownDocument } from "../../types";
import {
  createHomeImageAttachmentId,
  createHomeSavedNoteId,
  createHomeTodoId,
  formatHomeTodoDateKey,
  formatHomeTodoDateLabel,
  formatHomeTodoMonthLabel,
  getHomeTodoCalendarDays,
  getHomeTodoDateTitle,
  getHomeTodoYearOptions,
  homeRecentDocumentLimit,
  parseHomeTodoDateKey,
  reorderHomeTodoItemsForDate,
  setHomeTodoYearKey,
  shiftHomeTodoDateKey,
  shiftHomeTodoMonthKey,
  type HomeImageAttachment,
  type HomeTodoDragState,
} from "./homeModel";
import { useHomeState } from "./useHomeState";

type UseHomeControllerOptions = {
  recentDocuments: MarkdownDocument[];
};

function createHomeImageAttachment({
  dataUrl,
  fileName,
  mimeType,
}: {
  dataUrl: string;
  fileName: string;
  mimeType: string;
}): HomeImageAttachment {
  return {
    dataUrl,
    fileName,
    id: createHomeImageAttachmentId(),
    mimeType,
  };
}

function appendHomeImages(
  setter: Dispatch<SetStateAction<HomeImageAttachment[]>>,
  images: HomeImageAttachment[],
) {
  if (!images.length) {
    return;
  }

  setter((currentImages) => [...currentImages, ...images].slice(0, 8));
}

export function useHomeController({ recentDocuments }: UseHomeControllerOptions) {
  const {
    activeHomeSavedNoteId,
    homeImagePreview,
    homeImagePreviewZoom,
    homeQuickNote,
    homeQuickNoteImages,
    homeSavedNotes,
    homeTodoDraft,
    homeTodoDraftImages,
    homeTodoDrag,
    homeTodoItems,
    homeTodoSelectedDate,
    isHomeNoteDialogOpen,
    isHomeTodoCalendarOpen,
    isRecentExpanded,
    setActiveHomeSavedNoteId,
    setHomeImagePreview,
    setHomeImagePreviewZoom,
    setHomeQuickNote,
    setHomeQuickNoteImages,
    setHomeSavedNotes,
    setHomeTodoDraft,
    setHomeTodoDraftImages,
    setHomeTodoDrag,
    setHomeTodoItems,
    setHomeTodoSelectedDate,
    setIsHomeNoteDialogOpen,
    setIsHomeTodoCalendarOpen,
    setIsRecentExpanded,
  } = useHomeState();

  const homeTodoCalendarWheelAtRef = useRef(0);
  const homeTodoDragRef = useRef<HomeTodoDragState | null>(null);
  const homeTodoListRef = useRef<HTMLDivElement | null>(null);
  const homeTodoCalendarRef = useRef<HTMLDivElement | null>(null);
  const homeTodoRowRefs = useRef(new Map<string, HTMLDivElement>());

  const hasMoreRecentDocuments = recentDocuments.length > homeRecentDocumentLimit;
  const visibleRecentDocuments = useMemo(
    () =>
      isRecentExpanded
        ? recentDocuments
        : recentDocuments.slice(0, homeRecentDocumentLimit),
    [isRecentExpanded, recentDocuments],
  );
  const homeTodoDateTitle = getHomeTodoDateTitle(homeTodoSelectedDate);
  const homeTodoDateLabel = formatHomeTodoDateLabel(homeTodoSelectedDate);
  const homeTodoMonthLabel = formatHomeTodoMonthLabel(homeTodoSelectedDate);
  const homeTodoCalendarDate =
    parseHomeTodoDateKey(homeTodoSelectedDate) ?? new Date();
  const homeTodoSelectedYear = homeTodoCalendarDate.getFullYear();
  const homeTodoSelectedMonthLabel = `${homeTodoCalendarDate.getMonth() + 1}月`;
  const homeTodoYearOptions = useMemo(
    () => getHomeTodoYearOptions(homeTodoSelectedDate),
    [homeTodoSelectedDate],
  );
  const todayHomeTodoDate = formatHomeTodoDateKey();
  const homeTodoCalendarDays = useMemo(
    () => getHomeTodoCalendarDays(homeTodoSelectedDate),
    [homeTodoSelectedDate],
  );
  const selectedHomeTodoItems = useMemo(
    () => homeTodoItems.filter((item) => item.date === homeTodoSelectedDate),
    [homeTodoItems, homeTodoSelectedDate],
  );
  const remainingHomeTodoCount = selectedHomeTodoItems.filter((item) => !item.done).length;
  const completedHomeTodoCount = selectedHomeTodoItems.length - remainingHomeTodoCount;
  const homeTodoProgress = selectedHomeTodoItems.length
    ? Math.round((completedHomeTodoCount / selectedHomeTodoItems.length) * 100)
    : 0;
  const hasCompletedHomeTodos = selectedHomeTodoItems.some((item) => item.done);
  const activeHomeTodoItem = useMemo(
    () =>
      homeTodoDrag
        ? selectedHomeTodoItems.find((item) => item.id === homeTodoDrag.id) ?? null
        : null,
    [homeTodoDrag, selectedHomeTodoItems],
  );
  const visibleHomeTodoItems = useMemo(
    () =>
      homeTodoDrag
        ? selectedHomeTodoItems.filter((item) => item.id !== homeTodoDrag.id)
        : selectedHomeTodoItems,
    [homeTodoDrag, selectedHomeTodoItems],
  );

  useEffect(() => {
    homeTodoDragRef.current = homeTodoDrag;
  }, [homeTodoDrag]);

  useEffect(() => {
    if (!isHomeTodoCalendarOpen) {
      return;
    }

    const closeCalendar = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        homeTodoCalendarRef.current?.contains(target)
      ) {
        return;
      }

      setIsHomeTodoCalendarOpen(false);
    };

    const closeCalendarWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsHomeTodoCalendarOpen(false);
      }
    };

    window.addEventListener("pointerdown", closeCalendar, true);
    window.addEventListener("keydown", closeCalendarWithEscape);

    return () => {
      window.removeEventListener("pointerdown", closeCalendar, true);
      window.removeEventListener("keydown", closeCalendarWithEscape);
    };
  }, [isHomeTodoCalendarOpen, setIsHomeTodoCalendarOpen]);

  useEffect(() => {
    if (!hasMoreRecentDocuments && isRecentExpanded) {
      setIsRecentExpanded(false);
    }
  }, [hasMoreRecentDocuments, isRecentExpanded, setIsRecentExpanded]);

  async function readHomeClipboardImages(
    clipboardData?: DataTransfer | null,
  ): Promise<HomeImageAttachment[]> {
    const directAction = clipboardData
      ? getClipboardDirectMediaAction(clipboardData)
      : null;

    if (directAction?.action === "imageFile") {
      return [
        createHomeImageAttachment({
          dataUrl: await fileToDataUrl(directAction.file),
          fileName:
            directAction.file.name ||
            createTimestampedImageName(directAction.file.type || "image/png"),
          mimeType: directAction.file.type || "image/png",
        }),
      ];
    }

    try {
      const browserImage = await readBrowserClipboardMedia("image");

      if (browserImage) {
        return [
          createHomeImageAttachment({
            dataUrl: await fileToDataUrl(browserImage),
            fileName:
              browserImage.name ||
              createTimestampedImageName(browserImage.type || "image/png"),
            mimeType: browserImage.type || "image/png",
          }),
        ];
      }
    } catch {
      // Continue to the desktop bridge fallback.
    }

    try {
      const nativeImage = await window.desktop?.readClipboardImage?.();

      if (nativeImage?.dataUrl && nativeImage.mimeType.startsWith("image/")) {
        return [
          createHomeImageAttachment({
            dataUrl: normalizeDataUrlMimeType(nativeImage.dataUrl, nativeImage.mimeType),
            fileName:
              nativeImage.fileName || createTimestampedImageName(nativeImage.mimeType),
            mimeType: nativeImage.mimeType,
          }),
        ];
      }
    } catch {
      // Clipboard image support is best effort for the home widgets.
    }

    return [];
  }

  async function handleHomeImagePaste(
    event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    setter: Dispatch<SetStateAction<HomeImageAttachment[]>>,
  ) {
    if (!shouldTryClipboardMediaFallback(event.clipboardData)) {
      return;
    }

    event.preventDefault();
    const images = await readHomeClipboardImages(event.clipboardData);

    if (!images.length) {
      return;
    }

    appendHomeImages(setter, images);
  }

  function removeHomeTodoDraftImage(imageId: string) {
    setHomeTodoDraftImages((currentImages) =>
      currentImages.filter((image) => image.id !== imageId),
    );
  }

  function removeHomeQuickNoteImage(imageId: string) {
    setHomeQuickNoteImages((currentImages) =>
      currentImages.filter((image) => image.id !== imageId),
    );
  }

  function addHomeTodo() {
    const text = homeTodoDraft.trim();

    if (!text && homeTodoDraftImages.length === 0) {
      return;
    }

    setHomeTodoItems((currentItems) => [
      {
        id: createHomeTodoId(),
        text: text || "图片待办",
        done: false,
        date: homeTodoSelectedDate,
        images: homeTodoDraftImages,
        createdAt: new Date().toISOString(),
      },
      ...currentItems,
    ]);
    setHomeTodoDraft("");
    setHomeTodoDraftImages([]);
  }

  function handleHomeTodoCalendarWheel(
    event: ReactWheelEvent<HTMLDivElement>,
  ) {
    if ((event.target as HTMLElement | null)?.closest("select")) {
      return;
    }

    const wheelDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      ? event.deltaY
      : event.deltaX;

    if (Math.abs(wheelDelta) < 8) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const now = Date.now();

    if (now - homeTodoCalendarWheelAtRef.current < 180) {
      return;
    }

    homeTodoCalendarWheelAtRef.current = now;
    setHomeTodoSelectedDate((currentDate) =>
      shiftHomeTodoMonthKey(currentDate, wheelDelta > 0 ? 1 : -1),
    );
  }

  function toggleHomeTodo(todoId: string) {
    setHomeTodoItems((currentItems) =>
      currentItems.map((item) =>
        item.id === todoId ? { ...item, done: !item.done } : item,
      ),
    );
  }

  function deleteHomeTodo(todoId: string) {
    setHomeTodoItems((currentItems) =>
      currentItems.filter((item) => item.id !== todoId),
    );
  }

  function clearCompletedHomeTodos() {
    setHomeTodoItems((currentItems) =>
      currentItems.filter((item) => item.date !== homeTodoSelectedDate || !item.done),
    );
  }

  function saveHomeQuickNote() {
    const text = homeQuickNote.trim();

    if (!text && homeQuickNoteImages.length === 0) {
      return;
    }

    const noteId = createHomeSavedNoteId();

    setHomeSavedNotes((currentNotes) => [
      {
        id: noteId,
        text: text || "图片便签",
        images: homeQuickNoteImages,
        createdAt: new Date().toISOString(),
      },
      ...currentNotes,
    ].slice(0, 30));
    setActiveHomeSavedNoteId(noteId);
    setHomeQuickNote("");
    setHomeQuickNoteImages([]);
    setIsHomeNoteDialogOpen(false);
  }

  function deleteHomeSavedNote(noteId: string) {
    setHomeSavedNotes((currentNotes) =>
      currentNotes.filter((note) => note.id !== noteId),
    );
    setActiveHomeSavedNoteId((currentId) =>
      currentId === noteId ? null : currentId,
    );
  }

  function changeHomeImagePreviewZoom(delta: number) {
    setHomeImagePreviewZoom((currentZoom) =>
      Math.min(4, Math.max(0.25, Math.round((currentZoom + delta) * 100) / 100)),
    );
  }

  function resetHomeImagePreviewZoom() {
    setHomeImagePreviewZoom(1);
  }

  function closeHomeImagePreview() {
    setHomeImagePreview(null);
    resetHomeImagePreviewZoom();
  }

  function setHomeTodoRowRef(todoId: string, node: HTMLDivElement | null) {
    if (node) {
      homeTodoRowRefs.current.set(todoId, node);
      return;
    }

    homeTodoRowRefs.current.delete(todoId);
  }

  function getHomeTodoInsertIndex(clientY: number, activeTodoId: string) {
    const visibleItems = selectedHomeTodoItems.filter((item) => item.id !== activeTodoId);

    for (let index = 0; index < visibleItems.length; index += 1) {
      const row = homeTodoRowRefs.current.get(visibleItems[index].id);

      if (!row) {
        continue;
      }

      const rect = row.getBoundingClientRect();

      if (clientY < rect.top + rect.height / 2) {
        return index;
      }
    }

    return visibleItems.length;
  }

  function handleHomeTodoDragStart(
    event: ReactPointerEvent<HTMLButtonElement>,
    todoId: string,
  ) {
    if (event.button !== 0) {
      return;
    }

    const row = homeTodoRowRefs.current.get(todoId);

    if (!row) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rowRect = row.getBoundingClientRect();

    setHomeTodoDrag({
      height: rowRect.height,
      id: todoId,
      insertIndex: getHomeTodoInsertIndex(event.clientY, todoId),
      left: rowRect.left,
      offsetY: event.clientY - rowRect.top,
      pointerId: event.pointerId,
      pointerY: event.clientY,
      width: rowRect.width,
    });
  }

  useEffect(() => {
    if (!homeTodoDrag) {
      return;
    }

    const scrollNearEdges = (clientY: number) => {
      const list = homeTodoListRef.current;

      if (!list) {
        return;
      }

      const rect = list.getBoundingClientRect();
      const edgeSize = 48;

      if (clientY < rect.top + edgeSize) {
        list.scrollTop -= 12;
      } else if (clientY > rect.bottom - edgeSize) {
        list.scrollTop += 12;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const currentDrag = homeTodoDragRef.current;

      if (!currentDrag || event.pointerId !== currentDrag.pointerId) {
        return;
      }

      event.preventDefault();
      scrollNearEdges(event.clientY);

      setHomeTodoDrag((current) =>
        current && event.pointerId === current.pointerId
          ? {
              ...current,
              insertIndex: getHomeTodoInsertIndex(event.clientY, current.id),
              pointerY: event.clientY,
            }
          : current,
      );
    };

    const finishDrag = (event: PointerEvent) => {
      const currentDrag = homeTodoDragRef.current;

      if (!currentDrag || event.pointerId !== currentDrag.pointerId) {
        return;
      }

      event.preventDefault();
      setHomeTodoDrag(null);
      setHomeTodoItems((currentItems) =>
        reorderHomeTodoItemsForDate(
          currentItems,
          homeTodoSelectedDate,
          currentDrag.id,
          currentDrag.insertIndex,
        ),
      );
    };

    const cancelDrag = (event: PointerEvent) => {
      const currentDrag = homeTodoDragRef.current;

      if (!currentDrag || event.pointerId !== currentDrag.pointerId) {
        return;
      }

      setHomeTodoDrag(null);
    };

    document.body.classList.add("home-todo-global-dragging");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", cancelDrag);

    return () => {
      document.body.classList.remove("home-todo-global-dragging");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);
    };
  }, [homeTodoDrag?.id, homeTodoItems, homeTodoSelectedDate, selectedHomeTodoItems]);

  return {
    dashboardState: {
      activeNoteId: activeHomeSavedNoteId,
      activeTodoItem: activeHomeTodoItem,
      calendarDays: homeTodoCalendarDays,
      calendarRef: homeTodoCalendarRef,
      draftImages: homeTodoDraftImages,
      hasCompletedTodos: hasCompletedHomeTodos,
      hasMoreRecentDocuments,
      isCalendarOpen: isHomeTodoCalendarOpen,
      isRecentExpanded,
      monthLabel: homeTodoMonthLabel,
      notes: homeSavedNotes,
      onChangeTodoYear: (year: number) =>
        setHomeTodoSelectedDate((currentDate) =>
          setHomeTodoYearKey(currentDate, year),
        ),
      onClearCompletedTodos: clearCompletedHomeTodos,
      onDeleteNote: deleteHomeSavedNote,
      onDeleteTodo: deleteHomeTodo,
      onDraftPaste: (event: ClipboardEvent<HTMLInputElement>) =>
        handleHomeImagePaste(event, setHomeTodoDraftImages),
      onOpenNoteDialog: () => setIsHomeNoteDialogOpen(true),
      onPreviewImage: setHomeImagePreview,
      onRemoveDraftImage: removeHomeTodoDraftImage,
      onSelectCalendarDay: (dateKey: string) => {
        setHomeTodoSelectedDate(dateKey);
        setIsHomeTodoCalendarOpen(false);
      },
      onSelectNote: setActiveHomeSavedNoteId,
      onShiftTodoDate: (days: number) =>
        setHomeTodoSelectedDate((currentDate) =>
          shiftHomeTodoDateKey(currentDate, days),
        ),
      onShiftTodoMonth: (months: number) =>
        setHomeTodoSelectedDate((currentDate) =>
          shiftHomeTodoMonthKey(currentDate, months),
        ),
      onSubmitTodo: addHomeTodo,
      onTodoCalendarWheel: handleHomeTodoCalendarWheel,
      onTodoDraftChange: setHomeTodoDraft,
      onTodoDragStart: handleHomeTodoDragStart,
      onTodoRowRef: setHomeTodoRowRef,
      onToggleCalendar: () => setIsHomeTodoCalendarOpen((current) => !current),
      onToggleRecentExpanded: () => setIsRecentExpanded((current) => !current),
      onToggleTodo: toggleHomeTodo,
      onUseToday: () => {
        setHomeTodoSelectedDate(todayHomeTodoDate);
        setIsHomeTodoCalendarOpen(false);
      },
      recentDocuments: visibleRecentDocuments,
      remainingTodoCount: remainingHomeTodoCount,
      selectedMonthLabel: homeTodoSelectedMonthLabel,
      selectedYear: homeTodoSelectedYear,
      todoDateLabel: homeTodoDateLabel,
      todoDateTitle: homeTodoDateTitle,
      todoDraft: homeTodoDraft,
      todoDrag: homeTodoDrag,
      todoListRef: homeTodoListRef,
      todoProgress: homeTodoProgress,
      todoSelectedDate: homeTodoSelectedDate,
      todayTodoDate: todayHomeTodoDate,
      visibleTodoItems: visibleHomeTodoItems,
      yearOptions: homeTodoYearOptions,
    },
    imagePreview: {
      close: closeHomeImagePreview,
      image: homeImagePreview,
      resetZoom: resetHomeImagePreviewZoom,
      setImage: setHomeImagePreview,
      setZoom: changeHomeImagePreviewZoom,
      zoom: homeImagePreviewZoom,
    },
    noteDialog: {
      canSave: Boolean(homeQuickNote.trim() || homeQuickNoteImages.length),
      images: homeQuickNoteImages,
      isOpen: isHomeNoteDialogOpen,
      note: homeQuickNote,
      onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) =>
        handleHomeImagePaste(event, setHomeQuickNoteImages),
      removeImage: removeHomeQuickNoteImage,
      save: saveHomeQuickNote,
      setNote: setHomeQuickNote,
      setOpen: setIsHomeNoteDialogOpen,
    },
  };
}
