import React from "react";
import ReactDOM from "react-dom/client";
import "@excalidraw/excalidraw/index.css";
import "@milkdown/kit/prose/gapcursor/style/gapcursor.css";
import "@milkdown/kit/prose/tables/style/tables.css";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "./styles.css";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
