import React, {
  CSSProperties,
  MouseEvent,
  ReactNode,
  useState,
  useRef,
  useEffect,
} from "react";
import { Rnd } from "react-rnd";
import { getPageFromElement } from "../lib/pdfjs-dom";
import type { LTWHP, ViewportHighlight } from "../types";

/**
 * Style options for freetext highlight appearance.
 */
export interface FreetextStyle {
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: string;
}

/**
 * The props type for {@link FreetextHighlight}.
 *
 * @category Component Properties
 */
export interface FreetextHighlightProps {
  /**
   * The highlight to be rendered as a {@link FreetextHighlight}.
   */
  highlight: ViewportHighlight;

  /**
   * A callback triggered whenever the highlight position changes (drag).
   *
   * @param rect - The updated highlight area.
   */
  onChange?(rect: LTWHP): void;

  /**
   * A callback triggered whenever the text content changes.
   *
   * @param text - The new text content.
   */
  onTextChange?(text: string): void;

  /**
   * A callback triggered whenever the style changes.
   *
   * @param style - The new style options.
   */
  onStyleChange?(style: FreetextStyle): void;

  /**
   * Has the highlight been auto-scrolled into view?
   */
  isScrolledTo?: boolean;

  /**
   * react-rnd bounds on the highlight area.
   */
  bounds?: string | Element;

  /**
   * A callback triggered on context menu.
   */
  onContextMenu?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Event called when editing begins (drag or text edit).
   */
  onEditStart?(): void;

  /**
   * Event called when editing ends.
   */
  onEditEnd?(): void;

  /**
   * Custom styling for the container.
   */
  style?: CSSProperties;

  /**
   * Text color.
   */
  color?: string;

  /**
   * Background color.
   */
  backgroundColor?: string;

  /**
   * Font family.
   */
  fontFamily?: string;

  /**
   * Font size (e.g., "14px").
   */
  fontSize?: string;

  /**
   * Custom drag icon. Receives default icon as child if not provided.
   */
  dragIcon?: ReactNode;

  /**
   * Custom edit icon. Receives default icon as child if not provided.
   */
  editIcon?: ReactNode;

  /**
   * Custom style/settings icon. Receives default icon as child if not provided.
   */
  styleIcon?: ReactNode;

  /**
   * Custom background color presets for the style panel.
   * Default: ["#ffffc8", "#ffcdd2", "#c8e6c9", "#bbdefb", "#e1bee7"]
   */
  backgroundColorPresets?: string[];

  /**
   * Custom text color presets for the style panel.
   * Default: ["#333333", "#d32f2f", "#1976d2", "#388e3c", "#7b1fa2"]
   */
  textColorPresets?: string[];

  /**
   * Callback triggered when the delete button is clicked.
   */
  onDelete?(): void;

  /**
   * Custom delete icon. Replaces the default trash icon.
   */
  deleteIcon?: ReactNode;

  /**
   * Render the note as a compact marker until opened.
   */
  compact?: boolean;

  /**
   * Size of the compact marker in pixels.
   */
  compactSize?: number;

  /**
   * Custom compact marker icon.
   */
  compactIcon?: ReactNode;
}

/**
 * Renders a draggable, editable freetext annotation.
 *
 * @category Component
 */
// Default icons
const DefaultDragIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="8" cy="6" r="2" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="16" cy="12" r="2" />
    <circle cx="8" cy="18" r="2" />
    <circle cx="16" cy="18" r="2" />
  </svg>
);

const DefaultEditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
);

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

const DefaultCompactIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 3h9l5 5v13H6V3zm8 1.5V9h4.5L14 4.5zM8 12h8v1.5H8V12zm0 3h8v1.5H8V15zm0 3h5v1.5H8V18z" />
  </svg>
);

const DefaultCollapseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10v2h10v-2H7zm-2-7h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm0 2v14h14V5H5z" />
  </svg>
);

// Default color presets
const DEFAULT_BACKGROUND_PRESETS = ["transparent", "#ffffc8", "#ffcdd2", "#c8e6c9", "#bbdefb", "#e1bee7"];
const DEFAULT_TEXT_PRESETS = ["#333333", "#d32f2f", "#1976d2", "#388e3c", "#7b1fa2"];

export const FreetextHighlight = ({
  highlight,
  onChange,
  onTextChange,
  onStyleChange,
  isScrolledTo,
  bounds,
  onContextMenu,
  onEditStart,
  onEditEnd,
  style,
  color = "#333333",
  backgroundColor = "#ffffc8",
  fontFamily = "inherit",
  fontSize = "14px",
  dragIcon,
  editIcon,
  styleIcon,
  backgroundColorPresets = DEFAULT_BACKGROUND_PRESETS,
  textColorPresets = DEFAULT_TEXT_PRESETS,
  onDelete,
  deleteIcon,
  compact = false,
  compactSize = 32,
  compactIcon,
}: FreetextHighlightProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);
  const [text, setText] = useState(highlight.content?.text || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stylePanelRef = useRef<HTMLDivElement>(null);

  // Sync text with highlight content when it changes externally
  useEffect(() => {
    setText(highlight.content?.text || "");
  }, [highlight.content?.text]);

  useEffect(() => {
    setIsExpanded(!compact);
    setIsStylePanelOpen(false);
    if (!compact) {
      setIsEditing(false);
    }
  }, [compact]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Close style panel when clicking outside
  useEffect(() => {
    if (!isStylePanelOpen) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (stylePanelRef.current && !stylePanelRef.current.contains(e.target as Node)) {
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

  const highlightClass = isScrolledTo ? "FreetextHighlight--scrolledTo" : "";
  const editingClass = isEditing ? "FreetextHighlight--editing" : "";
  const compactClass = compact ? "FreetextHighlight--compact" : "";
  const isCompactCollapsed = compact && !isExpanded && !isEditing && !isStylePanelOpen;
  const collapsedClass = isCompactCollapsed ? "FreetextHighlight--collapsed" : "";

  // Generate key based on position for Rnd remount on position changes
  const key = `${highlight.position.boundingRect.width}${highlight.position.boundingRect.height}${highlight.position.boundingRect.left}${highlight.position.boundingRect.top}${isCompactCollapsed ? "collapsed" : "expanded"}`;

  const handleTextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsExpanded(true);
      setIsEditing(true);
      onEditStart?.();
    }
  };

  const handleTextBlur = () => {
    if (isEditing) {
      setIsEditing(false);
      onTextChange?.(text);
      onEditEnd?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setText(highlight.content?.text || "");
      setIsEditing(false);
      onEditEnd?.();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
      onTextChange?.(text);
      onEditEnd?.();
    }
  };

  const containerStyle: CSSProperties = {
    backgroundColor,
    color,
    fontFamily,
    fontSize,
    ...style,
  };

  return (
    <div
      className={`FreetextHighlight ${highlightClass} ${editingClass} ${compactClass} ${collapsedClass}`}
      onContextMenu={onContextMenu}
    >
      <Rnd
        className="FreetextHighlight__rnd"
        onDragStop={(_, data) => {
          const boundingRect: LTWHP = {
            ...highlight.position.boundingRect,
            top: data.y,
            left: data.x,
          };
          onChange?.(boundingRect);
        }}
        onDragStart={() => {
          if (!isEditing) {
            onEditStart?.();
          }
        }}
        default={{
          x: highlight.position.boundingRect.left,
          y: highlight.position.boundingRect.top,
          width: isCompactCollapsed ? compactSize : highlight.position.boundingRect.width || 150,
          height: isCompactCollapsed ? compactSize : highlight.position.boundingRect.height || 80,
        }}
        minWidth={isCompactCollapsed ? compactSize : 100}
        minHeight={isCompactCollapsed ? compactSize : 50}
        key={key}
        bounds={bounds}
        enableResizing={
          isCompactCollapsed
            ? false
            : {
                top: false,
                right: true,
                bottom: true,
                left: false,
                topRight: false,
                bottomRight: true,
                bottomLeft: false,
                topLeft: false,
              }
        }
        onResizeStop={(_e, _direction, ref, _delta, position) => {
          const boundingRect: LTWHP = {
            top: position.y,
            left: position.x,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
            pageNumber:
              getPageFromElement(ref)?.number ||
              highlight.position.boundingRect.pageNumber,
          };
          onChange?.(boundingRect);
        }}
        onResizeStart={() => {
          if (!isEditing) {
            onEditStart?.();
          }
        }}
        cancel=".FreetextHighlight__text, .FreetextHighlight__input, .FreetextHighlight__edit-button, .FreetextHighlight__style-button, .FreetextHighlight__style-panel, .FreetextHighlight__delete-button, .FreetextHighlight__collapse-button, .FreetextHighlight__compact-button"
      >
        <div className="FreetextHighlight__container" style={containerStyle}>
          {isCompactCollapsed ? (
            <button
              className="FreetextHighlight__compact-button"
              type="button"
              title={text || "Open note"}
              onClick={(event) => {
                event.stopPropagation();
                setIsExpanded(true);
              }}
            >
              {compactIcon || <DefaultCompactIcon />}
            </button>
          ) : (
            <>
          <div className="FreetextHighlight__toolbar">
            <div className="FreetextHighlight__drag-handle" title="Drag to move">
              {dragIcon || <DefaultDragIcon />}
            </div>
            <button
              className="FreetextHighlight__edit-button"
              onClick={handleTextClick}
              title="Edit text"
              type="button"
            >
              {editIcon || <DefaultEditIcon />}
            </button>
            <button
              className="FreetextHighlight__style-button"
              onClick={(e) => {
                e.stopPropagation();
                setIsStylePanelOpen(!isStylePanelOpen);
              }}
              title="Change style"
              type="button"
            >
              {styleIcon || <DefaultStyleIcon />}
            </button>
            {compact && (
              <button
                className="FreetextHighlight__collapse-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                  setIsStylePanelOpen(false);
                }}
                title="Collapse note"
                type="button"
              >
                <DefaultCollapseIcon />
              </button>
            )}
            {onDelete && (
              <button
                className="FreetextHighlight__delete-button"
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
          {isStylePanelOpen && (
            <div
              className="FreetextHighlight__style-panel"
              ref={stylePanelRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="FreetextHighlight__style-row">
                <label>Background</label>
                <div className="FreetextHighlight__color-options">
                  <div className="FreetextHighlight__color-presets">
                    {backgroundColorPresets.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`FreetextHighlight__color-preset ${c === "transparent" ? "FreetextHighlight__color-preset--transparent" : ""} ${backgroundColor === c ? "active" : ""}`}
                        style={c !== "transparent" ? { backgroundColor: c } : undefined}
                        onClick={() => onStyleChange?.({ backgroundColor: c })}
                        title={c === "transparent" ? "No background" : c}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={backgroundColor === "transparent" ? "#ffffff" : backgroundColor}
                    onChange={(e) => {
                      onStyleChange?.({ backgroundColor: e.target.value });
                    }}
                  />
                </div>
              </div>
              <div className="FreetextHighlight__style-row">
                <label

                >Text Color</label>
                <div className="FreetextHighlight__color-options">
                  <div className="FreetextHighlight__color-presets">
                    {textColorPresets.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`FreetextHighlight__color-preset ${color === c ? "active" : ""}`}
                        style={{ backgroundColor: c }}
                        onClick={() => onStyleChange?.({ color: c })}
                        title={c}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      onStyleChange?.({ color: e.target.value });
                    }}
                  />
                </div>
              </div>
              <div className="FreetextHighlight__style-row">
                <label>Font Size</label>
                <select
                  value={fontSize}
                  onChange={(e) => {
                    onStyleChange?.({ fontSize: e.target.value });
                  }}
                >
                  <option value="10px">10px</option>
                  <option value="12px">12px</option>
                  <option value="14px">14px</option>
                  <option value="16px">16px</option>
                  <option value="18px">18px</option>
                  <option value="20px">20px</option>
                  <option value="24px">24px</option>
                </select>
              </div>
              <div className="FreetextHighlight__style-row">
                <label>Font</label>
                <select
                  value={fontFamily}
                  onChange={(e) => {
                    onStyleChange?.({ fontFamily: e.target.value });
                  }}
                >
                  <option value="inherit">Default</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Courier New', monospace">Courier</option>
                  <option value="'Times New Roman', serif">Times</option>
                </select>
              </div>
            </div>
          )}
          <div className="FreetextHighlight__content">
            {isEditing ? (
              <textarea
                ref={textareaRef}
                className="FreetextHighlight__input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleTextBlur}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="FreetextHighlight__text">
                {text || "New note"}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </Rnd>
    </div>
  );
};
