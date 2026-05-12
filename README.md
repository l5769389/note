# Typora Like Editor

一个本地优先的 Markdown 编辑器原型，提供 Markdown 编辑/预览、文档本地存储、Excalidraw 流程图插入、图片自动插入，以及云备份和图片上传的 HTTP 适配接口。

## 项目结构

```text
src/
  main/       Electron 主进程
  preload/    Electron preload 脚本
  renderer/   React 渲染进程
```

项目已调整为标准 electron-vite 结构，入口配置位于 `electron.vite.config.ts`。

UI 基础组件使用 Radix UI，当前用于编辑模式切换、工具栏提示和 Excalidraw 弹窗。Radix 的视觉约束很少，适合继续打磨接近 Typora 的安静桌面编辑器界面。

## 运行

```bash
npm install
npm run dev
```

`npm run dev` 会先执行 `ensure:electron`，如果本机缺少 Electron 二进制，会通过镜像补装后再启动开发服务。

生产构建：

```bash
npm run build
```

构建后预览：

```bash
npm run preview
```

## 环境变量

- `VITE_IMAGE_UPLOAD_ENDPOINT`：图片上传接口，未配置时会把图片以内嵌 Data URL 写入文档。
- `VITE_CLOUD_BACKUP_ENDPOINT`：云备份接口，未配置时只保留本地保存。
- `VITE_CLOUD_BACKUP_TOKEN`：云备份接口鉴权令牌。

## 后续建议

- 用 SQLite 或 IndexedDB 替代 localStorage 存储大文档和图片资源。
- 为 Excalidraw asset 增加重新编辑入口。
- 增加云端版本历史、端到端加密、断网队列和同步冲突 UI。
