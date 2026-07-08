import {
  Minus,
  Plus,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  defaultImagePreviewTransform,
  translateImagePreview,
  zoomImagePreviewAtPoint,
  zoomImagePreviewFromGesture,
  type ImagePreviewPoint,
  type ImagePreviewTransform,
} from "../imagePreviewTransform";

type PointerSnapshot = ImagePreviewPoint & {
  pointerId: number;
};

type PreviewInteraction =
  | {
      moved: boolean;
      pointerId: number;
      startPoint: ImagePreviewPoint;
      startTransform: ImagePreviewTransform;
      type: "pan";
    }
  | {
      startCenter: ImagePreviewPoint;
      startDistance: number;
      startTransform: ImagePreviewTransform;
      type: "pinch";
    };

function getPointerDistance(first: PointerSnapshot, second: PointerSnapshot) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function getPointerCenter(first: PointerSnapshot, second: PointerSnapshot) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function getViewportCenter(viewport: HTMLElement) {
  const rect = viewport.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function ZoomableImagePreview({
  alt,
  classNamePrefix,
  onRequestClose,
  src,
}: {
  alt: string;
  classNamePrefix: "document-image-preview" | "home-image-preview";
  onRequestClose?: () => void;
  src: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef(new Map<number, PointerSnapshot>());
  const interactionRef = useRef<PreviewInteraction | null>(null);
  const transformRef = useRef<ImagePreviewTransform>(defaultImagePreviewTransform);
  const [transform, setTransform] = useState(defaultImagePreviewTransform);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    pointersRef.current.clear();
    interactionRef.current = null;
    setTransform(defaultImagePreviewTransform);
  }, [src]);

  function resetTransform() {
    pointersRef.current.clear();
    interactionRef.current = null;
    setTransform(defaultImagePreviewTransform);
  }

  function zoomAtPoint(point: ImagePreviewPoint, ratio: number) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();

    setTransform((current) =>
      zoomImagePreviewAtPoint(current, current.scale * ratio, point, rect),
    );
  }

  function zoomFromButton(ratio: number) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    zoomAtPoint(getViewportCenter(viewport), ratio);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoomAtPoint(
      {
        x: event.clientX,
        y: event.clientY,
      },
      event.deltaY < 0 ? 1.1 : 0.9,
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });

    const pointers = Array.from(pointersRef.current.values());

    if (pointers.length >= 2) {
      const [first, second] = pointers;

      interactionRef.current = {
        startCenter: getPointerCenter(first, second),
        startDistance: Math.max(1, getPointerDistance(first, second)),
        startTransform: transformRef.current,
        type: "pinch",
      };
      return;
    }

    interactionRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startPoint: {
        x: event.clientX,
        y: event.clientY,
      },
      startTransform: transformRef.current,
      type: "pan",
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    const currentPointer = pointersRef.current.get(event.pointerId);

    if (!viewport || !currentPointer) {
      return;
    }

    event.preventDefault();
    pointersRef.current.set(event.pointerId, {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });

    const interaction = interactionRef.current;

    if (!interaction) {
      return;
    }

    if (interaction.type === "pinch") {
      const pointers = Array.from(pointersRef.current.values());

      if (pointers.length < 2) {
        return;
      }

      const [first, second] = pointers;
      const distance = Math.max(1, getPointerDistance(first, second));
      const center = getPointerCenter(first, second);
      const rect = viewport.getBoundingClientRect();

      setTransform(
        zoomImagePreviewFromGesture(
          interaction.startTransform,
          interaction.startTransform.scale * (distance / interaction.startDistance),
          interaction.startCenter,
          center,
          rect,
        ),
      );
      return;
    }

    if (interaction.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - interaction.startPoint.x;
    const deltaY = event.clientY - interaction.startPoint.y;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      interaction.moved = true;
    }

    setTransform(
      translateImagePreview(interaction.startTransform, deltaX, deltaY),
    );
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current;
    const shouldClose =
      interaction?.type === "pan" &&
      !interaction.moved &&
      event.target === event.currentTarget &&
      onRequestClose;

    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 1) {
      const [remainingPointer] = Array.from(pointersRef.current.values());

      interactionRef.current = {
        moved: false,
        pointerId: remainingPointer.pointerId,
        startPoint: {
          x: remainingPointer.x,
          y: remainingPointer.y,
        },
        startTransform: transformRef.current,
        type: "pan",
      };
    } else if (pointersRef.current.size === 0) {
      interactionRef.current = null;
    }

    if (shouldClose) {
      onRequestClose();
    }
  }

  return (
    <>
      <div
        ref={viewportRef}
        className={`${classNamePrefix}-viewport`}
        onDoubleClick={resetTransform}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onWheel={handleWheel}
      >
        <img
          alt={alt}
          draggable={false}
          src={src}
          style={{
            transform: `translate3d(${transform.offsetX}px, ${transform.offsetY}px, 0) scale(${transform.scale})`,
          }}
        />
      </div>
      <div className={`${classNamePrefix}-toolbar`} aria-label="图片缩放">
        <button
          type="button"
          aria-label="缩小图片"
          onClick={() => zoomFromButton(0.9)}
        >
          <Minus size={16} />
        </button>
        <button
          className={`${classNamePrefix}-zoom-value`}
          type="button"
          onClick={resetTransform}
        >
          {Math.round(transform.scale * 100)}%
        </button>
        <button
          type="button"
          aria-label="放大图片"
          onClick={() => zoomFromButton(1.1)}
        >
          <Plus size={16} />
        </button>
      </div>
    </>
  );
}
