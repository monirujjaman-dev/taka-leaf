import type { ReactNode } from "react";

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`glass rounded-[22px] p-5 ${className}`}>{children}</section>;
}
