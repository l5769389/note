import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { MindMapFlowNodeData } from "../mindMapDocument";

export function MindMapNodeCard({
  data,
  selected,
}: NodeProps<Node<MindMapFlowNodeData>>) {
  return (
    <div
      className={[
        "mindmap-node",
        data.level === 0 ? "mindmap-node-root" : "mindmap-node-branch",
        data.side === "left" ? "mindmap-node-left" : "",
        selected ? "mindmap-node-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Handle
        className="mindmap-handle"
        id="left-target"
        type="target"
        position={Position.Left}
      />
      <Handle
        className="mindmap-handle"
        id="right-target"
        type="target"
        position={Position.Right}
      />
      <span>{data.text}</span>
      {data.childCount > 0 ? (
        <small>{data.collapsed ? `+${data.childCount}` : data.childCount}</small>
      ) : null}
      <Handle
        className="mindmap-handle"
        id="left-source"
        type="source"
        position={Position.Left}
      />
      <Handle
        className="mindmap-handle"
        id="right-source"
        type="source"
        position={Position.Right}
      />
    </div>
  );
}
