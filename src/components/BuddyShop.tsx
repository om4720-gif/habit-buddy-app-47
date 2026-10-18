import { useQueryClient } from "@tanstack/react-query";
import { Check, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BuddyFace } from "@/components/Buddy";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  FURS,
  ITEMS,
  THEMES,
  ownedFrom,
  purchaseTitle,
  setOutfit,
  setTheme,
  useOutfit,
  useTheme,
  type Outfit,
} from "@/lib/customize";

type Pending = { type: "item"; id: string } | { type: "fur"; id: string };

/** "Make it yours": dress Buddy with points, pick his fur color, and choose the app's accent color. */
export function BuddyShop({ balance, history }: { balance: number; history: { title: string }[] }) {
  const qc = useQueryClient();
  const outfit = useOutfit();
  const theme = useTheme();
  const [pending, setPending] = useState<Pending | null>(null);
  const [buying, setBuying] = useState(false);
  const owned = ownedFrom(history);

  const ownsItem = (id: string) => owned.has(id);
  const ownsFur = (id: string) => id === "rust" || owned.has(`fur-${id}`);

  // What the preview shows: your outfit, plus the not-yet-bought thing being tried on.
  const preview: Outfit = { ...outfit };
  if (pending?.type === "item") {
    const slot = ITEMS.find((i) => i.id === pending.id)!.slot;
    preview[slot] = pending.id;
  } else if (pending?.type === "fur") {
    preview.fur = pending.id;
  }

  const pendingInfo = pending
    ? pending.type === "item"
      ? { name: ITEMS.find((i) => i.id === pending.id)!.name, price: ITEMS.find((i) => i.id === pending.id)!.price }
      : { name: `${FURS.find((f) => f.id === pending.id)!.name} fur`, price: FURS.find((f) => f.id === pending.id)!.price }
    : null;

  const buy = async () => {
    if (!pending || !pendingInfo || buying) return;
    if (balance < pendingInfo.price) return;
    setBuying(true);
    const key = pending.type === "fur" ? `fur-${pending.id}` : pending.id;
    const { error } = await supabase
      .from("reward_redemptions")
      .insert({ title: purchaseTitle(key), cost: pendingInfo.price } as never);
    setBuying(false);
    if (error) {
      toast.error("Could not buy that. Try again.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["reward-shop"] });
    if (pending.type === "item") {
      const slot = ITEMS.find((i) => i.id === pending.id)!.slot;
      setOutfit({ [slot]: pending.id });
    } else {
      setOutfit({ fur: pending.id });
    }
    toast.success(`${pendingInfo.name}! Buddy looks great ✨`);
    setPending(null);
  };

  const tapItem = (id: string) => {
    const item = ITEMS.find((i) => i.id === id)!;
    if (ownsItem(id)) {
      setPending(null);
      setOutfit({ [item.slot]: outfit[item.slot] === id ? null : id });
    } else {
      setPending({ type: "item", id });
    }
  };

  const tapFur = (id: string) => {
    if (ownsFur(id)) {
      setPending(null);
      setOutfit({ fur: id });
    } else {
      setPending({ type: "fur", id });
    }
  };

  const heading = "text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft";

  return (
    <div>
      <div className="mt-4 flex flex-col items-center rounded-2xl bg-paper px-4 pb-4 pt-8 ring-1 ring-black/5">
        <BuddyFace className="size-28" mood="happy" joy={false} outfit={preview} />
        {pendingInfo ? (
          <div className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2 ring-1 ring-black/5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{pendingInfo.name}</p>
              <p className="text-xs text-ink-soft">
                {balance >= pendingInfo.price
                  ? `${pendingInfo.price} pts · you have ${balance}`
                  : `${balance} of ${pendingInfo.price} pts · ${pendingInfo.price - balance} to go`}
              </p>
              {balance < pendingInfo.price && (
                <div className="mt-1.5 h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-sand/70">
                  <div
                    className="h-full rounded-full bg-rust"
                    style={{ width: `${Math.round((balance / pendingInfo.price) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button size="sm" className="rounded-full" disabled={balance < pendingInfo.price || buying} onClick={buy}>
                Buy
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-soft">Tap something to try it on.</p>
        )}
      </div>

      <p className={`mt-5 ${heading}`}>Outfit</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ITEMS.map((item) => {
          const has = ownsItem(item.id);
          const wearing = outfit[item.slot] === item.id;
          const trying = pending?.type === "item" && pending.id === item.id;
          return (
            <button
              key={item.id}
              onClick={() => tapItem(item.id)}
              aria-pressed={wearing || trying}
              className={`flex flex-col items-center gap-1 rounded-2xl p-3 text-center ring-1 transition ${
                wearing || trying ? "bg-paper ring-rust/60" : "bg-paper/60 ring-black/5 hover:bg-paper"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">
                {item.emoji}
              </span>
              <span className="text-xs font-medium text-ink">{item.name}</span>
              <span className="flex items-center gap-1 text-[11px] text-ink-soft">
                {wearing ? (
                  <>
                    <Check className="size-3 text-rust" /> Wearing
                  </>
                ) : has ? (
                  "Owned"
                ) : (
                  <>
                    <Lock className="size-3" /> {item.price} pts
                  </>
                )}
              </span>
              {!has && (
                <span className="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-sand/70">
                  <span
                    className="block h-full rounded-full bg-rust/70"
                    style={{ width: `${Math.min(100, Math.round((balance / item.price) * 100))}%` }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {(outfit.head || outfit.face || outfit.neck) && (
        <button
          className="mt-2 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          onClick={() => setOutfit({ head: null, face: null, neck: null })}
        >
          Take everything off
        </button>
      )}

      <p className={`mt-5 ${heading}`}>Fur color</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {FURS.map((fur) => {
          const has = ownsFur(fur.id);
          const active = outfit.fur === fur.id;
          const trying = pending?.type === "fur" && pending.id === fur.id;
          return (
            <button
              key={fur.id}
              onClick={() => tapFur(fur.id)}
              aria-label={`${fur.name} fur${has ? "" : `, ${fur.price} points`}`}
              aria-pressed={active || trying}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`grid size-9 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-cream ${
                  active || trying ? "ring-ink/60" : "ring-transparent"
                }`}
                style={{ backgroundColor: fur.color ?? "var(--rust)" }}
              >
                {!has && <Lock className="size-3.5 text-cream" />}
              </span>
              <span className="text-[11px] text-ink-soft">{has ? fur.name : `${fur.price} pts`}</span>
            </button>
          );
        })}
      </div>

      <p className={`mt-5 ${heading}`}>App color</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            aria-label={`${t.name} theme`}
            aria-pressed={theme === t.id}
            className="flex flex-col items-center gap-1"
          >
            <span
              className={`grid size-9 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-cream ${
                theme === t.id ? "ring-ink/60" : "ring-transparent"
              }`}
              style={{ backgroundColor: t.swatch }}
            >
              {theme === t.id && <Check className="size-4 text-cream" />}
            </span>
            <span className="text-[11px] text-ink-soft">{t.name}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-soft">Themes are free. Classic fur follows the app color.</p>
    </div>
  );
}
