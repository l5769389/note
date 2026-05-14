import { describe, expect, it } from "vitest";
import { createHtmlPreviewDocument } from "../components/HtmlDocumentViewer";

describe("createHtmlPreviewDocument", () => {
  it("injects a base tag for srcDoc html with a local file path", () => {
    expect(
      createHtmlPreviewDocument(
        "<!doctype html><html><head><title>x</title></head><body></body></html>",
        "D:/notes/site/index.html",
      ),
    ).toContain('<base href="file:///D:/notes/site/">');
  });

  it("does not duplicate an existing base tag", () => {
    const html = '<html><head><base href="https://example.com/"></head></html>';
    const preview = createHtmlPreviewDocument(html, "D:/notes/site/index.html");

    expect(preview.match(/<base\s/gi)).toHaveLength(1);
    expect(preview).toContain("data-react-flow-runtime");
  });
});
