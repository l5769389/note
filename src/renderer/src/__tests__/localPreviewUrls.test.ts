import { describe, expect, it } from "vitest";
import {
  getDirectoryPath,
  getLocalPreviewUrl,
  isRelativeResourceUrl,
  resolveDocumentResourceUrl,
} from "../localPreviewUrls";

describe("local preview URL helpers", () => {
  it("encodes local file paths as typora-local URLs", () => {
    expect(getLocalPreviewUrl("D:\\Notes\\Project\\image 1.png")).toBe(
      "typora-local://file/D%3A/Notes/Project/image%201.png",
    );
    expect(getLocalPreviewUrl("D:/Notes/Project/image%201.png")).toBe(
      "typora-local://file/D%3A/Notes/Project/image%201.png",
    );
    expect(getLocalPreviewUrl()).toBeUndefined();
  });

  it("finds the containing directory for document paths", () => {
    expect(getDirectoryPath("D:\\Notes\\Project\\doc.md")).toBe(
      "D:/Notes/Project",
    );
    expect(getDirectoryPath("/home/me/doc.md")).toBe("/home/me");
    expect(getDirectoryPath()).toBe("");
  });

  it("identifies relative resource URLs only", () => {
    expect(isRelativeResourceUrl("assets/logo.png")).toBe(true);
    expect(isRelativeResourceUrl("../shared/logo.png")).toBe(true);
    expect(isRelativeResourceUrl("#section")).toBe(false);
    expect(isRelativeResourceUrl("/assets/logo.png")).toBe(false);
    expect(isRelativeResourceUrl("https://example.com/logo.png")).toBe(false);
    expect(isRelativeResourceUrl("typora-local://file/D%3A/logo.png")).toBe(false);
  });

  it("resolves relative document resources while preserving query and hash", () => {
    expect(
      resolveDocumentResourceUrl(
        "../shared/logo 1.png?raw=true#preview",
        "D:\\Notes\\Project\\doc.md",
      ),
    ).toBe("typora-local://file/D%3A/Notes/shared/logo%201.png?raw=true#preview");

    expect(resolveDocumentResourceUrl("https://example.com/a.png", "D:/doc.md")).toBe(
      "https://example.com/a.png",
    );
    expect(resolveDocumentResourceUrl("#heading", "D:/doc.md")).toBe("#heading");
    expect(resolveDocumentResourceUrl("assets/logo.png")).toBe("assets/logo.png");
  });
});
