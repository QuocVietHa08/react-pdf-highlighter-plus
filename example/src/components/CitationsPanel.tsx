import React, { useState } from "react";
import {
  Sparkles,
  CornerDownLeft,
  Loader2,
  Trash2,
  FileText,
  X,
} from "lucide-react";

export interface CitationListItem {
  id: string;
  quote: string;
  /** The text actually searched to locate it (quote, or the matched sentence). */
  searchText: string;
  pageNumber: number;
  confidence: "exact" | "fuzzy";
}

interface CitationsPanelProps {
  citations: CitationListItem[];
  activeId?: string | null;
  loading?: boolean;
  /** Resolve + add a citation for the given quote. Returns false if not found. */
  onFind: (quote: string) => Promise<boolean>;
  onJump: (id: string) => void;
  onClear?: () => void;
  onClose?: () => void;
}

/**
 * Demo panel that simulates an AI answer's citations: paste a quote, resolve it
 * to a location in the PDF, then click any citation to jump + highlight it.
 */
export function CitationsPanel({
  citations,
  activeId,
  loading,
  onFind,
  onJump,
  onClear,
  onClose,
}: CitationsPanelProps) {
  const [quote, setQuote] = useState("");
  const [notFound, setNotFound] = useState(false);

  const submit = async () => {
    const text = quote.trim();
    if (!text) return;
    setNotFound(false);
    const ok = await onFind(text);
    if (ok) setQuote("");
    else setNotFound(true);
  };

  return (
    <div className="flex w-80 flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3.5 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
          <Sparkles className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
        </div>
        <span className="text-sm font-semibold">Citations</span>
        {citations.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {citations.length}
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {citations.length > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear citations"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close citations"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="p-3">
        <textarea
          value={quote}
          onChange={(e) => {
            setQuote(e.target.value);
            setNotFound(false);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="Paste a sentence the AI cited…"
          aria-label="Citation quote"
          className="w-full resize-none rounded-lg border bg-muted/30 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/70 focus:border-blue-500/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={submit}
            disabled={loading || !quote.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Find &amp; cite
          </button>
          <span className="text-[11px] text-muted-foreground">
            ⌘/Ctrl + Enter
          </span>
        </div>
        {notFound && (
          <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            Couldn't locate that text in the PDF.
          </p>
        )}
      </div>

      {/* Citation list */}
      {citations.length > 0 && (
        <div className="border-t">
          <ul className="max-h-72 overflow-y-auto p-2">
            {citations.map((c, i) => {
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onJump(c.id)}
                    aria-current={active}
                    className={`group flex w-full gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                      active
                        ? "border-blue-500/60 bg-blue-500/10"
                        : "border-transparent hover:border-border hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-muted text-muted-foreground group-hover:bg-blue-500/15 group-hover:text-blue-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[13px] leading-snug">
                        {c.quote}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <FileText className="h-3 w-3" aria-hidden="true" />
                        Page {c.pageNumber}
                        {c.confidence === "fuzzy" && (
                          <span className="rounded bg-amber-500/15 px-1 py-px font-medium text-amber-600">
                            approx
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
