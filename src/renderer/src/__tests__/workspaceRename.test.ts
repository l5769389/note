import { describe, expect, it } from "vitest";
import {
  createWorkspaceRenamedEntryName,
  splitWorkspaceEntryNameForRename,
  validateWorkspaceRenameBaseName,
} from "../../../shared/workspaceRename";

describe("workspace rename helpers", () => {
  it("keeps file extensions locked when renaming files", () => {
    expect(
      splitWorkspaceEntryNameForRename("project-plan.md", "file"),
    ).toEqual({
      editableName: "project-plan",
      extension: ".md",
    });

    expect(
      createWorkspaceRenamedEntryName({
        currentName: "project-plan.md",
        entryType: "file",
        nextBaseName: "roadmap",
      }),
    ).toBe("roadmap.md");
  });

  it("renames folders as full names without extension handling", () => {
    expect(
      splitWorkspaceEntryNameForRename("archive.v1", "directory"),
    ).toEqual({
      editableName: "archive.v1",
      extension: "",
    });

    expect(
      createWorkspaceRenamedEntryName({
        currentName: "archive.v1",
        entryType: "directory",
        nextBaseName: "archive.v2",
      }),
    ).toBe("archive.v2");
  });

  it("rejects empty names and path separators", () => {
    expect(validateWorkspaceRenameBaseName("   ")).toBeTruthy();
    expect(validateWorkspaceRenameBaseName("bad/name")).toBeTruthy();
    expect(validateWorkspaceRenameBaseName("good name")).toBeNull();
  });
});
