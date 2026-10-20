import { useEffect } from "react";

import { applyColorMode, applyTheme, useColorMode, useTheme } from "@/lib/customize";

/** Keeps light/dark mode and the accent color in sync with the saved choices. Renders nothing. */
export function ThemeApplier() {
  const theme = useTheme();
  const mode = useColorMode();
  useEffect(() => {
    const device = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyTheme(theme, applyColorMode(mode, device.matches));
    apply();
    if (mode !== "system") return;
    device.addEventListener("change", apply); // follow the device when it switches at sunset
    return () => device.removeEventListener("change", apply);
  }, [theme, mode]);
  return null;
}
