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
    expect(preview).toContain("data-react-flow-runtime");
  });
});
