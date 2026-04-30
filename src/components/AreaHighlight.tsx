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

// Default color presets
const DEFAULT_COLOR_PRESETS = [
  "rgba(255, 226, 143, 1)", // Yellow (default)
  "#ffcdd2", // Light red
  "#c8e6c9", // Light green
  "#bbdefb", // Light blue
  "#e1bee7", // Light purple
];

/**
 * Renders a resizeable and interactive rectangular area for a highlight.
 *
 * @category Component
 */
export const AreaHighlight = ({
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
  styleIcon,
  deleteIcon,
  copyText,
  colorPresets = DEFAULT_COLOR_PRESETS,
}: AreaHighlightProps) => {
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

  const highlightClass = isScrolledTo ? "AreaHighlight--scrolledTo" : "";

  // Generate key based on position. This forces a remount (and a defaultpos update)
  // whenever highlight position changes (e.g., when updated, scale changes, etc.)
  // We don't use position as state because when updating Rnd this would happen and cause flickering:
  // User moves Rnd -> Rnd records new pos -> Rnd jumps back -> highlight updates -> Rnd re-renders at new pos
  const key = `${highlight.position.boundingRect.width}${highlight.position.boundingRect.height}${highlight.position.boundingRect.left}${highlight.position.boundingRect.top}`;

  // Merge custom style with highlight color
  const mergedStyle: CSSProperties = {
    ...style,
    backgroundColor: highlightColor,
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
      className={`AreaHighlight ${highlightClass}`}
      onContextMenu={onContextMenu}
      ref={containerRef}
    >
      {configLayer && (onStyleChange || onDelete) &&
        createPortal(
        <div
          className="AreaHighlight__toolbar-wrapper"
          style={{
            position: "absolute",
            left: highlight.position.boundingRect.left,
            top: highlight.position.boundingRect.top - 28,
            paddingBottom: 12,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={`AreaHighlight__toolbar ${isHovered || isScrolledTo || isStylePanelOpen ? "AreaHighlight__toolbar--visible" : ""}`}
          >
            {onStyleChange && (
              <button
                className="AreaHighlight__style-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStylePanelOpen(!isStylePanelOpen);
                }}
                title="Change color"
                type="button"
              >
                {styleIcon || <DefaultStyleIcon />}
              </button>
            )}
            <button
              className="AreaHighlight__copy-button"
              onClick={handleCopy}
              title={isCopied ? "Copied" : "Copy text"}
              type="button"
            >
              {isCopied ? <DefaultCopiedIcon /> : <DefaultCopyIcon />}
            </button>
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

          {/* Style Panel - inside wrapper */}
          {isStylePanelOpen && onStyleChange && (
            <div
              className="AreaHighlight__style-panel"
              ref={stylePanelRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="AreaHighlight__style-row">
                <label>Color</label>
                <div className="AreaHighlight__color-options">
                  <div className="AreaHighlight__color-presets">
                    {colorPresets.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`AreaHighlight__color-preset ${highlightColor === c ? "active" : ""}`}
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

      <Rnd
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
        onDragStart={onEditStart}
        onResizeStart={onEditStart}
        default={{
          x: highlight.position.boundingRect.left,
          y: highlight.position.boundingRect.top,
          width: highlight.position.boundingRect.width,
          height: highlight.position.boundingRect.height,
        }}
        key={key}
        bounds={bounds}
        // Prevevent any event clicks as clicking is already used for movement
        onClick={(event: Event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
        style={mergedStyle}
      />
    </div>
  );
};
