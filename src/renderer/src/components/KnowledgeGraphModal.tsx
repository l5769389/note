import "@xyflow/react/dist/style.css";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node as FlowNode,
  type NodeProps,
} from "@xyflow/react";
import { BookOpenText, FileText, Link2, Network, X } from "lucide-react";
import { useMemo } from "react";
import { getDocumentDisplayName } from "../documentModel";
import type { MarkdownDocument } from "../types";
import { getDocumentTypeName } from "../workspaceDisplay";
import type { WorkspaceRelationItem } from "./KnowledgeRelationsPanel";

type KnowledgeGraphModalProps = {
  items: WorkspaceRelationItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenDocument: (document: MarkdownDocument) => void;
};

type KnowledgeGraphNodeData = Record<string, unknown> & {
  documentType: string;
  path?: string;
  relationCount: number;
  title: string;
};

type KnowledgeGraphFlowNode = FlowNode<
  KnowledgeGraphNodeData,
  "knowledgeDocument"
>;

type KnowledgeGraphPair = {
  contentCount: number;
  count: number;
  documentCount: number;
  id: string;
  sourceDocument: MarkdownDocument;
  targetDocument: MarkdownDocument;
};

const nodeTypes = {
  knowledgeDocument: KnowledgeGraphDocumentNode,
};

function getNodePosition(index: number, count: number) {
  if (count <= 1 || index === 0) {
    return { x: 0, y: 0 };
  }

  const ringIndex = Math.floor((index - 1) / 10);
  const ringPosition = (index - 1) % 10;
  const ringCount = Math.min(10, count - 1 - ringIndex * 10);
  const angle = (Math.PI * 2 * ringPosition) / ringCount - Math.PI / 2;
  const radiusX = 320 + ringIndex * 210;
  const radiusY = 210 + ringIndex * 150;

  return {
    x: Math.round(Math.cos(angle) * radiusX),
    y: Math.round(Math.sin(angle) * radiusY),
  };
}

function KnowledgeGraphDocumentNode({
  data,
}: NodeProps<KnowledgeGraphFlowNode>) {
  return (
    <div className="knowledge-graph-node" title={data.path}>
      <Handle
        className="knowledge-graph-handle"
        type="target"
        position={Position.Left}
      />
      <span className="knowledge-graph-node-icon" aria-hidden="true">
        <FileText size={16} />
      </span>
      <span className="knowledge-graph-node-main">
        <strong>{data.title}</strong>
        <small>{data.documentType}</small>
      </span>
      <em>{data.relationCount}</em>
      <Handle
        className="knowledge-graph-handle"
        type="source"
        position={Position.Right}
      />
    </div>
  );
}

function createRelationPairs(items: WorkspaceRelationItem[]) {
  const documentsById = new Map<string, MarkdownDocument>();
  const degrees = new Map<string, number>();
  const pairsById = new Map<string, KnowledgeGraphPair>();

  items.forEach((item) => {
    if (item.status !== "linked" || !item.targetDocument) {
      return;
    }

    documentsById.set(item.sourceDocument.id, item.sourceDocument);
    documentsById.set(item.targetDocument.id, item.targetDocument);
    degrees.set(item.sourceDocument.id, (degrees.get(item.sourceDocument.id) ?? 0) + 1);
    degrees.set(item.targetDocument.id, (degrees.get(item.targetDocument.id) ?? 0) + 1);

    const pairId = `${item.sourceDocument.id}->${item.targetDocument.id}`;
    const existing = pairsById.get(pairId);

    if (existing) {
      existing.count += 1;
      if (item.kind === "document") {
        existing.documentCount += 1;
      } else {
        existing.contentCount += 1;
      }
      return;
    }

    pairsById.set(pairId, {
      contentCount: item.kind === "content" ? 1 : 0,
      count: 1,
      documentCount: item.kind === "document" ? 1 : 0,
      id: pairId,
      sourceDocument: item.sourceDocument,
      targetDocument: item.targetDocument,
    });
  });

  return { degrees, documentsById, pairs: Array.from(pairsById.values()) };
}

function createGraph(items: WorkspaceRelationItem[]) {
  const { degrees, documentsById, pairs } = createRelationPairs(items);
  const documents = Array.from(documentsById.values()).sort((left, right) => {
    const degreeOrder = (degrees.get(right.id) ?? 0) - (degrees.get(left.id) ?? 0);

    if (degreeOrder !== 0) {
      return degreeOrder;
    }

    return getDocumentDisplayName(left).localeCompare(
      getDocumentDisplayName(right),
      "zh-CN",
      { numeric: true },
    );
  });

  const nodes: KnowledgeGraphFlowNode[] = documents.map((document, index) => ({
    data: {
      documentType: getDocumentTypeName(document.documentType),
      path: document.filePath,
      relationCount: degrees.get(document.id) ?? 0,
      title: getDocumentDisplayName(document),
    },
    id: document.id,
    position: getNodePosition(index, documents.length),
    type: "knowledgeDocument",
  }));

  const edges: Edge[] = pairs.map((pair) => {
    const isDocumentRelation = pair.documentCount > 0;
    const color = isDocumentRelation ? "#6366f1" : "#14b8a6";
    const label =
      pair.count > 1
        ? `${pair.count} 条`
        : isDocumentRelation
          ? "相关文档"
          : "正文引用";

    return {
      animated: false,
      id: pair.id,
      label,
      labelBgBorderRadius: 10,
      labelBgPadding: [8, 4],
      labelStyle: {
        fill: color,
        fontSize: 12,
        fontWeight: 800,
      },
      markerEnd: {
        color,
        type: MarkerType.ArrowClosed,
      },
      source: pair.sourceDocument.id,
      style: {
        stroke: color,
        strokeWidth: pair.count > 1 ? 2.4 : 1.8,
      },
      target: pair.targetDocument.id,
      type: "smoothstep",
    };
  });

  return {
    documentsById,
    edges,
    nodes,
    pairs,
  };
}

export function KnowledgeGraphModal({
  items,
  open,
  onOpenChange,
  onOpenDocument,
}: KnowledgeGraphModalProps) {
  const graph = useMemo(() => createGraph(items), [items]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay knowledge-graph-overlay" />
        <Dialog.Content className="knowledge-graph-dialog">
          <header className="knowledge-graph-header">
            <div>
              <span className="knowledge-graph-title-icon">
                <Network size={18} />
              </span>
              <div>
                <Dialog.Title className="knowledge-graph-title">
                  知识关系
                </Dialog.Title>
                <Dialog.Description className="knowledge-graph-description">
                  查看当前工作区里已经建立关系的文档，双击节点可直接打开。
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" type="button" aria-label="关闭知识关系">
                <X size={16} />
              </button>
            </Dialog.Close>
          </header>

          <div className="knowledge-graph-stats">
            <span>
              <strong>{graph.nodes.length}</strong>
              份文档
            </span>
            <span>
              <strong>{graph.pairs.length}</strong>
              组连接
            </span>
            <span>
              <strong>{items.filter((item) => item.status === "linked").length}</strong>
              条关系
            </span>
          </div>

          <div className="knowledge-graph-body">
            <aside className="knowledge-graph-list" aria-label="关系列表">
              {graph.pairs.length ? (
                graph.pairs.map((pair) => (
                  <article className="knowledge-graph-relation" key={pair.id}>
                    <button
                      type="button"
                      title={pair.sourceDocument.filePath}
                      onClick={() => onOpenDocument(pair.sourceDocument)}
                    >
                      <FileText size={14} />
                      <span>{getDocumentDisplayName(pair.sourceDocument)}</span>
                    </button>
                    <Link2 size={14} />
                    <button
                      type="button"
                      title={pair.targetDocument.filePath}
                      onClick={() => onOpenDocument(pair.targetDocument)}
                    >
                      <BookOpenText size={14} />
                      <span>{getDocumentDisplayName(pair.targetDocument)}</span>
                    </button>
                    <small>
                      {pair.documentCount ? `${pair.documentCount} 条相关文档` : ""}
                      {pair.documentCount && pair.contentCount ? " · " : ""}
                      {pair.contentCount ? `${pair.contentCount} 条正文引用` : ""}
                    </small>
                  </article>
                ))
              ) : (
                <div className="knowledge-graph-empty">
                  <Network size={26} />
                  <strong>还没有知识关系</strong>
                  <span>在文档元信息里添加相关文档，或在正文中使用笔记链接后，这里会显示关系图。</span>
                </div>
              )}
            </aside>

            <div className="knowledge-graph-canvas">
              {graph.nodes.length ? (
                <ReactFlow
                  nodes={graph.nodes}
                  edges={graph.edges}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.24 }}
                  minZoom={0.2}
                  maxZoom={1.8}
                  nodesConnectable={false}
                  nodesDraggable={false}
                  elementsSelectable
                  onNodeDoubleClick={(_, node) => {
                    const document = graph.documentsById.get(node.id);

                    if (document) {
                      onOpenDocument(document);
                    }
                  }}
                >
                  <Background gap={22} size={1} />
                  <Controls showInteractive={false} />
                  <MiniMap pannable={false} zoomable={false} />
                </ReactFlow>
              ) : (
                <div className="knowledge-graph-canvas-empty" />
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
