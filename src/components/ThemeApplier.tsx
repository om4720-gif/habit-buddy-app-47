import { useEffect } from "react";

import { applyTheme, useTheme } from "@/lib/customize";

/** Keeps the app's accent color in sync with the chosen theme. Renders nothing. */
export function ThemeApplier() {
  const theme = useTheme();
  useEffect(() => applyTheme(theme), [theme]);
  return null;
}
