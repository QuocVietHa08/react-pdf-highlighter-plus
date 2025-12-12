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
import "../style/ShapeHighlight.css";
import type { LTWHP, ShapeType, ViewportHighlight } from "../types";

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

// Default color presets for shapes
const DEFAULT_COLOR_PRESETS = [
  "#000000", // Black
  "#FF0000", // Red
  "#0000FF", // Blue
  "#00AA00", // Green
  "#FF6600", // Orange
];

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
  const [isHovered, setIsHovered] = useState(false);
  const stylePanelRef = useRef<HTMLDivElement>(null);

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

  const highlightClass = isScrolledTo ? "ShapeHighlight--scrolledTo" : "";

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
      className={`ShapeHighlight ${highlightClass}`}
      onContextMenu={onContextMenu}
    >
      {/* Toolbar wrapper - extends down to overlap with shape */}
      {(onStyleChange || onDelete) && (
        <div
          className="ShapeHighlight__toolbar-wrapper"
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
            className={`ShapeHighlight__toolbar ${isHovered || isStylePanelOpen ? "ShapeHighlight__toolbar--visible" : ""}`}
          >
            {onStyleChange && (
              <button
                className="ShapeHighlight__style-button"
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

          {/* Style Panel - inside wrapper */}
          {isStylePanelOpen && onStyleChange && (
            <div
              className="ShapeHighlight__style-panel"
              ref={stylePanelRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ShapeHighlight__style-row">
                <label>Color</label>
                <div className="ShapeHighlight__color-options">
                  <div className="ShapeHighlight__color-presets">
                    {colorPresets.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`ShapeHighlight__color-preset ${strokeColor === c ? "active" : ""}`}
                        style={{ backgroundColor: c }}
                        onClick={() => onStyleChange({ strokeColor: c })}
                        title={c}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => {
                      onStyleChange({ strokeColor: e.target.value });
                    }}
                  />
                </div>
              </div>
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
        </div>
      )}

      <Rnd
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
        onDragStart={onEditStart}
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
        onClick={(event: Event) => {
          event.stopPropagation();
          event.preventDefault();
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
