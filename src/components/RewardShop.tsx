import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { CitySkyline } from "@/components/CitySkyline";
import { getCityProgress, POINTS } from "@/lib/city.functions";

const FIRST_LEVEL = { at: 0, name: "Campsite", emoji: "⛺" };
const LEVELS = [
  FIRST_LEVEL,
  { at: 50, name: "Village", emoji: "🏡" },
  { at: 150, name: "Town", emoji: "🏘️" },
  { at: 350, name: "City", emoji: "🏙️" },
  { at: 700, name: "Metropolis", emoji: "🌆" },
  { at: 1200, name: "Capital", emoji: "🏛️" },
];

export function RewardShop() {
  const qc = useQueryClient();
  const earned = useQuery({ queryKey: ["points"], queryFn: () => getCityProgress() });
  const shop = useQuery({
    queryKey: ["reward-shop"],
    queryFn: async () => {
      const [r, h] = await Promise.all([
        supabase.from("rewards").select("id, title, cost").order("cost"),
        supabase.from("reward_redemptions").select("id, title, cost, created_at").order("created_at", { ascending: false }),
      ]);
      if (r.error) throw r.error;
      if (h.error) throw h.error;
      return { rewards: r.data, history: h.data };
    },
  });
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("100");

  const total = earned.data?.total ?? 0;
  const spent = (shop.data?.history ?? []).reduce((s, r) => s + r.cost, 0);
  const balance = total - spent;
  const levelIndex = LEVELS.reduce((acc, l, i) => (total >= l.at ? i : acc), 0);
  const level = LEVELS[levelIndex] ?? FIRST_LEVEL;
  const next = LEVELS[levelIndex + 1];
  const toNext = next ? next.at - total : 0;
  const levelPct = next ? Math.round(((total - level.at) / (next.at - level.at)) * 100) : 100;
  const counts = earned.data?.counts ?? { habits: 0, lectures: 0, assignments: 0, early: 0 };

  // Celebrate when the city levels up (first ever load just records the level).
  useEffect(() => {
    if (earned.data === undefined) return;
    try {
      const prev = localStorage.getItem("cityLevel");
      const prevLevel = prev !== null ? LEVELS[Number(prev)] : undefined;
      if (prevLevel && levelIndex > Number(prev))
        toast.success(`🎉 Your ${prevLevel.name} just grew into a ${level.name}!`);
      localStorage.setItem("cityLevel", String(levelIndex));
    } catch {
      /* storage can be unavailable */
    }
  }, [earned.data, levelIndex, level.name]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["reward-shop"] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseInt(cost, 10);
    if (!title.trim() || !(c > 0)) return;
    const { error } = await supabase.from("rewards").insert({ title: title.trim().slice(0, 60), cost: c } as never);
    if (error) { toast.error("Could not add reward"); return; }
    setTitle("");
    refresh();
  };

  const redeem = async (r: { title: string; cost: number }) => {
    if (r.cost > balance) return;
    const { error } = await supabase.from("reward_redemptions").insert({ title: r.title, cost: r.cost } as never);
    if (error) { toast.error("Could not redeem"); return; }
    toast.success(`🎉 Enjoy your ${r.title}! You earned it.`);
    refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("rewards").delete().eq("id", id);
    refresh();
  };

  return (
    <section className="mb-8 rounded-3xl border border-line bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-rust">
            <Sparkles className="size-3.5" /> Your city
          </p>
          <p className="mt-1 font-display text-3xl text-ink">
            {level.emoji} {level.name}
          </p>
          <p className="text-xs text-ink-soft">{total} bricks laid · spending never shrinks your city</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl text-ink">🧱 {balance}</p>
          <p className="text-xs text-ink-soft">bricks to spend</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
        <CitySkyline {...counts} />
      </div>

      {next ? (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-ink-soft">
            <span>{level.name}</span>
            <span>
              {next.emoji} {next.name} at {next.at}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-rust transition-all" style={{ width: `${levelPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {toNext} bricks to a {next.name}: about {Math.ceil(toNext / POINTS.assignment)} assignment
            {Math.ceil(toNext / POINTS.assignment) === 1 ? "" : "s"}, {Math.ceil(toNext / POINTS.lecture)} lecture
            {Math.ceil(toNext / POINTS.lecture) === 1 ? "" : "s"}, or {Math.ceil(toNext / POINTS.habit)} habit check-ins.
            Finishing early lays bonus bricks.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-soft">You've built the Capital. Every brick from here is pure flex. 🏛️</p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
        🏠 Habits +{POINTS.habit} bricks (every 3 = a home) · 🏛️ Lectures +{POINTS.lecture} (every 2 = a hall) · 🗼 Assignments +
        {POINTS.assignment} (each = a tower) · ★ Finish early for bonus bricks and a star.
      </p>

      <h3 className="mt-6 flex items-center gap-2 font-display text-lg text-ink">
        <Gift className="size-4 text-rust" /> Treat market
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(shop.data?.rewards ?? []).map((r) => {
          const pct = Math.min(100, Math.round((balance / r.cost) * 100));
          const ready = balance >= r.cost;
          return (
            <div key={r.id} className="rounded-2xl border border-line p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{r.title}</p>
                  <p className="text-xs text-ink-soft">{r.cost} 🧱</p>
                </div>
                <button aria-label="Remove reward" onClick={() => remove(r.id)} className="text-ink-soft hover:text-ink">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-rust transition-all" style={{ width: `${pct}%` }} />
              </div>
              <Button size="sm" className="mt-3 w-full rounded-full" disabled={!ready} onClick={() => redeem(r)}>
                {ready ? "Redeem" : `${r.cost - balance} bricks to go`}
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
        <Input className="w-24" type="number" min={1} value={cost} onChange={(e) => setCost(e.target.value)} aria-label="Cost in bricks" />
        <Button type="submit" size="icon" aria-label="Add reward"><Plus /></Button>
      </form>

      {(shop.data?.history.length ?? 0) > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">Recently enjoyed</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            {shop.data!.history.slice(0, 5).map((h) => (
              <li key={h.id}>🎁 {h.title} · −{h.cost} 🧱</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
