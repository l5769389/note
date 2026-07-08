# noteDock

一个本地优先的 Markdown 编辑器原型，提供 Markdown 编辑/预览、文档本地存储、Excalidraw 流程图插入、图片自动插入、PDF/Word 只读预览和 React Flow 图表嵌入。

## 项目结构

```text
src/
  main/       Electron 主进程
  preload/    Electron preload 脚本
  renderer/   React 渲染进程
```

项目采用标准 electron-vite 结构，入口配置位于 `electron.vite.config.ts`。

UI 基础组件使用 Radix UI，适合继续打磨接近 Typora 的安静桌面编辑器体验。

## 运行

```bash
npm install
npm run dev
```

`npm run dev` 会先执行 `ensure:electron`，如果本机缺少 Electron 二进制，会通过镜像补装后再启动开发服务。

本地同步服务 + 桌面应用一键启动：

```bash
# macOS
npm run dev:local:mac

# Windows
npm run dev:local
```

macOS 也可以只启动其中一部分：

```bash
npm run dev:local:mac:server
npm run dev:local:mac:app
npm run dev:local:mac:app:debug
```

`dev:local:mac:app:debug` 会打开 Electron DevTools，并使用临时用户数据目录，适合排查白屏或本地缓存问题。

传参示例：

```bash
npm run dev:local:mac -- --port 47831 --admin-username admin --admin-password 123
npm run dev:local:mac:app -- --devtools --fresh-user-data
```

启动后在应用的 Settings -> Cloud Sync 里使用脚本输出的本地同步地址、用户名和密码登录。

生产构建：

```bash
npm run build
npm run dist:mac
npm run dist:win
```

构建后预览：

```bash
npm run preview
```

## 后续建议

- 用 SQLite 或 IndexedDB 替代 localStorage 存储大文档和图片资源。
- 为大型内嵌资源增加本地附件目录和引用迁移能力。
- 增加文档版本历史、自动快照和冲突恢复 UI。
