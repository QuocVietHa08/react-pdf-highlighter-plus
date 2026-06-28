import React, {
  CSSProperties,
  MouseEvent,
  ReactNode,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";

import {
  copyTextToClipboard,
  extractTextFromHighlightRect,
} from "../lib/copy-highlight-content";
import { findOrCreateHighlightConfigLayer } from "../lib/highlight-config-layer";
import type { ViewportHighlight } from "../types";

/**
 * Style options for text highlight appearance.
 */
export interface TextHighlightStyle {
  highlightColor?: string;
  highlightStyle?: "highlight" | "underline" | "strikethrough";
}

/**
 * The props type for {@link TextHighlight}.
 *
 * @category Component Properties
 */
export interface TextHighlightProps {
  /**
   * Highlight to render over text.
   */
  highlight: ViewportHighlight;

  /**
   * Callback triggered whenever the user clicks on the part of a highlight.
   *
   * @param event - Mouse event associated with click.
   */
  onClick?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Callback triggered whenever the user enters the area of a text highlight.
   *
   * @param event - Mouse event associated with movement.
   */
  onMouseOver?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Callback triggered whenever the user leaves  the area of a text highlight.
   *
   * @param event - Mouse event associated with movement.
   */
  onMouseOut?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Indicates whether the component is autoscrolled into view, affecting
   * default theming.
   */
  isScrolledTo: boolean;

  /**
   * Callback triggered whenever the user tries to open context menu on highlight.
   *
   * @param event - Mouse event associated with click.
   */
  onContextMenu?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Optional CSS styling applied to each TextHighlight part.
   */
  style?: CSSProperties;

  /**
   * Background/line color for the highlight.
   * Default: "rgba(255, 226, 143, 1)" (yellow)
   */
  highlightColor?: string;

  /**
   * Style mode for the highlight.
   * - "highlight": Solid background color (default)
   * - "underline": Line under the text
   * - "strikethrough": Line through the text
   */
  highlightStyle?: "highlight" | "underline" | "strikethrough";

  /**
   * Callback triggered when the style changes.
   */
  onStyleChange?(style: TextHighlightStyle): void;

  /**
   * Text to copy for this highlight.
   */
  copyText?: string;

  /**
   * Callback triggered when the delete button is clicked.
   */
  onDelete?(): void;

  /**
   * Custom style icon. Replaces the default palette icon.
   */
  styleIcon?: ReactNode;

  /**
   * Custom delete icon. Replaces the default trash icon.
   */
  deleteIcon?: ReactNode;

  /**
   * Custom color presets for the style panel.
   * Default: ["rgba(255, 226, 143, 1)", "#ffcdd2", "#c8e6c9", "#bbdefb", "#e1bee7"]
   */
  colorPresets?: string[];
}

// Default icons
const DefaultStyleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
  </svg>
);

const DefaultDeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

const DefaultCopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
  </svg>
);

const DefaultCopiedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
  </svg>
);

// Highlight style icons
const HighlightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 14l3 3v5h6v-5l3-3V9H6v5zm5-12h2v3h-2V2zM3.5 5.875L4.914 4.46l2.12 2.122L5.622 8 3.5 5.875zm13.46.71l2.123-2.12 1.414 1.414L18.375 8l-1.414-1.414z" />
  </svg>
);

const UnderlineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z" />
  </svg>
);

const StrikethroughIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z" />
  </svg>
);

// Default color presets
const DEFAULT_COLOR_PRESETS = [
  "rgba(255, 226, 143, 1)", // Yellow (default)
  "#ffcdd2", // Light red
  "#c8e6c9", // Light green
  "#bbdefb", // Light blue
  "#e1bee7", // Light purple
];

/**
 * A component for displaying a highlighted text area.
 *
 * @category Component
 */
export const TextHighlight = ({
  highlight,
  onClick,
  onMouseOver,
  onMouseOut,
  isScrolledTo,
  onContextMenu,
  style,
  highlightColor = "rgba(255, 226, 143, 1)",
  highlightStyle = "highlight",
  onStyleChange,
  onDelete,
  styleIcon,
  deleteIcon,
  copyText,
  colorPresets = DEFAULT_COLOR_PRESETS,
}: TextHighlightProps) => {
  const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [configLayer, setConfigLayer] = useState<HTMLElement | null>(null);
  const stylePanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      setConfigLayer(findOrCreateHighlightConfigLayer(containerRef.current));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  // Close style panel when clicking outside
  useEffect(() => {
    if (!isStylePanelOpen) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        stylePanelRef.current &&
        !stylePanelRef.current.contains(e.target as Node)
      ) {
        setIsStylePanelOpen(false);
      }
    };

    // Delay adding listener to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isStylePanelOpen]);

  const highlightClass = isScrolledTo ? "TextHighlight--scrolledTo" : "";
  const { rects } = highlight.position;

  // Get the first rect to position the toolbar
  const firstRect = rects[0];

  // Build style class based on highlight style
  const getPartStyleClass = () => {
    switch (highlightStyle) {
      case "underline":
        return "TextHighlight__part--underline";
      case "strikethrough":
        return "TextHighlight__part--strikethrough";
      default:
        return "";
    }
  };

  // Build inline style for each part
  const getPartStyle = (rect: typeof firstRect): CSSProperties => {
    const baseStyle: CSSProperties = { ...rect, ...style };

    if (highlightStyle === "highlight") {
      // --hl-fill-alpha (set to <100% in dark mode by PdfHighlighter.css) makes
      // the fill translucent so the light recolored text stays readable, while
      // the element stays fully opaque so the border ring isn't dimmed. Light
      // mode leaves the var unset → 100% → the original opaque color.
      baseStyle.backgroundColor = `color-mix(in srgb, ${highlightColor} var(--hl-fill-alpha, 100%), transparent)`;
    } else {
      // For underline and strikethrough, use the color for the line
      baseStyle.backgroundColor = "transparent";
      baseStyle.color = highlightColor;
    }

    return baseStyle;
  };

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const text =
      copyText ||
      highlight.content?.text ||
      (containerRef.current && firstRect
        ? extractTextFromHighlightRect(containerRef.current, firstRect)
        : "");

    await copyTextToClipboard(text);
    setIsCopied(true);

    if (copyResetTimeoutRef.current) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }

    copyResetTimeoutRef.current = window.setTimeout(() => {
      setIsCopied(false);
      copyResetTimeoutRef.current = null;
    }, 1500);
  };

  return (
    <div
      className={`TextHighlight ${highlightClass}`}
      onContextMenu={onContextMenu}
      ref={containerRef}
    >
      {configLayer && (onStyleChange || onDelete) && firstRect &&
        createPortal(
        <div
          className="TextHighlight__toolbar-wrapper"
          style={{
            position: "absolute",
            left: firstRect.left,
            top: firstRect.top - 28,
            paddingBottom: 12,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={`TextHighlight__toolbar ${isHovered || isScrolledTo || isStylePanelOpen ? "TextHighlight__toolbar--visible" : ""}`}
          >
            {onStyleChange && (
              <button
                className="TextHighlight__style-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStylePanelOpen(!isStylePanelOpen);
                }}
                title="Change style"
                type="button"
              >
                {styleIcon || <DefaultStyleIcon />}
              </button>
            )}
            <button
              className="TextHighlight__copy-button"
              onClick={handleCopy}
              title={isCopied ? "Copied" : "Copy text"}
              type="button"
            >
              {isCopied ? <DefaultCopiedIcon /> : <DefaultCopyIcon />}
            </button>
            {onDelete && (
              <button
                className="TextHighlight__delete-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete"
                type="button"
              >
                {deleteIcon || <DefaultDeleteIcon />}
              </button>
            )}
          </div>

          {/* Style Panel - inside wrapper */}
          {isStylePanelOpen && onStyleChange && (
            <div
              className="TextHighlight__style-panel"
              ref={stylePanelRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="TextHighlight__style-row">
                <label>Style</label>
                <div className="TextHighlight__style-buttons">
                  <button
                    type="button"
                    className={`TextHighlight__style-type-button ${highlightStyle === "highlight" ? "active" : ""}`}
                    onClick={() =>
                      onStyleChange({ highlightStyle: "highlight" })
                    }
                    title="Highlight"
                  >
                    <HighlightIcon />
                  </button>
                  <button
                    type="button"
                    className={`TextHighlight__style-type-button ${highlightStyle === "underline" ? "active" : ""}`}
                    onClick={() =>
                      onStyleChange({ highlightStyle: "underline" })
                    }
                    title="Underline"
                  >
                    <UnderlineIcon />
                  </button>
                  <button
                    type="button"
                    className={`TextHighlight__style-type-button ${highlightStyle === "strikethrough" ? "active" : ""}`}
                    onClick={() =>
                      onStyleChange({ highlightStyle: "strikethrough" })
                    }
                    title="Strikethrough"
                  >
                    <StrikethroughIcon />
                  </button>
                </div>
              </div>
              <div className="TextHighlight__style-row">
                <label>Color</label>
                <div className="TextHighlight__color-options">
                  <div className="TextHighlight__color-presets">
                    {colorPresets.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`TextHighlight__color-preset ${highlightColor === c ? "active" : ""}`}
                        style={{ backgroundColor: c }}
                        onClick={() => onStyleChange({ highlightColor: c })}
                        title={c}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={highlightColor}
                    onChange={(e) => {
                      onStyleChange({ highlightColor: e.target.value });
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>,
          configLayer,
        )}

      <div
        className="TextHighlight__parts"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {rects.map((rect, index) => (
          <div
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
            onClick={onClick}
            key={index}
            style={getPartStyle(rect)}
            className={`TextHighlight__part ${getPartStyleClass()}`}
          />
        ))}
      </div>
    </div>
  );
};
