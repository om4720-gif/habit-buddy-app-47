import { useSyncExternalStore } from "react";

// What Buddy wears, his fur color and the app theme. Choices live in this browser;
// ownership of paid items is kept in the database (as a purchase), so it survives a new device.

export type Slot = "head" | "face" | "neck";
export type ItemDef = { id: string; name: string; emoji: string; slot: Slot; price: number };

export const ITEMS: ItemDef[] = [
  { id: "party-hat", name: "Party hat", emoji: "🎉", slot: "head", price: 30 },
  { id: "grad-cap", name: "Graduation cap", emoji: "🎓", slot: "head", price: 50 },
  { id: "headphones", name: "Headphones", emoji: "🎧", slot: "head", price: 80 },
  { id: "crown", name: "Crown", emoji: "👑", slot: "head", price: 120 },
  { id: "glasses", name: "Glasses", emoji: "👓", slot: "face", price: 40 },
  { id: "sunglasses", name: "Sunglasses", emoji: "😎", slot: "face", price: 60 },
  { id: "bow-tie", name: "Bow tie", emoji: "🎀", slot: "neck", price: 40 },
  { id: "scarf", name: "Scarf", emoji: "🧣", slot: "neck", price: 50 },
];

export type FurDef = { id: string; name: string; color: string | null; price: number };
export const FURS: FurDef[] = [
  { id: "rust", name: "Classic", color: null, price: 0 }, // follows the app theme
  { id: "teal", name: "Teal", color: "#2F7D6B", price: 40 },
  { id: "blue", name: "Blue", color: "#4A6FA5", price: 40 },
  { id: "purple", name: "Purple", color: "#8E5BA8", price: 40 },
  { id: "rose", name: "Rose", color: "#C2547B", price: 40 },
  { id: "olive", name: "Olive", color: "#5E8C3A", price: 40 },
];

export type ThemeDef = { id: string; name: string; value: string | null; swatch: string };
export const THEMES: ThemeDef[] = [
  { id: "rust", name: "Rust", value: null, swatch: "#C8502B" },
  { id: "ocean", name: "Ocean", value: "oklch(0.52 0.12 245)", swatch: "#2F6F9F" },
  { id: "forest", name: "Forest", value: "oklch(0.5 0.12 155)", swatch: "#2F7D5B" },
  { id: "plum", name: "Plum", value: "oklch(0.5 0.15 310)", swatch: "#7E4FA0" },
  { id: "rose", name: "Rose", value: "oklch(0.58 0.17 5)", swatch: "#C2547B" },
  { id: "sun", name: "Sun", value: "oklch(0.62 0.15 70)", swatch: "#C9871F" },
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

export const useOutfit = (): Outfit => useSyncExternalStore(subscribe, outfitSnapshot, () => NO_OUTFIT);

export function setOutfit(patch: Partial<Outfit>) {
  writeRaw(OUTFIT_KEY, JSON.stringify({ ...outfitSnapshot(), ...patch }));
}

const themeSnapshot = () => {
  const id = readRaw(THEME_KEY);
  return THEMES.some((t) => t.id === id) ? (id as string) : "rust";
};
export const useTheme = (): string => useSyncExternalStore(subscribe, themeSnapshot, () => "rust");
export const setTheme = (id: string) => writeRaw(THEME_KEY, id);

/** Applies the accent color to the whole app (Buddy's classic fur follows it too). */
export function applyTheme(id: string) {
  const value = THEMES.find((t) => t.id === id)?.value ?? null;
  const root = document.documentElement;
  if (value) root.style.setProperty("--rust", value);
  else root.style.removeProperty("--rust");
}

// ---- ownership: a paid item is stored as a redemption titled "Buddy item: <id>" ----
export const PURCHASE_PREFIX = "Buddy item: ";
export const purchaseTitle = (id: string) => `${PURCHASE_PREFIX}${id}`;
export const isPurchase = (title: string) => title.startsWith(PURCHASE_PREFIX);
export const ownedFrom = (history: { title: string }[]) =>
  new Set(history.filter((h) => isPurchase(h.title)).map((h) => h.title.slice(PURCHASE_PREFIX.length)));
