import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearDocumentHistoryVersions,
  createDocumentHistoryVersion,
  listDocumentHistoryVersions,
  maybeCreateDocumentHistoryVersion,
  readDocumentHistoryVersion,
} from "./documentHistory";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "notedock-history-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("document history", () => {
  it("creates an automatic markdown snapshot from previous content", async () => {
    const root = await makeTempDir();
    const historyRootPath = join(root, "history");
    const filePath = join(root, "note.md");

    const version = await maybeCreateDocumentHistoryVersion({
      filePath,
      historyRootPath,
      nextContent: "# Next\n\nBody",
      previousContent: "# Previous\n\nBody",
    });

    expect(version?.reason).toBe("auto");
    expect(version?.preview).toBe("# Previous");

    const versions = await listDocumentHistoryVersions({ filePath, historyRootPath });

    expect(versions).toHaveLength(1);
    expect(versions[0].id).toBe(version?.id);
  });

  it("does not create duplicate automatic snapshots for the same content", async () => {
    const root = await makeTempDir();
    const historyRootPath = join(root, "history");
    const filePath = join(root, "note.md");

    await maybeCreateDocumentHistoryVersion({
      filePath,
      historyRootPath,
      nextContent: "next",
      previousContent: "previous",
    });
    await maybeCreateDocumentHistoryVersion({
      filePath,
      historyRootPath,
      nextContent: "next again",
      previousContent: "previous",
    });

    await expect(
      listDocumentHistoryVersions({ filePath, historyRootPath }),
    ).resolves.toHaveLength(1);
  });

  it("throttles automatic snapshots for five minutes", async () => {
    const root = await makeTempDir();
    const historyRootPath = join(root, "history");
    const filePath = join(root, "note.md");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await maybeCreateDocumentHistoryVersion({
      filePath,
      historyRootPath,
      nextContent: "next",
      previousContent: "first",
    });
    await expect(
      listDocumentHistoryVersions({ filePath, historyRootPath }),
    ).resolves.toHaveLength(1);

    vi.setSystemTime(new Date("2026-01-01T00:04:59.000Z"));
    await maybeCreateDocumentHistoryVersion({
      filePath,
      historyRootPath,
      nextContent: "next 2",
      previousContent: "second",
    });
    await expect(
      listDocumentHistoryVersions({ filePath, historyRootPath }),
    ).resolves.toHaveLength(1);

    vi.setSystemTime(new Date("2026-01-01T00:05:00.000Z"));
    await maybeCreateDocumentHistoryVersion({
      filePath,
      historyRootPath,
      nextContent: "next 3",
      previousContent: "third",
    });

    await expect(
      listDocumentHistoryVersions({ filePath, historyRootPath }),
    ).resolves.toHaveLength(2);
  });

  it("reads the full content for a selected history version", async () => {
    const root = await makeTempDir();
    const historyRootPath = join(root, "history");
    const filePath = join(root, "note.md");
    const content = "# Title\n\nFull history content";

    const version = await createDocumentHistoryVersion({
      content,
      filePath,
      historyRootPath,
      reason: "manual",
    });

    const result = await readDocumentHistoryVersion({
      filePath,
      historyRootPath,
      versionId: version!.id,
    });

    expect(result?.content).toBe(content);
    expect(result?.reason).toBe("manual");
  });

  it("clears all versions for a markdown document", async () => {
    const root = await makeTempDir();
    const historyRootPath = join(root, "history");
    const filePath = join(root, "note.md");

    await createDocumentHistoryVersion({
      content: "first",
      filePath,
      historyRootPath,
      reason: "manual",
    });
    await createDocumentHistoryVersion({
      content: "second",
      filePath,
      historyRootPath,
      reason: "manual",
    });

    await clearDocumentHistoryVersions({ filePath, historyRootPath });

    await expect(
      listDocumentHistoryVersions({ filePath, historyRootPath }),
    ).resolves.toEqual([]);
  });

  it("ignores unsupported file types", async () => {
    const root = await makeTempDir();
    const historyRootPath = join(root, "history");
    const filePath = join(root, "page.html");

    const version = await createDocumentHistoryVersion({
      content: "<h1>Page</h1>",
      filePath,
      historyRootPath,
    });

    expect(version).toBeNull();
    await expect(
      listDocumentHistoryVersions({ filePath, historyRootPath }),
    ).resolves.toEqual([]);
  });
});
