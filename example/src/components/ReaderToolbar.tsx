import React from "react";
import { Play, Pause, Square, Headphones, Loader2 } from "lucide-react";
import type { ReaderStatus } from "../lib/useReader";
import type { TtsVoice } from "../lib/tts";

interface ReaderToolbarProps {
  status: ReaderStatus;
  currentIndex: number;
  total: number;
  rate: number;
  voices: TtsVoice[];
  voiceId?: string;
  onRateChange: (rate: number) => void;
  onVoiceChange: (id: string) => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSeek: (index: number) => void;
}

/** Floating read-aloud transport: a compact pill when idle, a full player while
 *  reading. */
export function ReaderToolbar({
  status,
  currentIndex,
  total,
  rate,
  voices,
  voiceId,
  onRateChange,
  onVoiceChange,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSeek,
}: ReaderToolbarProps) {
  // Idle: compact "Read aloud" pill.
  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={() => onPlay()}
        className="inline-flex items-center gap-2 rounded-full border bg-background/95 px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur transition-colors hover:bg-muted"
      >
        <Headphones className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        Read aloud
      </button>
    );
  }

  const playing = status === "playing";
  const loading = status === "loading";
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  return (
    <div className="flex w-[28rem] max-w-[90vw] items-center gap-3 rounded-full border bg-background/95 px-3 py-2 shadow-xl backdrop-blur">
      {/* Play / Pause / Resume */}
      <button
        type="button"
        onClick={() => {
          if (loading) return;
          if (playing) onPause();
          else if (status === "paused") onResume();
          else onPlay();
        }}
        disabled={loading}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : playing ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4 translate-x-px" aria-hidden="true" />
        )}
      </button>

      {/* Stop */}
      <button
        type="button"
        onClick={onStop}
        aria-label="Stop"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Square className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {/* Progress */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={Number.isFinite(currentIndex) && currentIndex > 0 ? currentIndex : 0}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Reading position"
          className="h-1.5 w-full cursor-pointer accent-emerald-600"
          style={{
            background: `linear-gradient(to right, rgb(5 150 105) ${progress}%, hsl(var(--muted)) ${progress}%)`,
          }}
        />
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {loading
            ? "Preparing…"
            : `Sentence ${currentIndex + 1} / ${total}`}
        </span>
      </div>

      {/* Speed */}
      <select
        value={rate}
        onChange={(e) => onRateChange(Number(e.target.value))}
        aria-label="Reading speed"
        className="flex-shrink-0 rounded-md border bg-transparent px-1.5 py-1 text-xs"
      >
        {[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
          <option key={r} value={r}>
            {r}×
          </option>
        ))}
      </select>

      {/* Voice */}
      {voices.length > 0 && (
        <select
          value={voiceId ?? ""}
          onChange={(e) => onVoiceChange(e.target.value)}
          aria-label="Voice"
          className="hidden max-w-[7rem] flex-shrink-0 truncate rounded-md border bg-transparent px-1.5 py-1 text-xs sm:block"
        >
          <option value="">Default voice</option>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
