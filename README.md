# Typora Like Editor

一个本地优先的 Markdown 编辑器原型，当前提供 Markdown 编辑/预览、文档本地存储、Excalidraw 流程图插入、图片自动插入，以及云备份和图片上传的 HTTP 适配接口。

## 运行

```bash
npm install
npm run dev
```

桌面端开发：

```bash
npm run desktop:dev
```

桌面端生产预览：

```bash
npm run desktop:preview
```

## 实现路线

1. MVP 编辑器：React + Vite + TypeScript，左侧文档列表，默认 Typora 风格实时渲染编辑，浏览器本地存储自动保存。
2. Electron 桌面端：`electron/main.cjs` 提供主进程窗口，开发时加载 Vite dev server，生产预览加载 `dist/index.html`。
3. Excalidraw 集成：通过弹窗创建流程图，导出为 PNG Data URL 后插入 Markdown，同时保存 Excalidraw scene JSON，后续可扩展为重新编辑。
4. 图片上传：`src/services/imageUpload.ts` 已预留 `VITE_IMAGE_UPLOAD_ENDPOINT`，未配置时会把图片以内嵌 Data URL 写入文档。
5. 云备份：`src/services/cloudBackup.ts` 已预留 `VITE_CLOUD_BACKUP_ENDPOINT` 和 `VITE_CLOUD_BACKUP_TOKEN`，当前未配置时只做本地保存。
6. 本地文件能力：后续可把浏览器 localStorage 迁移到 Electron 文件系统或 SQLite，并增加文件夹工作区、增量同步、冲突解决。

## 后续建议

- 用 SQLite 或 IndexedDB 替代 localStorage 存储大文档和图片资源。
- 为 Excalidraw asset 增加重新编辑入口，读取 scene JSON 后回填画布。
- 增加云端版本历史、端到端加密、断网队列和同步冲突 UI。
- 图片上传接口建议返回 `{ "url": "https://..." }`，由客户端自动插入 Markdown 图片语法。
