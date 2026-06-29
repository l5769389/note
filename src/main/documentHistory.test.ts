import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
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
