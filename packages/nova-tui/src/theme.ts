export interface ThemePalette {
  accent: string;
  text: string;
  textDim: string;
  border: string;
  userBg: string;
  userText: string;
  systemText: string;
  toolPending: string;
  toolSuccess: string;
  toolError: string;
  codeBg: string;
  linkColor: string;
  error: string;
  success: string;
}

export const darkTheme: ThemePalette = {
  accent: "#F6C453",
  text: "#e0e4ec",
  textDim: "#6b7280",
  border: "#2d3748",
  userBg: "#1e3a5f",
  userText: "#93c5fd",
  systemText: "#a78bfa",
  toolPending: "#f59e0b",
  toolSuccess: "#22c55e",
  toolError: "#ef4444",
  codeBg: "#1a1b26",
  linkColor: "#60a5fa",
  error: "#ef4444",
  success: "#22c55e",
};

export const lightTheme: ThemePalette = {
  accent: "#B45309",
  text: "#1f2937",
  textDim: "#9ca3af",
  border: "#d1d5db",
  userBg: "#dbeafe",
  userText: "#1e40af",
  systemText: "#7c3aed",
  toolPending: "#d97706",
  toolSuccess: "#059669",
  toolError: "#dc2626",
  codeBg: "#f3f4f6",
  linkColor: "#2563eb",
  error: "#dc2626",
  success: "#059669",
};

export function detectTheme(): "dark" | "light" {
  const envTheme = process.env.GUIGUZI_THEME;
  if (envTheme === "light" || envTheme === "dark") return envTheme;
  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const parts = colorfgbg.split(";");
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      const bg = parseInt(lastPart, 10);
      if (!isNaN(bg) && bg < 8) return "light";
    }
  }
  return "dark";
}

export function getTheme(mode?: "dark" | "light"): ThemePalette {
  const resolved = mode ?? detectTheme();
  return resolved === "dark" ? darkTheme : lightTheme;
}

// ─── Backward compatibility ───
// Legacy Theme interface and DEFAULT_THEME for existing components (StatusBar, RouterPanel)

export interface Theme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  textDim: string;
  error: string;
  success: string;
  warning: string;
}

export const DEFAULT_THEME: Theme = {
  primary: "#00e5c7",
  secondary: "#a78bfa",
  accent: "#f5a623",
  background: "#0a0c10",
  text: "#e0e4ec",
  textDim: "#6b7280",
  error: "#ef4444",
  success: "#22c55e",
  warning: "#f5a623",
};
