import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Mic, Send, Square, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askMero } from "@/lib/mero-chat.functions";
import { useVoiceInput } from "@/lib/useVoiceInput";

type Msg = { role: "user" | "assistant"; content: string };
const isArabic = (t: string) => /[\u0600-\u06FF]/.test(t);

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = isArabic(text) ? "ar-EG" : "en-US";
  const v = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function MeroChat() {
  const qc = useQueryClient();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, thinking]);

  const send = useCallback(
    async (content: string) => {
      const c = content.trim();
      if (!c || thinking) return;
      const next = [...msgs, { role: "user" as const, content: c }].slice(-20);
      setMsgs(next);
      setText("");
      setThinking(true);
      try {
        const res = await askMero({ data: { today: format(new Date(), "yyyy-MM-dd"), messages: next } });
        setMsgs((m) => [...m, { role: "assistant", content: res.reply }]);
        if (voiceOn) speak(res.reply);
        if (res.changed) qc.invalidateQueries();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Mero couldn't answer.");
      } finally {
        setThinking(false);
      }
    },
    [msgs, thinking, voiceOn, qc],
  );

  const { recording, busy, toggle } = useVoiceInput(send);

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Talk to Mero · تكلم مع ميرو</p>
        <button
          aria-label={voiceOn ? "Mute Mero" : "Unmute Mero"}
          onClick={() => { setVoiceOn((v) => !v); window.speechSynthesis?.cancel(); }}
          className="rounded-full p-1 text-ink-soft hover:bg-muted"
        >
          {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {msgs.length === 0 && (
          <p className="text-xs text-ink-soft">
            Tap the mic and say "I finished Steel lecture 2" or "خلصت كويز المرور".
          </p>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            dir="auto"
            className={
              m.role === "user"
                ? "ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                : "max-w-[90%] text-sm leading-relaxed"
            }
          >
            {m.content}
          </div>
        ))}
        {thinking && (
          <p className="flex items-center gap-2 text-xs text-ink-soft">
            <Loader2 className="h-3 w-3 animate-spin" /> Mero is thinking…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); void send(text); }}
      >
        <Button
          type="button"
          size="icon"
          onClick={toggle}
          disabled={busy || thinking}
          aria-label={recording ? "Stop and send" : "Speak to Mero"}
          className={`h-11 w-11 shrink-0 rounded-full ${recording ? "animate-pulse bg-destructive text-destructive-foreground" : ""}`}
        >
          {busy ? <Loader2 className="animate-spin" /> : recording ? <Square /> : <Mic />}
        </Button>
        <Input dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type…" />
        <Button type="submit" size="icon" variant="ghost" disabled={!text.trim() || thinking} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  );
}
