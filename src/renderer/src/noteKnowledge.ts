import type { MarkdownDocument } from "./types";

export type NoteProperty = {
  key: string;
  value: string;
};

export type NoteWikiLink = {
  display: string;
  index: number;
  normalizedTarget: string;
  raw: string;
  target: string;
  targetDocument?: MarkdownDocument;
};

export type NoteBacklink = {
  link: NoteWikiLink;
  sourceDocument: MarkdownDocument;
};

export type DocumentKnowledge = {
  document: MarkdownDocument;
  frontmatterTags: string[];
  inlineTags: string[];
  links: NoteWikiLink[];
  properties: NoteProperty[];
  tags: string[];
};

export type NoteTagSummary = {
  count: number;
  tag: string;
};

export type WorkspaceKnowledge = {
  backlinksByDocumentId: Map<string, NoteBacklink[]>;
  documentByLinkKey: Map<string, MarkdownDocument>;
  metadataByDocumentId: Map<string, DocumentKnowledge>;
  outgoingLinksByDocumentId: Map<string, NoteWikiLink[]>;
  tagSummaries: NoteTagSummary[];
};

type ParsedFrontmatter = {
  body: string;
  hasFrontmatter: boolean;
  properties: Map<string, string | string[]>;
};

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const wikiLinkPattern = /\[\[([^[\]\n]{1,180})\]\]/g;
const inlineTagPattern =
  /(^|[\s([{:>])#([\p{L}\p{N}_/-]{1,64})(?=$|[\s.,;:!?()[\]{}<>])/gu;

function stripMarkdownCode(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ");
}

function stripQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = value.trim();
    const key = normalized.toLocaleLowerCase();

    if (!normalized || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(normalized);
  });

  return result;
}

export function normalizeTagName(value: string) {
  return value
    .trim()
    .replace(/^#+/, "")
    .replace(/[,[\]{}]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

export function normalizePropertyKey(value: string) {
  return value
    .trim()
    .replace(/[:\r\n]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

function parseListLikeValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map(stripQuotes)
      .map(normalizeTagName)
      .filter(Boolean);
  }

  const separator = trimmed.includes(",") ? /\s*,\s*/ : /\s+/;

  return trimmed
    .split(separator)
    .map(stripQuotes)
    .map(normalizeTagName)
    .filter(Boolean);
}

function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(frontmatterPattern);

  if (!match) {
    return {
      body: content,
      hasFrontmatter: false,
      properties: new Map(),
    };
  }

  const source = match[1] ?? "";
  const properties = new Map<string, string | string[]>();
  let currentListKey: string | null = null;

  source.split(/\r?\n/).forEach((line) => {
    const listItem = line.match(/^\s*-\s*(.+?)\s*$/);

    if (currentListKey && listItem) {
      const current = properties.get(currentListKey);
      const values = Array.isArray(current) ? current : [];
      properties.set(currentListKey, [...values, stripQuotes(listItem[1] ?? "")]);
      return;
    }

    const property = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);

    if (!property) {
      currentListKey = null;
      return;
    }

    const key = normalizePropertyKey(property[1] ?? "");
    const value = (property[2] ?? "").trim();

    if (!key) {
      currentListKey = null;
      return;
    }

    if (!value) {
      properties.set(key, []);
      currentListKey = key;
      return;
    }

    properties.set(key, stripQuotes(value));
    currentListKey = null;
  });

  return {
    body: content.slice(match[0].length),
    hasFrontmatter: true,
    properties,
  };
}

function getFrontmatterTags(properties: Map<string, string | string[]>) {
  const value = properties.get("tags") ?? properties.get("tag");

  if (Array.isArray(value)) {
    return uniqueValues(value.map(normalizeTagName).filter(Boolean));
  }

  if (typeof value === "string") {
    return uniqueValues(parseListLikeValue(value));
  }

  return [];
}

function getFrontmatterProperties(properties: Map<string, string | string[]>) {
  return Array.from(properties.entries())
    .filter(([key]) => key !== "tags" && key !== "tag")
    .map(([key, value]) => ({
      key,
      value: Array.isArray(value) ? value.map(stripQuotes).join(", ") : String(value),
    }))
    .filter((property) => property.value.trim().length > 0);
}

export function parseInlineTags(content: string) {
  const tags: string[] = [];
  const stripped = stripMarkdownCode(content);

  for (const match of stripped.matchAll(inlineTagPattern)) {
    const tag = normalizeTagName(match[2] ?? "");

    if (tag) {
      tags.push(tag);
    }
  }

  return uniqueValues(tags);
}

export function normalizeWikiLinkTarget(value: string) {
  const rawTarget = value.split("|")[0]?.trim() ?? "";
  const withoutAnchor = rawTarget.split("#")[0]?.trim() ?? "";

  return withoutAnchor
    .replace(/\\/g, "/")
    .replace(/\.(?:md|markdown)$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/")
    .toLocaleLowerCase();
}

export function getWikiLinkTitle(value: string) {
  const target = value.split("|")[0]?.split("#")[0]?.trim() ?? "";
  const segments = target.replace(/\\/g, "/").split("/").filter(Boolean);
  const title = segments.at(-1) ?? target;

  return title.replace(/\.(?:md|markdown)$/i, "").trim();
}

export function parseWikiLinks(content: string) {
  const links: NoteWikiLink[] = [];
  const stripped = stripMarkdownCode(content);

  for (const match of stripped.matchAll(wikiLinkPattern)) {
    const raw = match[1]?.trim() ?? "";
    const [targetPart, displayPart] = raw.split("|");
    const target = (targetPart ?? "").trim();
    const normalizedTarget = normalizeWikiLinkTarget(target);

    if (!target || !normalizedTarget) {
      continue;
    }

    links.push({
      display: (displayPart ?? "").trim() || getWikiLinkTitle(target) || target,
      index: match.index ?? 0,
      normalizedTarget,
      raw,
      target,
    });
  }

  return links;
}

export function parseDocumentKnowledge(
  document: MarkdownDocument,
): DocumentKnowledge {
  const frontmatter = parseFrontmatter(document.content);
  const frontmatterTags = getFrontmatterTags(frontmatter.properties);
  const inlineTags = parseInlineTags(frontmatter.body);
  const links = parseWikiLinks(frontmatter.body);
  const tags = uniqueValues([...frontmatterTags, ...inlineTags]);

  return {
    document,
    frontmatterTags,
    inlineTags,
    links,
    properties: getFrontmatterProperties(frontmatter.properties),
    tags,
  };
}

function getDocumentAliasKeys(document: MarkdownDocument) {
  const keys = new Set<string>();
  const push = (value?: string) => {
    const normalized = normalizeWikiLinkTarget(value ?? "");

    if (normalized) {
      keys.add(normalized);
    }
  };

  push(document.title);

  if (document.filePath) {
    const pathWithoutExtension = document.filePath
      .replace(/\\/g, "/")
      .replace(/\.[^/.]+$/i, "");
    const segments = pathWithoutExtension.split("/").filter(Boolean);

    for (let index = 0; index < segments.length; index += 1) {
      push(segments.slice(index).join("/"));
    }

    push(segments.at(-1));
  }

  return keys;
}

function isKnowledgeDocument(document: MarkdownDocument) {
  return document.documentType === "markdown";
}

export function createWorkspaceKnowledge(
  documents: MarkdownDocument[],
): WorkspaceKnowledge {
  const metadataByDocumentId = new Map<string, DocumentKnowledge>();
  const outgoingLinksByDocumentId = new Map<string, NoteWikiLink[]>();
  const backlinksByDocumentId = new Map<string, NoteBacklink[]>();
  const documentByLinkKey = new Map<string, MarkdownDocument>();
  const tagCounts = new Map<string, number>();

  documents.filter(isKnowledgeDocument).forEach((document) => {
    getDocumentAliasKeys(document).forEach((key) => {
      if (!documentByLinkKey.has(key)) {
        documentByLinkKey.set(key, document);
      }
    });
  });

  documents.filter(isKnowledgeDocument).forEach((document) => {
    const knowledge = parseDocumentKnowledge(document);

    metadataByDocumentId.set(document.id, knowledge);
    knowledge.tags.forEach((tag) =>
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1),
    );

    const resolvedLinks = knowledge.links.map((link) => ({
      ...link,
      targetDocument: documentByLinkKey.get(link.normalizedTarget),
    }));

    outgoingLinksByDocumentId.set(document.id, resolvedLinks);

    resolvedLinks.forEach((link) => {
      if (!link.targetDocument) {
        return;
      }

      const backlinks = backlinksByDocumentId.get(link.targetDocument.id) ?? [];
      backlinks.push({
        link,
        sourceDocument: document,
      });
      backlinksByDocumentId.set(link.targetDocument.id, backlinks);
    });
  });

  const tagSummaries = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ count, tag }))
    .sort(
      (left, right) =>
        right.count - left.count || left.tag.localeCompare(right.tag, "zh-CN"),
    );

  return {
    backlinksByDocumentId,
    documentByLinkKey,
    metadataByDocumentId,
    outgoingLinksByDocumentId,
    tagSummaries,
  };
}

function serializeYamlValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "\"\"";
  }

  return /[:#[\]{},]|^\s|\s$/.test(trimmed)
    ? JSON.stringify(trimmed)
    : trimmed;
}

function serializeFrontmatter(properties: Map<string, string | string[]>) {
  const lines: string[] = [];
  const tags = properties.get("tags");

  if (Array.isArray(tags) && tags.length) {
    lines.push(`tags: [${tags.map(serializeYamlValue).join(", ")}]`);
  } else if (typeof tags === "string" && tags.trim()) {
    lines.push(`tags: ${serializeYamlValue(tags)}`);
  }

  properties.forEach((value, key) => {
    if (key === "tags" || key === "tag") {
      return;
    }

    if (Array.isArray(value)) {
      if (!value.length) {
        return;
      }

      lines.push(`${key}:`);
      value.forEach((item) => lines.push(`  - ${serializeYamlValue(item)}`));
      return;
    }

    if (String(value).trim()) {
      lines.push(`${key}: ${serializeYamlValue(String(value))}`);
    }
  });

  return lines.length ? `---\n${lines.join("\n")}\n---\n\n` : "";
}

function writeFrontmatter(
  content: string,
  updater: (properties: Map<string, string | string[]>) => void,
) {
  const parsed = parseFrontmatter(content);
  const nextProperties = new Map(parsed.properties);

  updater(nextProperties);

  return `${serializeFrontmatter(nextProperties)}${parsed.body.replace(/^\s+/, "")}`;
}

export function setMarkdownTags(content: string, tags: string[]) {
  const nextTags = uniqueValues(tags.map(normalizeTagName).filter(Boolean));

  return writeFrontmatter(content, (properties) => {
    if (nextTags.length) {
      properties.set("tags", nextTags);
      properties.delete("tag");
      return;
    }

    properties.delete("tags");
    properties.delete("tag");
  });
}

export function addMarkdownTag(content: string, tag: string) {
  const knowledge = parseFrontmatter(content);
  const tags = getFrontmatterTags(knowledge.properties);

  return setMarkdownTags(content, [...tags, tag]);
}

export function removeMarkdownTag(content: string, tag: string) {
  const normalizedTag = normalizeTagName(tag).toLocaleLowerCase();
  const knowledge = parseFrontmatter(content);
  const tags = getFrontmatterTags(knowledge.properties).filter(
    (item) => item.toLocaleLowerCase() !== normalizedTag,
  );

  return setMarkdownTags(content, tags);
}

export function upsertMarkdownProperty(
  content: string,
  key: string,
  value: string,
) {
  const propertyKey = normalizePropertyKey(key);
  const propertyValue = value.trim();

  if (!propertyKey) {
    return content;
  }

  return writeFrontmatter(content, (properties) => {
    if (!propertyValue) {
      properties.delete(propertyKey);
      return;
    }

    properties.set(propertyKey, propertyValue);
  });
}

export function removeMarkdownProperty(content: string, key: string) {
  const propertyKey = normalizePropertyKey(key);

  if (!propertyKey) {
    return content;
  }

  return writeFrontmatter(content, (properties) => {
    properties.delete(propertyKey);
  });
}

export function createMarkdownNoteContent({
  body,
  properties = {},
  tags = [],
  title,
}: {
  body?: string;
  properties?: Record<string, string>;
  tags?: string[];
  title: string;
}) {
  const frontmatter = new Map<string, string | string[]>();
  const normalizedTags = uniqueValues(tags.map(normalizeTagName).filter(Boolean));

  if (normalizedTags.length) {
    frontmatter.set("tags", normalizedTags);
  }

  Object.entries(properties).forEach(([key, value]) => {
    const propertyKey = normalizePropertyKey(key);
    const propertyValue = value.trim();

    if (propertyKey && propertyValue) {
      frontmatter.set(propertyKey, propertyValue);
    }
  });

  const noteTitle = title.trim() || "Untitled";
  const noteBody = body?.trim();

  return [
    serializeFrontmatter(frontmatter).trimEnd(),
    `# ${noteTitle}`,
    noteBody ?? "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .concat("\n");
}
