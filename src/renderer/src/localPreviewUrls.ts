const urlWithSchemePattern = /^[a-z][a-z\d+.-]*:/i;

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeLocalPath(filePath: string) {
  return filePath
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => encodeURIComponent(safeDecodeURIComponent(part)))
    .join("/");
}

function splitResourceUrl(url: string) {
  const match = url.match(/^([^?#]*)([?#].*)?$/);

  return {
    path: match?.[1] ?? url,
    suffix: match?.[2] ?? "",
  };
}

export function getDirectoryPath(filePath?: string) {
  if (!filePath) {
    return "";
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  const separatorIndex = normalizedPath.lastIndexOf("/");

  return separatorIndex >= 0
    ? normalizedPath.slice(0, separatorIndex)
    : normalizedPath;
}

export function getLocalPreviewUrl(filePath?: string) {
  if (!filePath) {
    return undefined;
  }

  return `typora-local://file/${encodeLocalPath(filePath)}`;
}

export function isRelativeResourceUrl(url?: string) {
  if (!url) {
    return false;
  }

  return (
    !url.startsWith("#") &&
    !url.startsWith("/") &&
    !url.startsWith("\\") &&
    !urlWithSchemePattern.test(url)
  );
}

export function resolveDocumentResourceUrl(url?: string, documentFilePath?: string) {
  if (!url || !documentFilePath || !isRelativeResourceUrl(url)) {
    return url;
  }

  const { path, suffix } = splitResourceUrl(url);
  const baseDirectory = getDirectoryPath(documentFilePath);
  const resolvedSegments: string[] = [];

  `${baseDirectory}/${path}`
    .replace(/\\/g, "/")
    .split("/")
    .forEach((segment) => {
      if (!segment || segment === ".") {
        return;
      }

      if (segment === "..") {
        resolvedSegments.pop();
        return;
      }

      resolvedSegments.push(segment);
    });

  return `${getLocalPreviewUrl(resolvedSegments.join("/"))}${suffix}`;
}
