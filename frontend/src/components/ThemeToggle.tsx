import { Lightbulb } from "lucide-react";
import { useTheme } from "../ThemeContext";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "light" ? "dark" : "light";
  const label = `Mudar para tema ${next === "light" ? "claro" : "escuro"}`;
  return <button type="button" className={`theme-bulb-toggle ${resolvedTheme === "light" ? "is-lit" : ""} ${className}`.trim()}
    aria-label={label} title={label} onClick={() => setTheme(next)}>
    <Lightbulb size={19} strokeWidth={1.8} aria-hidden="true" />
  </button>;
}
