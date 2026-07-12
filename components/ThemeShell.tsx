import type { CSSProperties, ReactNode } from "react";

export type RuntimeTheme = {
  primary: string;
  sidebar: string;
  accent: string;
  background: string;
  surface: string;
  radius: number;
  density: string;
  font: string;
  sidebarWidth: number;
};

export function ThemeShell({ theme, children }: { theme: RuntimeTheme; children: ReactNode }) {
  const fonts: Record<string, string> = {
    Inter: "Inter, Arial, sans-serif",
    System: "Arial, Helvetica, sans-serif",
    Serif: "Georgia, serif",
  };
  const style = {
    "--brand": theme.primary,
    "--sidebar": theme.sidebar,
    "--accent": theme.accent,
    "--app-background": theme.background,
    "--surface": theme.surface,
    "--radius-card": `${theme.radius}px`,
    "--radius-control": `${Math.max(6, theme.radius - 6)}px`,
    "--sidebar-width": `${theme.sidebarWidth}px`,
    "--app-font": fonts[theme.font] || fonts.Inter,
  } as CSSProperties;
  const density = ["compact", "comfortable", "spacious"].includes(theme.density) ? theme.density : "comfortable";
  return <div className={`shell density-${density}`} style={style}>{children}</div>;
}
