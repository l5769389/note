import { _electron as electron, expect } from "@playwright/test";
import electronPath from "electron";
import JSZip from "jszip";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dirname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureParent = resolve("D:/testMD");
const fixtureRoot = resolve(fixtureParent, "noteDock-screenshot-fixtures");
const screenshotDir = resolve(repoRoot, "design", "screenshots", "feature-tour");
const appStateFileName = "notedock-state-v1.json";
const viewport = { width: 1600, height: 1000 };

const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

function assertInside(parent, target) {
  const normalizedParent = resolve(parent);
  const normalizedTarget = resolve(target);
  const pathFromParent = relative(normalizedParent, normalizedTarget);

  if (
    pathFromParent === "" ||
    pathFromParent.startsWith("..") ||
    pathFromParent.includes(`..${sep}`) ||
    pathFromParent === ".."
  ) {
    throw new Error(`Refusing to write outside ${normalizedParent}: ${normalizedTarget}`);
  }
}

function iso(offsetMinutes = 0) {
  return new Date(Date.UTC(2026, 4, 30, 9, offsetMinutes, 0)).toISOString();
}

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

function escapePdfText(value) {
  return value.replace(/[()\\]/g, "\\$&");
}

function createPdf(lines) {
  const objects = [];
  const content = [
    "BT",
    "/F1 24 Tf",
    "72 730 Td",
    `(${escapePdfText(lines[0])}) Tj`,
    "/F1 13 Tf",
    ...lines.slice(1).flatMap((line) => ["0 -26 Td", `(${escapePdfText(line)}) Tj`]),
    "ET",
  ].join("\n");

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

async function createDocx(filePath) {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels").file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder("word").file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>noteDock Word 预览示例</w:t></w:r></w:p>
    <w:p><w:r><w:t>这个文档用于截图验证：本地 docx 可以被只读打开，适合保存会议纪要、需求文档和外部资料。</w:t></w:r></w:p>
    <w:p><w:r><w:t>要点：阅读清晰、保留段落、不会进入 Markdown 编辑模式。</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`,
  );

  await writeFile(filePath, await zip.generateAsync({ type: "nodebuffer" }));
}

function createWorkbookData(title = "在线表格") {
  return {
    title,
    version: 1,
    workbook: {
      appVersion: "0.22.1",
      id: "workbook-feature-tour",
      locale: "zhCN",
      name: title,
      resources: [],
      sheetOrder: ["sheet-feature-tour"],
      sheets: {
        "sheet-feature-tour": {
          cellData: {
            0: {
              0: { v: "模块" },
              1: { v: "状态" },
              2: { v: "负责人" },
              3: { v: "下次动作" },
            },
            1: {
              0: { v: "Markdown 编辑" },
              1: { v: "进行中" },
              2: { v: "Nina" },
              3: { v: "整理截图" },
            },
            2: {
              0: { v: "资料阅读" },
              1: { v: "稳定" },
              2: { v: "Kai" },
              3: { v: "检查导出" },
            },
            3: {
              0: { v: "知识关系" },
              1: { v: "可用" },
              2: { v: "Rui" },
              3: { v: "补充标签" },
            },
          },
          columnCount: 8,
          columnData: {},
          columnHeader: { height: 24 },
          defaultColumnWidth: 120,
          defaultRowHeight: 30,
          freeze: { startColumn: 0, startRow: 0, xSplit: 0, ySplit: 0 },
          hidden: 0,
          id: "sheet-feature-tour",
          mergeData: [],
          name: "Feature Tour",
          rightToLeft: 0,
          rowCount: 40,
          rowData: {},
          rowHeader: { width: 46 },
          scrollLeft: 0,
          scrollTop: 0,
          showGridlines: 1,
          tabColor: "",
          zoomRatio: 1,
        },
      },
      styles: {},
    },
  };
}

function createDocument({
  content,
  extension,
  filePath,
  id,
  links = [],
  minutes = 0,
  properties = [],
  tags = [],
  title,
  type = "markdown",
}) {
  return {
    content: ["pdf", "word", "excel"].includes(type) ? "" : content,
    createdAt: iso(minutes),
    documentType: type,
    drawings: {},
    fileExtension: extension,
    filePath,
    id,
    lastOpenedAt: iso(90 - minutes),
    metadata: {
      documentLinks: links,
      properties,
      tags,
    },
    title,
    updatedAt: iso(minutes + 2),
  };
}

async function writeFixtureFile(path, content, encoding = "utf8") {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, encoding);
}

async function createFixtures() {
  assertInside(fixtureParent, fixtureRoot);
  await rm(fixtureRoot, { force: true, recursive: true });
  await mkdir(join(fixtureRoot, ".assets"), { recursive: true });
  await mkdir(join(fixtureRoot, "html-assets"), { recursive: true });
  await mkdir(screenshotDir, { recursive: true });

  const assetCard = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eef2ff"/>
      <stop offset="1" stop-color="#dbeafe"/>
    </linearGradient>
  </defs>
  <rect width="720" height="360" rx="32" fill="url(#g)"/>
  <circle cx="130" cy="142" r="58" fill="#6366f1" opacity=".18"/>
  <rect x="220" y="78" width="360" height="52" rx="18" fill="#1e293b"/>
  <rect x="220" y="158" width="270" height="22" rx="11" fill="#64748b" opacity=".35"/>
  <rect x="220" y="204" width="318" height="22" rx="11" fill="#64748b" opacity=".25"/>
  <text x="260" y="113" fill="#fff" font-family="Segoe UI, Arial" font-size="24" font-weight="700">Local asset preview</text>
</svg>`;
  const excalidrawPreview = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="420" viewBox="0 0 760 420">
  <rect width="760" height="420" rx="24" fill="#f8fafc"/>
  <path d="M132 208 C210 80 310 80 386 208 S560 336 636 208" fill="none" stroke="#4f46e5" stroke-width="8" stroke-linecap="round"/>
  <rect x="72" y="160" width="132" height="90" rx="18" fill="#eef2ff" stroke="#6366f1" stroke-width="3"/>
  <rect x="314" y="160" width="132" height="90" rx="18" fill="#ecfeff" stroke="#0891b2" stroke-width="3"/>
  <rect x="556" y="160" width="132" height="90" rx="18" fill="#f0fdf4" stroke="#16a34a" stroke-width="3"/>
  <text x="104" y="213" font-family="Segoe UI, Arial" font-size="24" fill="#312e81" font-weight="700">Idea</text>
  <text x="338" y="213" font-family="Segoe UI, Arial" font-size="24" fill="#155e75" font-weight="700">Draft</text>
  <text x="586" y="213" font-family="Segoe UI, Arial" font-size="24" fill="#166534" font-weight="700">Ship</text>
</svg>`;

  await writeFixtureFile(join(fixtureRoot, ".assets", "demo-card.svg"), assetCard);
  await writeFixtureFile(join(fixtureRoot, ".assets", "excalidraw-preview.svg"), excalidrawPreview);
  await writeFixtureFile(
    join(fixtureRoot, ".assets", "pulse.gif"),
    Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
  );
  await writeFixtureFile(
    join(fixtureRoot, ".assets", "architecture.excalidraw.json"),
    JSON.stringify(
      {
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: [
          {
            id: "idea-box",
            type: "rectangle",
            x: 80,
            y: 90,
            width: 180,
            height: 80,
            angle: 0,
            strokeColor: "#4f46e5",
            backgroundColor: "#eef2ff",
            fillStyle: "solid",
            strokeWidth: 2,
            strokeStyle: "solid",
            roughness: 1,
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: { type: 3 },
            seed: 1,
            version: 1,
            versionNonce: 1,
            isDeleted: false,
            boundElements: null,
            updated: 1,
            link: null,
            locked: false,
          },
        ],
        appState: { viewBackgroundColor: "#ffffff", currentItemFontFamily: 1 },
        files: {},
      },
      null,
      2,
    ),
  );
  await writeFixtureFile(
    join(fixtureRoot, ".assets", "feature-matrix.univer.json"),
    JSON.stringify(createWorkbookData("功能矩阵"), null, 2),
  );

  const htmlPath = join(fixtureRoot, "html-sample.html");
  await writeFixtureFile(
    join(fixtureRoot, "html-assets", "sample.css"),
    `body{font-family:Inter,"Segoe UI",Arial,sans-serif;margin:0;background:#f8fbff;color:#172033}.page{max-width:900px;margin:64px auto;padding:48px;border:1px solid #dbe4f0;border-radius:28px;background:#fff;box-shadow:0 24px 70px rgba(31,41,55,.08)}h1{font-size:46px;margin:0 0 12px}.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px}.metric{border:1px solid #dbeafe;border-radius:18px;padding:18px;background:linear-gradient(135deg,#eef2ff,#fff)}.metric strong{display:block;font-size:32px;color:#4f46e5}`,
  );
  await writeFixtureFile(
    join(fixtureRoot, "html-assets", "sample.js"),
    `document.querySelector("[data-status]").textContent = "本地脚本已执行";`,
  );
  await writeFixtureFile(
    htmlPath,
    `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>HTML Preview Test</title>
  <link rel="stylesheet" href="./html-assets/sample.css" />
</head>
<body>
  <main class="page">
    <h1>HTML 笔记预览</h1>
    <p>这个文件使用本地 CSS 和 JS，适合验证 noteDock 的 HTML 阅读能力。</p>
    <p data-status>脚本等待执行</p>
    <section class="metric-grid">
      <article class="metric"><strong>24</strong><span>批注</span></article>
      <article class="metric"><strong>6</strong><span>锚点</span></article>
      <article class="metric"><strong>3</strong><span>本地资源</span></article>
    </section>
  </main>
  <script src="./html-assets/sample.js"></script>
</body>
</html>`,
  );

  const documents = [];
  const file = (name) => join(fixtureRoot, name);

  const introContent = `# 01 Basic Elements

这是一份基础 Markdown 样例，用来检查常见文本元素。这里包含中文、English words、链接、行内代码 \`src/index.ts\` 和强调。

## Paragraphs

第一段文字用于检查普通段落的行高、字重和宽度。noteDock 希望在阅读和编辑之间保持稳定的视觉节奏。

> 引用块用于记录上下文、出处或者临时想法。

- 支持无序列表。
- 支持 **加粗**、*斜体*、~~删除线~~。
- 支持 [本地 HTML 示例](./html-sample.html)。

1. 打开本地文件夹。
2. 选择 Markdown。
3. 在实时渲染模式中编辑。
`;

  const alertsContent = `# 02 Lists, Quotes, Alerts

## 任务列表

- [ ] 给侧边栏增加按标签筛选入口。
- [x] 给任务列表支持复选框切换。
- [ ] 关系总览中支持按状态、类型、标签组合筛选。

## Alerts

> [!NOTE] 提醒
> 这是提醒内容，用来检查普通提醒样式。

> [!TIP] 建议
> 这是建议内容，可以用于提示用户下一步操作。

> [!IMPORTANT] 重要
> 这是重要内容，应该比普通提醒更突出。

> [!WARNING] 警告
> 这是警告内容，适合展示风险。

> [!CAUTION] 注意
> 这是注意内容，适合展示破坏性操作前的提示。
`;

  const mediaContent = `# 03 Tables, Images, Excalidraw

## 表格

| 模块 | 目标 | 状态 |
| --- | --- | --- |
| Markdown | 实时渲染 | 已启用 |
| 资源资产 | .assets 管理 | 已启用 |
| 知识关系 | 相关文档总览 | 已启用 |

## 图片与 GIF

![Local Image](.assets/demo-card.svg "align=center width=520")

![Animated GIF](.assets/pulse.gif "align=center width=160")

## 视频

<video controls src=".assets/demo-video.webm" width="520"></video>

## Excalidraw-like Image Marker

下面这条使用 excalidraw 标记，用来检查是否出现重新编辑入口。

![Architecture Sketch](.assets/excalidraw-preview.svg "excalidraw:drawing-architecture scene=.assets/architecture.excalidraw.json align=center width=520")
`;

  const codeContent = `# 04 Code, Mermaid, Math

## Code Block

\`\`\`python
uvicorn.run(
    create_socket_app(config),
    host=config.backend_host,
    port=config.backend_port,
    reload=False,
)
\`\`\`

## Mermaid

\`\`\`mermaid
flowchart LR
  A[Capture] --> B[Process]
  B --> C[Preview]
  C --> D[Save]
\`\`\`

## Inline Math

行内公式：$E = mc^2$，以及 $a^2 + b^2 = c^2$。

## Block Math

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$

## Online Sheet

\`\`\`univer-sheet
${JSON.stringify({ title: "功能矩阵", updatedAt: iso(40), version: 1, assetPath: ".assets/feature-matrix.univer.json" }, null, 2)}
\`\`\`
`;

  const relationsContent = `---
tags: [editor, typora-like, markdown]
status: draft
owner: Nina
priority: medium
area: writing
---

# 05 Relations and Metadata

这份文档用于展示顶部元信息、相关文档和知识关系图。

- 产品结构参考 [[01 Basic Elements]]
- 附件策略参考 [[03 Tables, Images, Excalidraw]]
- 代码块和公式参考 [[04 Code, Mermaid, Math]]

## Related Work

相关文档应该像资料卡片一样清晰地出现在元信息和关系图中。
`;

  const paths = {
    intro: file("01-basic-elements.md"),
    alerts: file("02-lists-quotes-alerts.md"),
    media: file("03-table-image-excalidraw.md"),
    code: file("04-code-mermaid-math.md"),
    relations: file("05-relations-metadata.md"),
    pdf: file("readonly-report.pdf"),
    word: file("word-preview.docx"),
    excel: file("metrics-workbook.xlsx"),
    sheet: file("online-sheet.univer"),
    drawing: file("architecture-board.excalidraw"),
    html: htmlPath,
  };

  await writeFixtureFile(paths.intro, introContent);
  await writeFixtureFile(paths.alerts, alertsContent);
  await writeFixtureFile(paths.media, mediaContent);
  await writeFixtureFile(paths.code, codeContent);
  await writeFixtureFile(paths.relations, relationsContent);
  await writeFixtureFile(paths.pdf, createPdf(["noteDock PDF Preview", "Readonly documents can be opened beside Markdown notes.", "This fixture is generated locally for screenshots."]));
  await createDocx(paths.word);

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["日期", "打开次数", "编辑次数", "附件数"],
    ["2026-05-20", 12, 4, 3],
    ["2026-05-21", 18, 7, 6],
    ["2026-05-22", 9, 2, 1],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "概览");
  await writeFixtureFile(paths.excel, XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
  await writeFixtureFile(paths.sheet, JSON.stringify(createWorkbookData("独立在线表格"), null, 2));
  await writeFixtureFile(
    paths.drawing,
    JSON.stringify(
      {
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: [],
        appState: { viewBackgroundColor: "#ffffff", currentItemFontFamily: 1 },
        files: {},
      },
      null,
      2,
    ),
  );

  const link = (target, title, documentType = "markdown") => ({
    createdAt: iso(10),
    documentType,
    filePath: target,
    title,
  });

  const docSeeds = [
    createDocument({
      content: introContent,
      extension: ".md",
      filePath: paths.intro,
      id: "doc-basic",
      links: [link(paths.alerts, "Lists, Quotes, Alerts")],
      minutes: 1,
      properties: [{ key: "area", value: "basics" }],
      tags: ["markdown", "intro"],
      title: "01 Basic Elements",
    }),
    createDocument({
      content: alertsContent,
      extension: ".md",
      filePath: paths.alerts,
      id: "doc-alerts",
      links: [link(paths.intro, "Basic Elements")],
      minutes: 2,
      properties: [{ key: "status", value: "review" }],
      tags: ["alerts", "lists"],
      title: "02 Lists, Quotes, Alerts",
    }),
    createDocument({
      content: mediaContent,
      extension: ".md",
      filePath: paths.media,
      id: "doc-media",
      links: [link(paths.drawing, "Architecture Board", "drawing")],
      minutes: 3,
      properties: [{ key: "assets", value: "managed" }],
      tags: ["media", "assets"],
      title: "03 Tables, Images, Excalidraw",
    }),
    createDocument({
      content: codeContent,
      extension: ".md",
      filePath: paths.code,
      id: "doc-code",
      links: [link(paths.sheet, "Online Sheet", "sheet")],
      minutes: 4,
      properties: [{ key: "runtime", value: "demo" }],
      tags: ["code", "mermaid", "math"],
      title: "04 Code, Mermaid, Math",
    }),
    createDocument({
      content: relationsContent,
      extension: ".md",
      filePath: paths.relations,
      id: "doc-relations",
      links: [
        link(paths.intro, "Basic Elements"),
        link(paths.media, "Media Assets"),
        link(paths.pdf, "Readonly Report", "pdf"),
      ],
      minutes: 5,
      properties: [
        { key: "owner", value: "Nina" },
        { key: "priority", value: "medium" },
      ],
      tags: ["editor", "typora-like", "markdown"],
      title: "05 Relations and Metadata",
    }),
    createDocument({
      content: await readText(paths.html),
      extension: ".html",
      filePath: paths.html,
      id: "doc-html",
      minutes: 6,
      title: "HTML Preview Test",
      type: "html",
    }),
    createDocument({
      content: "",
      extension: ".pdf",
      filePath: paths.pdf,
      id: "doc-pdf",
      minutes: 7,
      title: "Readonly Report",
      type: "pdf",
    }),
    createDocument({
      content: "",
      extension: ".docx",
      filePath: paths.word,
      id: "doc-word",
      minutes: 8,
      title: "Word Preview",
      type: "word",
    }),
    createDocument({
      content: "",
      extension: ".xlsx",
      filePath: paths.excel,
      id: "doc-excel",
      minutes: 9,
      title: "Metrics Workbook",
      type: "excel",
    }),
    createDocument({
      content: JSON.stringify(createWorkbookData("独立在线表格"), null, 2),
      extension: ".univer",
      filePath: paths.sheet,
      id: "doc-sheet",
      minutes: 10,
      title: "Online Sheet",
      type: "sheet",
    }),
    createDocument({
      content: await readText(paths.drawing),
      extension: ".excalidraw",
      filePath: paths.drawing,
      id: "doc-drawing",
      minutes: 11,
      title: "Architecture Board",
      type: "drawing",
    }),
  ];

  return { documents: docSeeds, paths };
}

async function readText(path) {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}

async function seedAppState(userDataDir, documents) {
  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    join(userDataDir, appStateFileName),
    JSON.stringify(
      {
        appSettings: {
          autosaveEnabled: true,
          editorMode: "typora",
        },
        recentDirectories: [fixtureRoot],
        sidebarWidth: 330,
        theme: "github",
        updatedAt: iso(100),
        version: 1,
        workspace: {
          activeDocumentId: "",
          documents,
          updatedAt: iso(101),
          version: 1,
          workspacePath: fixtureRoot,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function seedHomeStorage(page) {
  await page.evaluate(
    ({ todayDateKey }) => {
      const now = new Date().toISOString();
      localStorage.setItem(
        "notedock:home-todos",
        JSON.stringify([
          { id: "todo-a", text: "整理产品需求截图", done: false, date: todayDateKey, createdAt: now },
          { id: "todo-b", text: "检查附件资产引用", done: false, date: todayDateKey, createdAt: now },
          { id: "todo-c", text: "更新知识关系示例", done: true, date: todayDateKey, createdAt: now },
        ]),
      );
      localStorage.setItem(
        "notedock:home-saved-notes",
        JSON.stringify([
          {
            id: "note-a",
            text: "截图巡览重点：编辑、阅读器、搜索、关系图、媒体资产。",
            createdAt: now,
          },
          {
            id: "note-b",
            text: "后续可以把这些截图放入 README 或发布说明。",
            createdAt: now,
          },
        ]),
      );
      localStorage.setItem("notedock:theme", "github");
    },
    { todayDateKey: todayKey },
  );
}

async function ensureVideoFixture(page, videoPath) {
  try {
    const base64 = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext("2d");

      if (!context || !("captureStream" in canvas) || typeof MediaRecorder === "undefined") {
        return "";
      }

      let frame = 0;
      const draw = () => {
        const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "#111827");
        gradient.addColorStop(1, frame % 2 ? "#2563eb" : "#7c3aed");
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "rgba(255,255,255,.9)";
        context.font = "700 28px Segoe UI, sans-serif";
        context.fillText("noteDock Video", 50, 92);
        context.font = "500 15px Segoe UI, sans-serif";
        context.fillText(`Frame ${frame + 1}`, 126, 124);
        frame += 1;
      };

      draw();
      const stream = canvas.captureStream(8);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const timer = window.setInterval(draw, 125);
      recorder.start();
      await new Promise((resolve) => window.setTimeout(resolve, 950));
      recorder.stop();
      await new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      window.clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());

      const blob = new Blob(chunks, { type: "video/webm" });

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).replace(/^data:video\/webm;base64,/, ""));
        reader.readAsDataURL(blob);
      });
    });

    if (base64) {
      await writeFile(videoPath, Buffer.from(base64, "base64"));
      return;
    }
  } catch (error) {
    console.warn("[screenshots] Failed to generate webm fixture, writing placeholder.", error);
  }

  await writeFile(videoPath, Buffer.from([]));
}

async function launchApp(userDataDir) {
  const app = await electron.launch({
    args: [resolve(repoRoot, "out", "main", "index.js")],
    executablePath: electronPath,
    env: {
      ...process.env,
      NOTEDOCK_E2E: "1",
      NOTEDOCK_TEST_USER_DATA_DIR: userDataDir,
    },
  });
  const page = await app.firstWindow();
  const browserWindow = await app.browserWindow(page);
  await browserWindow.evaluate((window) => {
    window.setSize(1600, 1000);
    window.center();
  });
  await page.setViewportSize(viewport);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByTestId("app-shell")).toBeVisible({ timeout: 20_000 });
  await seedHomeStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("app-shell")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  return { app, page };
}

async function capture(page, fileName, description) {
  const path = join(screenshotDir, fileName);
  console.log(`[screenshots] ${fileName} - ${description}`);
  await page.waitForTimeout(450);
  await page.screenshot({ path });
}

async function safeClick(locator, timeout = 8_000) {
  await locator.first().waitFor({ state: "visible", timeout });
  await locator.first().click();
}

async function showFilesSidebar(page) {
  const fileTab = page.locator(".explorer-tabs button").first();
  if (await fileTab.isVisible().catch(() => false)) {
    await fileTab.click({ force: true });
    await page.waitForTimeout(150);
  }
}

async function showHome(page) {
  await safeClick(page.locator(".app-logo-button"));
  await page.waitForSelector(".welcome-home", { timeout: 10_000 });
}

async function showFileList(page) {
  await showFilesSidebar(page);

  if (await page.locator(".directory-file-list").isVisible().catch(() => false)) {
    return;
  }

  await page.locator(".explorer-footer-icon-button").last().click({ force: true });
  await page.waitForSelector(".directory-file-list", { timeout: 10_000 });
}

async function showFileTree(page) {
  await showFilesSidebar(page);

  if (await page.locator(".directory-tree-file, .directory-tree-folder").first().isVisible().catch(() => false)) {
    return;
  }

  await page.locator(".explorer-footer-icon-button").last().click({ force: true });
  await page.waitForSelector(".directory-tree-file, .directory-tree-folder", { timeout: 10_000 });
}

async function openDocument(page, fileName) {
  await showFileList(page);
  const item = page.locator(".directory-file-list-item").filter({ hasText: fileName }).first();
  await safeClick(item, 12_000);
  await page.waitForTimeout(900);
}

async function switchEditorMode(page, mode) {
  await page.getByTestId("menu-view").click();
  await page.getByTestId("menu-editor-mode").click();
  await page.getByTestId(`menu-mode-${mode}`).click();
  await page.waitForTimeout(500);
}

async function setTheme(page, theme) {
  await page.evaluate((nextTheme) => {
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("notedock:theme", nextTheme);
  }, theme);
  await page.waitForTimeout(350);
}

async function openWorkspaceSearch(page, query) {
  await page.keyboard.press("Control+Shift+F");
  await expect(page.getByTestId("workspace-search-input")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("workspace-search-input").fill(query);
  await expect(page.getByTestId("workspace-search-match").first()).toBeVisible({ timeout: 10_000 });
}

async function runScreenshots(page) {
  await showHome(page);
  await capture(page, "01-home-dashboard.png", "home dashboard");

  await safeClick(page.locator(".home-note-entry-button"));
  await page.waitForSelector(".home-note-dialog", { timeout: 10_000 });
  await capture(page, "02-home-note-dialog.png", "inspiration note dialog");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await showFileTree(page);
  await capture(page, "03-sidebar-file-tree.png", "sidebar tree");

  await showFileList(page);
  await capture(page, "04-sidebar-file-list.png", "sidebar file list");

  await openDocument(page, "01-basic-elements.md");
  await switchEditorMode(page, "typora");
  await expect(page.getByTestId("typora-editor")).toBeVisible({ timeout: 10_000 });
  await capture(page, "05-markdown-editor.png", "typora markdown editor");

  await openDocument(page, "04-code-mermaid-math.md");
  await switchEditorMode(page, "typora");
  await page.locator(".ProseMirror").first().click();
  await capture(page, "06-markdown-code-mermaid-math.png", "code, mermaid, math and online sheet");

  await openDocument(page, "02-lists-quotes-alerts.md");
  await capture(page, "07-table-and-alerts.png", "task list and alert blocks");

  await openDocument(page, "03-table-image-excalidraw.md");
  await page.waitForTimeout(1_200);
  await capture(page, "08-media-image-video-gif.png", "images, gif, video and excalidraw marker");

  await openDocument(page, "architecture-board.excalidraw");
  await capture(page, "09-excalidraw-viewer.png", "standalone excalidraw viewer");

  await openDocument(page, "online-sheet.univer");
  await page.waitForTimeout(1_500);
  await capture(page, "10-univer-sheet.png", "standalone univer sheet");

  await openDocument(page, "html-sample.html");
  await page.waitForSelector(".html-document-viewer", { timeout: 12_000 });
  await page.waitForTimeout(1_000);
  await capture(page, "11-html-viewer.png", "html reader with local css and js");

  await openDocument(page, "readonly-report.pdf");
  await page.waitForSelector(".pdf-document-viewer", { timeout: 12_000 });
  await capture(page, "12-pdf-viewer.png", "pdf viewer");

  await openDocument(page, "word-preview.docx");
  await page.waitForSelector(".word-document-viewer", { timeout: 12_000 });
  await page.waitForTimeout(1_500);
  await capture(page, "13-word-viewer.png", "word viewer");

  await openDocument(page, "metrics-workbook.xlsx");
  await page.waitForSelector(".excel-document-viewer", { timeout: 12_000 });
  await capture(page, "14-excel-viewer.png", "excel viewer");

  await openWorkspaceSearch(page, "Markdown");
  await capture(page, "15-workspace-search.png", "workspace search");

  await showHome(page);
  await safeClick(page.locator(".home-brand-actions button").nth(2));
  await page.waitForSelector(".knowledge-graph-dialog", { timeout: 15_000 });
  await page.waitForTimeout(1_000);
  await capture(page, "16-document-relations.png", "knowledge relation graph");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.getByTestId("menu-format").click();
  await page.locator(".menubar-dropdown-format").waitFor({ state: "visible", timeout: 8_000 });
  await page.locator(".menubar-dropdown-format").locator("button").filter({ hasText: "图像" }).first().hover();
  await page.waitForTimeout(500);
  await capture(page, "17-menus-and-submenus.png", "top menus and submenu");
  await page.keyboard.press("Escape");

  await setTheme(page, "dark");
  await showHome(page);
  await capture(page, "18-dark-theme-home.png", "dark theme home");

  await openDocument(page, "04-code-mermaid-math.md");
  await capture(page, "19-dark-theme-editor.png", "dark theme editor");
}

async function main() {
  const { documents, paths } = await createFixtures();
  const root = await import("node:fs/promises").then(({ mkdtemp }) =>
    mkdtemp(join(tmpdir(), "notedock-feature-screenshots-")),
  );
  const userDataDir = join(root, "user-data");

  await seedAppState(userDataDir, documents);

  const { app, page } = await launchApp(userDataDir);

  try {
    await ensureVideoFixture(page, join(fixtureRoot, ".assets", "demo-video.webm"));
    await runScreenshots(page);
  } finally {
    await app.close();
  }

  console.log(`[screenshots] Fixtures: ${toPosixPath(fixtureRoot)}`);
  console.log(`[screenshots] Output: ${toPosixPath(screenshotDir)}`);
}

main().catch((error) => {
  console.error("[screenshots] Failed to capture feature screenshots.");
  console.error(error);
  process.exitCode = 1;
});
