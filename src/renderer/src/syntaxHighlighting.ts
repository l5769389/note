import type { Refractor, Syntax } from "refractor/core";
import bash from "refractor/bash";
import c from "refractor/c";
import cpp from "refractor/cpp";
import csharp from "refractor/csharp";
import css from "refractor/css";
import diff from "refractor/diff";
import go from "refractor/go";
import java from "refractor/java";
import javascript from "refractor/javascript";
import json from "refractor/json";
import jsx from "refractor/jsx";
import markdown from "refractor/markdown";
import markup from "refractor/markup";
import php from "refractor/php";
import powershell from "refractor/powershell";
import python from "refractor/python";
import ruby from "refractor/ruby";
import rust from "refractor/rust";
import sql from "refractor/sql";
import typescript from "refractor/typescript";
import tsx from "refractor/tsx";
import yaml from "refractor/yaml";

const syntaxes: Array<{ name: string; syntax: Syntax }> = [
  { name: "markup", syntax: markup },
  { name: "css", syntax: css },
  { name: "javascript", syntax: javascript },
  { name: "typescript", syntax: typescript },
  { name: "jsx", syntax: jsx },
  { name: "tsx", syntax: tsx },
  { name: "json", syntax: json },
  { name: "bash", syntax: bash },
  { name: "powershell", syntax: powershell },
  { name: "markdown", syntax: markdown },
  { name: "yaml", syntax: yaml },
  { name: "diff", syntax: diff },
  { name: "python", syntax: python },
  { name: "java", syntax: java },
  { name: "c", syntax: c },
  { name: "cpp", syntax: cpp },
  { name: "csharp", syntax: csharp },
  { name: "go", syntax: go },
  { name: "rust", syntax: rust },
  { name: "php", syntax: php },
  { name: "ruby", syntax: ruby },
  { name: "sql", syntax: sql },
];

const aliases: Record<string, string[]> = {
  bash: ["sh", "shell", "zsh"],
  csharp: ["cs"],
  javascript: ["js", "node"],
  markdown: ["md"],
  markup: ["html", "xml", "svg"],
  powershell: ["ps", "ps1"],
  typescript: ["ts"],
  yaml: ["yml"],
};

export function registerMarkdownLanguages(refractor: Refractor) {
  for (const { name, syntax } of syntaxes) {
    if (!refractor.registered(name)) {
      refractor.register(syntax);
    }
  }

  for (const [language, languageAliases] of Object.entries(aliases)) {
    refractor.alias(language, languageAliases);
  }
}
