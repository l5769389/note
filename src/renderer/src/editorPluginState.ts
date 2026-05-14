import { PluginKey } from "@milkdown/kit/prose/state";

export type InlineCodeRange = {
  from: number;
  to: number;
};

export type MarkdownSyntaxPluginState = {
  expandedInlineCode: InlineCodeRange | null;
  isFocused: boolean;
  suppressedInlineCodeAt: number | null;
};

export type SearchHighlightPluginState = {
  range: InlineCodeRange | null;
};

export const markdownSyntaxPluginKey = new PluginKey<MarkdownSyntaxPluginState>(
  "typora-markdown-syntax",
);

export const searchHighlightPluginKey = new PluginKey<SearchHighlightPluginState>(
  "typora-search-highlight",
);

