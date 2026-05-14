import "@xyflow/react/dist/style.css";

import { Check, Plus, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import {
  createDefaultReactFlowDiagram,
  type ReactFlowDiagramData,
  type ReactFlowNodeData,
} from "../reactFlowDocument";

type ReactFlowModalProps = {
  initialData?: ReactFlowDiagramData;
  onClose: () => void;
  onSave: (data: ReactFlowDiagramData) => void;
};

function createNode(label: string, index: number): Node<ReactFlowNodeData> {
  return {
    data: { label },
    id: `node-${crypto.randomUUID()}`,
    position: {
      x: 120 + (index % 3) * 210,
      y: 90 + Math.floor(index / 3) * 120,
    },
    type: "default",
  };
}

export function ReactFlowModal({
  initialData,
  onClose,
  onSave,
}: ReactFlowModalProps) {
  const fallbackData = useMemo(() => createDefaultReactFlowDiagram(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ReactFlowNodeData>>(
    initialData?.nodes ?? fallbackData.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialData?.edges ?? fallbackData.edges,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    nodes[0]?.id ?? null,
  );
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedNodeLabel =
    typeof selectedNode?.data.label === "string" ? selectedNode.data.label : "";

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((currentEdges) =>
        addEdge({ ...connection, type: "smoothstep" }, currentEdges),
      ),
    [setEdges],
  );

  function addNode() {
    const nextNode = createNode(`Node ${nodes.length + 1}`, nodes.length);
    setNodes((currentNodes) => [...currentNodes, nextNode]);
    setSelectedNodeId(nextNode.id);
  }

  function deleteSelectedNode() {
    if (!selectedNodeId || nodes.length <= 1) {
      return;
    }

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNodeId));
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId,
      ),
    );
    setSelectedNodeId(nodes.find((node) => node.id !== selectedNodeId)?.id ?? null);
  }

  function updateSelectedNodeLabel(label: string) {
    if (!selectedNodeId) {
      return;
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                label,
              },
            }
          : node,
      ),
    );
  }

  function saveFlow() {
    onSave({
      edges: edges.map((edge): Edge => ({
        ...edge,
        selected: false,
      })),
      nodes: nodes.map((node): Node<ReactFlowNodeData> => ({
        ...node,
        data: {
          ...node.data,
          label:
            typeof node.data.label === "string" && node.data.label.trim()
              ? node.data.label.trim()
              : node.id,
        },
        selected: false,
      })),
      version: 1,
    });
    onClose();
  }

  return (
    <section className="react-flow-modal">
      <header className="drawing-toolbar">
        <strong>React Flow 图</strong>
        <div>
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} />
            关闭
          </button>
          <button className="primary-button" type="button" onClick={saveFlow}>
            <Check size={16} />
            保存
          </button>
        </div>
      </header>
      <div className="react-flow-editor-shell">
        <aside className="react-flow-editor-panel">
          <button className="secondary-button" type="button" onClick={addNode}>
            <Plus size={16} />
            添加节点
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={!selectedNode || nodes.length <= 1}
            onClick={deleteSelectedNode}
          >
            <Trash2 size={16} />
            删除节点
          </button>
          <label>
            <span>节点标题</span>
            <input
              value={selectedNodeLabel}
              disabled={!selectedNode}
              onChange={(event) => updateSelectedNodeLabel(event.target.value)}
            />
          </label>
        </aside>
        <div className="react-flow-editor-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
            fitViewOptions={{ padding: 0.22 }}
            defaultEdgeOptions={{ type: "smoothstep" }}
          >
            <Background gap={18} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>
    </section>
  );
}
