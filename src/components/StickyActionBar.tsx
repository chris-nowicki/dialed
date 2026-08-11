import type { ReactNode } from "react";

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
}

export function StickyActionBar({
  children,
  className = "",
}: StickyActionBarProps) {
  return (
    <div className={`sticky-action-bar ${className}`.trim()}>
      <div className="sticky-action-bar-inner">{children}</div>
    </div>
  );
}
