"use client";

import { useState, useRef, useCallback } from "react";

export function useVoiceInput({
  onTranscript,
}: {
  onTranscript: (text: string) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopListening = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const startListening = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("[STT] mic access denied:", err);
      return;
    }

    chunksRef.current = [];

    // Prefer webm/opus; fall back to whatever the browser supports
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
    console.log("[STT] mimeType:", mimeType || "(browser default)");

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setIsListening(false);

      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
      console.log("[STT] blob size:", blob.size);
      if (blob.size === 0) { console.warn("[STT] empty blob, skipping"); return; }

      try {
        const res = await fetch("/api/stt", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "x-audio-mime": mimeType || "audio/webm",
          },
          body: blob,
        });
        const data = await res.json();
        console.log("[STT] response:", res.status, data);
        if (data.transcript) onTranscript(data.transcript);
        else console.warn("[STT] no transcript in response");
      } catch (err) {
        console.error("[STT] fetch error:", err);
      }
    };

    recorder.onerror = (e) => console.error("[STT] recorder error:", e);
    recorder.start();
    console.log("[STT] recording started");
    setIsListening(true);
  }, [onTranscript]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return { isListening, toggleListening };
}
