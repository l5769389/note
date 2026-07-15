import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
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
  documentType = "markdown",
  fileExtension = ".md",
  filePath,
  id,
  title,
}: {
  content: string;
  documentType?: "drawing" | "markdown";
  fileExtension?: string;
  filePath: string;
  id: string;
  title: string;
}) {
  return {
    content,
    createdAt: iso(),
    documentType,
    drawings: {},
    fileExtension,
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
  const assetDir = join(workspaceDir, ".assets");
  const filePath = join(workspaceDir, "seed.md");
  const drawingFilePath = join(workspaceDir, "canvas.excalidraw");
  const content =
    '# Seed Note\n\nAlpha searchable line\n\n![pixel](.assets/pixel.png "width=160")\n\n';
  const document = createDocument({
    content,
    filePath,
    id: "seed-document",
    title: "seed",
  });
  const drawingDocument = createDocument({
    content: JSON.stringify({
      appState: { viewBackgroundColor: "#ffffff" },
      elements: [],
      files: {},
      source: "https://excalidraw.com",
      type: "excalidraw",
      version: 2,
    }),
    documentType: "drawing",
    fileExtension: ".excalidraw",
    filePath: drawingFilePath,
    id: "drawing-document",
    title: "canvas",
  });

  await mkdir(workspaceDir, { recursive: true });
  await mkdir(assetDir, { recursive: true });
  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    join(assetDir, "pixel.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  await writeFile(filePath, content, "utf-8");
  await writeFile(drawingFilePath, drawingDocument.content, "utf-8");
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
          documents: [document, drawingDocument],
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

  return {
    assetPath: join(assetDir, "pixel.png"),
    drawingFilePath,
    filePath,
    root,
    userDataDir,
    workspaceDir,
  };
}

async function switchEditorMode(
  app: ElectronApplication,
  _page: Page,
  mode: "preview" | "source" | "split" | "typora",
) {
  await app.evaluate(
    ({ BrowserWindow }, commandId) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send("app-menu:command", {
        id: commandId,
      });
    },
    `view:mode-${mode}`,
  );
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
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+T" : "Control+T",
    );
    const tableInsertDialog = page.locator(".table-insert-dialog");
    await expect(tableInsertDialog).toBeVisible();
    await tableInsertDialog.getByLabel("表格行数").fill("4");
    await tableInsertDialog.getByLabel("表格列数").fill("3");
    await tableInsertDialog
      .getByRole("button", { name: "插入表格" })
      .click();
    const insertedTable = proseMirror.locator("table").first();
    await expect(insertedTable).toBeVisible();
    await expect(proseMirror.locator("table")).toHaveCount(1);
    await expect(insertedTable.locator("tr")).toHaveCount(4);
    await expect(insertedTable.locator("tr").first().locator("th, td")).toHaveCount(3);
    const tableWidthRatio = await insertedTable.evaluate((table) => {
      const editor = table.closest(".ProseMirror");

      return editor
        ? table.getBoundingClientRect().width / editor.getBoundingClientRect().width
        : 0;
    });
    expect(tableWidthRatio).toBeGreaterThan(0.9);
    await insertedTable.evaluate((table) => {
      const cells = table.querySelectorAll("th, td");
      const first = cells.item(0);
      const last = cells.item(cells.length - 1);

      if (!first || !last) {
        return;
      }

      const range = document.createRange();
      range.selectNodeContents(first);
      range.setEnd(last, last.childNodes.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    });
    await expect(insertedTable).toHaveClass(/ProseMirror-selectednode/);
    const headerCells = insertedTable.locator("tr").first().locator("th");
    await headerCells.first().click();
    await expect(insertedTable).not.toHaveClass(/ProseMirror-selectednode/);
    await page.keyboard.type("A");
    await page.keyboard.press("Tab");
    await expect(insertedTable.locator("tr").first().locator("th")).toHaveCount(3);
    await expect(headerCells.first()).toHaveText("");
    await expect(headerCells.nth(1)).toHaveText("A");
    await page.keyboard.type("B");
    await page.keyboard.press("Tab");
    await expect(insertedTable.locator("tr").first().locator("th")).toHaveCount(3);
    await page.keyboard.type("C");
    await page.keyboard.press("Tab");
    await expect(insertedTable.locator("tr").first().locator("th")).toHaveCount(4);
    expect(
      (await insertedTable.locator("tr").first().locator("th").allTextContents()).map(
        (value) => value.replaceAll("\u200B", ""),
      ),
    ).toEqual(["", "C", "B", "A"]);

    const tableToolbar = page.locator(".milkdown-table-toolbar");
    await insertedTable.locator("tr").first().locator("th").first().click();
    await expect(tableToolbar).toBeVisible();
    await tableToolbar.getByLabel("更多表格操作").click();
    await expect(page.locator(".milkdown-table-more-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".milkdown-table-more-menu")).toBeHidden();

    const secondRowSecondCell = insertedTable
      .locator("tr")
      .nth(1)
      .locator("td")
      .nth(1);
    await secondRowSecondCell.click();
    await page.keyboard.type("Q");
    await page.keyboard.press("Shift+ArrowLeft");
    await tableToolbar.getByLabel("居中对齐").click();
    await expect(secondRowSecondCell).toHaveCSS("text-align", "center");
    await expect(
      insertedTable.locator("tr").nth(1).locator("td").first(),
    ).toHaveCSS("text-align", "left");
    await page.keyboard.press("Backspace");
    const focusedTableCell = await page.evaluate(() => {
      const selection = window.getSelection();
      const anchor = selection?.anchorNode;
      const element =
        anchor instanceof Element ? anchor : anchor?.parentElement ?? null;
      const cell = element?.closest("td, th");
      const row = cell?.parentElement;

      return {
        column: cell && row ? Array.from(row.children).indexOf(cell) : -1,
        row:
          row?.parentElement && row
            ? Array.from(row.parentElement.children).indexOf(row)
            : -1,
      };
    });
    expect(focusedTableCell).toEqual({ column: 0, row: 1 });

    await insertedTable.locator("tr").nth(2).locator("td").first().click();
    await tableToolbar.getByLabel("更多表格操作").click();
    await page
      .locator(".milkdown-table-more-menu")
      .getByRole("button", { name: "删除行" })
      .click();
    await expect(insertedTable.locator("tr")).toHaveCount(3);

    await insertedTable.locator("tr").nth(1).locator("td").nth(2).click();
    await tableToolbar.getByLabel("更多表格操作").click();
    await page
      .locator(".milkdown-table-more-menu")
      .getByRole("button", { name: "删除列" })
      .click();
    await expect(insertedTable.locator("tr").first().locator("th, td")).toHaveCount(3);
    const editorImage = proseMirror.locator("img.typora-editable-image");
    await expect(editorImage).toBeVisible();
    const directImageCopy = await page.evaluate(
      (assetPath) => window.desktop?.writeImageFileToClipboard?.(assetPath),
      seed.assetPath,
    );
    expect(directImageCopy).toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.desktop?.readClipboardImage?.()))
      .toMatchObject({ mimeType: "image/png" });

    await editorImage.click({ button: "right" });
    const imagePreviewAction = page.getByRole("menuitem", { name: "全屏浏览" });
    await expect(imagePreviewAction).toBeVisible();
    await imagePreviewAction.click();
    const imagePreviewDialog = page.locator(".document-image-preview-dialog");
    const imagePreviewClose = page.getByLabel("关闭图片预览");
    await expect(imagePreviewDialog).toBeVisible();
    await expect(imagePreviewClose).toBeVisible();
    const imagePreviewBox = await imagePreviewDialog.boundingBox();
    const imagePreviewCloseBox = await imagePreviewClose.boundingBox();
    const imagePreviewViewport = await page.evaluate(() => ({
      height: window.innerHeight,
      width: window.innerWidth,
    }));
    expect(imagePreviewBox).not.toBeNull();
    expect(imagePreviewCloseBox).not.toBeNull();
    expect(imagePreviewBox!.x).toBeGreaterThanOrEqual(12);
    expect(imagePreviewBox!.y).toBeGreaterThanOrEqual(12);
    expect(imagePreviewBox!.x + imagePreviewBox!.width).toBeLessThanOrEqual(
      imagePreviewViewport.width - 12,
    );
    expect(imagePreviewBox!.y + imagePreviewBox!.height).toBeLessThanOrEqual(
      imagePreviewViewport.height - 12,
    );
    expect(imagePreviewCloseBox!.y).toBeGreaterThanOrEqual(imagePreviewBox!.y);
    await imagePreviewClose.click();
    await page.evaluate(async () => {
      await window.desktop?.writeRichHtmlToClipboard?.({ text: "clipboard-sentinel" });
    });
    await expect
      .poll(() => page.evaluate(() => window.desktop?.readClipboardImage?.()))
      .toBeNull();
    await editorImage.click();
    await page.keyboard.press("Meta+C");
    await expect
      .poll(() => page.evaluate(() => window.desktop?.readClipboardImage?.()))
      .toMatchObject({ mimeType: "image/png" });

    await proseMirror.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("Typed in Typora mode.\n");
    await page.keyboard.press("Control+S");
    await expect
      .poll(async () => readFile(seed.filePath, "utf-8"))
      .toContain("Typed in Typora mode.");

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send("app-menu:command", {
        id: "file:history",
      });
    });
    const historyDialog = page.locator(".document-history-dialog");
    await expect(historyDialog).toBeVisible();
    await expect(historyDialog.locator(".document-history-browser")).toBeVisible();
    await expect(
      historyDialog.locator(".document-history-browser-documents"),
    ).toBeVisible();
    await expect(historyDialog.locator(".document-history-panel")).toBeVisible();
    const historyDialogBox = await historyDialog.boundingBox();
    expect(historyDialogBox).not.toBeNull();
    expect(historyDialogBox!.x).toBeGreaterThanOrEqual(16);
    expect(historyDialogBox!.y).toBeGreaterThanOrEqual(16);
    await historyDialog.getByLabel("关闭历史记录").click();

    await switchEditorMode(app, page, "source");
    const sourceEditor = page.getByTestId("source-editor");
    await expect(sourceEditor).toBeVisible();
    await expect(
      sourceEditor,
    ).toHaveValue(
      /\|[\s\u200B]*\|\s*C\s*\|[\s\u200B]*A[\s\u200B]*\|/,
    );
    await expect(sourceEditor).not.toHaveValue(/\n\|\s*\n/);
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

    await switchEditorMode(app, page, "preview");
    await expect(page.getByTestId("markdown-preview")).toBeVisible();
    await expect(page.getByTestId("markdown-preview")).toContainText("Typed in Typora mode.");

    await page.getByLabel("关闭当前文档").click();
    await expect(page.locator(".welcome-home")).toBeVisible();
    await expect(page.getByTestId("markdown-preview")).toHaveCount(0);
    await expect(recentDocument).toBeVisible();

    const drawingDocument = page
      .getByTestId("recent-document")
      .filter({ hasText: "canvas.excalidraw" })
      .first();
    await drawingDocument.click();
    await page
      .getByRole("button", { name: /canvas\.excalidraw 预览/ })
      .dblclick();

    const drawingDialog = page.locator(".drawing-dialog");
    const drawingToolbar = drawingDialog.locator(".drawing-toolbar");
    await expect(drawingToolbar).toBeVisible({ timeout: 20_000 });
    const drawingBox = await drawingDialog.boundingBox();
    const viewport = await page.evaluate(() => ({
      height: window.innerHeight,
      width: window.innerWidth,
    }));
    expect(drawingBox).not.toBeNull();
    expect(drawingBox!.x).toBeGreaterThanOrEqual(12);
    expect(drawingBox!.y).toBeGreaterThanOrEqual(12);
    expect(drawingBox!.x + drawingBox!.width).toBeLessThanOrEqual(viewport.width - 12);
    expect(drawingBox!.y + drawingBox!.height).toBeLessThanOrEqual(viewport.height - 12);
    await expect(
      drawingToolbar.getByRole("button", { name: "关闭" }),
    ).toBeVisible();
    await drawingToolbar.getByRole("button", { name: "关闭" }).click();
    await expect(drawingDialog).toHaveCount(0);
  } finally {
    await app.close();
    await rm(seed.root, { force: true, recursive: true });
  }
});
