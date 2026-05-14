import "@xyflow/react/dist/style.css";

import { Check, GitBranchPlus, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  addMindMapChild,
  addMindMapSibling,
  createDefaultMindMapDiagram,
  deleteMindMapNode,
  findMindMapNode,
  layoutMindMapDiagram,
  updateMindMapNode,
  type MindMapDiagramData,
  type MindMapFlowNodeData,
  type MindMapSide,
} from "../mindMapDocument";
import { MindMapNodeCard } from "./MindMapNodeCard";

type MindMapModalProps = {
  initialData?: MindMapDiagramData;
  onClose: () => void;
  onSave: (data: MindMapDiagramData) => void;
};

const nodeTypes = {
  mindMapNode: (props: NodeProps<Node<MindMapFlowNodeData>>) => (
    <MindMapNodeCard {...props} />
  ),
};

export function MindMapModal({ initialData, onClose, onSave }: MindMapModalProps) {
  const [data, setData] = useState<MindMapDiagramData>(
    initialData ?? createDefaultMindMapDiagram(),
  );
  const [selectedNodeId, setSelectedNodeId] = useState(data.root.id);
  const selectedMatch = findMindMapNode(data, selectedNodeId);
  const selectedNode = selectedMatch?.node ?? data.root;
  const canChangeSide = selectedMatch?.parent?.id === data.root.id;
  const canDelete = selectedNode.id !== data.root.id;
  const canToggle = Boolean(selectedNode.children?.length);
  const flowData = useMemo(() => {
    const layout = layoutMindMapDiagram(data);

    return {
      edges: layout.edges.map((edge) => ({
        ...edge,
        className: "mindmap-edge",
      })),
      nodes: layout.nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNode.id,
      })),
    };
  }, [data, selectedNode.id]);

  function updateSelectedText(text: string) {
    setData((current) => updateMindMapNode(current, selectedNode.id, { text }));
  }

  function updateSelectedSide(side: MindMapSide) {
    setData((current) => updateMindMapNode(current, selectedNode.id, { side }));
  }

  function addChild() {
    setData((current) => {
      const next = addMindMapChild(current, selectedNode.id);
      setSelectedNodeId(next.nodeId);
      return next.data;
    });
  }

  function addSibling() {
    setData((current) => {
      const next = addMindMapSibling(current, selectedNode.id);
      setSelectedNodeId(next.nodeId);
      return next.data;
    });
  }

  function deleteSelected() {
    if (!canDelete) {
      return;
    }

    const nextSelectedId = selectedMatch?.parent?.id ?? data.root.id;
    setData((current) => deleteMindMapNode(current, selectedNode.id));
    setSelectedNodeId(nextSelectedId);
  }

  function toggleCollapsed() {
    if (!canToggle) {
      return;
    }

    setData((current) =>
      updateMindMapNode(current, selectedNode.id, {
        collapsed: selectedNode.collapsed !== true,
      }),
    );
  }

  function saveMindMap() {
    onSave(data);
    onClose();
  }

  return (
    <section className="mindmap-modal">
      <header className="drawing-toolbar">
        <strong>思维导图</strong>
        <div>
          <button className="secondary-button" type="button" onClick={onClose}>
            <X size={16} />
            关闭
          </button>
          <button className="primary-button" type="button" onClick={saveMindMap}>
            <Check size={16} />
            保存
          </button>
        </div>
      </header>
      <div className="mindmap-editor-shell">
        <aside className="mindmap-editor-panel">
          <div className="mindmap-editor-actions">
            <button className="secondary-button" type="button" onClick={addChild}>
              <Plus size={16} />
              子主题
            </button>
            <button className="secondary-button" type="button" onClick={addSibling}>
              <GitBranchPlus size={16} />
              同级主题
            </button>
          </div>
          <label>
            <span>主题文本</span>
            <input
              value={selectedNode.text}
              onChange={(event) => updateSelectedText(event.target.value)}
            />
          </label>
          <label>
            <span>分支方向</span>
            <select
              value={selectedNode.side ?? "right"}
              disabled={!canChangeSide}
              onChange={(event) => updateSelectedSide(event.target.value as MindMapSide)}
            >
              <option value="right">右侧</option>
              <option value="left">左侧</option>
            </select>
          </label>
          <button
            className="secondary-button"
            type="button"
            disabled={!canToggle}
            onClick={toggleCollapsed}
          >
            {selectedNode.collapsed ? "展开子主题" : "折叠子主题"}
          </button>
          <button
            className="secondary-button danger-button"
            type="button"
            disabled={!canDelete}
            onClick={deleteSelected}
          >
            <Trash2 size={16} />
            删除主题
          </button>
          <p className="mindmap-editor-hint">
            在画布中点击主题后编辑文本；保存后会写入 mindmap 代码块。
          </p>
        </aside>
        <div className="mindmap-editor-canvas">
          <ReactFlow
            nodes={flowData.nodes}
            edges={flowData.edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
            fitViewOptions={{ padding: 0.24 }}
            nodesConnectable={false}
            nodesDraggable={false}
            defaultEdgeOptions={{ type: "smoothstep" }}
          >
            <Background gap={18} size={1} />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </section>
  );
}
