import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BuddyFace } from "@/components/Buddy";
import { Button } from "@/components/ui/button";
import { updateDeadline } from "@/lib/deadlines.functions";
import { useUserSettings } from "@/lib/useUserSettings";
import { getMeroBriefing, type MeroAction } from "@/lib/mero.functions";
import { updateLecture } from "@/lib/uni.functions";

export function MeroBriefing({ date }: { date: string }) {
  const agent = useUserSettings().settings.agent_name;
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const key = ["mero", date];
  const cached = qc.getQueryData(key);
  const q = useQuery({
    queryKey: key,
    queryFn: () => getMeroBriefing({ data: { today: date } }),
    enabled: enabled || !!cached,
    staleTime: Infinity,
    retry: false,
  });

  const run = async (a: MeroAction) => {
    try {
      if (a.type === "mark_lecture_studied")
        await updateLecture({ data: { lectureId: a.id, completed: true } });
      else await updateDeadline({ data: { deadlineId: a.id, completed: true } });
      setDone((s) => new Set(s).add(a.id));
      qc.invalidateQueries({ predicate: (x) => x.queryKey[0] !== "mero" });
      toast.success("Done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't do that.");
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BuddyFace className="size-12" mood="happy" joy={false} />
          <div>
            <h2 className="font-semibold">{agent}</h2>
            <p className="text-xs text-ink-soft">Your daily briefing</p>
          </div>
        </div>
        {q.data && (
          <Button variant="ghost" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={q.isFetching ? "animate-spin" : ""} /> Refresh
          </Button>
        )}
      </div>

      {!q.data && !q.isFetching && !q.error && (
        <Button className="mt-4" onClick={() => setEnabled(true)}>
          Get today's briefing
        </Button>
      )}
      {q.isFetching && !q.data && (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> {agent} is looking at your deadlines…
        </p>
      )}
      {q.error && (
        <div className="mt-4 text-sm text-destructive">
          {q.error.message}{" "}
          <button className="underline" onClick={() => q.refetch()}>Try again</button>
        </div>
      )}
      {q.data && (
        <div className="mt-4 space-y-4">
          <p className="font-medium">{q.data.greeting}</p>
          <p className="text-sm leading-relaxed text-ink-soft">{q.data.summary}</p>
          {q.data.focus.length > 0 && (
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {q.data.focus.map((f, i) => <li key={i}>{f}</li>)}
            </ol>
          )}
          {q.data.actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {q.data.actions.map((a) => (
                <Button key={a.id} variant="outline" size="sm" disabled={done.has(a.id)} onClick={() => run(a)}>
                  <Check /> {done.has(a.id) ? "Done" : a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
