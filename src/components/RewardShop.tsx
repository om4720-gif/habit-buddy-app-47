import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BuddyShop } from "@/components/BuddyShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getCityProgress, POINTS } from "@/lib/city.functions";
import { isPurchase } from "@/lib/customize";

/** Points earned minus points spent, plus the reward list. Shared by the chip and the dialog. */
export function useRewards() {
  const earned = useQuery({ queryKey: ["points"], queryFn: () => getCityProgress() });
  const shop = useQuery({
    queryKey: ["reward-shop"],
    queryFn: async () => {
      const [r, h] = await Promise.all([
        supabase.from("rewards").select("id, title, cost").order("cost"),
        supabase
          .from("reward_redemptions")
          .select("id, title, cost, created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (r.error) throw r.error;
      if (h.error) throw h.error;
      return { rewards: r.data, history: h.data };
    },
  });
  const total = earned.data?.total ?? 0;
  const spent = (shop.data?.history ?? []).reduce((s, r) => s + r.cost, 0);
  return { total, spent, balance: total - spent, shop };
}

/** Small pill for the page header; opens the rewards dialog. */
export function PointsChip({ balance, onClick }: { balance: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${balance} points. Open rewards`}
      title="Rewards"
      className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3.5 py-2 text-sm font-semibold tabular-nums text-ink ring-1 ring-black/5 transition hover:bg-sand"
    >
      <Sparkles className="size-4 text-rust" />
      {balance}
    </button>
  );
}

export function RewardsDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { total, spent, balance, shop } = useRewards();
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("100");
  const [tab, setTab] = useState<"treats" | "buddy">("treats");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["reward-shop"] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseInt(cost, 10);
    if (!title.trim() || !(c > 0)) return;
    const { error } = await supabase
      .from("rewards")
      .insert({ title: title.trim().slice(0, 60), cost: c } as never);
    if (error) {
      toast.error("Could not add reward");
      return;
    }
    setTitle("");
    refresh();
  };

  const redeem = async (r: { title: string; cost: number }) => {
    if (r.cost > balance) return;
    const { error } = await supabase
      .from("reward_redemptions")
      .insert({ title: r.title, cost: r.cost } as never);
    if (error) {
      toast.error("Could not redeem");
      return;
    }
    toast.success(`🎉 Enjoy your ${r.title}! You earned it.`);
    refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("rewards").delete().eq("id", id);
    refresh();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rewards"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-cream p-6 ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">
              <Sparkles className="size-3.5" /> Rewards
            </p>
            <p className="mt-2 font-display text-4xl font-semibold tabular-nums text-ink">
              {balance} <span className="text-lg text-ink-soft">pts</span>
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {total} earned · {spent} spent
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 inline-flex rounded-full bg-paper p-1 ring-1 ring-black/5">
          {(
            [
              ["treats", "Treats"],
              ["buddy", "Make it yours"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                tab === id ? "bg-cream text-ink shadow-sm ring-1 ring-black/5" : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "buddy" ? (
          <BuddyShop balance={balance} history={shop.data?.history ?? []} />
        ) : (
          <>
        <p className="mt-4 text-xs text-ink-soft">
          Habit +{POINTS.habit} · Lecture +{POINTS.lecture} · Assignment +{POINTS.assignment} · Finishing early earns a
          bonus. Spend points on treats you set yourself.
        </p>

        <h3 className="mt-6 flex items-center gap-2 font-display text-lg text-ink">
          <Gift className="size-4 text-rust" /> Treats
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(shop.data?.rewards ?? []).map((r) => {
            const pct = Math.min(100, Math.round((balance / r.cost) * 100));
            const ready = balance >= r.cost;
            return (
              <div key={r.id} className="rounded-2xl bg-paper p-4 ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{r.title}</p>
                    <p className="text-xs text-ink-soft">{r.cost} pts</p>
                  </div>
                  <button
                    aria-label="Remove reward"
                    onClick={() => remove(r.id)}
                    className="text-ink-soft hover:text-ink"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-rust transition-all" style={{ width: `${pct}%` }} />
                </div>
                <Button size="sm" className="mt-3 w-full rounded-full" disabled={!ready} onClick={() => redeem(r)}>
                  {ready ? "Redeem" : `${r.cost - balance} pts to go`}
                </Button>
              </div>
            );
          })}
          {shop.data?.rewards.length === 0 && (
            <p className="text-sm text-ink-soft sm:col-span-2">
              Add your first treat — a movie night, a coffee, a day off.
            </p>
          )}
        </div>

        <form onSubmit={add} className="mt-4 flex gap-2">
          <Input placeholder="New reward, e.g. Movie night" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            className="w-24"
            type="number"
            min={1}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            aria-label="Cost in points"
          />
          <Button type="submit" size="icon" aria-label="Add reward">
            <Plus />
          </Button>
        </form>

        {(shop.data?.history ?? []).filter((h) => !isPurchase(h.title)).length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">Recently enjoyed</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {shop.data!.history.filter((h) => !isPurchase(h.title)).slice(0, 5).map((h) => (
                <li key={h.id}>
                  🎁 {h.title} · −{h.cost}
                </li>
              ))}
            </ul>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
