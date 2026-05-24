import { describe, expect, it } from "vitest";
import { shouldFocusWorkspaceSearch } from "../workspaceUiEffects";

describe("workspace UI effect helpers", () => {
  it("focuses workspace search only when the search tab is visible", () => {
    expect(shouldFocusWorkspaceSearch("search", false)).toBe(true);
    expect(shouldFocusWorkspaceSearch("search", true)).toBe(false);
    expect(shouldFocusWorkspaceSearch("files", false)).toBe(false);
  });
});
