import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { transcribeAudio } from "@/lib/transcribe.functions";

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  let length = 0;
  for (const c of chunks) length += c.length;
  const samples = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    samples.set(c, offset);
    offset += c.length;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let pos = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    pos += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the recording."));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export function useVoiceInput(onText: (text: string) => void) {
  const transcribe = useServerFn(transcribeAudio);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const stateRef = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    node: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    chunks: Float32Array[];
  } | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      node.onaudioprocess = (e) =>
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node);
      node.connect(ctx.destination);
      stateRef.current = { stream, ctx, node, source, chunks };
      setRecording(true);
    } catch {
      toast.error("Microphone access is needed to use your voice.");
    }
  }, []);

  const stop = useCallback(async () => {
    const s = stateRef.current;
    stateRef.current = null;
    setRecording(false);
    if (!s) return;
    s.stream.getTracks().forEach((t) => t.stop());
    s.node.disconnect();
    s.source.disconnect();
    const blob = encodeWav(s.chunks, s.ctx.sampleRate);
    await s.ctx.close();
    if (blob.size < 4096) {
      toast.error("That recording was empty — please try again.");
      return;
    }
    setBusy(true);
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await transcribe({ data: { audioBase64 } });
      if (!res.text) {
        toast.error("Nothing was picked up — please try again.");
        return;
      }
      onText(res.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice input failed.");
    } finally {
      setBusy(false);
    }
  }, [onText, transcribe]);

  const toggle = useCallback(() => {
    if (recording) void stop();
    else void start();
  }, [recording, start, stop]);

  return { recording, busy, toggle };
}
