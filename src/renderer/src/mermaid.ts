let isMermaidConfigured = false;
let mermaidModulePromise: Promise<typeof import("mermaid").default> | null = null;
const mermaidSvgCache = new Map<string, Promise<string>>();

function loadMermaid() {
  mermaidModulePromise ??= import("mermaid").then((module) => module.default);
  return mermaidModulePromise;
}

async function configureMermaid() {
  const mermaid = await loadMermaid();

  if (isMermaidConfigured) {
    return mermaid;
  }

  mermaid.initialize({
    flowchart: {
      curve: "basis",
      htmlLabels: true,
      nodeSpacing: 42,
      rankSpacing: 54,
    },
    securityLevel: "strict",
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      background: "#ffffff",
      fontFamily:
        '"Inter", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      lineColor: "#667085",
      mainBkg: "#f8fafc",
      nodeBorder: "#b8c2d6",
      primaryBorderColor: "#9aa8c7",
      primaryColor: "#f5f7ff",
      primaryTextColor: "#1f2937",
      secondaryBorderColor: "#b7d8cc",
      secondaryColor: "#f3fbf8",
      secondaryTextColor: "#1f2937",
      tertiaryBorderColor: "#d6dae3",
      tertiaryColor: "#ffffff",
      tertiaryTextColor: "#1f2937",
    },
  });

  isMermaidConfigured = true;
  return mermaid;
}

function hashMermaidCode(code: string) {
  let hash = 0;

  for (let index = 0; index < code.length; index += 1) {
    hash = Math.imul(31, hash) + code.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

export function createMermaidRenderId(prefix: string, code: string) {
  return `${prefix.replace(/[^a-zA-Z0-9_-]/g, "")}-${hashMermaidCode(code)}`;
}

export async function renderMermaidSvg(id: string, code: string) {
  const cacheKey = `${id}\n${code}`;
  const cachedSvg = mermaidSvgCache.get(cacheKey);

  if (cachedSvg) {
    return cachedSvg;
  }

  const svgPromise = configureMermaid()
    .then((mermaid) => mermaid.render(id, code))
    .then(({ svg }) => svg)
    .catch((error: unknown) => {
      mermaidSvgCache.delete(cacheKey);
      throw error;
    });

  mermaidSvgCache.set(cacheKey, svgPromise);
  return svgPromise;
}
