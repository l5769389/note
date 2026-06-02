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
  const [homeQuickNoteImages, setHomeQuickNoteImages] = useState<HomeImageAttachment[]>(
    loadHomeQuickNoteImages,
  );
  const [homeSavedNotes, setHomeSavedNotes] = useState<HomeSavedNote[]>(loadHomeSavedNotes);
  const [activeHomeSavedNoteId, setActiveHomeSavedNoteId] = useState<string | null>(null);
  const [isHomeNoteDialogOpen, setIsHomeNoteDialogOpen] = useState(false);
  const [homeImagePreview, setHomeImagePreview] =
    useState<HomeImageAttachment | null>(null);
  const [homeImagePreviewZoom, setHomeImagePreviewZoom] = useState(1);
  const [homeTodoItems, setHomeTodoItems] = useState<HomeTodoItem[]>(loadHomeTodoItems);
  const [homeTodoSelectedDate, setHomeTodoSelectedDate] = useState(formatHomeTodoDateKey);
  const [isHomeTodoCalendarOpen, setIsHomeTodoCalendarOpen] = useState(false);
  const [homeTodoDraft, setHomeTodoDraft] = useState("");
  const [homeTodoDraftImages, setHomeTodoDraftImages] = useState<HomeImageAttachment[]>([]);
  const [homeTodoDrag, setHomeTodoDrag] = useState<HomeTodoDragState | null>(null);

  useEffect(() => {
    persistHomeValue(homeTodoStorageKey, JSON.stringify(homeTodoItems));
  }, [homeTodoItems]);

  useEffect(() => {
    persistHomeValue(homeQuickNoteStorageKey, homeQuickNote);
  }, [homeQuickNote]);

  useEffect(() => {
    persistHomeValue(homeQuickNoteImagesStorageKey, JSON.stringify(homeQuickNoteImages));
  }, [homeQuickNoteImages]);

  useEffect(() => {
    persistHomeValue(homeSavedNotesStorageKey, JSON.stringify(homeSavedNotes));
  }, [homeSavedNotes]);

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
