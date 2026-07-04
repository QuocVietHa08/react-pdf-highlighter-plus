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
import { Check, ChevronDown, Palette, Trash2 } from "lucide-react";
import { Rnd } from "react-rnd";
import { findOrCreateHighlightConfigLayer } from "../lib/highlight-config-layer";
import { getPageFromElement } from "../lib/pdfjs-dom";
import type { LTWHP, ShapeType, ViewportHighlight } from "../types";
import { useClearTipWhileSelected } from "../contexts/PdfHighlighterContext";

/**
 * Style options for shape highlight appearance.
 */
export interface ShapeStyle {
  strokeColor?: string;
  strokeWidth?: number;
}

/**
 * The props type for {@link ShapeHighlight}.
 *
 * @category Component Properties
 */
export interface ShapeHighlightProps {
  /**
   * The highlight to be rendered as a {@link ShapeHighlight}.
   */
  highlight: ViewportHighlight;

  /**
   * A callback triggered whenever the highlight position or size changes.
   *
   * @param rect - The updated highlight area.
   */
  onChange?(rect: LTWHP): void;

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
   * Event called when editing begins (drag or resize).
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
   * The type of shape to render.
   * @default "rectangle"
   */
  shapeType?: ShapeType;

  /**
   * Stroke color for the shape.
   * @default "#000000"
   */
  strokeColor?: string;

  /**
   * Stroke width for the shape.
   * @default 2
   */
  strokeWidth?: number;

  /**
   * Callback triggered when the style changes.
   */
  onStyleChange?(style: ShapeStyle): void;

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
   */
  colorPresets?: string[];

  /**
   * For arrows: start point as percentage of bounding box (0-1).
   */
  startPoint?: { x: number; y: number };

  /**
   * For arrows: end point as percentage of bounding box (0-1).
   */
  endPoint?: { x: number; y: number };
}

// Default icons — lucide-react, so the toolbar matches the example app's
// icon vocabulary instead of a separate hand-drawn set.
const DefaultStyleIcon = () => <Palette width={14} height={14} />;
const DefaultDeleteIcon = () => <Trash2 width={14} height={14} />;

// Default color presets for shapes
const DEFAULT_COLOR_PRESETS = [
  "#000000", // Black
  "#FF0000", // Red
  "#0000FF", // Blue
  "#00AA00", // Green
  "#FF6600", // Orange
];

// Display names for the default presets, used in the color dropdown.
const COLOR_NAMES: Record<string, string> = {
  "#000000": "Black",
  "#FF0000": "Red",
  "#0000FF": "Blue",
  "#00AA00": "Green",
  "#FF6600": "Orange",
};

// Stroke width options
const STROKE_WIDTHS = [
  { label: "Thin", value: 1 },
  { label: "Medium", value: 2 },
  { label: "Thick", value: 4 },
];

/**
 * Renders a draggable, resizable shape annotation.
 * Supports rectangle, circle/ellipse, and arrow shapes.
 *
 * @category Component
 */
export const ShapeHighlight = ({
  highlight,
  onChange,
  isScrolledTo,
  bounds,
  onContextMenu,
  onEditStart,
  onEditEnd,
  style,
  shapeType = "rectangle",
  strokeColor = "#000000",
  strokeWidth = 2,
  onStyleChange,
  onDelete,
  styleIcon,
  deleteIcon,
  colorPresets = DEFAULT_COLOR_PRESETS,
  startPoint,
  endPoint,
}: ShapeHighlightProps) => {
  const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  useClearTipWhileSelected(isSelected);
  const [configLayer, setConfigLayer] = useState<HTMLElement | null>(null);
  const stylePanelRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarWrapperRef = useRef<HTMLDivElement>(null);

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

  // Resolve on every commit — a run-once effect can catch the text layer
  // before pdf.js attaches it to .page, leaving configLayer null forever.
  useLayoutEffect(() => {
    if (containerRef.current) {
      const layer = findOrCreateHighlightConfigLayer(containerRef.current);
      setConfigLayer((prev) => (prev === layer ? prev : layer));
    }
  });

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

  const highlightClass = isScrolledTo ? "ShapeHighlight--scrolledTo" : "";
  const selectedClass = isSelected ? "ShapeHighlight--selected" : "";

  // Generate key based on position for Rnd remount on position changes
  const key = `${highlight.position.boundingRect.width}${highlight.position.boundingRect.height}${highlight.position.boundingRect.left}${highlight.position.boundingRect.top}`;

  // Generate unique ID for SVG markers
  const markerId = `arrowhead-${highlight.id}`;

  // Render the shape SVG
  const renderShape = (width: number, height: number) => {
    switch (shapeType) {
      case "rectangle":
        return (
          <svg
            className="ShapeHighlight__svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          >
            <rect
              x={strokeWidth / 2}
              y={strokeWidth / 2}
              width={width - strokeWidth}
              height={height - strokeWidth}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
          </svg>
        );
      case "circle":
        return (
          <svg
            className="ShapeHighlight__svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          >
            <ellipse
              cx={width / 2}
              cy={height / 2}
              rx={width / 2 - strokeWidth / 2}
              ry={height / 2 - strokeWidth / 2}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
          </svg>
        );
      case "arrow": {
        // Use stored start/end points if available, otherwise default to left-to-right
        const x1 = startPoint ? startPoint.x * width : strokeWidth;
        const y1 = startPoint ? startPoint.y * height : height / 2;
        const x2 = endPoint ? endPoint.x * width : width - strokeWidth - 10;
        const y2 = endPoint ? endPoint.y * height : height / 2;

        return (
          <svg
            className="ShapeHighlight__svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          >
            <defs>
              <marker
                id={markerId}
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
              </marker>
            </defs>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              markerEnd={`url(#${markerId})`}
            />
          </svg>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div
      className={`ShapeHighlight ${highlightClass} ${selectedClass}`}
      onContextMenu={onContextMenu}
      ref={containerRef}
    >
      {configLayer && (onStyleChange || onDelete) &&
        createPortal(
        <div
          className="ShapeHighlight__toolbar-wrapper"
          ref={toolbarWrapperRef}
          style={{
            position: "absolute",
            left: highlight.position.boundingRect.left,
            top: highlight.position.boundingRect.top,
          }}
        >
          <div
            className={`ShapeHighlight__toolbar ${isSelected || isScrolledTo || isStylePanelOpen || isColorMenuOpen ? "ShapeHighlight__toolbar--visible" : ""}`}
          >
            {onStyleChange && (
              <>
                {/* Color as a dropdown (swatch + chevron) instead of a row of
                    dots — gives each preset room for a name and a checkmark
                    on the active one, and keeps the toolbar itself compact. */}
                <button
                  type="button"
                  className="ShapeHighlight__color-trigger"
                  aria-label="Stroke color"
                  aria-expanded={isColorMenuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsStylePanelOpen(false);
                    setIsColorMenuOpen((v) => !v);
                  }}
                  title="Stroke color"
                >
                  <span
                    className="ShapeHighlight__color-trigger-dot"
                    style={{ backgroundColor: strokeColor }}
                  />
                  <ChevronDown width={12} height={12} strokeWidth={2.5} />
                </button>
                <div className="ShapeHighlight__toolbar-divider" />
              </>
            )}
            {onStyleChange && (
              <button
                className="ShapeHighlight__style-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsColorMenuOpen(false);
                  setIsStylePanelOpen(!isStylePanelOpen);
                }}
                title="Stroke width"
                type="button"
              >
                {styleIcon || <DefaultStyleIcon />}
              </button>
            )}
            {onDelete && (
              <button
                className="ShapeHighlight__delete-button"
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

          {/* Color dropdown - same slot as the style panel */}
          {isColorMenuOpen && onStyleChange && (
            <div
              className="ShapeHighlight__color-menu"
              ref={colorMenuRef}
              onClick={(e) => e.stopPropagation()}
            >
              {colorPresets.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="ShapeHighlight__color-menu-item"
                  onClick={() => {
                    onStyleChange({ strokeColor: c });
                    setIsColorMenuOpen(false);
                  }}
                >
                  <span
                    className="ShapeHighlight__color-menu-dot"
                    style={{ backgroundColor: c }}
                  />
                  <span className="ShapeHighlight__color-menu-label">
                    {COLOR_NAMES[c] || c}
                  </span>
                  {strokeColor === c && (
                    <span className="ShapeHighlight__color-menu-check">
                      <Check width={14} height={14} strokeWidth={2.5} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Style Panel - inside wrapper */}
          {isStylePanelOpen && onStyleChange && (
            <div
              className="ShapeHighlight__style-panel"
              ref={stylePanelRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ShapeHighlight__style-row">
                <label>Width</label>
                <div className="ShapeHighlight__width-options">
                  {STROKE_WIDTHS.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      className={`ShapeHighlight__width-button ${strokeWidth === w.value ? "active" : ""}`}
                      onClick={() => onStyleChange({ strokeWidth: w.value })}
                      title={w.label}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>,
          configLayer,
        )}

      <Rnd
        className="ShapeHighlight__rnd"
        onDragStop={(_, data) => {
          const boundingRect: LTWHP = {
            ...highlight.position.boundingRect,
            top: data.y,
            left: data.x,
          };
          onChange?.(boundingRect);
          onEditEnd?.();
        }}
        onDragStart={() => {
          setIsSelected(true);
          onEditStart?.();
        }}
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
          onEditEnd?.();
        }}
        onResizeStart={onEditStart}
        default={{
          x: highlight.position.boundingRect.left,
          y: highlight.position.boundingRect.top,
          width: highlight.position.boundingRect.width || 100,
          height: highlight.position.boundingRect.height || 100,
        }}
        minWidth={20}
        minHeight={20}
        key={key}
        bounds={bounds}
        lockAspectRatio={shapeType === "circle"}
        // A click still selects the highlight (shows the toolbar).
        onClick={(event: Event) => {
          event.stopPropagation();
          event.preventDefault();
          setIsSelected(true);
        }}
        style={style}
      >
        <div className="ShapeHighlight__container">
          {renderShape(
            highlight.position.boundingRect.width || 100,
            highlight.position.boundingRect.height || 100
          )}
        </div>
      </Rnd>
    </div>
  );
};
