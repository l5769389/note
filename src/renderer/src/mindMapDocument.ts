import type { Edge, Node } from "@xyflow/react";

export type MindMapSide = "left" | "right";

export type MindMapNodeData = {
  children?: MindMapNodeData[];
  collapsed?: boolean;
  id: string;
  side?: MindMapSide;
  text: string;
};

export type MindMapDiagramData = {
  layout: "balanced";
  root: MindMapNodeData;
  version: 1;
};

export type MindMapFlowNodeData = {
  childCount: number;
  collapsed: boolean;
  level: number;
  side: MindMapSide | "root";
  text: string;
};

export type MindMapEditTarget =
  | { kind: "insert" }
  | { code: string; kind: "markdown" }
  | { index: number; kind: "html" };

const mindMapLanguagePattern = /^(?:mindmap|mind-map)$/i;
const markdownMindMapBlockPattern =
  /```(?:mindmap|mind-map)\s*\n([\s\S]*?)\n```/gi;
const htmlMindMapScriptPattern =
  /<script\b(?=[^>]*\bdata-mindmap\b)[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;

const horizontalGap = 230;
const verticalGap = 78;
const rootNodeWidth = 190;
const branchNodeWidth = 172;
const nodeHeight = 46;

function createId(prefix = "topic") {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sanitizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getNodeWidth(level: number) {
  return level === 0 ? rootNodeWidth : branchNodeWidth;
}

export function isMindMapLanguage(language: string) {
  return mindMapLanguagePattern.test(language.trim());
}

export function createDefaultMindMapDiagram(): MindMapDiagramData {
  return {
    layout: "balanced",
    root: {
      id: "root",
      text: "中心主题",
      children: [
        {
          id: "idea",
          side: "right",
          text: "想法",
          children: [
            { id: "idea-detail", text: "补充说明" },
            { id: "idea-action", text: "下一步" },
          ],
        },
        {
          id: "plan",
          side: "left",
          text: "计划",
          children: [
            { id: "plan-now", text: "当前任务" },
            { id: "plan-later", text: "后续扩展" },
          ],
        },
      ],
    },
    version: 1,
  };
}

function normalizeMindMapNode(
  node: unknown,
  fallbackId: string,
  fallbackText: string,
  seenIds: Set<string>,
): MindMapNodeData {
  const record =
    node && typeof node === "object" ? (node as Record<string, unknown>) : {};
  const rawId = sanitizeText(record.id, fallbackId);
  const id = seenIds.has(rawId) ? `${rawId}-${seenIds.size + 1}` : rawId;
  seenIds.add(id);
  const rawChildren = Array.isArray(record.children) ? record.children : [];

  return {
    id,
    text: sanitizeText(record.text ?? record.label, fallbackText),
    ...(record.collapsed === true ? { collapsed: true } : {}),
    ...(record.side === "left" || record.side === "right"
      ? { side: record.side }
      : {}),
    ...(rawChildren.length
      ? {
          children: rawChildren.map((child, index) =>
            normalizeMindMapNode(
              child,
              `${id}-${index + 1}`,
              `主题 ${index + 1}`,
              seenIds,
            ),
          ),
        }
      : {}),
  };
}

function assignRootChildSides(root: MindMapNodeData): MindMapNodeData {
  const children = root.children ?? [];
  let rightCount = children.filter((child) => child.side === "right").length;
  let leftCount = children.filter((child) => child.side === "left").length;

  return {
    ...root,
    children: children.map((child) => {
      if (child.side === "left" || child.side === "right") {
        return child;
      }

      const side: MindMapSide = rightCount <= leftCount ? "right" : "left";

      if (side === "right") {
        rightCount += 1;
      } else {
        leftCount += 1;
      }

      return { ...child, side };
    }),
  };
}

function normalizeMindMapDiagramData(data: unknown): MindMapDiagramData {
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const seenIds = new Set<string>();
  const root = normalizeMindMapNode(record.root, "root", "中心主题", seenIds);

  return {
    layout: "balanced",
    root: assignRootChildSides(root),
    version: 1,
  };
}

type OutlineEntry = {
  level: number;
  text: string;
};

function parseOutlineEntry(line: string): OutlineEntry | null {
  const heading = line.match(/^(#{1,6})\s+(.+)$/);

  if (heading) {
    return { level: heading[1].length, text: heading[2].trim() };
  }

  const bullet = line.match(/^(\s*)[-*+]\s+(.+)$/);

  if (bullet) {
    return {
      level: Math.floor(bullet[1].replace(/\t/g, "  ").length / 2) + 2,
      text: bullet[2].trim(),
    };
  }

  return null;
}

function parseMindMapOutline(source: string): MindMapDiagramData {
  const entries = source
    .split(/\r?\n/)
    .map((line) => parseOutlineEntry(line.trimEnd()))
    .filter((entry): entry is OutlineEntry => Boolean(entry));

  if (!entries.length) {
    throw new Error("Mind map data must be JSON or a Markdown outline.");
  }

  const first = entries[0];
  const root: MindMapNodeData = {
    id: "root",
    text: first.text,
    children: [],
  };
  const stack: Array<{ level: number; node: MindMapNodeData }> = [
    { level: first.level, node: root },
  ];
  let counter = 1;

  entries.slice(1).forEach((entry) => {
    counter += 1;
    const node: MindMapNodeData = {
      id: `topic-${counter}`,
      text: entry.text,
    };

    while (stack.length > 1 && stack[stack.length - 1].level >= entry.level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].node;
    parent.children = [...(parent.children ?? []), node];
    stack.push({ level: entry.level, node });
  });

  return {
    layout: "balanced",
    root: assignRootChildSides(root),
    version: 1,
  };
}

export function parseMindMapDiagramData(source: string): MindMapDiagramData {
  try {
    return normalizeMindMapDiagramData(JSON.parse(source));
  } catch {
    return parseMindMapOutline(source);
  }
}

export function serializeMindMapDiagramData(data: MindMapDiagramData) {
  return JSON.stringify(normalizeMindMapDiagramData(data), null, 2);
}

function serializeForHtmlScript(data: MindMapDiagramData) {
  return serializeMindMapDiagramData(data).replace(/</g, "\\u003c");
}

export function createMindMapMarkdown(data: MindMapDiagramData) {
  return `\n\`\`\`mindmap\n${serializeMindMapDiagramData(data)}\n\`\`\`\n`;
}

export function createMindMapHtmlEmbed(data: MindMapDiagramData) {
  return [
    '<div class="mindmap-embed" data-mindmap>',
    `<script type="application/json" data-mindmap>${serializeForHtmlScript(data)}</script>`,
    "</div>",
  ].join("\n");
}

export function replaceMindMapMarkdownBlock(
  content: string,
  targetCode: string,
  nextData: MindMapDiagramData,
) {
  let didReplace = false;

  return content.replace(markdownMindMapBlockPattern, (match, code: string) => {
    if (didReplace || code.trim() !== targetCode.trim()) {
      return match;
    }

    didReplace = true;
    return `\`\`\`mindmap\n${serializeMindMapDiagramData(nextData)}\n\`\`\``;
  });
}

export function replaceMindMapHtmlEmbed(
  content: string,
  targetIndex: number,
  nextData: MindMapDiagramData,
) {
  let index = 0;

  return content.replace(htmlMindMapScriptPattern, (match) => {
    if (index !== targetIndex) {
      index += 1;
      return match;
    }

    index += 1;
    return `<script type="application/json" data-mindmap>${serializeForHtmlScript(nextData)}</script>`;
  });
}

function countVisibleLeaves(node: MindMapNodeData): number {
  const children = node.collapsed ? [] : (node.children ?? []);

  if (!children.length) {
    return 1;
  }

  return children.reduce((total, child) => total + countVisibleLeaves(child), 0);
}

function edgeHandles(side: MindMapSide) {
  return side === "left"
    ? {
        sourceHandle: "left-source",
        targetHandle: "right-target",
      }
    : {
        sourceHandle: "right-source",
        targetHandle: "left-target",
      };
}

export function layoutMindMapDiagram(data: MindMapDiagramData): {
  edges: Edge[];
  nodes: Node<MindMapFlowNodeData>[];
} {
  const normalized = normalizeMindMapDiagramData(data);
  const nodes: Node<MindMapFlowNodeData>[] = [];
  const edges: Edge[] = [];

  function pushNode(
    node: MindMapNodeData,
    centerX: number,
    centerY: number,
    level: number,
    side: MindMapSide | "root",
  ) {
    const width = getNodeWidth(level);

    nodes.push({
      data: {
        childCount: node.children?.length ?? 0,
        collapsed: node.collapsed === true,
        level,
        side,
        text: node.text,
      },
      id: node.id,
      position: {
        x: centerX - width / 2,
        y: centerY - nodeHeight / 2,
      },
      type: "mindMapNode",
    });
  }

  function layoutSubtree(
    node: MindMapNodeData,
    parentId: string,
    depth: number,
    side: MindMapSide,
    leafY: number,
  ) {
    const leaves = countVisibleLeaves(node);
    const centerY = leafY + ((leaves - 1) * verticalGap) / 2;
    const centerX = (side === "left" ? -1 : 1) * depth * horizontalGap;

    pushNode(node, centerX, centerY, depth, side);
    edges.push({
      ...edgeHandles(side),
      id: `edge-${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      type: "smoothstep",
    });

    if (!node.collapsed) {
      let nextY = leafY;

      (node.children ?? []).forEach((child) => {
        nextY = layoutSubtree(child, node.id, depth + 1, side, nextY);
      });
    }

    return leafY + leaves * verticalGap;
  }

  pushNode(normalized.root, 0, 0, 0, "root");

  (["left", "right"] as MindMapSide[]).forEach((side) => {
    const children = (normalized.root.children ?? []).filter(
      (child) => (child.side ?? "right") === side,
    );
    const leafCount = children.reduce(
      (total, child) => total + countVisibleLeaves(child),
      0,
    );
    let nextY = -((Math.max(1, leafCount) - 1) * verticalGap) / 2;

    children.forEach((child) => {
      nextY = layoutSubtree(child, normalized.root.id, 1, side, nextY);
    });
  });

  return { edges, nodes };
}

export function findMindMapNode(
  data: MindMapDiagramData,
  nodeId: string,
): { node: MindMapNodeData; parent?: MindMapNodeData } | null {
  function visit(
    node: MindMapNodeData,
    parent?: MindMapNodeData,
  ): { node: MindMapNodeData; parent?: MindMapNodeData } | null {
    if (node.id === nodeId) {
      return { node, parent };
    }

    for (const child of node.children ?? []) {
      const match = visit(child, node);

      if (match) {
        return match;
      }
    }

    return null;
  }

  return visit(data.root);
}

function mapMindMapTree(
  node: MindMapNodeData,
  mapper: (node: MindMapNodeData) => MindMapNodeData,
): MindMapNodeData {
  return mapper({
    ...node,
    children: node.children?.map((child) => mapMindMapTree(child, mapper)),
  });
}

export function updateMindMapNode(
  data: MindMapDiagramData,
  nodeId: string,
  patch: Partial<Pick<MindMapNodeData, "collapsed" | "side" | "text">>,
): MindMapDiagramData {
  return normalizeMindMapDiagramData({
    ...data,
    root: mapMindMapTree(data.root, (node) =>
      node.id === nodeId ? { ...node, ...patch } : node,
    ),
  });
}

export function addMindMapChild(
  data: MindMapDiagramData,
  parentId: string,
  text = "新主题",
): { data: MindMapDiagramData; nodeId: string } {
  const newNode: MindMapNodeData = {
    id: createId(),
    text,
  };
  const parent = findMindMapNode(data, parentId);

  if (parent?.node.id === data.root.id) {
    const children = data.root.children ?? [];
    const rightCount = children.filter((child) => child.side === "right").length;
    const leftCount = children.filter((child) => child.side === "left").length;
    newNode.side = rightCount <= leftCount ? "right" : "left";
  }

  return {
    data: normalizeMindMapDiagramData({
      ...data,
      root: mapMindMapTree(data.root, (node) =>
        node.id === parentId
          ? { ...node, children: [...(node.children ?? []), newNode] }
          : node,
      ),
    }),
    nodeId: newNode.id,
  };
}

export function addMindMapSibling(
  data: MindMapDiagramData,
  nodeId: string,
  text = "新主题",
): { data: MindMapDiagramData; nodeId: string } {
  const match = findMindMapNode(data, nodeId);

  if (!match?.parent) {
    return addMindMapChild(data, data.root.id, text);
  }

  const newNode: MindMapNodeData = {
    id: createId(),
    side: match.node.side,
    text,
  };

  return {
    data: normalizeMindMapDiagramData({
      ...data,
      root: mapMindMapTree(data.root, (node) =>
        node.id === match.parent?.id
          ? { ...node, children: [...(node.children ?? []), newNode] }
          : node,
      ),
    }),
    nodeId: newNode.id,
  };
}

export function deleteMindMapNode(
  data: MindMapDiagramData,
  nodeId: string,
): MindMapDiagramData {
  if (nodeId === data.root.id) {
    return data;
  }

  return normalizeMindMapDiagramData({
    ...data,
    root: mapMindMapTree(data.root, (node) => ({
      ...node,
      children: node.children?.filter((child) => child.id !== nodeId),
    })),
  });
}
