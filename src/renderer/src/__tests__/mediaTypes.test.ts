import { describe, expect, it } from "vitest";
import {
  getClipboardFormatMimeType,
  getMediaFileExtensionFromMimeType,
  getMediaMimeTypeForFileName,
} from "../../../shared/mediaTypes";

describe("media type helpers", () => {
  it("detects image and video MIME types from filenames", () => {
    expect(getMediaMimeTypeForFileName("capture.GIF")).toBe("image/gif");
    expect(getMediaMimeTypeForFileName("clip.mov")).toBe("video/quicktime");
    expect(getMediaMimeTypeForFileName("screen-recording.WEBM")).toBe("video/webm");
  });

  it("normalizes clipboard format aliases", () => {
    expect(getClipboardFormatMimeType("PNG")).toBe("image/png");
    expect(getClipboardFormatMimeType("image/jpg")).toBe("image/jpeg");
    expect(getClipboardFormatMimeType("video/x-matroska")).toBe("video/x-matroska");
  });

  it("uses stable preferred file extensions for media MIME types", () => {
    expect(getMediaFileExtensionFromMimeType("image/jpeg")).toBe("jpg");
    expect(getMediaFileExtensionFromMimeType("image/gif")).toBe("gif");
    expect(getMediaFileExtensionFromMimeType("video/quicktime")).toBe("mov");
  });
});
