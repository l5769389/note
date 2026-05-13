import { useEffect, useId, useMemo, useState } from "react";
import { createMermaidRenderId, renderMermaidSvg } from "../mermaid";

type MermaidDiagramProps = {
  className?: string;
  code: string;
};

type MermaidRenderState =
  | { status: "error"; message: string }
  | { status: "loading" }
  | { status: "ready"; svg: string };

export function MermaidDiagram({ className, code }: MermaidDiagramProps) {
  const reactId = useId();
  const renderId = useMemo(
    () => createMermaidRenderId(`mermaid-${reactId}`, code),
    [code, reactId],
  );
  const [renderState, setRenderState] = useState<MermaidRenderState>({
    status: "loading",
  });

  useEffect(() => {
    let isCancelled = false;

    setRenderState({ status: "loading" });
    renderMermaidSvg(renderId, code)
      .then((svg) => {
        if (!isCancelled) {
          setRenderState({ status: "ready", svg });
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          const message = error instanceof Error ? error.message : "Mermaid render failed";
          setRenderState({ status: "error", message });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [code, renderId]);

  const diagramClassName = ["mermaid-diagram", className].filter(Boolean).join(" ");

  if (renderState.status === "error") {
    return (
      <figure className={`${diagramClassName} mermaid-diagram-error`}>
        <figcaption>Mermaid diagram error</figcaption>
        <pre>{renderState.message}</pre>
      </figure>
    );
  }

  if (renderState.status === "loading") {
    return <figure className={`${diagramClassName} mermaid-diagram-loading`} />;
  }

  return (
    <figure
      className={diagramClassName}
      dangerouslySetInnerHTML={{ __html: renderState.svg }}
    />
  );
}
