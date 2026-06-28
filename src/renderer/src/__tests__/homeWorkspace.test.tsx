import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeWorkspace } from "../features/home/HomeWorkspace";

describe("HomeWorkspace", () => {
  it("does not mount the inspiration note dialog on initial render", () => {
    const html = renderToStaticMarkup(
      <HomeWorkspace
        activeDocument={null}
        logoUrl="/icon.png"
        noteDialogRequestId={0}
        onCreateDocument={() => {}}
        onOpenKnowledgeRelations={() => {}}
        onOpenRecentDocument={() => {}}
        onOpenRecentDocumentContextMenu={() => {}}
        onOpenWorkspaceFolder={() => {}}
        recentDocuments={[]}
        workspacePath="D:/notes"
      />,
    );

    expect(html).not.toContain("home-note-dialog");
  });
});
