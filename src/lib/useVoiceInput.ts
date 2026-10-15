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

// ---- Free, in-browser speech recognition (no AI credits) -------------------
type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const VOICE_LANG_KEY = "voiceLang";
export type VoiceLang = "en-US" | "ar-EG";

export function getVoiceLang(): VoiceLang {
  try {
    return localStorage.getItem(VOICE_LANG_KEY) === "ar-EG" ? "ar-EG" : "en-US";
  } catch {
    return "en-US";
  }
}

export function setVoiceLang(lang: VoiceLang) {
  try {
    localStorage.setItem(VOICE_LANG_KEY, lang);
  } catch {
    /* storage can be unavailable (private mode) */
  }
}

export function useVoiceInput(onText: (text: string) => void) {
  const transcribe = useServerFn(transcribeAudio);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const recRef = useRef<SpeechRec | null>(null);
  const stateRef = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    node: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    chunks: Float32Array[];
  } | null>(null);

  const startBrowser = useCallback((Ctor: new () => SpeechRec) => {
    const rec = new Ctor();
    rec.lang = getVoiceLang();
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let gotText = false;
    let failed = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) {
        gotText = true;
        onTextRef.current(text);
      }
    };
    rec.onerror = (e) => {
      failed = true;
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        toast.error("Microphone access is needed to use your voice.");
      else if (e.error === "network")
        toast.error("Voice input needs an internet connection.");
      else if (e.error !== "aborted" && e.error !== "no-speech") toast.error("Voice input failed.");
      else if (e.error === "no-speech") toast.error("Nothing was picked up — please try again.");
    };
    rec.onend = () => {
      recRef.current = null;
      setRecording(false);
      setBusy(false);
      if (!gotText && !failed) toast.error("Nothing was picked up — please try again.");
    };
    try {
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      recRef.current = null;
      toast.error("Could not start voice input.");
    }
  }, []);

  const start = useCallback(async () => {
    // Free path: the browser's own speech recognition (Chrome, Edge, Safari).
    const Ctor = getSpeechRecognition();
    if (Ctor) {
      startBrowser(Ctor);
      return;
    }
    // Fallback (e.g. Firefox): record and transcribe on the server (uses AI credits).
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
  }, [startBrowser]);

  const stop = useCallback(async () => {
    if (recRef.current) {
      setRecording(false);
      setBusy(true);
      recRef.current.stop();
      return;
    }
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
