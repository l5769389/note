import { describe, expect, it } from "vitest";
import {
  normalizeDirectoryKey,
  rememberRecentDirectoryPath,
} from "../recentDirectories";

describe("recent directory helpers", () => {
  it("normalizes directory keys across separators, casing, and trailing slashes", () => {
    expect(normalizeDirectoryKey("D:\\Notes\\Project\\")).toBe(
      "d:/notes/project",
    );
    expect(normalizeDirectoryKey()).toBe("");
  });

  it("adds new directories first and de-duplicates normalized matches", () => {
    expect(
      rememberRecentDirectoryPath(
        ["D:/Notes/Project", "D:/Notes/Archive"],
        "d:\\notes\\project\\",
      ),
    ).toEqual(["d:\\notes\\project\\", "D:/Notes/Archive"]);
  });

  it("ignores empty paths and enforces the provided limit", () => {
    const current = ["D:/one", "D:/two"];

    expect(rememberRecentDirectoryPath(current, "")).toBe(current);
    expect(rememberRecentDirectoryPath(current, "D:/three", 2)).toEqual([
      "D:/three",
      "D:/one",
    ]);
  });
});
