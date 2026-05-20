export type MediaKind = "image" | "video";

export const mediaMimeTypeEntries = [
  [".3g2", "video/3gpp2"],
  [".3gp", "video/3gpp"],
  [".avi", "video/x-msvideo"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".m4v", "video/mp4"],
  [".mkv", "video/x-matroska"],
  [".mov", "video/quicktime"],
  [".mp4", "video/mp4"],
  [".mpeg", "video/mpeg"],
  [".mpg", "video/mpeg"],
  [".ogv", "video/ogg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".wmv", "video/x-ms-wmv"],
] as const;

export const clipboardFormatMimeTypeEntries = [
  ...mediaMimeTypeEntries.map(([extension, mimeType]) => [
    extension.slice(1),
    mimeType,
  ] as const),
  ["image/jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["jfif", "image/jpeg"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["tiff", "image/tiff"],
] as const;

const mediaMimeTypesByExtension = new Map<string, string>(mediaMimeTypeEntries);
const clipboardMimeTypesByFormat = new Map<string, string>(
  clipboardFormatMimeTypeEntries,
);

const preferredMediaExtensionByMimeType = new Map<string, string>([
  ["image/bmp", "bmp"],
  ["image/gif", "gif"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/svg+xml", "svg"],
  ["image/tiff", "tiff"],
  ["image/webp", "webp"],
  ["video/3gpp", "3gp"],
  ["video/3gpp2", "3g2"],
  ["video/mp4", "mp4"],
  ["video/mpeg", "mpeg"],
  ["video/ogg", "ogv"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
  ["video/x-matroska", "mkv"],
  ["video/x-ms-wmv", "wmv"],
  ["video/x-msvideo", "avi"],
]);

export function getFileExtension(name: string) {
  const match = name.match(/\.[^.\\/]+$/);

  return match?.[0]?.toLowerCase() ?? "";
}

export function getMediaMimeTypeForExtension(extension: string) {
  const normalizedExtension = extension.trim().toLowerCase();

  if (!normalizedExtension) {
    return null;
  }

  return mediaMimeTypesByExtension.get(
    normalizedExtension.startsWith(".")
      ? normalizedExtension
      : `.${normalizedExtension}`,
  ) ?? null;
}

export function getMediaMimeTypeForFileName(name: string) {
  return getMediaMimeTypeForExtension(getFileExtension(name));
}

export function getClipboardFormatMimeType(format: string) {
  const normalizedFormat = format.trim().toLowerCase();

  if (!normalizedFormat) {
    return null;
  }

  if (
    normalizedFormat.startsWith("image/") ||
    normalizedFormat.startsWith("video/")
  ) {
    return clipboardMimeTypesByFormat.get(normalizedFormat) ?? normalizedFormat;
  }

  return clipboardMimeTypesByFormat.get(normalizedFormat) ?? null;
}

export function getMediaFileExtensionFromMimeType(mimeType: string) {
  const normalizedMimeType = mimeType.trim().toLowerCase();

  return (
    preferredMediaExtensionByMimeType.get(normalizedMimeType) ??
    normalizedMimeType.split("/").at(1)?.replace(/^x-/, "") ??
    "bin"
  );
}

export function getMediaKind(mimeType: string): MediaKind | null {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  return null;
}
