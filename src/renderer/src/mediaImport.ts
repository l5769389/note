import { getMediaMimeTypeForFileName } from "../../shared/mediaTypes";

export type ClipboardMediaKind = "image" | "video";

export type ClipboardMediaFileReference = {
  fileName: string;
  filePath: string;
  mimeType: string;
  size?: number;
};

export type ClipboardMediaData = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

export type MediaFileImportAction =
  | { action: "imageFile"; file: File }
  | { action: "videoFile"; file: File }
  | {
      action: "videoFilePath";
      fileName: string;
      filePath: string;
      mimeType: string;
    };

export type MediaDataImportAction =
  | {
      action: "imageDataUrl";
      dataUrl: string;
      fileName: string;
      mimeType: string;
    }
  | {
      action: "videoDataUrl";
      dataUrl: string;
      fileName: string;
      mimeType: string;
    };

export type MediaImportAction = MediaFileImportAction | MediaDataImportAction;

export type ClipboardMediaFallbackReaders = {
  listMediaFileRefs?: () =>
    | Promise<ArrayLikeOrIterable<ClipboardMediaFileReference> | null | undefined>
    | ArrayLikeOrIterable<ClipboardMediaFileReference>
    | null
    | undefined;
  onBeforeReadNativeMediaData?: () => void;
  readBrowserMedia?: (
    kind: ClipboardMediaKind,
  ) => Promise<File | null> | File | null;
  readImageData?: () =>
    | Promise<ClipboardMediaData | null | undefined>
    | ClipboardMediaData
    | null
    | undefined;
  readMediaData?: () =>
    | Promise<ArrayLikeOrIterable<ClipboardMediaData> | null | undefined>
    | ArrayLikeOrIterable<ClipboardMediaData>
    | null
    | undefined;
};

type ArrayLikeOrIterable<T> = ArrayLike<T> | Iterable<T>;

type ClipboardItemLike = {
  getAsFile: () => File | null;
  kind: string;
};

type ClipboardDataLike = {
  files: ArrayLikeOrIterable<File>;
  getData: (format: string) => string;
  items: ArrayLikeOrIterable<ClipboardItemLike>;
};

type BrowserClipboardItemLike = {
  getType: (type: string) => Promise<Blob>;
  types: readonly string[];
};

type BrowserClipboardLike = {
  read?: () => Promise<ArrayLikeOrIterable<BrowserClipboardItemLike>>;
};

type DataTransferLike = {
  files: ArrayLikeOrIterable<File>;
  items: ArrayLikeOrIterable<{ kind: string }>;
  types: ArrayLikeOrIterable<string>;
};

function toArray<T>(value: ArrayLikeOrIterable<T>) {
  return Array.from(value);
}

export function getClipboardMediaMimeType(name: string) {
  return getMediaMimeTypeForFileName(name) ?? "";
}

export function isClipboardMediaFile(file: File, kind: ClipboardMediaKind) {
  const mimeType = file.type || getClipboardMediaMimeType(file.name);

  return mimeType.startsWith(`${kind}/`);
}

export function normalizeDataUrlMimeType(dataUrl: string, mimeType: string) {
  if (!mimeType || dataUrl.startsWith(`data:${mimeType}`)) {
    return dataUrl;
  }

  return dataUrl.replace(/^data:[^;,]*(?=[;,])/, `data:${mimeType}`);
}

export function dataTransferHasFiles(
  dataTransfer: Pick<DataTransferLike, "items" | "types">,
) {
  return (
    toArray(dataTransfer.types).includes("Files") ||
    toArray(dataTransfer.items).some((item) => item.kind === "file")
  );
}

export function getDroppedMediaFiles(
  dataTransfer: Pick<DataTransferLike, "files">,
) {
  return toArray(dataTransfer.files).filter(
    (file) =>
      isClipboardMediaFile(file, "video") ||
      isClipboardMediaFile(file, "image"),
  );
}

export function getLocalPathForDroppedFile(
  file: File,
  resolvePath?: (file: File) => string | null | undefined,
) {
  try {
    const resolvedPath = resolvePath?.(file);

    if (resolvedPath) {
      return resolvedPath;
    }
  } catch {
    // Older Electron builds exposed path directly on File. Keep that as a
    // compatibility fallback for local drag-and-drop.
  }

  const legacyPath = (file as File & { path?: string }).path;

  return typeof legacyPath === "string" && legacyPath ? legacyPath : null;
}

export function getDroppedMediaImportActions(
  dataTransfer: Pick<DataTransferLike, "files">,
  resolvePath?: (file: File) => string | null | undefined,
): MediaFileImportAction[] {
  return getDroppedMediaFiles(dataTransfer).map((file) => {
    if (!isClipboardMediaFile(file, "video")) {
      return { action: "imageFile", file };
    }

    const filePath = getLocalPathForDroppedFile(file, resolvePath);

    if (!filePath) {
      return { action: "videoFile", file };
    }

    return {
      action: "videoFilePath",
      fileName: file.name || createTimestampedVideoName(file.type),
      filePath,
      mimeType: file.type || getClipboardMediaMimeType(file.name) || "video/mp4",
    };
  });
}

export function getClipboardMediaFileFromData({
  createFallbackName,
  clipboardData,
  fallbackMimeType,
  kind,
}: {
  clipboardData: ClipboardDataLike;
  createFallbackName: (mimeType: string) => string;
  fallbackMimeType: string;
  kind: ClipboardMediaKind;
}) {
  const clipboardFile = toArray(clipboardData.files).find((file) =>
    isClipboardMediaFile(file, kind),
  );

  if (clipboardFile) {
    return clipboardFile;
  }

  const itemFile =
    toArray(clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .find((file) => file ? isClipboardMediaFile(file, kind) : false) ?? null;

  if (!itemFile) {
    return null;
  }

  const mimeType = itemFile.type || fallbackMimeType;

  return new File([itemFile], itemFile.name || createFallbackName(mimeType), {
    type: mimeType,
  });
}

export function getClipboardImageFile(clipboardData: ClipboardDataLike) {
  return getClipboardMediaFileFromData({
    clipboardData,
    createFallbackName: createTimestampedImageName,
    fallbackMimeType: "image/png",
    kind: "image",
  });
}

export function getClipboardVideoFile(clipboardData: ClipboardDataLike) {
  return getClipboardMediaFileFromData({
    clipboardData,
    createFallbackName: createTimestampedVideoName,
    fallbackMimeType: "video/webm",
    kind: "video",
  });
}

export function getClipboardDirectMediaAction(
  clipboardData: ClipboardDataLike,
): MediaFileImportAction | null {
  const image = getClipboardImageFile(clipboardData);

  if (image) {
    return { action: "imageFile", file: image };
  }

  const video = getClipboardVideoFile(clipboardData);

  return video ? { action: "videoFile", file: video } : null;
}

export function findFirstClipboardMedia<T extends { mimeType: string }>(
  files: ArrayLikeOrIterable<T> | null | undefined,
  kind: ClipboardMediaKind,
) {
  if (!files) {
    return null;
  }

  return (
    toArray(files).find((file) => file.mimeType.startsWith(`${kind}/`)) ?? null
  );
}

export function getClipboardFileReferenceImportAction(
  files: ArrayLikeOrIterable<ClipboardMediaFileReference> | null | undefined,
): MediaFileImportAction | null {
  const video = findFirstClipboardMedia(files, "video");

  return video
    ? {
        action: "videoFilePath",
        fileName: video.fileName,
        filePath: video.filePath,
        mimeType: video.mimeType,
      }
    : null;
}

export function getClipboardMediaDataImportAction(
  files: ArrayLikeOrIterable<ClipboardMediaData> | null | undefined,
): MediaDataImportAction | null {
  const video = findFirstClipboardMedia(files, "video");

  if (video) {
    return { action: "videoDataUrl", ...video };
  }

  const image = findFirstClipboardMedia(files, "image");

  return image ? { action: "imageDataUrl", ...image } : null;
}

export function getClipboardImageDataImportAction(
  image: ClipboardMediaData | null | undefined,
): MediaDataImportAction | null {
  return image?.mimeType.startsWith("image/")
    ? { action: "imageDataUrl", ...image }
    : null;
}

export async function readClipboardMediaFallbackAction({
  listMediaFileRefs,
  onBeforeReadNativeMediaData,
  readBrowserMedia = readBrowserClipboardMedia,
  readImageData,
  readMediaData,
}: ClipboardMediaFallbackReaders): Promise<MediaImportAction | null> {
  const nativeFileRefAction = getClipboardFileReferenceImportAction(
    await listMediaFileRefs?.(),
  );

  if (nativeFileRefAction) {
    return nativeFileRefAction;
  }

  const browserVideo = await readBrowserMedia("video");

  if (browserVideo) {
    return { action: "videoFile", file: browserVideo };
  }

  const browserImage = await readBrowserMedia("image");

  if (browserImage) {
    return { action: "imageFile", file: browserImage };
  }

  onBeforeReadNativeMediaData?.();

  const nativeMediaDataAction = getClipboardMediaDataImportAction(
    await readMediaData?.(),
  );

  if (nativeMediaDataAction) {
    return nativeMediaDataAction;
  }

  return getClipboardImageDataImportAction(await readImageData?.());
}

export function clipboardHtmlLooksLikeMedia(clipboardData: ClipboardDataLike) {
  const html = clipboardData.getData("text/html");

  return /<(?:img|video)\b|data:(?:image|video)\/|file:\/\//i.test(html);
}

export function clipboardPlainTextLooksLikeMediaPath(plainText: string) {
  const normalizedText = plainText.trim().replace(/^"|"$/g, "");

  if (!normalizedText) {
    return false;
  }

  if (/^file:\/\//i.test(normalizedText)) {
    return Boolean(getClipboardMediaMimeType(normalizedText));
  }

  if (!/^(?:[a-zA-Z]:[\\/]|\/[a-zA-Z]:[\\/])/.test(normalizedText)) {
    return false;
  }

  return Boolean(getClipboardMediaMimeType(normalizedText));
}

export function shouldTryClipboardMediaFallback(
  clipboardData: ClipboardDataLike,
) {
  const plainText = clipboardData.getData("text/plain");

  return (
    plainText.trim().length === 0 ||
    clipboardHtmlLooksLikeMedia(clipboardData) ||
    clipboardPlainTextLooksLikeMediaPath(plainText) ||
    toArray(clipboardData.files).some(
      (file) =>
        isClipboardMediaFile(file, "image") ||
        isClipboardMediaFile(file, "video") ||
        Boolean(getClipboardMediaMimeType(file.name)),
    )
  );
}

export async function readBrowserClipboardMedia(
  kind: ClipboardMediaKind,
  clipboard: BrowserClipboardLike | undefined =
    typeof navigator === "undefined" ? undefined : navigator.clipboard,
) {
  if (!clipboard?.read) {
    return null;
  }

  try {
    const items = toArray(await clipboard.read());

    for (const item of items) {
      const mediaType = item.types.find((type) => type.startsWith(`${kind}/`));

      if (!mediaType) {
        continue;
      }

      const blob = await item.getType(mediaType);

      return new File(
        [blob],
        kind === "image"
          ? createTimestampedImageName(blob.type || mediaType)
          : createTimestampedVideoName(blob.type || mediaType),
        { type: blob.type || mediaType },
      );
    }
  } catch {
    return null;
  }

  return null;
}

export function createTimestampedMediaName(
  mimeType: string,
  fallbackExtension: string,
  prefix: string,
) {
  const extension =
    mimeType
      .split("/")
      .at(1)
      ?.replace("jpeg", "jpg")
      .replace("svg+xml", "svg")
      .replace("quicktime", "mov")
      .replace("x-matroska", "mkv")
      .replace("ogg", "ogv") || fallbackExtension;
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "-")
    .slice(0, 19);

  return `${prefix}-${timestamp}.${extension}`;
}

export function createTimestampedImageName(mimeType: string) {
  return createTimestampedMediaName(mimeType, "png", "screenshot");
}

export function createTimestampedVideoName(mimeType: string) {
  return createTimestampedMediaName(mimeType, "webm", "recording");
}

export function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function createVideoMarkdown(fileName: string, reference: string) {
  const title = escapeHtmlAttribute(fileName);
  const src = escapeHtmlAttribute(reference);

  return `<video controls preload="metadata" src="${src}" title="${title}"></video>\n\n`;
}

export function createMediaImportPlaceholder(
  importId: string,
  fileName: string,
  status: string,
  progress?: number,
) {
  const progressLabel =
    typeof progress === "number" ? `${Math.max(1, Math.round(progress * 100))}%` : "";
  const safeId = escapeHtmlAttribute(importId);
  const safeName = escapeHtmlAttribute(fileName || "video");
  const safeStatus = escapeHtmlAttribute(status);

  return [
    `<div class="notedock-media-import" data-notedock-import-id="${safeId}">`,
    `  <strong>正在导入视频</strong>`,
    `  <span>${safeName}</span>`,
    `  <em>${safeStatus}${progressLabel ? ` · ${progressLabel}` : ""}</em>`,
    `</div>`,
    "",
    "",
  ].join("\n");
}

export function getMediaImportPattern(importId: string) {
  const escapedId = importId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(
    `<div\\b(?=[^>]*data-notedock-import-id="${escapedId}")[^>]*>[\\s\\S]*?<\\/div>\\n{0,2}`,
  );
}

export function replaceMediaImportPlaceholderContent(
  content: string,
  importId: string,
  replacement: string,
  options: { appendIfMissing?: boolean } = {},
) {
  let didReplace = false;
  const replacedContent = content.replace(getMediaImportPattern(importId), () => {
    didReplace = true;
    return replacement;
  });

  if (didReplace) {
    return {
      content: replacedContent,
      didChange: replacedContent !== content,
      didReplace,
    };
  }

  if (!options.appendIfMissing) {
    return { content, didChange: false, didReplace };
  }

  const appendedContent = `${content.trimEnd()}\n\n${replacement}`;

  return {
    content: appendedContent,
    didChange: appendedContent !== content,
    didReplace,
  };
}
