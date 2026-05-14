import "@xyflow/react/dist/style.css";

import { Edit3 } from "lucide-react";
import { useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  parseReactFlowDiagramData,
  type ReactFlowDiagramData,
  type ReactFlowNodeData,
} from "../reactFlowDocument";

type ReactFlowDiagramProps = {
  code: string;
  onEdit?: (code: string) => void;
};

function getNodeLabel(node: Node<ReactFlowNodeData>) {
  return typeof node.data?.label === "string" ? node.data.label : node.id;
}

function createDisplayNodes(nodes: Node<ReactFlowNodeData>[]) {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      label: getNodeLabel(node),
    },
    draggable: false,
    selectable: false,
  }));
}

function createDisplayEdges(edges: Edge[]) {
  return edges.map((edge) => ({
    ...edge,
    selectable: false,
    type: edge.type ?? "smoothstep",
  }));
}

export function ReactFlowDiagram({ code, onEdit }: ReactFlowDiagramProps) {
  const parsed = useMemo<
    | { data: ReactFlowDiagramData; status: "ready" }
    | { message: string; status: "error" }
  >(() => {
    try {
      return { data: parseReactFlowDiagramData(code), status: "ready" };
    } catch (error) {
      return {
        message: error instanceof Error ? error.message : "React Flow render failed",
        status: "error",
      };
    }
  }, [code]);

  if (parsed.status === "error") {
    return (
      <figure className="react-flow-diagram react-flow-diagram-error">
        <figcaption>React Flow diagram error</figcaption>
        <pre>{parsed.message}</pre>
      </figure>
    );
  }

  return (
    <figure className="react-flow-diagram">
      {onEdit ? (
        <button
          className="react-flow-diagram-edit"
          type="button"
          onClick={() => onEdit(code)}
        >
          <Edit3 size={14} />
          编辑
        </button>
      ) : null}
      <ReactFlow
        nodes={createDisplayNodes(parsed.data.nodes)}
        edges={createDisplayEdges(parsed.data.edges)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.25}
        maxZoom={1.8}
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
