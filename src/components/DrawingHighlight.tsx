import React, { CSSProperties, MouseEvent, ReactNode, useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Pencil, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { Rnd } from "react-rnd";
import { findOrCreateHighlightConfigLayer } from "../lib/highlight-config-layer";
import { getPageFromElement } from "../lib/pdfjs-dom";
import type { DrawingStroke, LTWHP, ViewportHighlight } from "../types";
import { useClearTipWhileSelected } from "../contexts/PdfHighlighterContext";

// Drawing style presets (same as toolbar)
const DRAWING_COLORS = ["#000000", "#FF0000", "#0000FF", "#00FF00", "#FFFF00"];
const STROKE_WIDTHS = [
  { label: "Thin", value: 1 },
  { label: "Medium", value: 3 },
  { label: "Thick", value: 5 },
];

// Display names for the stroke color presets, used in the color dropdown.
const COLOR_NAMES: Record<string, string> = {
  "#000000": "Black",
  "#FF0000": "Red",
  "#0000FF": "Blue",
  "#00FF00": "Green",
  "#FFFF00": "Yellow",
};

/**
 * The props type for {@link DrawingHighlight}.
 *
 * @category Component Properties
 */
export interface DrawingHighlightProps {
  /**
   * The highlight to be rendered as a {@link DrawingHighlight}.
   * The highlight.content.image should contain the drawing as a PNG data URL.
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
   * Custom drag icon. Replaces the default 6-dot grid icon.
   */
  dragIcon?: ReactNode;

  /**
   * Callback when drawing style changes (color or stroke width).
   * The newImage is the re-rendered PNG data URL with updated styles.
   * The newStrokes contain the updated stroke data.
   */
  onStyleChange?(newImage: string, newStrokes: DrawingStroke[]): void;

  /**
   * Callback triggered when the delete button is clicked.
   */
  onDelete?(): void;

  /**
   * Custom delete icon. Replaces the default trash icon.
   */
  deleteIcon?: ReactNode;
}

// (The dedicated drag handle was removed — the whole drawing body drags now.
// The dragIcon prop is kept in the API for backward compatibility.)

const DefaultDeleteIcon = () => <Trash2 width={14} height={14} />;

/**
 * Re-render strokes to a canvas and return as PNG data URL.
 */
const renderStrokesToImage = (
  strokes: DrawingStroke[],
  width: number,
  height: number
): string => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) return "";

  strokes.forEach((stroke) => {
    if (stroke.points.length < 2) return;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    stroke.points.slice(1).forEach((point) => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  });

  return canvas.toDataURL("image/png");
};

/**
 * Renders a draggable, resizable freehand drawing annotation.
 * Drawings are stored as PNG images with transparent backgrounds.
 *
 * @category Component
 */
export const DrawingHighlight = ({
  highlight,
  onChange,
  isScrolledTo,
  bounds,
  onContextMenu,
  onEditStart,
  onEditEnd,
  style,
  dragIcon,
  onStyleChange,
  onDelete,
  deleteIcon,
}: DrawingHighlightProps) => {
  const [showStyleControls, setShowStyleControls] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  useClearTipWhileSelected(isSelected);
  const [configLayer, setConfigLayer] = useState<HTMLElement | null>(null);
  const styleControlsRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarWrapperRef = useRef<HTMLDivElement>(null);

  const highlightClass = isScrolledTo ? "DrawingHighlight--scrolledTo" : "";
  const selectedClass = isSelected ? "DrawingHighlight--selected" : "";

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
        setShowStyleControls(false);
        setIsColorMenuOpen(false);
      }
    };
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSelected(false);
        setShowStyleControls(false);
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

  // Close style controls when clicking outside
  useEffect(() => {
    if (!showStyleControls) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (styleControlsRef.current && !styleControlsRef.current.contains(e.target as Node)) {
        setShowStyleControls(false);
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
  }, [showStyleControls]);

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

  // Generate key based on position for Rnd remount on position changes
  const key = `${highlight.position.boundingRect.width}${highlight.position.boundingRect.height}${highlight.position.boundingRect.left}${highlight.position.boundingRect.top}`;

  const imageUrl = highlight.content?.image;
  const strokes = highlight.content?.strokes;

  // Apply new color to all strokes
  const handleColorChange = useCallback((newColor: string) => {
    if (!strokes || !onStyleChange) return;

    console.log("DrawingHighlight: Changing color to", newColor);
    const newStrokes = strokes.map((stroke) => ({
      ...stroke,
      color: newColor,
    }));

    const newImage = renderStrokesToImage(
      newStrokes,
      highlight.position.boundingRect.width,
      highlight.position.boundingRect.height
    );

    onStyleChange(newImage, newStrokes);
  }, [strokes, onStyleChange, highlight.position.boundingRect.width, highlight.position.boundingRect.height]);

  // Apply new width to all strokes
  const handleWidthChange = useCallback((newWidth: number) => {
    if (!strokes || !onStyleChange) return;

    console.log("DrawingHighlight: Changing width to", newWidth);
    const newStrokes = strokes.map((stroke) => ({
      ...stroke,
      width: newWidth,
    }));

    const newImage = renderStrokesToImage(
      newStrokes,
      highlight.position.boundingRect.width,
      highlight.position.boundingRect.height
    );

    onStyleChange(newImage, newStrokes);
  }, [strokes, onStyleChange, highlight.position.boundingRect.width, highlight.position.boundingRect.height]);

  // Get current color from first stroke (for showing active state)
  const currentColor = strokes?.[0]?.color || "#000000";
  const currentWidth = strokes?.[0]?.width || 3;

  // Rotate 90° at a time: rotate every stroke point around the canvas
  // center, re-render to a new canvas with swapped dimensions (same
  // bake-into-a-new-PNG approach as color/width changes), and swap the
  // bounding rect to match, keeping the box centered in place.
  const handleRotate = useCallback((clockwise: boolean) => {
    if (!strokes || !onStyleChange) return;

    const { width, height, left, top, pageNumber } =
      highlight.position.boundingRect;

    const newStrokes = strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((p) =>
        clockwise
          ? { x: height - p.y, y: p.x }
          : { x: p.y, y: width - p.x },
      ),
    }));

    const newImage = renderStrokesToImage(newStrokes, height, width);
    onStyleChange(newImage, newStrokes);

    const centerX = left + width / 2;
    const centerY = top + height / 2;
    onChange?.({
      left: centerX - height / 2,
      top: centerY - width / 2,
      width: height,
      height: width,
      pageNumber,
    });
  }, [strokes, onStyleChange, onChange, highlight.position.boundingRect]);

  // Not enough room above the box for the toolbar (e.g. the drawing sits at
  // the very top of the page) — flip it below instead of letting it float
  // up over whatever page content is above the box.
  const flipToolbar = highlight.position.boundingRect.top < 40;

  return (
    <div
      className={`DrawingHighlight ${highlightClass} ${selectedClass}`}
      onContextMenu={onContextMenu}
      ref={containerRef}
    >
      {configLayer &&
        createPortal(
          <div
            className="DrawingHighlight__toolbar-wrapper"
            ref={toolbarWrapperRef}
            style={{
              position: "absolute",
              left: highlight.position.boundingRect.left,
              top: highlight.position.boundingRect.top,
            }}
          >
          <div
            className={`DrawingHighlight__toolbar DrawingHighlight__toolbar--floating ${flipToolbar ? "DrawingHighlight__toolbar--below" : ""} ${isSelected || isScrolledTo || showStyleControls ? "DrawingHighlight__toolbar--visible" : ""}`}
          >
            {strokes && strokes.length > 0 && onStyleChange && (
              <>
                {/* Color as a dropdown (swatch + chevron) instead of a row of
                    dots — gives each preset room for a name and a checkmark
                    on the active one, and keeps the toolbar itself compact. */}
                <button
                  type="button"
                  className="DrawingHighlight__color-trigger"
                  aria-label="Stroke color"
                  aria-expanded={isColorMenuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStyleControls(false);
                    setIsColorMenuOpen((v) => !v);
                  }}
                  title="Stroke color"
                >
                  <span
                    className="DrawingHighlight__color-trigger-dot"
                    style={{ backgroundColor: currentColor }}
                  />
                  <ChevronDown width={12} height={12} strokeWidth={2.5} />
                </button>
                <div className="DrawingHighlight__toolbar-divider" />
              </>
            )}
            {strokes && strokes.length > 0 && onStyleChange && (
              <button
                type="button"
                className="DrawingHighlight__style-button"
                title="Stroke width"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsColorMenuOpen(false);
                  setShowStyleControls(!showStyleControls);
                }}
              >
                <Pencil width={14} height={14} />
              </button>
            )}
            {strokes && strokes.length > 0 && onStyleChange && (
              <>
                <button
                  type="button"
                  className="DrawingHighlight__rotate-button"
                  title="Rotate left"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRotate(false);
                  }}
                >
                  <RotateCcw width={14} height={14} />
                </button>
                <button
                  type="button"
                  className="DrawingHighlight__rotate-button"
                  title="Rotate right"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRotate(true);
                  }}
                >
                  <RotateCw width={14} height={14} />
                </button>
              </>
            )}
            {onDelete && (
              <button
                className="DrawingHighlight__delete-button"
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
            {showStyleControls && strokes && strokes.length > 0 && onStyleChange && (
              <div className="DrawingHighlight__style-controls" ref={styleControlsRef}>
                <div className="DrawingHighlight__width-picker">
                  {STROKE_WIDTHS.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      className={`DrawingHighlight__width-button ${currentWidth === w.value ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWidthChange(w.value);
                      }}
                      title={w.label}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color dropdown - same slot as the style controls */}
            {isColorMenuOpen && strokes && strokes.length > 0 && onStyleChange && (
              <div className="DrawingHighlight__color-menu" ref={colorMenuRef}>
                {DRAWING_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="DrawingHighlight__color-menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleColorChange(color);
                      setIsColorMenuOpen(false);
                    }}
                  >
                    <span
                      className="DrawingHighlight__color-menu-dot"
                      style={{ backgroundColor: color }}
                    />
                    <span className="DrawingHighlight__color-menu-label">
                      {COLOR_NAMES[color] || color}
                    </span>
                    {currentColor === color && (
                      <span className="DrawingHighlight__color-menu-check">
                        <Check width={14} height={14} strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>,
          configLayer,
        )}
      <Rnd
        className="DrawingHighlight__rnd"
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
          width: highlight.position.boundingRect.width || 150,
          height: highlight.position.boundingRect.height || 100,
        }}
        minWidth={30}
        minHeight={30}
        key={key}
        bounds={bounds}
        // No aspect ratio lock for drawings - allow free resizing
        lockAspectRatio={false}
        // A click still selects the highlight (shows the toolbar).
        onClick={(event: Event) => {
          event.stopPropagation();
          event.preventDefault();
          setIsSelected(true);
        }}
        style={style}
      >
        <div
          className="DrawingHighlight__container"
        >
          <div className="DrawingHighlight__content">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Drawing"
                className="DrawingHighlight__image"
                draggable={false}
              />
            ) : (
              <div className="DrawingHighlight__placeholder">No drawing</div>
            )}
          </div>
        </div>
      </Rnd>
    </div>
  );
};
