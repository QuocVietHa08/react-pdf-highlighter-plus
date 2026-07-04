import React, {
  CSSProperties,
  MouseEvent,
  ReactNode,
  useState,
  useRef,
  useEffect,
} from "react";
import { Check, ChevronDown, Minimize2, Palette, Pencil, StickyNote, Trash2 } from "lucide-react";
import { Rnd } from "react-rnd";
import { getPageFromElement } from "../lib/pdfjs-dom";
import type { LTWHP, ViewportHighlight } from "../types";
import { useClearTipWhileSelected } from "../contexts/PdfHighlighterContext";

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
// (The dedicated drag handle was removed — the whole note body drags now.
// The dragIcon prop is kept in the API for backward compatibility.)

// Default icons — lucide-react, so the toolbar matches the example app's
// icon vocabulary instead of a separate hand-drawn set.
const DefaultEditIcon = () => <Pencil width={14} height={14} />;
const DefaultStyleIcon = () => <Palette width={14} height={14} />;
const DefaultDeleteIcon = () => <Trash2 width={14} height={14} />;
const DefaultCompactIcon = () => <StickyNote width={16} height={16} />;
const DefaultCollapseIcon = () => <Minimize2 width={14} height={14} />;
const ChevronDownIcon = () => <ChevronDown width={12} height={12} strokeWidth={2.5} />;
const CheckIcon = () => <Check width={14} height={14} strokeWidth={2.5} />;

// Default color presets
const DEFAULT_BACKGROUND_PRESETS = ["transparent", "#ffffc8", "#ffcdd2", "#c8e6c9", "#bbdefb", "#e1bee7"];
const DEFAULT_TEXT_PRESETS = ["#333333", "#d32f2f", "#1976d2", "#388e3c", "#7b1fa2"];

// Display names for the default background presets, used in the color
// dropdown. A custom preset (not in this map) just falls back to its value.
const BACKGROUND_COLOR_NAMES: Record<string, string> = {
  transparent: "None",
  "#ffffc8": "Yellow",
  "#ffcdd2": "Red",
  "#c8e6c9": "Green",
  "#bbdefb": "Blue",
  "#e1bee7": "Purple",
};

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
  const [isSelected, setIsSelected] = useState(false);
  useClearTipWhileSelected(isSelected);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [text, setText] = useState(highlight.content?.text || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stylePanelRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Deselect on click outside / Escape (sticky-note interaction model).
  useEffect(() => {
    if (!isSelected) return;
    const handlePointerDown = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsSelected(false);
        setIsStylePanelOpen(false);
        setIsColorMenuOpen(false);
      }
    };
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !isEditing) {
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
  }, [isSelected, isEditing]);

  // Sync text with highlight content when it changes externally
  useEffect(() => {
    setText(highlight.content?.text || "");
  }, [highlight.content?.text]);

  useEffect(() => {
    setIsExpanded(!compact);
    setIsStylePanelOpen(false);
    setIsColorMenuOpen(false);
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

  // Close color menu when clicking outside
  useEffect(() => {
    if (!isColorMenuOpen) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) {
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

  const highlightClass = isScrolledTo ? "FreetextHighlight--scrolledTo" : "";
  const editingClass = isEditing ? "FreetextHighlight--editing" : "";
  const selectedClass = isSelected ? "FreetextHighlight--selected" : "";
  const compactClass = compact ? "FreetextHighlight--compact" : "";
  const isCompactCollapsed = compact && !isExpanded && !isEditing && !isStylePanelOpen && !isColorMenuOpen;
  const collapsedClass = isCompactCollapsed ? "FreetextHighlight--collapsed" : "";

  // Not enough room above the box for the toolbar (e.g. the note sits at
  // the very top of the page) — flip it below instead of letting it float
  // up over whatever page content is above the box.
  const flipToolbar = highlight.position.boundingRect.top < 40;

  // Generate key based on position for Rnd remount on position changes
  const key = `${highlight.position.boundingRect.width}${highlight.position.boundingRect.height}${highlight.position.boundingRect.left}${highlight.position.boundingRect.top}${isCompactCollapsed ? "collapsed" : "expanded"}`;

  // Single click selects (shows the toolbar); double-click edits in place.
  const handleNoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) setIsSelected(true);
  };

  const enterEditMode = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isEditing) {
      setIsExpanded(true);
      setIsSelected(true);
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
      ref={rootRef}
      className={`FreetextHighlight ${highlightClass} ${editingClass} ${selectedClass} ${compactClass} ${collapsedClass}`}
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
            setIsSelected(true);
            onEditStart?.();
          }
        }}
        disableDragging={isEditing}
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
        // The whole note body drags (sticky-note model); only interactive
        // controls and the edit textarea are excluded.
        cancel=".FreetextHighlight__input, .FreetextHighlight__toolbar, .FreetextHighlight__style-panel, .FreetextHighlight__color-menu, .FreetextHighlight__compact-button"
      >
        <div
          className="FreetextHighlight__container"
          style={containerStyle}
          onClick={handleNoteClick}
          onDoubleClick={enterEditMode}
        >
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
          <div
            className={`FreetextHighlight__toolbar ${flipToolbar ? "FreetextHighlight__toolbar--below" : ""}`}
          >
            {/* Color as a dropdown (swatch + chevron) instead of a row of
                dots — gives each preset room for a name and a checkmark on
                the active one, and keeps the toolbar itself compact. */}
            <button
              type="button"
              className="FreetextHighlight__color-trigger"
              aria-label="Background color"
              aria-expanded={isColorMenuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setIsStylePanelOpen(false);
                setIsColorMenuOpen((v) => !v);
              }}
              title="Background color"
            >
              <span
                className="FreetextHighlight__color-trigger-dot"
                style={{
                  backgroundColor:
                    backgroundColor === "transparent" ? undefined : backgroundColor,
                }}
              />
              <ChevronDownIcon />
            </button>
            <div className="FreetextHighlight__toolbar-divider" />
            <button
              className="FreetextHighlight__edit-button"
              onClick={enterEditMode}
              title="Edit text (or double-click the note)"
              type="button"
            >
              {editIcon || <DefaultEditIcon />}
            </button>
            <button
              className="FreetextHighlight__style-button"
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
            {compact && (
              <button
                className="FreetextHighlight__collapse-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                  setIsStylePanelOpen(false);
                  setIsColorMenuOpen(false);
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

          {/* Color dropdown - own slot, same as the style panel */}
          {isColorMenuOpen && (
            <div
              className={`FreetextHighlight__color-menu ${flipToolbar ? "FreetextHighlight__color-menu--below-toolbar" : ""}`}
              ref={colorMenuRef}
              onClick={(e) => e.stopPropagation()}
            >
              {backgroundColorPresets.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="FreetextHighlight__color-menu-item"
                  onClick={() => {
                    onStyleChange?.({ backgroundColor: c });
                    setIsColorMenuOpen(false);
                  }}
                >
                  <span
                    className={`FreetextHighlight__color-menu-dot ${c === "transparent" ? "FreetextHighlight__color-menu-dot--transparent" : ""}`}
                    style={c !== "transparent" ? { backgroundColor: c } : undefined}
                  />
                  <span className="FreetextHighlight__color-menu-label">
                    {BACKGROUND_COLOR_NAMES[c] || c}
                  </span>
                  {backgroundColor === c && (
                    <span className="FreetextHighlight__color-menu-check">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {isStylePanelOpen && (
            <div
              className={`FreetextHighlight__style-panel ${flipToolbar ? "FreetextHighlight__style-panel--below-toolbar" : ""}`}
              ref={stylePanelRef}
              onClick={(e) => e.stopPropagation()}
            >
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
