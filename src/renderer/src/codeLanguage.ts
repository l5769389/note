export type CodeLanguageSuggestion = {
  aliases?: string[];
  label: string;
  value: string;
};

export const codeLanguageSuggestions: CodeLanguageSuggestion[] = [
  { label: "Plain Text", value: "", aliases: ["text", "plaintext", "plain"] },
  { label: "Bash", value: "bash", aliases: ["sh", "shell", "zsh"] },
  { label: "C", value: "c" },
  { label: "C++", value: "cpp", aliases: ["c++"] },
  { label: "C#", value: "csharp", aliases: ["c#", "cs"] },
  { label: "CSS", value: "css" },
  { label: "Go", value: "go", aliases: ["golang"] },
  { label: "HTML", value: "html", aliases: ["markup"] },
  { label: "Java", value: "java" },
  { label: "JavaScript", value: "javascript", aliases: ["js", "node"] },
  { label: "JSON", value: "json" },
  { label: "JSX", value: "jsx" },
  { label: "Markdown", value: "markdown", aliases: ["md"] },
  { label: "Mermaid", value: "mermaid" },
  { label: "PHP", value: "php" },
  { label: "PowerShell", value: "powershell", aliases: ["ps", "ps1"] },
  { label: "Python", value: "python", aliases: ["py"] },
  { label: "Ruby", value: "ruby" },
  { label: "Rust", value: "rust", aliases: ["rs"] },
  { label: "SQL", value: "sql" },
  { label: "TSX", value: "tsx" },
  { label: "TypeScript", value: "typescript", aliases: ["ts"] },
  { label: "XML", value: "xml" },
  { label: "YAML", value: "yaml", aliases: ["yml"] },
];

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#]+/g, "");
}

function getFuzzyIndexScore(candidate: string, query: string) {
  let candidateIndex = 0;
  let score = 0;

  for (const character of query) {
    const matchedIndex = candidate.indexOf(character, candidateIndex);

    if (matchedIndex === -1) {
      return Number.POSITIVE_INFINITY;
    }

    score += matchedIndex - candidateIndex;
    candidateIndex = matchedIndex + 1;
  }

  return score;
}

export function formatCodeLanguageLabel(language: string) {
  const normalizedLanguage = language.trim().toLowerCase();
  const knownLabels: Record<string, string> = {
    "plain text": "PlainText",
    bash: "Bash",
    c: "C",
    "c++": "C++",
    cpp: "C++",
    "c#": "C#",
    csharp: "CSharp",
    css: "CSS",
    html: "HTML",
    java: "Java",
    javascript: "JavaScript",
    js: "JavaScript",
    json: "JSON",
    jsx: "JSX",
    markdown: "Markdown",
    md: "Markdown",
    py: "Python",
    python: "Python",
    shell: "Shell",
    sql: "SQL",
    ts: "TypeScript",
    tsx: "TSX",
    typescript: "TypeScript",
    xml: "XML",
    yaml: "YAML",
    yml: "YAML",
  };

  if (!normalizedLanguage) {
    return "PlainText";
  }

  if (knownLabels[normalizedLanguage]) {
    return knownLabels[normalizedLanguage];
  }

  return normalizedLanguage
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

export function normalizeCodeLanguageInput(language: string) {
  const normalizedLanguage = language.trim().toLowerCase();
  const matchedSuggestion = codeLanguageSuggestions.find((suggestion) => {
    const values = [suggestion.value, suggestion.label, ...(suggestion.aliases ?? [])];

    return values.some(
      (value) => normalizeSearchText(value) === normalizeSearchText(normalizedLanguage),
    );
  });

  if (matchedSuggestion) {
    return matchedSuggestion.value;
  }

  return normalizedLanguage === "plaintext" ||
    normalizedLanguage === "plain text" ||
    normalizedLanguage === "text"
    ? ""
    : normalizedLanguage;
}

export function getCodeLanguageInputValue(language: string) {
  const trimmedLanguage = language.trim();
  const normalizedLanguage = normalizeCodeLanguageInput(trimmedLanguage);
  const matchedSuggestion = codeLanguageSuggestions.find(
    (suggestion) => suggestion.value === normalizedLanguage,
  );

  if (matchedSuggestion) {
    return matchedSuggestion.label;
  }

  return trimmedLanguage || "Text";
}

export function isMermaidLanguage(language: string) {
  return language.trim().toLowerCase() === "mermaid";
}

export function getCodeLanguageSuggestions(query: string, limit = 8) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return codeLanguageSuggestions.slice(0, limit);
  }

  return codeLanguageSuggestions
    .map((suggestion) => {
      const values = [
        suggestion.value,
        suggestion.label,
        ...(suggestion.aliases ?? []),
      ].map(normalizeSearchText);
      const scores = values.map((value) => {
        if (value === normalizedQuery) {
          return 0;
        }

        if (value.startsWith(normalizedQuery)) {
          return 1;
        }

        if (value.includes(normalizedQuery)) {
          return 2;
        }

        const fuzzyScore = getFuzzyIndexScore(value, normalizedQuery);

        return Number.isFinite(fuzzyScore) ? 3 + fuzzyScore : fuzzyScore;
      });
      const score = Math.min(...scores);

      return { score, suggestion };
    })
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.suggestion.label.localeCompare(right.suggestion.label),
    )
    .slice(0, limit)
    .map(({ suggestion }) => suggestion);
}
