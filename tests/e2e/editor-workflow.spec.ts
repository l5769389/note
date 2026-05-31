import { _electron as electron, expect, test, type Page } from "@playwright/test";
import electronPath from "electron";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const appStateFileName = "notedock-state-v1.json";

function iso(offsetMs = 0) {
  return new Date(Date.UTC(2026, 4, 30, 12, 0, 0, offsetMs)).toISOString();
}

function createDocument({
  content,
  filePath,
  id,
  title,
}: {
  content: string;
  filePath: string;
  id: string;
  title: string;
}) {
  return {
    content,
    createdAt: iso(),
    documentType: "markdown",
    drawings: {},
    fileExtension: ".md",
    filePath,
    id,
    lastOpenedAt: iso(1),
    metadata: {
      documentLinks: [],
      properties: [],
      tags: [],
    },
    title,
    updatedAt: iso(2),
  };
}

async function seedWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "notedock-e2e-"));
  const userDataDir = join(root, "user-data");
  const workspaceDir = join(root, "workspace");
  const filePath = join(workspaceDir, "seed.md");
  const content = "# Seed Note\n\nAlpha searchable line\n\n";
  const document = createDocument({
    content,
    filePath,
    id: "seed-document",
    title: "seed",
  });

  await mkdir(workspaceDir, { recursive: true });
  await mkdir(userDataDir, { recursive: true });
  await writeFile(filePath, content, "utf-8");
  await writeFile(
    join(userDataDir, appStateFileName),
    JSON.stringify(
      {
        appSettings: {
          editorMode: "typora",
        },
        recentDirectories: [workspaceDir],
        theme: "github",
        updatedAt: iso(3),
        version: 1,
        workspace: {
          activeDocumentId: "",
          documents: [document],
          updatedAt: iso(4),
          version: 1,
          workspacePath: workspaceDir,
        },
      },
      null,
      2,
    ),
    "utf-8",
  );

  return { filePath, root, userDataDir, workspaceDir };
}

async function switchEditorMode(page: Page, mode: "preview" | "source" | "split" | "typora") {
  await page.getByTestId("menu-view").click();
  await page.getByTestId("menu-editor-mode").click();
  await page.getByTestId(`menu-mode-${mode}`).click();
}

test("opens a seeded markdown document and exercises editing, shortcuts, search, and preview", async () => {
  const seed = await seedWorkspace();
  const app = await electron.launch({
    args: [resolve("out/main/index.js")],
    executablePath: electronPath as unknown as string,
    env: {
      ...process.env,
      NOTEDOCK_E2E: "1",
      NOTEDOCK_TEST_USER_DATA_DIR: seed.userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("app-shell")).toBeVisible();

    const recentDocument = page
      .getByTestId("recent-document")
      .filter({ hasText: "seed.md" })
      .first();
    await expect(recentDocument).toBeVisible();
    await recentDocument.click();

    const typoraEditor = page.getByTestId("typora-editor");
    const proseMirror = typoraEditor.locator(".ProseMirror");
    await expect(proseMirror).toBeVisible();
    await proseMirror.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("Typed in Typora mode.\n");
    await page.keyboard.press("Control+S");
    await expect
      .poll(async () => readFile(seed.filePath, "utf-8"))
      .toContain("Typed in Typora mode.");

    await switchEditorMode(page, "source");
    const sourceEditor = page.getByTestId("source-editor");
    await expect(sourceEditor).toBeVisible();
    await sourceEditor.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      const start = textarea.value.indexOf("Alpha searchable line");
      textarea.focus();
      textarea.setSelectionRange(start, start + "Alpha searchable line".length);
    });
    await page.keyboard.press("Control+B");
    await expect(sourceEditor).toHaveValue(/(?:\*\*Alpha searchable line\*\*)/);
    await page.keyboard.press("Control+S");
    await expect
      .poll(async () => readFile(seed.filePath, "utf-8"))
      .toContain("**Alpha searchable line**");

    await page.keyboard.press("Control+F");
    await expect(page.getByTestId("find-input")).toBeVisible();
    await page.getByTestId("find-input").fill("Typed in Typora");
    await page.getByTestId("find-close").click();
    await expect(page.getByTestId("find-input")).toBeHidden();

    await sourceEditor.click();
    await page.keyboard.press("Control+Shift+F");
    const workspaceSearchInput = page.getByTestId("workspace-search-input");
    await expect(workspaceSearchInput).toBeVisible();
    await workspaceSearchInput.fill("searchable");
    await expect(page.getByTestId("workspace-search-match").first()).toBeVisible();

    await switchEditorMode(page, "preview");
    await expect(page.getByTestId("markdown-preview")).toBeVisible();
    await expect(page.getByTestId("markdown-preview")).toContainText("Typed in Typora mode.");
  } finally {
    await app.close();
    await rm(seed.root, { force: true, recursive: true });
  }
});
