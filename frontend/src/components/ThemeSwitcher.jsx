
import {
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";

import {
  LightMode,
  DarkMode,
  DesktopWindows,
} from "@mui/icons-material";

import { useThemeMode } from "../hooks/useThemeMode";

export default function ThemeSwitcher() {
  const { mode, changeMode } = useThemeMode();

  return (
    <ToggleButtonGroup
      value={mode}
      exclusive
      onChange={(_, newMode) => {
        if (newMode !== null) {
          changeMode(newMode);
        }
      }}
      size="small"
      aria-label="Appearance"
    >
      <ToggleButton value="light" aria-label="Light mode">
        <Tooltip title="Light">
          <LightMode fontSize="small" />
        </Tooltip>
      </ToggleButton>

      <ToggleButton value="dark" aria-label="Dark mode">
        <Tooltip title="Dark">
          <DarkMode fontSize="small" />
        </Tooltip>
      </ToggleButton>

      <ToggleButton value="system" aria-label="System theme">
        <Tooltip title="System">
          <DesktopWindows fontSize="small" />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
