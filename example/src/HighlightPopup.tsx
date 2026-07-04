import type { ViewportHighlight } from "./react-pdf-highlighter-extended";
import { CommentedHighlight } from "./types";
import React, { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";

/**
 * Comment button + editor panel, meant to slot into a highlight's own
 * toolbar via `extraButtons`/`extraPanel` (TextHighlight/AreaHighlight).
 * Keeping the comment inside the same selected-toolbar surface (instead of
 * a separate hover popup) means clicking a highlight always shows every
 * action in one place, comment included — no surface where you can select
 * a highlight but not see whether it has a note.
 *
 * `classPrefix` picks up the host component's existing button/panel CSS
 * (TextHighlight__* or AreaHighlight__*) so the comment button matches its
 * neighbors without the library needing to know about "comments" at all.
 */
export function useHighlightCommentControls(
  highlight: ViewportHighlight<CommentedHighlight>,
  onEdit: ((edit: Partial<CommentedHighlight>) => void) | undefined,
  classPrefix: "TextHighlight" | "AreaHighlight",
) {
  const [showComment, setShowComment] = useState(false);
  const [draft, setDraft] = useState(highlight.comment || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_TEXTAREA_HEIGHT = 160;

  useEffect(() => {
    if (showComment) setDraft(highlight.comment || "");
  }, [showComment]);

  useEffect(() => {
    if (showComment) textareaRef.current?.focus();
  }, [showComment]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !showComment) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [showComment, draft]);

  const hasComment = !!highlight.comment;

  const commit = () => onEdit?.({ comment: draft });

  const close = () => setShowComment(false);

  const button = onEdit ? (
    <button
      type="button"
      className={`${classPrefix}__comment-button ${showComment ? "active" : ""}`}
      aria-label={hasComment ? "View note" : "Add a note"}
      title={hasComment ? "View note" : "Add a note"}
      onClick={(e) => {
        e.stopPropagation();
        setShowComment((v) => !v);
      }}
    >
      <MessageSquare width={14} height={14} aria-hidden="true" />
      {hasComment && !showComment && (
        <span className={`${classPrefix}__comment-dot`} aria-hidden="true" />
      )}
    </button>
  ) : null;

  const panel =
    onEdit && showComment ? (
      <div
        className={`${classPrefix}__comment-panel`}
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            commit();
            close();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
              close();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(highlight.comment || "");
              close();
            }
          }}
          rows={2}
          placeholder="Add a note…"
        />
      </div>
    ) : null;

  return { button, panel, showComment };
}
