import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const transcribeAudio = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        audioBase64: z.string().min(100),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Voice input is not configured.");

    const binary = Uint8Array.from(atob(data.audioBase64), (c) =>
      c.charCodeAt(0)
    );
    if (binary.byteLength > 20 * 1024 * 1024) {
      throw new Error("Recording is too long.");
    }

    const form = new FormData();
    form.append("model", "google/gemini-3.5-transcribe");
    form.append(
      "file",
      new Blob([binary], { type: "audio/wav" }),
      "recording.wav"
    );

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Transcription failed [${res.status}]: ${body}`);
      if (res.status === 429) throw new Error("Too many requests, try again shortly.");
      if (res.status === 402 || res.status === 403)
        throw new Error("Voice input is unavailable right now.");
      throw new Error("Could not understand that recording.");
    }

    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });
