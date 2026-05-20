import { describe, expect, it } from "vitest";
import { getHtmlOutline } from "../htmlStructure";

describe("getHtmlOutline", () => {
  it("extracts heading outline entries with stable ids and anchors", () => {
    const outline = getHtmlOutline(`
      <main>
        <h1 id="intro">Intro &amp; Setup</h1>
        <section>
          <h2><a name="deep-dive"></a><span>Deep&nbsp;Dive</span></h2>
          <h3 data-x="1">API <code>events</code></h3>
        </section>
      </main>
    `);

    expect(outline).toEqual([
      {
        anchor: "intro",
        id: "html-outline-0",
        level: 1,
        title: "Intro & Setup",
      },
      {
        anchor: "deep-dive",
        id: "html-outline-1",
        level: 2,
        title: "Deep Dive",
      },
      {
        id: "html-outline-2",
        level: 3,
        title: "API events",
      },
    ]);
  });

  it("ignores headings inside non-content blocks", () => {
    expect(
      getHtmlOutline(`
        <script>const title = "<h1>Not content</h1>";</script>
        <style>h1::before { content: "Fake"; }</style>
        <h2>Real heading</h2>
      `),
    ).toEqual([
      {
        id: "html-outline-0",
        level: 2,
        title: "Real heading",
      },
    ]);
  });
});
