export type MenubarMenu =
  | "file"
  | "edit"
  | "paragraph"
  | "format"
  | "view"
  | "theme"
  | "help";

export type TopMenu = MenubarMenu | null;

export type MenubarItem = {
  key: MenubarMenu;
  label: string;
};

export const menubarItems: MenubarItem[] = [
  { key: "file", label: "文件(F)" },
  { key: "edit", label: "编辑(E)" },
  { key: "paragraph", label: "段落(P)" },
  { key: "format", label: "格式(O)" },
  { key: "view", label: "视图(V)" },
  { key: "theme", label: "主题(T)" },
  { key: "help", label: "帮助(H)" },
];
