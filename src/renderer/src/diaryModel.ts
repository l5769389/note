import type { DirectoryTreeItem, LocalMarkdownFile, MarkdownDocument } from "./types";
import { createDocumentFromLocalFile } from "./documentModel";
import { normalizeTagName } from "./noteKnowledge";

export const diaryRootDirectoryName = "日记";
export const diaryFrontmatterTypeKey = "notedock-type";
export const diaryFrontmatterTypeValue = "diary";
export const diaryMoodValues = [
  "开心",
  "平静",
  "疲惫",
  "焦虑",
  "低落",
  "兴奋",
] as const;
export const diaryTemplateIds = [
  "blank",
  "daily-review",
  "study-log",
  "work-log",
] as const;

export type DiaryMood = (typeof diaryMoodValues)[number];
export type DiaryTemplateId = (typeof diaryTemplateIds)[number];

export type DiaryTemplate = {
  body: string;
  description: string;
  id: DiaryTemplateId;
  label: string;
};

export const diaryTemplates: DiaryTemplate[] = [
  {
    body: "",
    description: "不写入任何正文内容",
    id: "blank",
    label: "空白",
  },
  {
    body: "## 今日回顾\n\n\n## 情绪记录\n\n\n## 明日计划\n",
    description: "回顾今天、记录状态、整理下一步",
    id: "daily-review",
    label: "每日复盘",
  },
  {
    body: "## 今日学习\n\n\n## 关键收获\n\n\n## 待复习\n",
    description: "适合课程、阅读和技能学习记录",
    id: "study-log",
    label: "学习记录",
  },
  {
    body: "## 今日工作\n\n\n## 进展\n\n\n## 风险与待办\n",
    description: "适合项目推进和工作日志",
    id: "work-log",
    label: "工作日志",
  },
];

export const diaryTemplateOptions = diaryTemplates.map((template) => ({
  description: template.description,
  label: template.label,
  preview: template.body.trim() || "从空白页开始记录",
  value: template.id,
}));

export type DiaryEntry = {
  dateKey: string;
  dayLabel: string;
  filePath: string;
  monthKey: string;
  monthLabel: string;
  mood?: DiaryMood;
  summary?: string;
  tags: string[];
  templateId: DiaryTemplateId;
  title: string;
  updatedAt?: string;
  year: string;
};

export type DiaryMonthGroup = {
  entries: DiaryEntry[];
  key: string;
  label: string;
};

export type DiaryYearGroup = {
  key: string;
  label: string;
  months: DiaryMonthGroup[];
};

export type DiaryMetadata = {
  dateKey: string;
  isDiary: boolean;
  mood?: DiaryMood;
  tags: string[];
  templateId: DiaryTemplateId;
};

type ParsedDiaryFrontmatter = {
  body: string;
  hasFrontmatter: boolean;
  properties: Map<string, string | string[]>;
};

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const diarySummaryLimit = 72;

function stripTrailingPathSeparators(value: string) {
  return value.replace(/[\\/]+$/g, "");
}

function stripQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLocaleLowerCase();

    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
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

function parseDiaryFrontmatter(content: string): ParsedDiaryFrontmatter {
  const match = content.match(frontmatterPattern);

  if (!match) {
    return {
      body: content,
      hasFrontmatter: false,
      properties: new Map(),
    };
  }

  const properties = new Map<string, string | string[]>();
  let currentListKey: string | null = null;

  (match[1] ?? "").split(/\r?\n/).forEach((line) => {
    const listItem = line.match(/^\s*-\s*(.+?)\s*$/);

    if (currentListKey && listItem) {
      const currentValue = properties.get(currentListKey);
      properties.set(currentListKey, [
        ...(Array.isArray(currentValue) ? currentValue : []),
        stripQuotes(listItem[1] ?? ""),
      ]);
      return;
    }

    const property = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);

    if (!property) {
      currentListKey = null;
      return;
    }

    const key = (property[1] ?? "").trim();
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
    body: content.slice(match[0].length).replace(/^\r?\n/, ""),
    hasFrontmatter: true,
    properties,
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

function serializeDiaryFrontmatter(properties: Map<string, string | string[]>) {
  const lines: string[] = [];

  properties.forEach((value, key) => {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(serializeYamlValue).join(", ")}]`);
      return;
    }

    if (String(value).trim()) {
      lines.push(`${key}: ${serializeYamlValue(String(value))}`);
    }
  });

  return lines.length ? `---\n${lines.join("\n")}\n---\n\n` : "";
}

function normalizeDiaryMood(value: unknown): DiaryMood | undefined {
  return diaryMoodValues.find((mood) => mood === value);
}

export function normalizeDiaryTemplateId(value: unknown): DiaryTemplateId {
  return diaryTemplateIds.find((templateId) => templateId === value) ?? "blank";
}

function getDiaryTemplateBody(templateId: DiaryTemplateId) {
  return diaryTemplates.find((template) => template.id === templateId)?.body ?? "";
}

function normalizeTemplateBodyForCompare(body: string) {
  return body.trim().replace(/\s+/g, "\n");
}

function isReplaceableDiaryTemplateBody(body: string) {
  const normalizedBody = normalizeTemplateBodyForCompare(body);

  return (
    !normalizedBody ||
    /^#\s*\d{4}-\d{2}-\d{2}$/.test(normalizedBody) ||
    diaryTemplates.some(
      (template) =>
        normalizeTemplateBodyForCompare(template.body) === normalizedBody,
    )
  );
}

type DiaryBodySection = {
  content: string;
  headingLine: string;
  index: number;
  key: string;
};

function normalizeDiaryHeadingKey(value: string) {
  return value
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[`*_~#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function getDiaryHeadingTitle(line: string) {
  const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);

  return match ? match[1] ?? "" : "";
}

function splitDiaryBodyIntoSections(body: string) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const leadingLines: string[] = [];
  const sections: DiaryBodySection[] = [];
  let current:
    | {
        contentLines: string[];
        headingLine: string;
        key: string;
      }
    | null = null;

  function pushCurrentSection() {
    if (!current) {
      return;
    }

    sections.push({
      content: current.contentLines.join("\n"),
      headingLine: current.headingLine,
      index: sections.length,
      key: current.key,
    });
    current = null;
  }

  for (const line of lines) {
    const headingTitle = getDiaryHeadingTitle(line);
    const headingKey = normalizeDiaryHeadingKey(headingTitle);

    if (headingKey) {
      pushCurrentSection();
      current = {
        contentLines: [],
        headingLine: line.trimEnd(),
        key: headingKey,
      };
      continue;
    }

    if (current) {
      current.contentLines.push(line);
    } else {
      leadingLines.push(line);
    }
  }

  pushCurrentSection();

  return {
    leading: leadingLines.join("\n"),
    sections,
  };
}

function formatDiarySection(headingLine: string, content: string) {
  const trimmedContent = content.trim();

  return trimmedContent
    ? `${headingLine}\n\n${trimmedContent}`
    : headingLine;
}

function getUnmatchedDiaryBlocks(
  oldBody: ReturnType<typeof splitDiaryBodyIntoSections>,
  usedSectionIndexes: Set<number>,
) {
  const blocks: string[] = [];
  const leading = oldBody.leading.trim();

  if (leading) {
    blocks.push(leading);
  }

  oldBody.sections.forEach((section) => {
    if (usedSectionIndexes.has(section.index)) {
      return;
    }

    if (!section.content.trim()) {
      return;
    }

    blocks.push(formatDiarySection(section.headingLine, section.content));
  });

  return blocks.filter((block) => block.trim());
}

function migrateDiaryBodyToTemplate(body: string, nextTemplateId: DiaryTemplateId) {
  const templateBody = getDiaryTemplateBody(nextTemplateId);

  if (isReplaceableDiaryTemplateBody(body)) {
    return templateBody;
  }

  if (!templateBody.trim()) {
    return body;
  }

  const oldBody = splitDiaryBodyIntoSections(body);
  const template = splitDiaryBodyIntoSections(templateBody);
  const oldSectionsByKey = new Map<string, DiaryBodySection[]>();
  const usedSectionIndexes = new Set<number>();

  oldBody.sections.forEach((section) => {
    const sections = oldSectionsByKey.get(section.key) ?? [];
    sections.push(section);
    oldSectionsByKey.set(section.key, sections);
  });

  const nextBlocks = template.sections.map((section) => {
    const oldSection = oldSectionsByKey.get(section.key)?.shift();

    if (oldSection) {
      usedSectionIndexes.add(oldSection.index);
      return formatDiarySection(section.headingLine, oldSection.content);
    }

    return formatDiarySection(section.headingLine, section.content);
  });
  const unmatchedBlocks = getUnmatchedDiaryBlocks(oldBody, usedSectionIndexes);

  if (unmatchedBlocks.length) {
    nextBlocks.push(formatDiarySection("## 其他记录", unmatchedBlocks.join("\n\n")));
  }

  return `${template.leading.trim() ? `${template.leading.trim()}\n\n` : ""}${nextBlocks
    .filter((block) => block.trim())
    .join("\n\n")}${templateBody.endsWith("\n") ? "\n" : ""}`;
}

function getPropertyString(
  properties: Map<string, string | string[]>,
  key: string,
) {
  const value = properties.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getPropertyTags(properties: Map<string, string | string[]>) {
  const value = properties.get("tags") ?? properties.get("tag");

  if (Array.isArray(value)) {
    return uniqueValues(value.map(normalizeTagName).filter(Boolean));
  }

  if (typeof value === "string") {
    return uniqueValues(parseListLikeValue(value));
  }

  return [];
}

function getDefaultDiaryDateKey(dateKey?: string) {
  return dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ? dateKey
    : getDiaryDateKey();
}

function createDiaryFrontmatter({
  dateKey,
  mood,
  tags,
  templateId,
}: {
  dateKey: string;
  mood?: DiaryMood;
  tags?: string[];
  templateId: DiaryTemplateId;
}) {
  const properties = new Map<string, string | string[]>();
  const normalizedTags = uniqueValues((tags ?? []).map(normalizeTagName).filter(Boolean));

  properties.set(diaryFrontmatterTypeKey, diaryFrontmatterTypeValue);
  properties.set("diary-date", dateKey);
  properties.set("diary-template", templateId);
  properties.set("tags", normalizedTags);

  if (mood) {
    properties.set("diary-mood", mood);
  }

  return serializeDiaryFrontmatter(properties);
}

export function joinWorkspacePath(rootPath: string, ...segments: string[]) {
  const root = stripTrailingPathSeparators(rootPath.trim());
  const cleanSegments = segments
    .map((segment) => segment.trim().replace(/^[\\/]+|[\\/]+$/g, ""))
    .filter(Boolean);

  return [root, ...cleanSegments].filter(Boolean).join("/");
}

export function getDiaryRootPath(workspacePath: string) {
  return joinWorkspacePath(workspacePath, diaryRootDirectoryName);
}

export function getDiaryDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getDiaryMonthDirectoryPath(workspacePath: string, dateKey: string) {
  const [year, month] = dateKey.split("-");

  return joinWorkspacePath(getDiaryRootPath(workspacePath), year || "0000", month || "00");
}

export function getDiaryFilePath(workspacePath: string, dateKey: string) {
  return joinWorkspacePath(getDiaryMonthDirectoryPath(workspacePath, dateKey), `${dateKey}.md`);
}

function normalizeDiaryPath(value?: string) {
  return (value ?? "").replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

export function isPathInsideDiaryRoot(filePath?: string, workspacePath?: string) {
  if (!filePath || !workspacePath) {
    return false;
  }

  const path = normalizeDiaryPath(filePath);
  const diaryRoot = normalizeDiaryPath(getDiaryRootPath(workspacePath));

  return Boolean(path && diaryRoot && (path === diaryRoot || path.startsWith(`${diaryRoot}/`)));
}

export function removeDiaryRootFromDirectoryTree(
  tree?: DirectoryTreeItem | null,
  workspacePath?: string,
  diaryFilePaths: Iterable<string> = [],
): DirectoryTreeItem | null {
  if (!tree) {
    return null;
  }

  const normalizedDiaryFilePaths = new Set(
    Array.from(diaryFilePaths, normalizeDiaryPath),
  );

  if (isPathInsideDiaryRoot(tree.path, workspacePath)) {
    return null;
  }

  if (tree.type === "file") {
    return normalizedDiaryFilePaths.has(normalizeDiaryPath(tree.path))
      ? null
      : tree;
  }

  return {
    ...tree,
    children: (tree.children ?? [])
      .map((child) =>
        removeDiaryRootFromDirectoryTree(
          child,
          workspacePath,
          normalizedDiaryFilePaths,
        ),
      )
      .filter((child): child is DirectoryTreeItem => Boolean(child)),
  };
}

export function getDiaryMetadata(content: string, fallbackDateKey?: string): DiaryMetadata {
  const parsed = parseDiaryFrontmatter(content);
  const properties = parsed.properties;
  const dateKey = getDefaultDiaryDateKey(
    getPropertyString(properties, "diary-date") || fallbackDateKey,
  );

  return {
    dateKey,
    isDiary:
      getPropertyString(properties, diaryFrontmatterTypeKey) ===
      diaryFrontmatterTypeValue,
    mood: normalizeDiaryMood(getPropertyString(properties, "diary-mood")),
    tags: getPropertyTags(properties),
    templateId: normalizeDiaryTemplateId(
      getPropertyString(properties, "diary-template"),
    ),
  };
}

export function getDiaryBody(content: string) {
  return parseDiaryFrontmatter(content).body;
}

export function replaceDiaryBodyPreservingMetadata(content: string, body: string) {
  const parsed = parseDiaryFrontmatter(content);

  if (!parsed.hasFrontmatter) {
    return body;
  }

  return `${serializeDiaryFrontmatter(parsed.properties)}${body.replace(/^\s+/, "")}`;
}

export function isDiaryDocumentContent(content: string) {
  return getDiaryMetadata(content).isDiary;
}

export function createDiaryInitialContent(
  dateKey: string,
  templateId: DiaryTemplateId = "blank",
) {
  const normalizedTemplateId = normalizeDiaryTemplateId(templateId);
  const body = getDiaryTemplateBody(normalizedTemplateId);

  return `${createDiaryFrontmatter({
    dateKey: getDefaultDiaryDateKey(dateKey),
    templateId: normalizedTemplateId,
  })}${body}`;
}

export function updateDiaryMetadata(
  content: string,
  updates: Partial<Pick<DiaryMetadata, "tags" | "templateId">> & {
    dateKey?: string;
    mood?: DiaryMood | null;
  },
) {
  const parsed = parseDiaryFrontmatter(content);
  const currentMetadata = getDiaryMetadata(content, updates.dateKey);
  const properties = new Map(parsed.properties);
  const tags =
    updates.tags !== undefined
      ? uniqueValues(updates.tags.map(normalizeTagName).filter(Boolean))
      : currentMetadata.tags;
  const templateId =
    updates.templateId !== undefined
      ? normalizeDiaryTemplateId(updates.templateId)
      : currentMetadata.templateId;

  properties.set(diaryFrontmatterTypeKey, diaryFrontmatterTypeValue);
  properties.set("diary-date", getDefaultDiaryDateKey(updates.dateKey ?? currentMetadata.dateKey));
  properties.set("diary-template", templateId);
  properties.set("tags", tags);
  properties.delete("tag");

  if (Object.prototype.hasOwnProperty.call(updates, "mood")) {
    if (updates.mood) {
      properties.set("diary-mood", updates.mood);
    } else {
      properties.delete("diary-mood");
    }
  } else if (currentMetadata.mood) {
    properties.set("diary-mood", currentMetadata.mood);
  }

  return `${serializeDiaryFrontmatter(properties)}${parsed.body.replace(/^\s+/, "")}`;
}

export function applyDiaryTemplateIfEmpty(
  content: string,
  templateId: DiaryTemplateId,
) {
  return applyDiaryTemplateWithCarryover(content, templateId);
}

export function applyDiaryTemplateWithCarryover(
  content: string,
  templateId: DiaryTemplateId,
) {
  const nextTemplateId = normalizeDiaryTemplateId(templateId);
  const nextContent = updateDiaryMetadata(content, {
    templateId: nextTemplateId,
  });
  const nextBody = migrateDiaryBodyToTemplate(getDiaryBody(content), nextTemplateId);

  return replaceDiaryBodyPreservingMetadata(nextContent, nextBody);
}

export function getDiarySummary(content: string) {
  const body = getDiaryBody(content)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return body.length > diarySummaryLimit
    ? `${body.slice(0, diarySummaryLimit)}...`
    : body;
}

function getDiaryEntryFromFile(file: {
  name: string;
  path: string;
  updatedAt?: string;
}): DiaryEntry | null {
  const match = file.name.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/i);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const dateKey = `${year}-${month}-${day}`;

  return {
    dateKey,
    dayLabel: `${Number(day)}日`,
    filePath: file.path,
    monthKey: `${year}-${month}`,
    monthLabel: `${Number(month)}月`,
    tags: [],
    templateId: "blank",
    title: dateKey,
    updatedAt: file.updatedAt,
    year,
  };
}

function collectDiaryEntriesFromTree(tree?: DirectoryTreeItem | null): DiaryEntry[] {
  if (!tree) {
    return [];
  }

  if (tree.type === "file") {
    const entry = getDiaryEntryFromFile(tree);
    return entry ? [entry] : [];
  }

  return (tree.children ?? []).flatMap(collectDiaryEntriesFromTree);
}

export function getDiaryEntriesFromTree(tree?: DirectoryTreeItem | null) {
  return collectDiaryEntriesFromTree(tree).sort((left, right) =>
    right.dateKey.localeCompare(left.dateKey),
  );
}

export function enrichDiaryEntryWithContent(entry: DiaryEntry, content: string): DiaryEntry {
  const metadata = getDiaryMetadata(content, entry.dateKey);

  return {
    ...entry,
    mood: metadata.mood,
    summary: getDiarySummary(content),
    tags: metadata.tags,
    templateId: metadata.templateId,
  };
}

export function groupDiaryEntries(entries: DiaryEntry[]): DiaryYearGroup[] {
  const yearMap = new Map<string, Map<string, DiaryEntry[]>>();

  for (const entry of entries) {
    if (!yearMap.has(entry.year)) {
      yearMap.set(entry.year, new Map());
    }

    const monthMap = yearMap.get(entry.year)!;

    if (!monthMap.has(entry.monthKey)) {
      monthMap.set(entry.monthKey, []);
    }

    monthMap.get(entry.monthKey)!.push(entry);
  }

  return Array.from(yearMap.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([year, monthMap]) => ({
      key: year,
      label: `${year}年`,
      months: Array.from(monthMap.entries())
        .sort(([left], [right]) => right.localeCompare(left))
        .map(([monthKey, monthEntries]) => ({
          entries: [...monthEntries].sort((left, right) =>
            right.dateKey.localeCompare(left.dateKey),
          ),
          key: monthKey,
          label: monthEntries[0]?.monthLabel ?? monthKey,
        })),
    }));
}

export function createDiaryDocument(file: LocalMarkdownFile): MarkdownDocument {
  return createDocumentFromLocalFile(file);
}
