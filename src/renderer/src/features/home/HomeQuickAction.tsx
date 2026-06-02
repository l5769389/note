import type { ReactNode } from "react";

type HomeQuickActionProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
};

export function HomeQuickAction({ icon, label, onClick }: HomeQuickActionProps) {
  return (
    <button type="button" title={label} onClick={onClick}>
      {icon}
      <span>
        <strong>{label}</strong>
      </span>
    </button>
  );
}
