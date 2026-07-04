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
import { Check, ChevronDown, Copy, Trash2 } from "lucide-react";

import {
  copyTextToClipboard,
  extractTextFromHighlightRect,
} from "../lib/copy-highlight-content";
import { findOrCreateHighlightConfigLayer } from "../lib/highlight-config-layer";
import { getPageFromElement } from "../lib/pdfjs-dom";
import { Rnd } from "react-rnd";
import type { LTWHP, ViewportHighlight } from "../types";

/**
 * Style options for area highlight appearance.
 */
export interface AreaHighlightStyle {
  highlightColor?: string;
}

/**
 * The props type for {@link AreaHighlight}.
 *
 * @category Component Properties
 */
export interface AreaHighlightProps {
  /**
   * The highlight to be rendered as an {@link AreaHighlight}.
   */
  highlight: ViewportHighlight;

  /**
   * A callback triggered whenever the highlight area is either finished
   * being moved or resized.
   *
   * @param rect - The updated highlight area.
   */
  onChange?(rect: LTWHP): void;

  /**
   * Has the highlight been auto-scrolled into view? By default, this will render the highlight red.
   */
  isScrolledTo?: boolean;

  /**
   * react-rnd bounds on the highlight area. This is useful for preventing the user
   * moving the highlight off the viewer/page.  See [react-rnd docs](https://github.com/bokuweb/react-rnd).
   */
  bounds?: string | Element;

  /**
   * A callback triggered whenever a context menu is opened on the highlight area.
   *
   * @param event - The mouse event associated with the context menu.
   */
  onContextMenu?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Event called whenever the user tries to move or resize an {@link AreaHighlight}.
   */
  onEditStart?(): void;

  /**
   * Custom styling to be applied to the {@link AreaHighlight} component.
   */
  style?: CSSProperties;

  /**
   * Background color for the highlight.
   * Default: "rgba(255, 226, 143, 1)" (yellow)
   */
  highlightColor?: string;

  /**
   * Callback triggered when the style changes.
   */
  onStyleChange?(style: AreaHighlightStyle): void;

  /**
   * Text to copy for this area highlight.
   */
  copyText?: string;

  /**
   * Callback triggered when the delete button is clicked.
   */
  onDelete?(): void;

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
const DefaultDeleteIcon = () => <Trash2 width={14} height={14} />;
const DefaultCopyIcon = () => <Copy width={14} height={14} />;
const DefaultCopiedIcon = () => <Check width={14} height={14} strokeWidth={2.5} />;
const ChevronDownIcon = () => <ChevronDown width={12} height={12} strokeWidth={2.5} />;
const CheckIcon = () => <Check width={14} height={14} strokeWidth={2.5} />;

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
 * Renders a resizeable and interactive rectangular area for a highlight.
 *
 * @category Component
 */
export const AreaHighlight = memo(({
  highlight,
  onChange,
  isScrolledTo,
  bounds,
  onContextMenu,
  onEditStart,
  style,
  highlightColor = "rgba(255, 226, 143, 1)",
  onStyleChange,
  onDelete,
  deleteIcon,
  copyText,
  colorPresets = DEFAULT_COLOR_PRESETS,
  extraButtons,
  extraPanel,
}: AreaHighlightProps) => {
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [configLayer, setConfigLayer] = useState<HTMLElement | null>(null);
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
        setIsColorMenuOpen(false);
      }
    };
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSelected(false);
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

  // Resolve on every commit — a run-once effect can catch the text layer
  // before pdf.js attaches it to .page, leaving configLayer null forever.
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

    // Delay adding listener to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isColorMenuOpen]);

  const highlightClass = isScrolledTo ? "AreaHighlight--scrolledTo" : "";
  const selectedClass = isSelected ? "AreaHighlight--selected" : "";

  // Not enough room above the box for the toolbar (e.g. the highlight sits
  // at the very top of the page) — flip it below instead of letting it
  // float up over whatever page content is above the box.
  const flipToolbar = highlight.position.boundingRect.top < 40;

  // Generate key based on position. This forces a remount (and a defaultpos update)
  // whenever highlight position changes (e.g., when updated, scale changes, etc.)
  // We don't use position as state because when updating Rnd this would happen and cause flickering:
  // User moves Rnd -> Rnd records new pos -> Rnd jumps back -> highlight updates -> Rnd re-renders at new pos
  const key = `${highlight.position.boundingRect.width}${highlight.position.boundingRect.height}${highlight.position.boundingRect.left}${highlight.position.boundingRect.top}`;

  // Merge custom style with highlight color. --hl-fill-alpha (set <100% in dark
  // mode) keeps the fill translucent so underlying content stays visible while
  // the border ring stays crisp (no element opacity). Light mode = 100%.
  const mergedStyle: CSSProperties = {
    ...style,
    backgroundColor: `color-mix(in srgb, ${highlightColor} var(--hl-fill-alpha, 100%), transparent)`,
  };

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const text =
      copyText ||
      highlight.content?.text ||
      (containerRef.current
        ? extractTextFromHighlightRect(
            containerRef.current,
            highlight.position.boundingRect,
          )
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
      className={`AreaHighlight ${highlightClass} ${selectedClass}`}
      onContextMenu={onContextMenu}
      ref={containerRef}
    >
      {configLayer && (onStyleChange || onDelete) &&
        createPortal(
        <div
          className="AreaHighlight__toolbar-wrapper"
          ref={toolbarWrapperRef}
          style={{
            position: "absolute",
            left: highlight.position.boundingRect.left,
            top: highlight.position.boundingRect.top,
          }}
        >
          <div
            className={`AreaHighlight__toolbar ${flipToolbar ? "AreaHighlight__toolbar--below" : ""} ${isSelected || isScrolledTo || isColorMenuOpen ? "AreaHighlight__toolbar--visible" : ""}`}
          >
            {onStyleChange && (
              <>
                {/* Color as a dropdown (swatch + chevron) instead of a row of
                    dots — gives each preset room for a name and a checkmark
                    on the active one, and keeps the toolbar itself compact. */}
                <button
                  type="button"
                  className="AreaHighlight__color-trigger"
                  aria-label="Highlight color"
                  aria-expanded={isColorMenuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsColorMenuOpen((v) => !v);
                  }}
                  title="Highlight color"
                >
                  <span
                    className="AreaHighlight__color-trigger-dot"
                    style={{ backgroundColor: highlightColor }}
                  />
                  <ChevronDownIcon />
                </button>
                <div className="AreaHighlight__toolbar-divider" />
              </>
            )}
            <button
              className="AreaHighlight__copy-button"
              onClick={handleCopy}
              title={isCopied ? "Copied" : "Copy text"}
              type="button"
            >
              {isCopied ? <DefaultCopiedIcon /> : <DefaultCopyIcon />}
            </button>
            {extraButtons}
            {onDelete && (
              <button
                className="AreaHighlight__delete-button"
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

          {/* Color dropdown - inside wrapper */}
          {isColorMenuOpen && onStyleChange && (
            <div
              className="AreaHighlight__color-menu"
              ref={colorMenuRef}
              onClick={(e) => e.stopPropagation()}
            >
              {colorPresets.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="AreaHighlight__color-menu-item"
                  onClick={() => {
                    onStyleChange({ highlightColor: c });
                    setIsColorMenuOpen(false);
                  }}
                >
                  <span
                    className="AreaHighlight__color-menu-dot"
                    style={{ backgroundColor: c }}
                  />
                  <span className="AreaHighlight__color-menu-label">
                    {COLOR_NAMES[c] || c}
                  </span>
                  {highlightColor === c && (
                    <span className="AreaHighlight__color-menu-check">
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

      <Rnd
        className="AreaHighlight__part"
        onDragStop={(_, data) => {
          const boundingRect: LTWHP = {
            ...highlight.position.boundingRect,
            top: data.y,
            left: data.x,
          };

          onChange && onChange(boundingRect);
        }}
        onResizeStop={(_mouseEvent, _direction, ref, _delta, position) => {
          const boundingRect: LTWHP = {
            top: position.y,
            left: position.x,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
            pageNumber: getPageFromElement(ref)?.number || -1,
          };

          onChange && onChange(boundingRect);
        }}
        onDragStart={() => {
          setIsSelected(true);
          onEditStart?.();
        }}
        onResizeStart={onEditStart}
        default={{
          x: highlight.position.boundingRect.left,
          y: highlight.position.boundingRect.top,
          width: highlight.position.boundingRect.width,
          height: highlight.position.boundingRect.height,
        }}
        key={key}
        bounds={bounds}
        // Prevevent any event clicks as clicking is already used for movement.
        // A click still selects the highlight (shows the toolbar).
        onClick={(event: Event) => {
          event.stopPropagation();
          event.preventDefault();
          setIsSelected(true);
        }}
        style={mergedStyle}
      />
    </div>
  );
});

AreaHighlight.displayName = "AreaHighlight";
