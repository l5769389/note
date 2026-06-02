import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clipboardHtmlLooksLikeMedia,
  clipboardPlainTextLooksLikeMediaPath,
  createMediaImportPlaceholder,
  createTimestampedImageName,
  createTimestampedVideoName,
  createVideoMarkdown,
  dataTransferHasFiles,
  findFirstClipboardMedia,
  getClipboardDirectMediaAction,
  getClipboardFileReferenceImportAction,
  getClipboardImageFile,
  getClipboardImageDataImportAction,
  getClipboardMediaDataImportAction,
  getClipboardMediaMimeType,
  getDroppedMediaImportActions,
  getDroppedMediaFiles,
  getLocalPathForDroppedFile,
  getMediaImportPattern,
  isClipboardMediaFile,
  normalizeDataUrlMimeType,
  readBrowserClipboardMedia,
  readClipboardMediaFallbackAction,
  replaceMediaImportPlaceholderContent,
  shouldPreserveImageFileAsAsset,
  shouldTryClipboardMediaFallback,
} from "../mediaImport";

function clipboardData({
  files = [],
  html = "",
  items = [],
  text = "",
}: {
  files?: File[];
  html?: string;
  items?: Array<{ getAsFile: () => File | null; kind: string }>;
  text?: string;
}) {
  return {
    files,
    items,
    getData: (format: string) =>
      format === "text/html" ? html : format === "text/plain" ? text : "",
  };
}

describe("media import helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects clipboard media by explicit type or filename", () => {
    expect(getClipboardMediaMimeType("capture.GIF")).toBe("image/gif");
    expect(isClipboardMediaFile(new File([], "clip.mov"), "video")).toBe(true);
    expect(isClipboardMediaFile(new File([], "note.txt"), "image")).toBe(false);
    expect(shouldPreserveImageFileAsAsset(new File([], "motion.gif"))).toBe(
      true,
    );
    expect(
      shouldPreserveImageFileAsAsset(new File([], "still.png", { type: "image/png" })),
    ).toBe(false);
  });

  it("normalizes pasted data URL MIME types", () => {
    expect(
      normalizeDataUrlMimeType("data:;base64,abc", "video/mp4"),
    ).toBe("data:video/mp4;base64,abc");
    expect(
      normalizeDataUrlMimeType("data:image/png;base64,abc", "image/png"),
    ).toBe("data:image/png;base64,abc");
  });

  it("filters dropped media files and detects file drops", () => {
    const image = new File([], "image.png");
    const video = new File([], "video.mp4");
    const text = new File([], "note.txt");

    expect(dataTransferHasFiles({ items: [], types: ["Files"] })).toBe(true);
    expect(dataTransferHasFiles({ items: [{ kind: "file" }], types: [] })).toBe(
      true,
    );
    expect(getDroppedMediaFiles({ files: [image, text, video] })).toEqual([
      image,
      video,
    ]);
  });

  it("resolves dropped local paths from the desktop bridge or legacy file path", () => {
    const file = new File([], "video.mp4");
    const legacyFile = Object.assign(new File([], "legacy.mp4"), {
      path: "D:/legacy.mp4",
    });

    expect(getLocalPathForDroppedFile(file, () => "D:/video.mp4")).toBe(
      "D:/video.mp4",
    );
    expect(
      getLocalPathForDroppedFile(legacyFile, () => {
        throw new Error("unsupported");
      }),
    ).toBe("D:/legacy.mp4");
  });

  it("plans dropped media imports with local video paths when available", () => {
    const image = new File([], "image.png", { type: "image/png" });
    const gif = new File([], "motion.gif", { type: "image/gif" });
    const video = new File([], "video.mp4", { type: "video/mp4" });

    expect(
      getDroppedMediaImportActions(
        { files: [image, gif, video] },
        (file) =>
          file === video
            ? "D:/video.mp4"
            : file === gif
              ? "D:/motion.gif"
              : null,
      ),
    ).toEqual([
      { action: "imageFile", file: image },
      {
        action: "imageFilePath",
        fileName: "motion.gif",
        filePath: "D:/motion.gif",
        mimeType: "image/gif",
      },
      {
        action: "videoFilePath",
        fileName: "video.mp4",
        filePath: "D:/video.mp4",
        mimeType: "video/mp4",
      },
    ]);

    expect(getDroppedMediaImportActions({ files: [video] })).toEqual([
      { action: "videoFile", file: video },
    ]);
  });

  it("extracts clipboard files from direct files and item files", () => {
    const directImage = new File([], "direct.png", { type: "image/png" });
    const itemImage = new File([], "item.png", { type: "image/png" });

    expect(getClipboardImageFile(clipboardData({ files: [directImage] }))).toBe(
      directImage,
    );
    expect(
      getClipboardImageFile(
        clipboardData({
          items: [{ kind: "file", getAsFile: () => itemImage }],
        }),
      )?.name,
    ).toBe("item.png");
  });

  it("plans direct clipboard media actions with image priority", () => {
    const image = new File([], "direct.png", { type: "image/png" });
    const video = new File([], "clip.mp4", { type: "video/mp4" });

    expect(
      getClipboardDirectMediaAction(clipboardData({ files: [video] })),
    ).toEqual({
      action: "videoFile",
      file: video,
    });
    expect(
      getClipboardDirectMediaAction(clipboardData({ files: [video, image] })),
    ).toEqual({
      action: "imageFile",
      file: image,
    });
  });

  it("finds the first clipboard media item by MIME type", () => {
    expect(
      findFirstClipboardMedia(
        [
          { fileName: "note.txt", mimeType: "text/plain" },
          { fileName: "clip.mov", mimeType: "video/quicktime" },
        ],
        "video",
      ),
    ).toEqual({ fileName: "clip.mov", mimeType: "video/quicktime" });
    expect(findFirstClipboardMedia(undefined, "image")).toBeNull();
  });

  it("plans clipboard file-reference and data-url import actions", () => {
    expect(
      getClipboardFileReferenceImportAction([
        {
          fileName: "motion.gif",
          filePath: "D:/motion.gif",
          mimeType: "image/gif",
        },
      ]),
    ).toEqual({
      action: "imageFilePath",
      fileName: "motion.gif",
      filePath: "D:/motion.gif",
      mimeType: "image/gif",
    });

    expect(
      getClipboardFileReferenceImportAction([
        {
          fileName: "clip.mp4",
          filePath: "D:/clip.mp4",
          mimeType: "video/mp4",
        },
      ]),
    ).toEqual({
      action: "videoFilePath",
      fileName: "clip.mp4",
      filePath: "D:/clip.mp4",
      mimeType: "video/mp4",
    });

    expect(
      getClipboardMediaDataImportAction([
        {
          dataUrl: "data:image/png;base64,a",
          fileName: "image.png",
          mimeType: "image/png",
        },
        {
          dataUrl: "data:video/mp4;base64,b",
          fileName: "clip.mp4",
          mimeType: "video/mp4",
        },
      ]),
    ).toEqual({
      action: "videoDataUrl",
      dataUrl: "data:video/mp4;base64,b",
      fileName: "clip.mp4",
      mimeType: "video/mp4",
    });

    expect(
      getClipboardImageDataImportAction({
        dataUrl: "data:image/png;base64,a",
        fileName: "image.png",
        mimeType: "image/png",
      }),
    ).toEqual({
      action: "imageDataUrl",
      dataUrl: "data:image/png;base64,a",
      fileName: "image.png",
      mimeType: "image/png",
    });
  });

  it("resolves clipboard fallback actions by source priority", async () => {
    const browserReader = vi.fn(async () => null);
    const beforeNativeRead = vi.fn();

    await expect(
      readClipboardMediaFallbackAction({
        listMediaFileRefs: async () => [
          {
            fileName: "clip.mp4",
            filePath: "D:/clip.mp4",
            mimeType: "video/mp4",
          },
        ],
        onBeforeReadNativeMediaData: beforeNativeRead,
        readBrowserMedia: browserReader,
      }),
    ).resolves.toEqual({
      action: "videoFilePath",
      fileName: "clip.mp4",
      filePath: "D:/clip.mp4",
      mimeType: "video/mp4",
    });
    expect(browserReader).not.toHaveBeenCalled();
    expect(beforeNativeRead).not.toHaveBeenCalled();

    const browserVideo = new File([], "browser.webm", { type: "video/webm" });

    await expect(
      readClipboardMediaFallbackAction({
        listMediaFileRefs: async () => [],
        onBeforeReadNativeMediaData: beforeNativeRead,
        readBrowserMedia: async (kind) =>
          kind === "video" ? browserVideo : null,
      }),
    ).resolves.toEqual({ action: "videoFile", file: browserVideo });
    expect(beforeNativeRead).not.toHaveBeenCalled();

    const readImageData = vi.fn(async () => ({
      dataUrl: "data:image/png;base64,c",
      fileName: "fallback.png",
      mimeType: "image/png",
    }));

    await expect(
      readClipboardMediaFallbackAction({
        onBeforeReadNativeMediaData: beforeNativeRead,
        readBrowserMedia: async () => null,
        readImageData,
        readMediaData: async () => [
          {
            dataUrl: "data:image/png;base64,a",
            fileName: "image.png",
            mimeType: "image/png",
          },
        ],
      }),
    ).resolves.toEqual({
      action: "imageDataUrl",
      dataUrl: "data:image/png;base64,a",
      fileName: "image.png",
      mimeType: "image/png",
    });
    expect(beforeNativeRead).toHaveBeenCalledTimes(1);
    expect(readImageData).not.toHaveBeenCalled();

    await expect(
      readClipboardMediaFallbackAction({
        onBeforeReadNativeMediaData: beforeNativeRead,
        readBrowserMedia: async () => null,
        readImageData: async () => ({
          dataUrl: "data:image/png;base64,c",
          fileName: "fallback.png",
          mimeType: "image/png",
        }),
        readMediaData: async () => [],
      }),
    ).resolves.toEqual({
      action: "imageDataUrl",
      dataUrl: "data:image/png;base64,c",
      fileName: "fallback.png",
      mimeType: "image/png",
    });
    expect(beforeNativeRead).toHaveBeenCalledTimes(2);
  });

  it("detects clipboard media fallback candidates", () => {
    expect(clipboardHtmlLooksLikeMedia(clipboardData({ html: "<img src=x>" }))).toBe(
      true,
    );
    expect(clipboardPlainTextLooksLikeMediaPath('"D:/capture.webp"')).toBe(true);
    expect(clipboardPlainTextLooksLikeMediaPath("plain text")).toBe(false);
    expect(
      shouldTryClipboardMediaFallback(clipboardData({ files: [new File([], "a.mov")] })),
    ).toBe(true);
  });

  it("reads browser clipboard media items", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T06:07:08.000Z"));

    const file = await readBrowserClipboardMedia("image", {
      read: async () => [
        {
          types: ["text/plain"],
          getType: async () => new Blob(),
        },
        {
          types: ["image/png"],
          getType: async () => new Blob(["a"], { type: "image/png" }),
        },
      ],
    });

    expect(file?.name).toBe("screenshot-2026-05-24-06-07-08.png");
    expect(file?.type).toBe("image/png");
  });

  it("creates timestamped media names with normalized extensions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T06:07:08.000Z"));

    expect(createTimestampedImageName("image/jpeg")).toBe(
      "screenshot-2026-05-24-06-07-08.jpg",
    );
    expect(createTimestampedVideoName("video/quicktime")).toBe(
      "recording-2026-05-24-06-07-08.mov",
    );
  });

  it("escapes video markdown attributes", () => {
    expect(createVideoMarkdown(`a"b.mp4`, `assets/a&b.mp4`)).toContain(
      `src="assets/a&amp;b.mp4" title="a&quot;b.mp4"`,
    );
  });

  it("creates and matches escaped import placeholders", () => {
    const placeholder = createMediaImportPlaceholder(
      "id.*",
      `a"b.mp4`,
      "读取中",
      0.25,
    );

    expect(placeholder).toContain(`data-notedock-import-id="id.*"`);
    expect(placeholder).toContain("a&quot;b.mp4");
    expect(placeholder).toContain("25%");
    expect("before\n" + placeholder + "after").toMatch(
      getMediaImportPattern("id.*"),
    );
  });

  it("replaces or appends media import placeholders in markdown content", () => {
    const placeholder = createMediaImportPlaceholder("video-1", "clip.mp4", "ready");
    const content = `before\n${placeholder}after`;

    expect(
      replaceMediaImportPlaceholderContent(
        content,
        "video-1",
        "<video></video>\n\n",
      ),
    ).toEqual({
      content: "before\n<video></video>\n\nafter",
      didChange: true,
      didReplace: true,
    });

    expect(
      replaceMediaImportPlaceholderContent("before", "missing", "after"),
    ).toEqual({
      content: "before",
      didChange: false,
      didReplace: false,
    });

    expect(
      replaceMediaImportPlaceholderContent("before\n", "missing", "after", {
        appendIfMissing: true,
      }),
    ).toEqual({
      content: "before\n\nafter",
      didChange: true,
      didReplace: false,
    });
  });
});
