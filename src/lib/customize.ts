import { useSyncExternalStore } from "react";

// What Buddy wears, his fur color and the app theme. Choices live in this browser;
// ownership of paid items is kept in the database (as a purchase), so it survives a new device.

export type Slot = "head" | "face" | "neck";
// Prices are set against what you actually earn: a habit is 5 points, a lecture 10, an assignment 20
// (plus up to 25 for finishing early). A good day is about 40, a good week 250-350.
export type ItemDef = { id: string; name: string; emoji: string; slot: Slot; price: number };

export const ITEMS: ItemDef[] = [
  { id: "party-hat", name: "Party hat", emoji: "🎉", slot: "head", price: 150 },
  { id: "grad-cap", name: "Graduation cap", emoji: "🎓", slot: "head", price: 400 },
  { id: "headphones", name: "Headphones", emoji: "🎧", slot: "head", price: 600 },
  { id: "crown", name: "Crown", emoji: "👑", slot: "head", price: 1200 },
  { id: "glasses", name: "Glasses", emoji: "👓", slot: "face", price: 200 },
  { id: "sunglasses", name: "Sunglasses", emoji: "😎", slot: "face", price: 450 },
  { id: "bow-tie", name: "Bow tie", emoji: "🎀", slot: "neck", price: 200 },
  { id: "scarf", name: "Scarf", emoji: "🧣", slot: "neck", price: 250 },
];

export type FurDef = { id: string; name: string; color: string | null; price: number };
export const FURS: FurDef[] = [
  { id: "rust", name: "Classic", color: null, price: 0 }, // follows the app theme
  { id: "teal", name: "Teal", color: "#2F7D6B", price: 350 },
  { id: "blue", name: "Blue", color: "#4A6FA5", price: 350 },
  { id: "purple", name: "Purple", color: "#8E5BA8", price: 350 },
  { id: "rose", name: "Rose", color: "#C2547B", price: 350 },
  { id: "olive", name: "Olive", color: "#5E8C3A", price: 350 },
];

export type ThemeDef = {
  id: string;
  name: string;
  value: string | null;
  dark: string | null;
  swatch: string;
};
export const THEMES: ThemeDef[] = [
  { id: "rust", name: "Rust", value: null, dark: null, swatch: "#C8502B" },
  {
    id: "ocean",
    name: "Ocean",
    value: "oklch(0.52 0.12 245)",
    dark: "oklch(0.69 0.1 245)",
    swatch: "#2F6F9F",
  },
  {
    id: "forest",
    name: "Forest",
    value: "oklch(0.5 0.12 155)",
    dark: "oklch(0.69 0.11 155)",
    swatch: "#2F7D5B",
  },
  {
    id: "plum",
    name: "Plum",
    value: "oklch(0.5 0.15 310)",
    dark: "oklch(0.7 0.11 310)",
    swatch: "#7E4FA0",
  },
  {
    id: "rose",
    name: "Rose",
    value: "oklch(0.55 0.17 5)",
    dark: "oklch(0.7 0.12 8)",
    swatch: "#B04068",
  },
  {
    id: "sun",
    name: "Sun",
    value: "oklch(0.54 0.12 70)",
    dark: "oklch(0.73 0.12 78)",
    swatch: "#9A6A12",
  },
];

export type Outfit = { head: string | null; face: string | null; neck: string | null; fur: string };
export const NO_OUTFIT: Outfit = { head: null, face: null, neck: null, fur: "rust" };

const OUTFIT_KEY = "ritual:outfit";
const THEME_KEY = "ritual:theme";
const EVENT = "ritual:customize";

const readRaw = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeRaw = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be unavailable (private mode) */
  }
  window.dispatchEvent(new Event(EVENT));
};

export function parseOutfit(raw: string | null): Outfit {
  if (!raw) return NO_OUTFIT;
  try {
    const o = JSON.parse(raw) as Partial<Outfit>;
    const valid = (slot: Slot, id: unknown) =>
      typeof id === "string" && ITEMS.some((i) => i.id === id && i.slot === slot) ? id : null;
    return {
      head: valid("head", o.head),
      face: valid("face", o.face),
      neck: valid("neck", o.neck),
      fur: FURS.some((f) => f.id === o.fur) ? (o.fur as string) : "rust",
    };
  } catch {
    return NO_OUTFIT;
  }
}

// useSyncExternalStore needs a stable snapshot object while nothing changed.
let cachedRaw: string | null | undefined;
let cachedOutfit: Outfit = NO_OUTFIT;
const outfitSnapshot = () => {
  const raw = readRaw(OUTFIT_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedOutfit = parseOutfit(raw);
  }
  return cachedOutfit;
};

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export const useOutfit = (): Outfit =>
  useSyncExternalStore(subscribe, outfitSnapshot, () => NO_OUTFIT);

export function setOutfit(patch: Partial<Outfit>) {
  writeRaw(OUTFIT_KEY, JSON.stringify({ ...outfitSnapshot(), ...patch }));
}

const themeSnapshot = () => {
  const id = readRaw(THEME_KEY);
  return THEMES.some((t) => t.id === id) ? (id as string) : "rust";
};
export const useTheme = (): string => useSyncExternalStore(subscribe, themeSnapshot, () => "rust");
export const setTheme = (id: string) => writeRaw(THEME_KEY, id);

/** Applies the accent color to the whole app, buttons included (Buddy's classic fur follows it too). */
export function applyTheme(id: string, dark = false) {
  const t = THEMES.find((x) => x.id === id);
  const value = (dark ? t?.dark : t?.value) ?? null;
  const root = document.documentElement;
  for (const name of ["--rust", "--primary", "--ring"]) {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name); // back to the palette's own accent
  }
}

// ---- Light / Dark / follow the device ----
export type ColorMode = "light" | "dark" | "system";
const MODE_KEY = "ritual:mode";
const modeSnapshot = (): ColorMode => {
  const v = readRaw(MODE_KEY);
  return v === "light" || v === "dark" ? v : "system";
};
export const useColorMode = (): ColorMode =>
  useSyncExternalStore(subscribe, modeSnapshot, () => "system" as ColorMode);
export const setColorMode = (mode: ColorMode) => writeRaw(MODE_KEY, mode);
export const resolveDark = (mode: ColorMode, deviceIsDark: boolean) =>
  mode === "dark" || (mode === "system" && deviceIsDark);

/** Puts the "dark" class on <html> (and tells the browser, so form fields and scrollbars match). Returns whether it is dark. */
export function applyColorMode(mode: ColorMode, deviceIsDark: boolean): boolean {
  const dark = resolveDark(mode, deviceIsDark);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#17181b" : "#CE552F");
  return dark;
}

// ---- has the person looked at "Make it yours" yet? (drives the "New" nudge) ----
const SEEN_KEY = "ritual:yoursSeen";
const seenSnapshot = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // can't remember it, so don't nag
  }
};
export const useYoursSeen = (): boolean =>
  useSyncExternalStore(subscribe, seenSnapshot, () => true);
export const markYoursSeen = () => writeRaw(SEEN_KEY, "1");

// ---- ownership: a paid item is stored as a redemption titled "Buddy item: <id>" ----
export const PURCHASE_PREFIX = "Buddy item: ";
export const purchaseTitle = (id: string) => `${PURCHASE_PREFIX}${id}`;
export const isPurchase = (title: string) => title.startsWith(PURCHASE_PREFIX);
export const ownedFrom = (history: { title: string }[]) =>
  new Set(
    history.filter((h) => isPurchase(h.title)).map((h) => h.title.slice(PURCHASE_PREFIX.length)),
  );
