import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseXmindDocument } from "../xmindDocument";

async function createXmindBase64(files: Record<string, string>) {
  const zip = new JSZip();

  Object.entries(files).forEach(([path, content]) => {
    zip.file(path, content);
  });

  return zip.generateAsync({ type: "base64" });
}

describe("xmindDocument", () => {
  it("parses modern content.json XMind archives", async () => {
    const content = await createXmindBase64({
      "content.json": JSON.stringify([
        {
          id: "sheet-1",
          title: "Sheet",
          rootTopic: {
            id: "root",
            title: "Center",
            children: {
              attached: [
                {
                  id: "topic-a",
                  labels: ["todo"],
                  notes: { plain: { content: "note text" } },
                  title: "Topic A",
                },
              ],
            },
          },
        },
      ]),
    });

    const model = await parseXmindDocument(content);

    expect(model.source).toBe("json");
    expect(model.sheets[0].rootTopic.title).toBe("Center");
    expect(model.sheets[0].rootTopic.children[0]).toMatchObject({
      labels: ["todo"],
      notes: "note text",
      title: "Topic A",
    });
  });

  it("parses content.json archives with a sheets wrapper", async () => {
    const content = await createXmindBase64({
      "content.json": JSON.stringify({
        sheets: [
          {
            id: "sheet-1",
            rootTopic: { id: "root", title: "Wrapped" },
            title: "Wrapped Sheet",
          },
        ],
      }),
    });

    const model = await parseXmindDocument(content);

    expect(model.sheets[0].title).toBe("Wrapped Sheet");
    expect(model.sheets[0].rootTopic.title).toBe("Wrapped");
  });

  it("reports archives without XMind content", async () => {
    const content = await createXmindBase64({
      "metadata.json": "{}",
    });

    await expect(parseXmindDocument(content)).rejects.toThrow(
      "content.json or content.xml",
    );
  });
});
