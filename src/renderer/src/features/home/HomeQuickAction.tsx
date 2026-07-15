import type { ReactNode } from "react";

type HomeQuickActionProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "primary";
};

export function HomeQuickAction({
  icon,
  label,
  onClick,
  variant = "default",
}: HomeQuickActionProps) {
  return (
    <button
      className={[
        "home-quick-action",
        variant === "primary" ? "home-quick-action-primary" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      title={label}
      onClick={onClick}
    >
      {icon}
      <span>
        <strong>{label}</strong>
      </span>
    </button>
  );
}
