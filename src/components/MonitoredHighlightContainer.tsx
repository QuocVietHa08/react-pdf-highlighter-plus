import React, { ReactNode, useRef } from "react";
import { usePdfHighlighterContext } from "../contexts/PdfHighlighterContext";
import { Tip } from "../types";
import { MouseMonitor } from "./MouseMonitor";

/**
 * The props type for {@link MonitoredHighlightContainer}.
 *
 * @category Component Properties
 */
export interface MonitoredHighlightContainerProps {
  /**
   * A callback triggered whenever the mouse hovers over a highlight.
   */
  onMouseEnter?(): void;

  /**
   * What tip to automatically display whenever a mouse hovers over a highlight.
   * The tip will persist even as the user puts their mouse over it and not the
   * highlight, but will disappear once it no longer hovers both.
   */
  highlightTip?: Tip;

  /**
   * A callback triggered whenever the mouse completely moves out from both the
   * highlight (children) and any highlightTip.
   */
  onMouseLeave?(): void;

  /**
   * Component to monitor mouse activity over. This should be a highlight within the {@link PdfHighlighter}.
   */
  children: ReactNode;
}

/**
 * A container for a highlight component that monitors whether a mouse is over a
 * highlight and over some secondary highlight tip. It will display the tip
 * whenever the mouse is over the highlight and it will hide the tip only when
 * the mouse has left the highlight AND the tip.
 *
 * @category Component
 */
export const MonitoredHighlightContainer = ({
  onMouseEnter,
  highlightTip,
  onMouseLeave,
  children,
}: MonitoredHighlightContainerProps) => {
  const mouseInRef = useRef(false); // Whether the mouse is over the child (highlight)

  const { setTip, isEditingOrHighlighting, isHighlightSelected } =
    usePdfHighlighterContext();

  return (
    <div
      onMouseEnter={() => {
        mouseInRef.current = true;
        onMouseEnter && onMouseEnter();

        if (isEditingOrHighlighting()) return;
        // A selected highlight's toolbar owns the space above — no hover tip.
        if (isHighlightSelected()) return;

        if (highlightTip) {
          // MouseMonitor the highlightTip to prevent it from disappearing if the mouse is over it and not the highlight.
          const monitoredHighlightTip = (
            <MouseMonitor
              onMoveAway={() => {
                // The event will keep triggering if the mouse is not on the highlightTip,
                // but don't do anything if the mouse is over the highlight.
                if (mouseInRef.current) {
                  return;
                }

                setTip(null);
                onMouseLeave && onMouseLeave();
              }}
              paddingX={60}
              paddingY={30}
            >
              {highlightTip.content}
            </MouseMonitor>
          );

          setTip({
            position: highlightTip.position,
            content: monitoredHighlightTip,
          });
        }
      }}
      onMouseLeave={() => {
        mouseInRef.current = false;

        // Trigger onMouseLeave if no highlightTip exists
        !highlightTip && onMouseLeave && onMouseLeave();
      }}
    >
      {children}
    </div>
  );
};
