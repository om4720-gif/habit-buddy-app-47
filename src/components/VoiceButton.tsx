import { Loader2, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVoiceInput } from "@/lib/useVoiceInput";

export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const { recording, busy, toggle } = useVoiceInput(onText);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggle}
      disabled={busy}
      title={recording ? "Stop and use my voice" : "Speak the title"}
      aria-label={recording ? "Stop recording" : "Record with your voice"}
      className={`shrink-0 rounded-full border-line ${
        recording ? "bg-rust text-cream hover:bg-rust/90" : "bg-card text-ink hover:bg-cream"
      }`}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : recording ? (
        <Square className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
    </Button>
  );
}
