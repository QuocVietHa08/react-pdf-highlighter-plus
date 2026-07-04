import React, {
  CSSProperties,
  MouseEvent,
  ReactNode,
  memo,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Copy,
  Highlighter,
  Palette,
  Strikethrough,
  Trash2,
  Underline,
} from "lucide-react";

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

  /**
   * Extra buttons rendered in the same toolbar row, after the copy button.
   * Use this to add consumer-defined actions (e.g. a comment toggle) without
   * needing a second, separate popup.
   */
  extraButtons?: ReactNode;

  /**
   * Extra content rendered below the toolbar row, in the same slot as the
   * built-in style panel (e.g. a comment editor opened by an extraButtons
   * toggle).
   */
  extraPanel?: ReactNode;
}

// Default icons — lucide-react, so the toolbar matches the example app's
// icon vocabulary instead of a separate hand-drawn set.
const DefaultStyleIcon = () => <Palette width={14} height={14} />;
const DefaultDeleteIcon = () => <Trash2 width={14} height={14} />;
const DefaultCopyIcon = () => <Copy width={14} height={14} />;
const DefaultCopiedIcon = () => <Check width={14} height={14} strokeWidth={2.5} />;
const ChevronDownIcon = () => <ChevronDown width={12} height={12} strokeWidth={2.5} />;
const CheckIcon = () => <Check width={14} height={14} strokeWidth={2.5} />;

// Highlight style icons
const HighlightIcon = () => <Highlighter width={16} height={16} />;
const UnderlineIcon = () => <Underline width={16} height={16} />;
const StrikethroughIcon = () => <Strikethrough width={16} height={16} />;

// Default color presets
const DEFAULT_COLOR_PRESETS = [
  "rgba(255, 226, 143, 1)", // Yellow (default)
  "#ffcdd2", // Light red
  "#c8e6c9", // Light green
  "#bbdefb", // Light blue
  "#e1bee7", // Light purple
];

// Display names for the default presets, used in the color dropdown. A
// custom preset (not in this map) just falls back to showing its own value.
const COLOR_NAMES: Record<string, string> = {
  "rgba(255, 226, 143, 1)": "Yellow",
  "#ffcdd2": "Red",
  "#c8e6c9": "Green",
  "#bbdefb": "Blue",
  "#e1bee7": "Purple",
};

/**
 * A component for displaying a highlighted text area.
 *
 * @category Component
 */
export const TextHighlight = memo(({
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
  extraButtons,
  extraPanel,
}: TextHighlightProps) => {
  const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [configLayer, setConfigLayer] = useState<HTMLElement | null>(null);
  const stylePanelRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarWrapperRef = useRef<HTMLDivElement>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);

  // Deselect on click outside / Escape (selection interaction model).
  // The toolbar is portaled outside the root, so clicks inside it must
  // also count as "inside".
  useEffect(() => {
    if (!isSelected) return;
    const handlePointerDown = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      const insideRoot = containerRef.current?.contains(target);
      const insideToolbar = toolbarWrapperRef.current?.contains(target);
      if (!insideRoot && !insideToolbar) {
        setIsSelected(false);
        setIsStylePanelOpen(false);
        setIsColorMenuOpen(false);
      }
    };
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSelected(false);
        setIsStylePanelOpen(false);
        setIsColorMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isSelected]);

  // Resolve the config layer on EVERY commit (no deps): at first mount the
  // text layer may not be attached to its .page yet (pdf.js builds it async),
  // which left configLayer null forever with a run-once effect — no toolbar.
  // The identity check makes steady-state re-runs free, and a pdf.js page
  // rebuild (which relocates our layer) self-heals on the next commit.
  useLayoutEffect(() => {
    if (containerRef.current) {
      const layer = findOrCreateHighlightConfigLayer(containerRef.current);
      setConfigLayer((prev) => (prev === layer ? prev : layer));
    }
  });

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

  // Close color menu when clicking outside
  useEffect(() => {
    if (!isColorMenuOpen) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        colorMenuRef.current &&
        !colorMenuRef.current.contains(e.target as Node)
      ) {
        setIsColorMenuOpen(false);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isColorMenuOpen]);

  const highlightClass = isScrolledTo ? "TextHighlight--scrolledTo" : "";
  const selectedClass = isSelected ? "TextHighlight--selected" : "";
  const { rects } = highlight.position;

  // Get the first rect to position the toolbar
  const firstRect = rects[0];

  // Not enough room above the box for the toolbar (e.g. the highlight sits
  // at the very top of the page) — flip it below instead of letting it
  // float up over whatever page content is above the box.
  const flipToolbar = !!firstRect && firstRect.top < 40;

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
      className={`TextHighlight ${highlightClass} ${selectedClass}`}
      onContextMenu={onContextMenu}
      ref={containerRef}
    >
      {configLayer && (onStyleChange || onDelete) && firstRect &&
        createPortal(
        <div
          className="TextHighlight__toolbar-wrapper"
          ref={toolbarWrapperRef}
          style={{
            position: "absolute",
            left: firstRect.left,
            top: firstRect.top,
          }}
        >
          <div
            className={`TextHighlight__toolbar ${flipToolbar ? "TextHighlight__toolbar--below" : ""} ${isSelected || isScrolledTo || isStylePanelOpen || isColorMenuOpen ? "TextHighlight__toolbar--visible" : ""}`}
          >
            {onStyleChange && (
              <>
                {/* Color as a dropdown (swatch + chevron) instead of a row of
                    dots — gives each preset room for a name and a checkmark
                    on the active one, and keeps the toolbar itself compact. */}
                <button
                  type="button"
                  className="TextHighlight__color-trigger"
                  aria-label="Highlight color"
                  aria-expanded={isColorMenuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsStylePanelOpen(false);
                    setIsColorMenuOpen((v) => !v);
                  }}
                  title="Highlight color"
                >
                  <span
                    className="TextHighlight__color-trigger-dot"
                    style={{ backgroundColor: highlightColor }}
                  />
                  <ChevronDownIcon />
                </button>
                <div className="TextHighlight__toolbar-divider" />
              </>
            )}
            {onStyleChange && (
              <button
                className="TextHighlight__style-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsColorMenuOpen(false);
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
            {extraButtons}
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
            </div>
          )}

          {/* Color dropdown - same slot as the style panel */}
          {isColorMenuOpen && onStyleChange && (
            <div
              className="TextHighlight__color-menu"
              ref={colorMenuRef}
              onClick={(e) => e.stopPropagation()}
            >
              {colorPresets.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="TextHighlight__color-menu-item"
                  onClick={() => {
                    onStyleChange({ highlightColor: c });
                    setIsColorMenuOpen(false);
                  }}
                >
                  <span
                    className="TextHighlight__color-menu-dot"
                    style={{ backgroundColor: c }}
                  />
                  <span className="TextHighlight__color-menu-label">
                    {COLOR_NAMES[c] || c}
                  </span>
                  {highlightColor === c && (
                    <span className="TextHighlight__color-menu-check">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {extraPanel}
        </div>,
          configLayer,
        )}

      <div
        className="TextHighlight__parts"
      >
        {rects.map((rect, index) => (
          <div
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
            onClick={(event) => {
              // Single click selects (shows the toolbar); existing
              // click behavior (e.g. hover tips) is preserved.
              setIsSelected(true);
              onClick?.(event);
            }}
            key={index}
            style={getPartStyle(rect)}
            className={`TextHighlight__part ${getPartStyleClass()}`}
          />
        ))}
      </div>
    </div>
  );
});

TextHighlight.displayName = "TextHighlight";
