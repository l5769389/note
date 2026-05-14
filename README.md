# Typora Like Editor

一个本地优先的 Markdown 编辑器原型，提供 Markdown 编辑/预览、文档本地存储、Excalidraw 流程图插入、图片自动插入、XMind 预览和 React Flow 图表嵌入。

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

## 后续建议

- 用 SQLite 或 IndexedDB 替代 localStorage 存储大文档和图片资源。
- 为大型内嵌资源增加本地附件目录和引用迁移能力。
- 增加文档版本历史、自动快照和冲突恢复 UI。
