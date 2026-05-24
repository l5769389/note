import { useEffect, useState } from "react";
import { extractLocalAssetReferences } from "./assetManager";
import { isMarkdownDocument } from "./documentModel";
import type { MarkdownDocument } from "./types";

export type CheckAssetReferencesPayload = {
  documentFilePath: string;
  references: string[];
};

export type CheckAssetReferences = (
  payload: CheckAssetReferencesPayload,
) => Promise<string[]>;

export function getDocumentAssetReferenceCheckPayload(
  document?: MarkdownDocument | null,
): CheckAssetReferencesPayload | null {
  if (!isMarkdownDocument(document) || !document?.filePath) {
    return null;
  }

  const references = extractLocalAssetReferences(document.content).map(
    (reference) => reference.reference,
  );

  if (!references.length) {
    return null;
  }

  return {
    documentFilePath: document.filePath,
    references,
  };
}

export function useMissingDocumentAssetReferences(
  document: MarkdownDocument | null | undefined,
  checkAssetReferences?: CheckAssetReferences,
  delayMs = 500,
) {
  const [missingAssetReferences, setMissingAssetReferences] = useState<string[]>([]);

  useEffect(() => {
    const payload = getDocumentAssetReferenceCheckPayload(document);

    if (!payload || !checkAssetReferences) {
      setMissingAssetReferences([]);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void checkAssetReferences(payload)
        .then((missing) => {
          if (!cancelled) {
            setMissingAssetReferences(missing);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMissingAssetReferences([]);
          }
        });
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [checkAssetReferences, delayMs, document]);

  return missingAssetReferences;
}
