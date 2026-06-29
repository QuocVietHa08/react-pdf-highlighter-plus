import { useCallback, useEffect, useRef, useState } from "react";

import type { TtsEngine, TtsVoice } from "./tts";

export type ReaderStatus = "idle" | "loading" | "playing" | "paused";

interface UseReaderParams<S> {
  engine: TtsEngine;
  /** Build the ordered reading script (called once, lazily, on first play). */
  buildScript: () => Promise<S[]>;
  /** Extract the spoken text from a script entry. */
  getText: (sentence: S) => string;
  /** Called when a sentence starts being read — highlight + scroll to it. */
  onReadSentence: (sentence: S, index: number) => void;
  /** Called when reading stops/finishes — clear the reading highlight. */
  onStop?: () => void;
  /** Change this (e.g. the document URL) to discard the cached script + reset. */
  resetKey?: unknown;
}

/**
 * Drives a text-to-speech engine over an ordered script, one entry at a time,
 * notifying the consumer which sentence is active so it can highlight + scroll.
 * Engine-agnostic (Web Speech today, a cloud voice later).
 */
export function useReader<S>({
  engine,
  buildScript,
  getText,
  onReadSentence,
  onStop,
  resetKey,
}: UseReaderParams<S>) {
  const [status, setStatus] = useState<ReaderStatus>("idle");
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [total, setTotal] = useState(0);
  const [rate, setRate] = useState(1);
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);
  const [voices, setVoices] = useState<TtsVoice[]>([]);

  const scriptRef = useRef<S[] | null>(null);
  // Bumped on every (re)start; an utterance's onEnd is ignored unless its token
  // still matches — so a cancel/seek can't trigger a phantom auto-advance.
  const tokenRef = useRef(0);
  const statusRef = useRef<ReaderStatus>("idle");
  const rateRef = useRef(rate);
  const voiceRef = useRef(voiceId);
  rateRef.current = rate;
  voiceRef.current = voiceId;

  const setStatusBoth = (s: ReaderStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  // Voices load asynchronously in some browsers.
  useEffect(() => {
    const update = () => setVoices(engine.getVoices());
    update();
    const synth =
      typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (synth) {
      synth.addEventListener("voiceschanged", update);
      return () => synth.removeEventListener("voiceschanged", update);
    }
    return undefined;
  }, [engine]);

  // Stop speaking if the component goes away.
  useEffect(() => () => engine.cancel(), [engine]);

  // Discard the cached script + reset when the document changes.
  useEffect(() => {
    tokenRef.current += 1;
    engine.cancel();
    scriptRef.current = null;
    setTotal(0);
    setCurrentIndex(-1);
    setStatusBoth("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const speakIndex = useCallback(
    (index: number) => {
      const script = scriptRef.current;
      if (!script) return;
      if (!Number.isFinite(index) || index < 0 || index >= script.length) {
        tokenRef.current += 1;
        engine.cancel();
        setStatusBoth("idle");
        setCurrentIndex(-1);
        onStop?.();
        return;
      }
      const token = ++tokenRef.current;
      setCurrentIndex(index);
      onReadSentence(script[index]!, index);
      console.log(
        `[reader] speak ${index + 1}/${script.length}:`,
        getText(script[index]!).slice(0, 60),
      );
      engine.speak(getText(script[index]!), {
        rate: rateRef.current,
        voiceId: voiceRef.current,
        onEnd: () => {
          if (token !== tokenRef.current) return; // stale (seeked/stopped)
          if (statusRef.current !== "playing") return;
          speakIndex(index + 1);
        },
        onError: () => {
          if (token !== tokenRef.current) return;
          if (statusRef.current === "playing") speakIndex(index + 1); // skip
        },
      });
    },
    [engine, getText, onReadSentence, onStop],
  );

  const play = useCallback(
    async (fromIndex?: number) => {
      if (!scriptRef.current) {
        setStatusBoth("loading");
        scriptRef.current = await buildScript();
        setTotal(scriptRef.current.length);
        console.log(
          `[reader] script ready: ${scriptRef.current.length} sentences`,
        );
      }
      setStatusBoth("playing");
      const start =
        typeof fromIndex === "number" && Number.isFinite(fromIndex)
          ? fromIndex
          : currentIndex >= 0
            ? currentIndex
            : 0;
      speakIndex(start);
    },
    [buildScript, currentIndex, speakIndex],
  );

  const pause = useCallback(() => {
    engine.pause();
    setStatusBoth("paused");
  }, [engine]);

  const resume = useCallback(() => {
    engine.resume();
    setStatusBoth("playing");
  }, [engine]);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    engine.cancel();
    setStatusBoth("idle");
    setCurrentIndex(-1);
    onStop?.();
  }, [engine, onStop]);

  const seek = useCallback(
    (index: number) => {
      if (statusRef.current === "idle" || statusRef.current === "loading") {
        play(index);
        return;
      }
      setStatusBoth("playing"); // a seek implies playing
      speakIndex(index);
    },
    [play, speakIndex],
  );

  return {
    status,
    currentIndex,
    total,
    rate,
    setRate,
    voices,
    voiceId,
    setVoiceId,
    play,
    pause,
    resume,
    stop,
    seek,
  };
}
