import { Loader2, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVoiceInput } from "@/lib/useVoiceInput";

export function VoiceButton({
  onText,
  label,
  idleTitle = "Speak the title",
}: {
  onText: (text: string) => void;
  label?: string;
  idleTitle?: string;
}) {
  const { recording, busy, toggle } = useVoiceInput(onText);

  const icon = busy ? (
    <Loader2 className="size-4 animate-spin" />
  ) : recording ? (
    <Square className="size-4" />
  ) : (
    <Mic className="size-4" />
  );

  return (
    <Button
      type="button"
      variant="outline"
      size={label ? "default" : "icon"}
      onClick={toggle}
      disabled={busy}
      title={recording ? "Stop and use my voice" : idleTitle}
      aria-label={recording ? "Stop recording" : idleTitle}
      className={`shrink-0 rounded-full border-line ${
        recording ? "bg-rust text-cream hover:bg-rust/90" : "bg-card text-ink hover:bg-cream"
      }`}
    >
      {icon}
      {label && (
        <span className="ml-2">
          {busy ? "Listening…" : recording ? "Stop" : label}
        </span>
      )}
    </Button>
  );
}
