import { getDocumentTypeFromPath } from "./documentModel";
import { normalizePropertyKey, normalizeTagName } from "./noteKnowledge";
import type { DocumentMetadata } from "./types";
import { getPathLabel, normalizeFilePathKey } from "./workspaceDisplay";

type TimestampFactory = () => string;

export function getTagInputValues(value: string) {
  const seen = new Set<string>();

  return value
    .split(/[,\s]+/)
    .map(normalizeTagName)
    .filter((tag) => {
      const key = tag.toLocaleLowerCase();

      if (!tag || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export function normalizeDocumentMetadata(
  metadata?: DocumentMetadata,
  createTimestamp: TimestampFactory = () => new Date().toISOString(),
): DocumentMetadata {
  const seenTags = new Set<string>();
  const tags =
    metadata?.tags
      ?.map(normalizeTagName)
      .filter((tag) => {
        const key = tag.toLocaleLowerCase();

        if (!tag || seenTags.has(key)) {
          return false;
        }

        seenTags.add(key);
        return true;
      }) ?? [];
  const seenDocumentLinks = new Set<string>();
  const documentLinks =
    metadata?.documentLinks
      ?.map((link) => {
        const filePath = link.filePath.trim();

        return {
          createdAt: link.createdAt || createTimestamp(),
          documentType: link.documentType ?? getDocumentTypeFromPath(filePath),
          filePath,
          title: (link.title ?? "").trim() || getPathLabel(filePath),
        };
      })
      .filter((link) => {
        const key = normalizeFilePathKey(link.filePath);

        if (!link.filePath || seenDocumentLinks.has(key)) {
          return false;
        }

        seenDocumentLinks.add(key);
        return true;
      }) ?? [];
  const seenProperties = new Set<string>();
  const properties =
    metadata?.properties
      ?.map((property) => ({
        key: normalizePropertyKey(property.key),
        value: property.value.trim(),
      }))
      .filter((property) => {
        const key = property.key.toLocaleLowerCase();

        if (!property.key || seenProperties.has(key)) {
          return false;
        }

        seenProperties.add(key);
        return true;
      }) ?? [];

  return {
    documentLinks,
    properties,
    tags,
  };
}
