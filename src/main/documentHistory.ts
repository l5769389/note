import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

export type DocumentHistoryVersionReason = "auto" | "manual" | "restore";

export type DocumentHistoryVersion = {
  byteSize: number;
  contentHash: string;
  createdAt: string;
  filePath: string;
  id: string;
  lineCount: number;
  preview: string;
  reason: DocumentHistoryVersionReason;
  title: string;
  wordCount: number;
};

export type DocumentHistoryVersionWithContent = DocumentHistoryVersion & {
  content: string;
};

const markdownHistoryExtensions = new Set([".md", ".markdown", ".mdown"]);
const documentHistoryMinIntervalMs = 10 * 60 * 1000;
const documentHistoryLargeChangeThreshold = 640;
const documentHistoryMaxVersions = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isDocumentHistorySupportedFile(filePath: string) {
  return markdownHistoryExtensions.has(extname(filePath).toLowerCase());
}

function createContentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function getHistoryFileKey(filePath: string) {
  return createHash("sha256").update(resolve(filePath).toLowerCase()).digest("hex");
}

function getHistoryDirectoryPath(historyRootPath: string, filePath: string) {
  return join(historyRootPath, getHistoryFileKey(filePath));
}

function getVersionMetadataPath(
  historyRootPath: string,
  filePath: string,
  versionId: string,
) {
  return join(getHistoryDirectoryPath(historyRootPath, filePath), `${versionId}.json`);
}

function getVersionContentPath(
  historyRootPath: string,
  filePath: string,
  versionId: string,
) {
  return join(getHistoryDirectoryPath(historyRootPath, filePath), `${versionId}.md`);
}

function createVersionId(now: Date) {
  const timestamp = now.toISOString().replace(/[^\d]/g, "").slice(0, 14);
  return `${timestamp}-${randomUUID()}`;
}

function getHistoryPreview(content: string) {
  return (
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "空白版本"
  ).slice(0, 160);
}

function countWords(content: string) {
  const matches = content.match(/[\p{L}\p{N}_]+/gu);
  return matches?.length ?? 0;
}

function getLineCount(content: string) {
  if (!content) {
    return 0;
  }

  return content.split(/\r?\n/).length;
}

function estimateContentChangeSize(previousContent: string, nextContent: string) {
  const maxComparableLength = Math.min(previousContent.length, nextContent.length);
  let changedCharacters = Math.abs(previousContent.length - nextContent.length);

  for (let index = 0; index < maxComparableLength; index += 1) {
    if (previousContent[index] !== nextContent[index]) {
      changedCharacters += 1;
    }

    if (changedCharacters >= documentHistoryLargeChangeThreshold) {
      return changedCharacters;
    }
  }

  return changedCharacters;
}

function normalizeHistoryMetadata(value: unknown): DocumentHistoryVersion | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.byteSize !== "number" ||
    typeof value.contentHash !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.filePath !== "string" ||
    typeof value.id !== "string" ||
    typeof value.lineCount !== "number" ||
    typeof value.preview !== "string" ||
    typeof value.title !== "string" ||
    typeof value.wordCount !== "number"
  ) {
    return null;
  }

  const reason =
    value.reason === "manual" || value.reason === "restore" ? value.reason : "auto";

  return {
    byteSize: value.byteSize,
    contentHash: value.contentHash,
    createdAt: value.createdAt,
    filePath: value.filePath,
    id: value.id,
    lineCount: value.lineCount,
    preview: value.preview,
    reason,
    title: value.title,
    wordCount: value.wordCount,
  };
}

async function readHistoryMetadataFile(filePath: string) {
  try {
    return normalizeHistoryMetadata(JSON.parse(await readFile(filePath, "utf-8")));
  } catch {
    return null;
  }
}

export async function listDocumentHistoryVersions({
  filePath,
  historyRootPath,
}: {
  filePath: string;
  historyRootPath: string;
}) {
  if (!isDocumentHistorySupportedFile(filePath)) {
    return [];
  }

  const directoryPath = getHistoryDirectoryPath(historyRootPath, filePath);
  let entries: string[] = [];

  try {
    entries = await readdir(directoryPath);
  } catch {
    return [];
  }

  const versions = (
    await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => readHistoryMetadataFile(join(directoryPath, entry))),
    )
  ).filter((version): version is DocumentHistoryVersion => Boolean(version));

  return versions.sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
}

export async function readDocumentHistoryVersion({
  filePath,
  historyRootPath,
  versionId,
}: {
  filePath: string;
  historyRootPath: string;
  versionId: string;
}): Promise<DocumentHistoryVersionWithContent | null> {
  const metadata = await readHistoryMetadataFile(
    getVersionMetadataPath(historyRootPath, filePath, versionId),
  );

  if (!metadata) {
    return null;
  }

  try {
    const content = await readFile(
      getVersionContentPath(historyRootPath, filePath, versionId),
      "utf-8",
    );

    return { ...metadata, content };
  } catch {
    return null;
  }
}

async function pruneDocumentHistoryVersions({
  filePath,
  historyRootPath,
}: {
  filePath: string;
  historyRootPath: string;
}) {
  const versions = await listDocumentHistoryVersions({ filePath, historyRootPath });
  const staleVersions = versions.slice(documentHistoryMaxVersions);

  await Promise.all(
    staleVersions.map(async (version) => {
      await Promise.allSettled([
        rm(getVersionMetadataPath(historyRootPath, filePath, version.id), {
          force: true,
        }),
        rm(getVersionContentPath(historyRootPath, filePath, version.id), {
          force: true,
        }),
      ]);
    }),
  );
}

export async function createDocumentHistoryVersion({
  content,
  filePath,
  historyRootPath,
  now = new Date(),
  reason = "manual",
}: {
  content: string;
  filePath: string;
  historyRootPath: string;
  now?: Date;
  reason?: DocumentHistoryVersionReason;
}) {
  if (!isDocumentHistorySupportedFile(filePath)) {
    return null;
  }

  const contentHash = createContentHash(content);
  const versions = await listDocumentHistoryVersions({ filePath, historyRootPath });

  if (versions[0]?.contentHash === contentHash && reason !== "manual") {
    return versions[0];
  }

  const createdAt = now.toISOString();
  const id = createVersionId(now);
  const metadata = {
    byteSize: Buffer.byteLength(content, "utf-8"),
    contentHash,
    createdAt,
    filePath: resolve(filePath),
    id,
    lineCount: getLineCount(content),
    preview: getHistoryPreview(content),
    reason,
    title: basename(filePath),
    wordCount: countWords(content),
  } satisfies DocumentHistoryVersion;
  const directoryPath = getHistoryDirectoryPath(historyRootPath, filePath);

  await mkdir(directoryPath, { recursive: true });
  await Promise.all([
    writeFile(
      getVersionMetadataPath(historyRootPath, filePath, id),
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf-8",
    ),
    writeFile(getVersionContentPath(historyRootPath, filePath, id), content, "utf-8"),
  ]);
  await pruneDocumentHistoryVersions({ filePath, historyRootPath });

  return metadata;
}

export async function maybeCreateDocumentHistoryVersion({
  filePath,
  historyRootPath,
  nextContent,
  previousContent,
}: {
  filePath: string;
  historyRootPath: string;
  nextContent: string;
  previousContent: string;
}) {
  if (
    !isDocumentHistorySupportedFile(filePath) ||
    !previousContent.trim() ||
    previousContent === nextContent
  ) {
    return null;
  }

  const versions = await listDocumentHistoryVersions({ filePath, historyRootPath });
  const previousHash = createContentHash(previousContent);
  const latestVersion = versions[0] ?? null;

  if (latestVersion?.contentHash === previousHash) {
    return null;
  }

  const latestCreatedAt = latestVersion ? Date.parse(latestVersion.createdAt) : 0;
  const isPastMinimumInterval =
    !latestCreatedAt ||
    Number.isNaN(latestCreatedAt) ||
    Date.now() - latestCreatedAt >= documentHistoryMinIntervalMs;
  const isLargeChange =
    estimateContentChangeSize(previousContent, nextContent) >=
    documentHistoryLargeChangeThreshold;

  if (!latestVersion || isPastMinimumInterval || isLargeChange) {
    return createDocumentHistoryVersion({
      content: previousContent,
      filePath,
      historyRootPath,
      reason: "auto",
    });
  }

  return null;
}

export async function readCurrentDocumentContent(filePath: string) {
  try {
    const fileStats = await stat(filePath);

    if (!fileStats.isFile()) {
      return "";
    }

    return await readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}
