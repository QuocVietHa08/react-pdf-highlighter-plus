// Pluggable text-to-speech layer. The reader talks to this interface, so the
// Web Speech engine can be swapped for a cloud voice (ElevenLabs/OpenAI) later
// without touching the reader logic.

export interface TtsVoice {
  id: string;
  name: string;
}

export interface SpeakOptions {
  rate?: number;
  voiceId?: string;
  onEnd?: () => void;
  onError?: (error?: unknown) => void;
}

export interface TtsEngine {
  readonly name: string;
  isSupported(): boolean;
  getVoices(): TtsVoice[];
  /** Speak `text`; calls onEnd when finished, onError on failure. */
  speak(text: string, options: SpeakOptions): void;
  pause(): void;
  resume(): void;
  /** Stop and clear anything queued. */
  cancel(): void;
}

/** Browser SpeechSynthesis engine — free, offline-ish, no backend. */
export class WebSpeechTts implements TtsEngine {
  readonly name = "Browser voice";
  private synth =
    typeof window !== "undefined" ? window.speechSynthesis : undefined;

  isSupported(): boolean {
    return !!this.synth;
  }

  getVoices(): TtsVoice[] {
    return (
      this.synth?.getVoices().map((v) => ({
        id: v.voiceURI,
        name: `${v.name} (${v.lang})`,
      })) ?? []
    );
  }

  speak(text: string, { rate = 1, voiceId, onEnd, onError }: SpeakOptions): void {
    if (!this.synth) {
      onError?.(new Error("SpeechSynthesis not supported"));
      return;
    }
    // Clear any pending utterance first (cancel may fire a stale onend — the
    // reader guards against that with a play token).
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    if (voiceId) {
      const voice = this.synth.getVoices().find((v) => v.voiceURI === voiceId);
      if (voice) utterance.voice = voice;
    }
    utterance.onend = () => onEnd?.();
    utterance.onerror = (e) => onError?.(e);
    this.synth.speak(utterance);
  }

  pause(): void {
    this.synth?.pause();
  }

  resume(): void {
    this.synth?.resume();
  }

  cancel(): void {
    this.synth?.cancel();
  }
}
