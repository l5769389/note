export function formatCodeLanguageLabel(language: string) {
  const normalizedLanguage = language.trim().toLowerCase();
  const knownLabels: Record<string, string> = {
    "plain text": "PlainText",
    bash: "Bash",
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

  return normalizedLanguage === "plaintext" ||
    normalizedLanguage === "plain text" ||
    normalizedLanguage === "text"
    ? ""
    : normalizedLanguage;
}

export function isMermaidLanguage(language: string) {
  return language.trim().toLowerCase() === "mermaid";
}

