import { loadLibraryFromBlob } from "@excalidraw/excalidraw";
import type { LibraryItem, LibraryItems } from "@excalidraw/excalidraw/types";

type BundledExcalidrawLibrary = {
  load: () => Promise<{ default: string }>;
  name: string;
  source: string;
};

export const bundledExcalidrawLibraries: BundledExcalidrawLibrary[] = [
  {
    name: "Flow Chart Symbols",
    source: "finfin/flow-chart-symbols.excalidrawlib",
    load: () =>
      import("./assets/excalidraw-libraries/flow-chart-symbols.excalidrawlib?raw"),
  },
  {
    name: "System Design Icons",
    source: "niknm/systemdesignicons.excalidrawlib",
    load: () =>
      import("./assets/excalidraw-libraries/system-design-icons.excalidrawlib?raw"),
  },
  {
    name: "Software Architecture",
    source: "youritjang/software-architecture.excalidrawlib",
    load: () =>
      import("./assets/excalidraw-libraries/software-architecture.excalidrawlib?raw"),
  },
  {
    name: "Lo-Fi Wireframing Kit",
    source: "spfr/lo-fi-wireframing-kit.excalidrawlib",
    load: () =>
      import("./assets/excalidraw-libraries/lo-fi-wireframing-kit.excalidrawlib?raw"),
  },
  {
    name: "Web Kit",
    source: "excacomp/web-kit.excalidrawlib",
    load: () => import("./assets/excalidraw-libraries/web-kit.excalidrawlib?raw"),
  },
  {
    name: "AWS Serverless Icons",
    source: "slobodan/aws-serverless.excalidrawlib",
    load: () =>
      import("./assets/excalidraw-libraries/aws-serverless.excalidrawlib?raw"),
  },
  {
    name: "Network Topology Icons",
    source: "dwelle/network-topology-icons.excalidrawlib",
    load: () =>
      import("./assets/excalidraw-libraries/network-topology-icons.excalidrawlib?raw"),
  },
  {
    name: "IT Logos",
    source: "pclainchard/it-logos.excalidrawlib",
    load: () => import("./assets/excalidraw-libraries/it-logos.excalidrawlib?raw"),
  },
];

let bundledLibraryItemsPromise: Promise<LibraryItems> | undefined;

function dedupeLibraryItems(items: LibraryItem[]) {
  const byId = new Map<string, LibraryItem>();

  items.forEach((item) => {
    byId.set(item.id, item);
  });

  return Array.from(byId.values());
}

export function getBundledExcalidrawLibraryItems() {
  bundledLibraryItemsPromise ??= Promise.all(
    bundledExcalidrawLibraries.map(async (library) => {
      const module = await library.load();

      return loadLibraryFromBlob(
        new Blob([module.default], { type: "application/json" }),
        "published",
      );
    }),
  ).then((libraryGroups) => dedupeLibraryItems(libraryGroups.flat()));

  return bundledLibraryItemsPromise;
}
