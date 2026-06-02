import { Check, GripVertical, Trash2 } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { HomeImageAttachment, HomeTodoItem } from "./homeModel";

type HomeTodoRowProps = {
  item: HomeTodoItem;
  onDelete: (todoId: string) => void;
  onDragStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    todoId: string,
  ) => void;
  onPreviewImage: (image: HomeImageAttachment) => void;
  onToggle: (todoId: string) => void;
  rowRef: (todoId: string, node: HTMLDivElement | null) => void;
};

export function HomeTodoRow({
  item,
  onDelete,
  onDragStart,
  onPreviewImage,
  onToggle,
  rowRef,
}: HomeTodoRowProps) {
  return (
    <div
      className={
        [
          "home-todo-item",
          item.done ? "home-todo-item-done" : "",
        ]
          .filter(Boolean)
          .join(" ")
      }
      ref={(node) => rowRef(item.id, node)}
    >
      <button
        className="home-todo-check"
        type="button"
        aria-label={item.done ? "标记为未完成" : "标记为已完成"}
        aria-pressed={item.done}
        onClick={() => onToggle(item.id)}
      >
        {item.done ? <Check size={14} /> : null}
      </button>
      <div className="home-todo-item-content">
        <span>{item.text}</span>
        {item.images?.length ? (
          <div className="home-inline-image-strip" aria-label="待办图片">
            {item.images.map((image) => (
              <button
                className="home-inline-image-preview"
                type="button"
                aria-label={`浏览图片 ${image.fileName}`}
                key={image.id}
                onClick={() => onPreviewImage(image)}
              >
                <img
                  alt={image.fileName}
                  src={image.dataUrl}
                  draggable={false}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        className="home-todo-delete"
        type="button"
        aria-label="删除待办"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 size={14} />
      </button>
      <button
        className="home-todo-drag-handle"
        type="button"
        aria-label="拖拽排序"
        title="拖拽排序"
        onPointerDown={(event) => onDragStart(event, item.id)}
      >
        <GripVertical size={15} />
      </button>
    </div>
  );
}

export function HomeTodoDropSlot() {
  return (
    <div className="home-todo-drop-slot-row" aria-hidden="true">
      <span />
      <span />
    </div>
  );
}

export function HomeTodoDragPreview({ item }: { item: HomeTodoItem }) {
  return (
    <div
      className={[
        "home-todo-item",
        "home-todo-item-preview",
        item.done ? "home-todo-item-done" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="home-todo-check" aria-hidden="true">
        {item.done ? <Check size={14} /> : null}
      </span>
      <div className="home-todo-item-content">
        <span>{item.text}</span>
        {item.images?.length ? (
          <div className="home-inline-image-strip" aria-hidden="true">
            {item.images.map((image) => (
              <img
                alt=""
                key={image.id}
                src={image.dataUrl}
                draggable={false}
              />
            ))}
          </div>
        ) : null}
      </div>
      <span className="home-todo-delete" aria-hidden="true" />
      <span className="home-todo-drag-handle" aria-hidden="true">
        <GripVertical size={15} />
      </span>
    </div>
  );
}
