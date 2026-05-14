import "@xyflow/react/dist/style.css";

import { Edit3 } from "lucide-react";
import { useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  type Node,
  ReactFlow,
  type NodeProps,
} from "@xyflow/react";
import {
  layoutMindMapDiagram,
  parseMindMapDiagramData,
  type MindMapDiagramData,
  type MindMapFlowNodeData,
} from "../mindMapDocument";
import { MindMapNodeCard } from "./MindMapNodeCard";

type MindMapDiagramProps = {
  code: string;
  onEdit?: (code: string) => void;
};

const nodeTypes = {
  mindMapNode: (props: NodeProps<Node<MindMapFlowNodeData>>) => (
    <MindMapNodeCard {...props} />
  ),
};

function createDisplayData(data: MindMapDiagramData) {
  const layout = layoutMindMapDiagram(data);

  return {
    edges: layout.edges.map((edge) => ({
      ...edge,
      className: "mindmap-edge",
      selectable: false,
    })),
    nodes: layout.nodes.map((node) => ({
      ...node,
      draggable: false,
      selectable: false,
    })),
  };
}

export function MindMapDiagram({ code, onEdit }: MindMapDiagramProps) {
  const parsed = useMemo<
    | { data: ReturnType<typeof createDisplayData>; status: "ready" }
    | { message: string; status: "error" }
  >(() => {
    try {
      return {
        data: createDisplayData(parseMindMapDiagramData(code)),
        status: "ready",
      };
    } catch (error) {
      return {
        message: error instanceof Error ? error.message : "Mind map render failed",
        status: "error",
      };
    }
  }, [code]);

  if (parsed.status === "error") {
    return (
      <figure className="mindmap-diagram mindmap-diagram-error">
        <figcaption>Mind map error</figcaption>
        <pre>{parsed.message}</pre>
      </figure>
    );
  }

  return (
    <figure className="mindmap-diagram">
      {onEdit ? (
        <button
          className="mindmap-diagram-edit"
          type="button"
          onClick={() => onEdit(code)}
        >
          <Edit3 size={14} />
          编辑
        </button>
      ) : null}
      <ReactFlow
        nodes={parsed.data.nodes}
        edges={parsed.data.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.24 }}
        minZoom={0.25}
        maxZoom={1.9}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={false}
      >
        <Background gap={18} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable={false} zoomable={false} />
      </ReactFlow>
    </figure>
  );
}
