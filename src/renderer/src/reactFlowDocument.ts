import type { Edge, Node, Viewport } from "@xyflow/react";

export type ReactFlowNodeData = {
  label?: string;
  [key: string]: unknown;
};

export type ReactFlowDiagramData = {
  edges: Edge[];
  nodes: Node<ReactFlowNodeData>[];
  version: 1;
  viewport?: Viewport;
};

export type ReactFlowEditTarget =
  | { kind: "insert" }
  | { code: string; kind: "markdown" }
  | { index: number; kind: "html" };

const reactFlowLanguagePattern = /^(?:react-flow|reactflow)$/i;
const markdownReactFlowBlockPattern =
  /```(?:react-flow|reactflow)\s*\n([\s\S]*?)\n```/gi;
const htmlReactFlowScriptPattern =
  /<script\b(?=[^>]*\bdata-react-flow\b)[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;

export function isReactFlowLanguage(language: string) {
  return reactFlowLanguagePattern.test(language.trim());
}

function createNode(
  id: string,
  label: string,
  position: { x: number; y: number },
): Node<ReactFlowNodeData> {
  return {
    data: { label },
    id,
    position,
    type: "default",
  };
}

export function createDefaultReactFlowDiagram(): ReactFlowDiagramData {
  return {
    edges: [
      {
        id: "edge-start-plan",
        source: "start",
        target: "plan",
        type: "smoothstep",
      },
      {
        id: "edge-plan-ship",
        source: "plan",
        target: "ship",
        type: "smoothstep",
      },
    ],
    nodes: [
      createNode("start", "Start", { x: 0, y: 80 }),
      createNode("plan", "Plan", { x: 230, y: 0 }),
      createNode("ship", "Ship", { x: 460, y: 80 }),
    ],
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function normalizeNode(node: unknown, index: number): Node<ReactFlowNodeData> | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  const record = node as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim()
    ? record.id
    : `node-${index + 1}`;
  const positionRecord =
    record.position && typeof record.position === "object"
      ? (record.position as Record<string, unknown>)
      : {};
  const dataRecord =
    record.data && typeof record.data === "object"
      ? (record.data as ReactFlowNodeData)
      : {};

  return {
    ...record,
    data: {
      ...dataRecord,
      label:
        typeof dataRecord.label === "string" && dataRecord.label.trim()
          ? dataRecord.label
          : id,
    },
    id,
    position: {
      x: typeof positionRecord.x === "number" ? positionRecord.x : index * 180,
      y: typeof positionRecord.y === "number" ? positionRecord.y : 0,
    },
    type: typeof record.type === "string" ? record.type : "default",
  } as Node<ReactFlowNodeData>;
}

function normalizeEdge(edge: unknown, index: number): Edge | null {
  if (!edge || typeof edge !== "object") {
    return null;
  }

  const record = edge as Record<string, unknown>;

  if (typeof record.source !== "string" || typeof record.target !== "string") {
    return null;
  }

  return {
    ...record,
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id
        : `edge-${index + 1}`,
    source: record.source,
    target: record.target,
    type: typeof record.type === "string" ? record.type : "smoothstep",
  } as Edge;
}

export function parseReactFlowDiagramData(source: string): ReactFlowDiagramData {
  const parsed = JSON.parse(source) as unknown;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("React Flow data must be a JSON object.");
  }

  const record = parsed as Record<string, unknown>;
  const nodes = Array.isArray(record.nodes)
    ? record.nodes
        .map((node, index) => normalizeNode(node, index))
        .filter((node): node is Node<ReactFlowNodeData> => Boolean(node))
    : [];
  const edges = Array.isArray(record.edges)
    ? record.edges
        .map((edge, index) => normalizeEdge(edge, index))
        .filter((edge): edge is Edge => Boolean(edge))
    : [];

  if (!nodes.length) {
    throw new Error("React Flow data must contain at least one node.");
  }

  return {
    edges,
    nodes,
    version: 1,
    viewport:
      record.viewport && typeof record.viewport === "object"
        ? (record.viewport as Viewport)
        : undefined,
  };
}

export function serializeReactFlowDiagramData(data: ReactFlowDiagramData) {
  return JSON.stringify(
    {
      version: 1,
      nodes: data.nodes,
      edges: data.edges,
      viewport: data.viewport,
    },
    null,
    2,
  );
}

export function createReactFlowMarkdown(data: ReactFlowDiagramData) {
  return `\n\`\`\`react-flow\n${serializeReactFlowDiagramData(data)}\n\`\`\`\n`;
}

export function createReactFlowHtmlEmbed(data: ReactFlowDiagramData) {
  return [
    '<div class="react-flow-embed" data-react-flow>',
    `<script type="application/json" data-react-flow>${serializeReactFlowDiagramData(data)}</script>`,
    "</div>",
  ].join("\n");
}

export function replaceReactFlowMarkdownBlock(
  content: string,
  targetCode: string,
  nextData: ReactFlowDiagramData,
) {
  let didReplace = false;

  return content.replace(markdownReactFlowBlockPattern, (match, code: string) => {
    if (didReplace || code.trim() !== targetCode.trim()) {
      return match;
    }

    didReplace = true;
    return `\`\`\`react-flow\n${serializeReactFlowDiagramData(nextData)}\n\`\`\``;
  });
}

export function replaceReactFlowHtmlEmbed(
  content: string,
  targetIndex: number,
  nextData: ReactFlowDiagramData,
) {
  let index = 0;

  return content.replace(htmlReactFlowScriptPattern, (match) => {
    if (index !== targetIndex) {
      index += 1;
      return match;
    }

    index += 1;
    return `<script type="application/json" data-react-flow>${serializeReactFlowDiagramData(nextData)}</script>`;
  });
}

export function hasReactFlowHtmlEmbed(content: string) {
  return htmlReactFlowScriptPattern.test(content);
}
