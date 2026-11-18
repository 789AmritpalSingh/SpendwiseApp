
import {
  useMemo,
  useState,
} from "react";

import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  useMediaQuery,
} from "@mui/material";
import { ThemeModeContext } from "./themeModeStore";

const STORAGE_KEY = "spendwise-theme";

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      return ["light", "dark", "system"].includes(saved)
        ? saved
        : "system";
    } catch {
      return "system";
    }
  });

  const systemPrefersDark = useMediaQuery(
    "(prefers-color-scheme: dark)"
  );

  const resolvedMode =
    mode === "system"
      ? systemPrefersDark ? "dark" : "light"
      : mode;

  const changeMode = (newMode) => {
    if (!["light", "dark", "system"].includes(newMode)) {
      return;
    }

    setMode(newMode);

    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // Continue even if browser storage is unavailable.
    }
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode,
          primary: {
            main:
              resolvedMode === "dark"
                ? "#82aaff"
                : "#2563eb",
          },
          background: {
            default:
              resolvedMode === "dark"
                ? "#0f172a"
                : "#f5f7fb",
            paper:
              resolvedMode === "dark"
                ? "#1e293b"
                : "#ffffff",
          },
          success: {
            main: "#16a34a",
          },
        },

        shape: {
          borderRadius: 12,
        },

        typography: {
          fontFamily: "Arial, sans-serif",
        },

        components: {
          MuiCard: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                boxShadow:
                  resolvedMode === "dark"
                    ? "0 2px 12px rgba(0,0,0,0.15)"
                    : "0 2px 8px rgba(15,23,42,0.05)",
                border:
                  resolvedMode === "dark"
                    ? "1px solid #334155"
                    : "1px solid #e5e7eb",
              },
            },
          },

          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
              },
            },
          },
        },
      }),
    [resolvedMode]
  );

  const contextValue = useMemo(
    () => ({
      mode,
      resolvedMode,
      changeMode,
    }),
    [mode, resolvedMode]
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}


