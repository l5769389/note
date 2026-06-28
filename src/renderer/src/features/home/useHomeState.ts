import { useEffect, useState } from "react";
import {
  formatHomeTodoDateKey,
  homeQuickNoteImagesStorageKey,
  homeQuickNoteStorageKey,
  homeSavedNotesStorageKey,
  homeTodoStorageKey,
  loadHomeQuickNote,
  loadHomeQuickNoteImages,
  loadHomeSavedNotes,
  loadHomeTodoItems,
  type HomeImageAttachment,
  type HomeSavedNote,
  type HomeTodoDragState,
  type HomeTodoItem,
} from "./homeModel";

function persistHomeValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Home persistence is convenience state and should never block the editor.
  }
}

export function useHomeState() {
  const [isHomeOpen, setIsHomeOpen] = useState(true);
  const [isRecentExpanded, setIsRecentExpanded] = useState(false);
  const [homeQuickNote, setHomeQuickNote] = useState(loadHomeQuickNote);
  const [homeQuickNoteImages, setHomeQuickNoteImages] = useState<HomeImageAttachment[]>([]);
  const [homeSavedNotes, setHomeSavedNotes] = useState<HomeSavedNote[]>([]);
  const [activeHomeSavedNoteId, setActiveHomeSavedNoteId] = useState<string | null>(null);
  const [isHomeNoteDialogOpen, setIsHomeNoteDialogOpen] = useState(false);
  const [homeImagePreview, setHomeImagePreview] =
    useState<HomeImageAttachment | null>(null);
  const [homeImagePreviewZoom, setHomeImagePreviewZoom] = useState(1);
  const [homeTodoItems, setHomeTodoItems] = useState<HomeTodoItem[]>([]);
  const [hasHydratedHomeCollections, setHasHydratedHomeCollections] = useState(false);
  const [homeTodoSelectedDate, setHomeTodoSelectedDate] = useState(formatHomeTodoDateKey);
  const [isHomeTodoCalendarOpen, setIsHomeTodoCalendarOpen] = useState(false);
  const [homeTodoDraft, setHomeTodoDraft] = useState("");
  const [homeTodoDraftImages, setHomeTodoDraftImages] = useState<HomeImageAttachment[]>([]);
  const [homeTodoDrag, setHomeTodoDrag] = useState<HomeTodoDragState | null>(null);

  useEffect(() => {
    let isCanceled = false;

    const hydrateHomeCollections = () => {
      if (isCanceled) {
        return;
      }

      setHomeQuickNoteImages((current) =>
        current.length ? current : loadHomeQuickNoteImages(),
      );
      setHomeSavedNotes((current) =>
        current.length ? current : loadHomeSavedNotes(),
      );
      setHomeTodoItems((current) =>
        current.length ? current : loadHomeTodoItems(),
      );
      setHasHydratedHomeCollections(true);
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(hydrateHomeCollections, {
        timeout: 500,
      });

      return () => {
        isCanceled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timerId = globalThis.setTimeout(hydrateHomeCollections, 0);

    return () => {
      isCanceled = true;
      globalThis.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedHomeCollections) {
      return;
    }

    persistHomeValue(homeTodoStorageKey, JSON.stringify(homeTodoItems));
  }, [hasHydratedHomeCollections, homeTodoItems]);

  useEffect(() => {
    persistHomeValue(homeQuickNoteStorageKey, homeQuickNote);
  }, [homeQuickNote]);

  useEffect(() => {
    if (!hasHydratedHomeCollections) {
      return;
    }

    persistHomeValue(homeQuickNoteImagesStorageKey, JSON.stringify(homeQuickNoteImages));
  }, [hasHydratedHomeCollections, homeQuickNoteImages]);

  useEffect(() => {
    if (!hasHydratedHomeCollections) {
      return;
    }

    persistHomeValue(homeSavedNotesStorageKey, JSON.stringify(homeSavedNotes));
  }, [hasHydratedHomeCollections, homeSavedNotes]);

  return {
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
    isHomeOpen,
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
    setIsHomeOpen,
    setIsHomeTodoCalendarOpen,
    setIsRecentExpanded,
  };
}
