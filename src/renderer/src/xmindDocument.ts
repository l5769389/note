import JSZip from "jszip";

export type XmindTopicNode = {
  children: XmindTopicNode[];
  id: string;
  labels: string[];
  notes?: string;
  title: string;
};

export type XmindSheet = {
  id: string;
  rootTopic: XmindTopicNode;
  title: string;
};

export type XmindDocumentModel = {
  sheets: XmindSheet[];
  source: "json" | "xml";
};

function fallbackId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

function normalizeTitle(value: unknown, fallback = "Untitled") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

function collectJsonChildren(topic: Record<string, unknown>) {
  const children = topic.children;

  if (!children || typeof children !== "object") {
    return [];
  }

  return Object.values(children as Record<string, unknown>).flatMap((group) =>
    Array.isArray(group) ? group.filter((child) => child && typeof child === "object") : [],
  ) as Array<Record<string, unknown>>;
}

function getJsonNotes(topic: Record<string, unknown>) {
  const notes = topic.notes;

  if (!notes || typeof notes !== "object") {
    return undefined;
  }

  const noteRecord = notes as Record<string, unknown>;
  const plain = noteRecord.plain;

  if (plain && typeof plain === "object") {
    const content = (plain as Record<string, unknown>).content;
    return typeof content === "string" && content.trim() ? content.trim() : undefined;
  }

  return undefined;
}

function parseJsonTopic(topic: Record<string, unknown>, fallbackTitle: string): XmindTopicNode {
  return {
    children: collectJsonChildren(topic).map((child, index) =>
      parseJsonTopic(child, `Topic ${index + 1}`),
    ),
    id: normalizeTitle(topic.id, fallbackId("topic")),
    labels: toStringList(topic.labels),
    notes: getJsonNotes(topic),
    title: normalizeTitle(topic.title, fallbackTitle),
  };
}

function parseContentJson(content: string): XmindDocumentModel {
  const parsed = JSON.parse(content) as unknown;
  const rawSheets = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as Record<string, unknown>).sheets)
      ? ((parsed as Record<string, unknown>).sheets as unknown[])
      : [];
  const sheets = rawSheets
    .filter((sheet): sheet is Record<string, unknown> => sheet && typeof sheet === "object")
    .map((sheet, index) => {
      const rootTopic = sheet.rootTopic;
      const title = normalizeTitle(sheet.title, `Sheet ${index + 1}`);

      return {
        id: normalizeTitle(sheet.id, fallbackId("sheet")),
        rootTopic:
          rootTopic && typeof rootTopic === "object"
            ? parseJsonTopic(rootTopic as Record<string, unknown>, title)
            : {
                children: [],
                id: fallbackId("topic"),
                labels: [],
                title,
              },
        title,
      };
    });

  return { sheets, source: "json" };
}

function getDirectChild(element: Element, tagName: string) {
  return Array.from(element.children).find((child) => child.tagName === tagName);
}

function parseXmlTopic(topic: Element, fallbackTitle: string): XmindTopicNode {
  const title = normalizeTitle(getDirectChild(topic, "title")?.textContent, fallbackTitle);
  const childrenElement = getDirectChild(topic, "children");
  const topicChildren = childrenElement
    ? Array.from(childrenElement.querySelectorAll(":scope > topics > topic"))
    : [];

  return {
    children: topicChildren.map((child, index) => parseXmlTopic(child, `Topic ${index + 1}`)),
    id: normalizeTitle(topic.getAttribute("id"), fallbackId("topic")),
    labels: [],
    notes: undefined,
    title,
  };
}

function parseContentXml(content: string): XmindDocumentModel {
  if (typeof DOMParser === "undefined") {
    throw new Error("XML XMind files are not supported in this runtime.");
  }

  const xml = new DOMParser().parseFromString(content, "application/xml");
  const sheets = Array.from(xml.querySelectorAll("sheet")).map((sheet, index) => {
    const title = normalizeTitle(getDirectChild(sheet, "title")?.textContent, `Sheet ${index + 1}`);
    const rootTopic = getDirectChild(sheet, "topic");

    return {
      id: normalizeTitle(sheet.getAttribute("id"), fallbackId("sheet")),
      rootTopic: rootTopic
        ? parseXmlTopic(rootTopic, title)
        : {
            children: [],
            id: fallbackId("topic"),
            labels: [],
            title,
          },
      title,
    };
  });

  return { sheets, source: "xml" };
}

export async function parseXmindDocument(base64Content: string): Promise<XmindDocumentModel> {
  const zip = await JSZip.loadAsync(base64Content, { base64: true });
  const contentJson = zip.file("content.json");

  if (contentJson) {
    return parseContentJson(await contentJson.async("string"));
  }

  const contentXml = zip.file("content.xml");

  if (contentXml) {
    return parseContentXml(await contentXml.async("string"));
  }

  throw new Error("This XMind file does not contain content.json or content.xml.");
}
