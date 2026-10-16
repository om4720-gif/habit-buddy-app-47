import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { getVoiceEngine, transcribeAudio } from "@/lib/transcribe.functions";

// Two ways to listen:
//  1. Cloud (Gemini, using your FALLBACK_AI_API_KEY): far better with Arabic and mixed Arabic/English.
//  2. Browser speech recognition (Chrome, Edge, Safari): free, no key needed, weaker with Arabic.
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

/** Mono 16 kHz WAV: small to upload, and plenty for speech. */
export function toWav16k(chunks: Float32Array[], sampleRate: number): Blob {
  let length = 0;
  for (const c of chunks) length += c.length;
  const all = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.length;
  }

  const target = 16000;
  let samples = all;
  let rate = sampleRate;
  if (sampleRate > target) {
    const ratio = sampleRate / target;
    const out = new Float32Array(Math.floor(all.length / ratio));
    for (let i = 0; i < out.length; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(all.length, Math.floor((i + 1) * ratio));
      let sum = 0;
      for (let j = start; j < end; j++) sum += all[j] ?? 0;
      out[i] = sum / Math.max(1, end - start);
    }
    samples = out;
    rate = target;
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
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
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
  const getEngine = useServerFn(getVoiceEngine);
  const engine = useQuery({ queryKey: ["voice-engine"], queryFn: () => getEngine(), staleTime: Infinity, retry: false });
  const cloud = engine.data?.cloud === true;

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const recRef = useRef<SpeechRec | null>(null);
  const cloudRef = useRef<{
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
      else if (e.error === "network") toast.error("Voice input needs an internet connection.");
      else if (e.error === "no-speech") toast.error("Nothing was picked up — please try again.");
      else if (e.error !== "aborted") toast.error("Voice input failed.");
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

  const startCloud = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node);
      node.connect(ctx.destination);
      cloudRef.current = { stream, ctx, node, source, chunks };
      setRecording(true);
    } catch {
      toast.error("Microphone access is needed to use your voice.");
    }
  }, []);

  const start = useCallback(() => {
    if (cloud) return void startCloud();
    const Ctor = getSpeechRecognition();
    if (Ctor) return startBrowser(Ctor);
    toast.error("Voice input isn't supported in this browser. Try Chrome, Edge or Safari.");
  }, [cloud, startBrowser, startCloud]);

  const stop = useCallback(async () => {
    if (recRef.current) {
      setRecording(false);
      setBusy(true);
      recRef.current.stop();
      return;
    }
    const s = cloudRef.current;
    cloudRef.current = null;
    setRecording(false);
    if (!s) return;
    s.stream.getTracks().forEach((t) => t.stop());
    s.node.disconnect();
    s.source.disconnect();
    const blob = toWav16k(s.chunks, s.ctx.sampleRate);
    await s.ctx.close();
    if (blob.size < 6400) {
      toast.error("That recording was empty — please try again.");
      return;
    }
    setBusy(true);
    try {
      const res = await transcribe({ data: { audioBase64: await blobToBase64(blob) } });
      if (!res.text) {
        toast.error("Nothing was picked up — please try again.");
        return;
      }
      onTextRef.current(res.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice input failed.");
    } finally {
      setBusy(false);
    }
  }, [transcribe]);

  const toggle = useCallback(() => {
    if (recording) void stop();
    else start();
  }, [recording, start, stop]);

  return { recording, busy, toggle };
}
