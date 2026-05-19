import { describe, expect, it } from "vitest";
import { createHtmlPreviewDocument } from "../components/HtmlDocumentViewer";

describe("createHtmlPreviewDocument", () => {
  it("injects a base tag for srcDoc html with a local file path", () => {
    const preview = createHtmlPreviewDocument(
      "<!doctype html><html><head><title>x</title></head><body><img src=\"./assets/demo.svg\"><script src=\"./app.js\"></script></body></html>",
      "D:/notes/site/index.html",
    );

    expect(preview).toContain('<base href="typora-local://file/D%3A/notes/site/">');
    expect(preview).not.toContain("file:///D:/notes/site/");
  });

  it("does not duplicate an existing base tag", () => {
    const html = '<html><head><base href="https://example.com/"></head></html>';
    const preview = createHtmlPreviewDocument(html, "D:/notes/site/index.html");

    expect(preview.match(/<base\s/gi)).toHaveLength(1);
    expect(preview).not.toContain("data-react-flow-runtime");
    expect(preview).not.toContain("data-mindmap-runtime");
  });

  it("injects diagram runtimes only when matching markers exist", () => {
    const reactFlowPreview = createHtmlPreviewDocument(
      '<html><head></head><body><script type="application/json" data-react-flow>{}</script></body></html>',
    );
    const mindMapPreview = createHtmlPreviewDocument(
      '<html><head></head><body><script type="application/json" data-mindmap>{}</script></body></html>',
    );

    expect(reactFlowPreview).toContain("data-react-flow-runtime");
    expect(reactFlowPreview).not.toContain("data-mindmap-runtime");
    expect(mindMapPreview).not.toContain("data-react-flow-runtime");
    expect(mindMapPreview).toContain("data-mindmap-runtime");
  });
});
