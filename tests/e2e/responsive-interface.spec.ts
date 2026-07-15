import { _electron as electron, expect, test, type Page } from "@playwright/test";
import electronPath from "electron";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const appStateFileName = "notedock-state-v1.json";

async function seedEmptyWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "notedock-responsive-e2e-"));
  const userDataDir = join(root, "user-data");
  const timestamp = new Date(Date.UTC(2026, 6, 10, 4, 0, 0)).toISOString();

  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    join(userDataDir, appStateFileName),
    JSON.stringify({
      appSettings: {
        homeShowDiaryPanel: true,
        homeShowNotePanel: true,
        homeShowTodoPanel: true,
      },
      recentDirectories: [],
      theme: "github",
      updatedAt: timestamp,
      version: 1,
      workspace: {
        activeDocumentId: "",
        documents: [],
        updatedAt: timestamp,
        version: 1,
        workspacePath: "",
      },
    }),
    "utf8",
  );

  return { root, userDataDir };
}

async function resizeApp(
  page: Page,
  browserWindow: Awaited<ReturnType<Awaited<ReturnType<typeof electron.launch>>["browserWindow"]>>,
  width: number,
  height: number,
) {
  await browserWindow.evaluate(
    (window, size) => window.setSize(size.width, size.height),
    { width, height },
  );
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(250);
}

test("adapts the home and settings layouts at supported window sizes", async ({}, testInfo) => {
  const seed = await seedEmptyWorkspace();
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
    const browserWindow = await app.browserWindow(page);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("app-shell")).toBeVisible();

    await resizeApp(page, browserWindow, 760, 640);

    const home = page.locator(".welcome-home");
    const mainColumn = page.locator(".home-main-column");
    const sideColumn = page.locator(".home-side-column");
    await expect(home).toBeVisible();
    await expect(sideColumn).toBeVisible();
    await expect(home).toHaveCSS("overflow-y", "hidden");
    await expect(page.locator(".recent-list")).toHaveCSS("overflow-y", "hidden");

    const narrowMainBox = await mainColumn.boundingBox();
    const narrowSideBox = await sideColumn.boundingBox();
    expect(narrowMainBox).not.toBeNull();
    expect(narrowSideBox).not.toBeNull();
    expect(narrowSideBox!.y).toBeGreaterThan(narrowMainBox!.y);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath("home-760x640.png"),
      fullPage: false,
    });

    await page.getByLabel("打开设置").evaluate((element: HTMLElement) => {
      element.click();
    });
    const settingsDialog = page.locator(".settings-dialog.settings-redesign");
    await expect(settingsDialog).toBeVisible();
    const settingsBox = await settingsDialog.boundingBox();
    expect(settingsBox).not.toBeNull();
    expect(settingsBox!.height).toBeLessThanOrEqual(616);
    expect(settingsBox!.width).toBeLessThanOrEqual(736);

    const themeSelect = settingsDialog
      .locator(".settings-redesign-select-row select")
      .first();
    for (const themeName of [
      "paper",
      "github",
      "newsprint",
      "night",
      "pixyll",
      "whitey",
      "dark",
    ]) {
      await themeSelect.selectOption(themeName);
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.dataset.theme ?? ""),
        )
        .toBe(themeName);

      const themeSnapshot = await page.evaluate(() => {
        const readBackground = (selector: string) => {
          const element = document.querySelector(selector);

          if (!(element instanceof HTMLElement)) {
            return "";
          }

          return window.getComputedStyle(element).backgroundColor;
        };

        return {
          dialogBackground: readBackground(
            ".settings-dialog.settings-redesign",
          ),
          mainBackground: readBackground(".settings-redesign-main"),
          rowBackground: readBackground(".settings-redesign-select-row"),
          selectBackground: readBackground(
            ".settings-redesign-select-row select",
          ),
        };
      });

      expect(themeSnapshot.dialogBackground).not.toBe("");

      if (themeName === "night" || themeName === "dark") {
        expect(themeSnapshot.dialogBackground).not.toBe("rgb(255, 255, 255)");
        expect(themeSnapshot.mainBackground).not.toBe("rgb(255, 255, 255)");
        expect(themeSnapshot.rowBackground).not.toBe("rgb(255, 255, 255)");
        expect(themeSnapshot.selectBackground).not.toBe("rgb(255, 255, 255)");
      }
    }

    await themeSelect.selectOption("github");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? ""))
      .toBe("github");

    await settingsDialog.getByRole("button", { name: "笔记", exact: true }).click();
    const densitySnapshot = await page.evaluate(() => {
      const density = document.querySelector(".settings-comfort-slider");
      const densityInput = document.querySelector(
        ".settings-comfort-slider input[type='range']",
      );
      const densityStyle =
        density instanceof HTMLElement ? window.getComputedStyle(density) : null;
      const densityInputStyle =
        densityInput instanceof HTMLElement
          ? window.getComputedStyle(densityInput)
          : null;

      return {
        inputAppearance:
          densityInputStyle?.getPropertyValue("-webkit-appearance") ??
          densityInputStyle?.appearance ??
          "",
        display: densityStyle?.display ?? "",
      };
    });
    expect(densitySnapshot.display).toBe("grid");
    expect(densitySnapshot.inputAppearance).toContain("none");

    await settingsDialog.getByRole("button", { name: "日记", exact: true }).click();
    const homeSettingsBox = await settingsDialog.boundingBox();
    expect(homeSettingsBox).not.toBeNull();
    expect(homeSettingsBox!.width).toBeCloseTo(settingsBox!.width, 0);
    expect(homeSettingsBox!.height).toBeCloseTo(settingsBox!.height, 0);

    await settingsDialog.locator(".settings-redesign-template-button").click();
    const templateDialog = page.getByRole("dialog", {
      name: "选择默认日记模板",
    });
    await expect(templateDialog).toBeVisible();
    await templateDialog.getByRole("button", { name: /每日复盘/ }).click();
    await expect(templateDialog).toHaveCount(0);
    await expect(
      settingsDialog.locator(".settings-redesign-template-button"),
    ).toContainText("每日复盘");

    const diaryToggle = settingsDialog
      .locator(".settings-redesign-toggle-row")
      .filter({ hasText: "日记" })
      .locator('input[type="checkbox"]');
    await diaryToggle.evaluate((element: HTMLInputElement) => element.click());
    await expect(page.locator(".explorer-tab-diary")).toHaveCount(0);
    await expect(page.locator(".home-diary-panel")).toHaveCount(0);
    await diaryToggle.evaluate((element: HTMLInputElement) => element.click());
    await expect(page.locator(".explorer-tab-diary")).toHaveCount(1);
    await expect(page.locator(".home-diary-panel")).toHaveCount(0);

    await page.screenshot({
      path: testInfo.outputPath("settings-760x640.png"),
      fullPage: false,
    });
    await page.getByLabel("关闭设置").click();
    await expect(page.locator(".home-diary-panel")).toHaveCount(0);

    await resizeApp(page, browserWindow, 1280, 860);
    await expect(page.locator(".explorer-tab-diary")).toBeVisible();
    await expect(home).toHaveCSS("overflow-y", "hidden");
    const sidebar = page.locator(".explorer-sidebar");
    const sidebarFooter = page.locator(".explorer-footer-bar");
    await expect(sidebar).toBeVisible();
    await home.hover();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await expect(sidebarFooter).toHaveCSS("visibility", "hidden");
    await sidebar.hover();
    await expect(sidebarFooter).toHaveCSS("visibility", "visible");

    const mediumMainBox = await mainColumn.boundingBox();
    const mediumSideBox = await sideColumn.boundingBox();
    expect(mediumMainBox).not.toBeNull();
    expect(mediumSideBox).not.toBeNull();
    expect(mediumSideBox!.y).toBeGreaterThan(mediumMainBox!.y);

    await page.screenshot({
      path: testInfo.outputPath("home-1280x860.png"),
      fullPage: false,
    });

    await resizeApp(page, browserWindow, 1600, 900);
    const wideMainBox = await mainColumn.boundingBox();
    const wideSideBox = await sideColumn.boundingBox();
    expect(wideMainBox).not.toBeNull();
    expect(wideSideBox).not.toBeNull();
    expect(wideSideBox!.x).toBeGreaterThan(wideMainBox!.x);

    const todoPanel = page.locator(".home-todo-panel");
    const notePanel = page.locator(".home-note-panel");
    const todoBox = await todoPanel.boundingBox();
    const noteBox = await notePanel.boundingBox();
    expect(todoBox).not.toBeNull();
    expect(noteBox).not.toBeNull();
    expect(todoBox!.height).toBeCloseTo(noteBox!.height, 0);
    expect(todoBox!.height * 2 + 14).toBeCloseTo(wideSideBox!.height, 0);

    await page.screenshot({
      path: testInfo.outputPath("home-1600x900.png"),
      fullPage: false,
    });

    await page.getByLabel("打开设置").evaluate((element: HTMLElement) => {
      element.click();
    });
    await expect(settingsDialog).toBeVisible();
    await settingsDialog.getByRole("button", { name: "通用", exact: true }).click();
    const noteToggle = settingsDialog
      .locator(".settings-redesign-toggle-row")
      .filter({ hasText: "灵感便签" })
      .locator('input[type="checkbox"]');
    await noteToggle.evaluate((element: HTMLInputElement) => element.click());
    await expect(notePanel).toHaveCount(0);
    const todoOnlyBox = await todoPanel.boundingBox();
    const singlePanelSideBox = await sideColumn.boundingBox();
    expect(todoOnlyBox).not.toBeNull();
    expect(singlePanelSideBox).not.toBeNull();
    expect(todoOnlyBox!.height).toBeCloseTo(singlePanelSideBox!.height, 0);

    await noteToggle.evaluate((element: HTMLInputElement) => element.click());
    await expect(notePanel).toHaveCount(1);
    await page.getByLabel("关闭设置").click();

    await resizeApp(page, browserWindow, 2048, 1200);
    const homeBox = await home.boundingBox();
    const dashboardBox = await page.locator(".home-dashboard").boundingBox();
    const fullscreenMainBox = await mainColumn.boundingBox();
    const fullscreenSideBox = await sideColumn.boundingBox();
    expect(homeBox).not.toBeNull();
    expect(dashboardBox).not.toBeNull();
    expect(fullscreenMainBox).not.toBeNull();
    expect(fullscreenSideBox).not.toBeNull();
    expect(dashboardBox!.x - homeBox!.x).toBeLessThanOrEqual(2);
    expect(dashboardBox!.width).toBeGreaterThan(homeBox!.width - 4);
    expect(fullscreenMainBox!.width / fullscreenSideBox!.width).toBeGreaterThan(1.6);
    expect(fullscreenMainBox!.width / fullscreenSideBox!.width).toBeLessThan(2.1);

    await page.screenshot({
      path: testInfo.outputPath("home-2048x1200.png"),
      fullPage: false,
    });
  } finally {
    await app.close();
    await rm(seed.root, { force: true, recursive: true });
  }
});
