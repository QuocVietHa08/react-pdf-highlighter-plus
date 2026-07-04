import React, {
  CSSProperties,
  MouseEvent,
  ReactNode,
  useState,
  useRef,
  useEffect,
} from "react";
import { RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { Rnd } from "react-rnd";
import { getPageFromElement } from "../lib/pdfjs-dom";
import type { LTWHP, ViewportHighlight } from "../types";
import { useClearTipWhileSelected } from "../contexts/PdfHighlighterContext";

/**
 * The props type for {@link ImageHighlight}.
 *
 * @category Component Properties
 */
export interface ImageHighlightProps {
  /**
   * The highlight to be rendered as an {@link ImageHighlight}.
   * The highlight.content.image should contain the image data URL.
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
   * Callback triggered when the delete button is clicked.
   */
  onDelete?(): void;

  /**
   * Custom delete icon. Replaces the default trash icon.
   */
  deleteIcon?: ReactNode;

  /**
   * Callback triggered when the image is rotated 90°. Receives the
   * re-rendered PNG data URL (rotated, dimensions swapped to match).
   * Pair with `onChange` to persist the swapped bounding rect this
   * component already computes and passes to it.
   */
  onImageChange?(newImage: string): void;
}

// (The dedicated drag handle was removed — the whole image body drags now.
// The dragIcon prop is kept in the API for backward compatibility.)

const DefaultDeleteIcon = () => <Trash2 width={14} height={14} />;

/**
 * Rotate a raster image 90° by redrawing it onto a canvas with swapped
 * dimensions — bakes the rotation into new pixels (like DrawingHighlight
 * bakes stroke edits into a new PNG) instead of a CSS transform, so the
 * result behaves like any other stored image (crops, exports, etc. all
 * just work on it).
 */
const rotateImageDataUrl = (
  dataUrl: string,
  width: number,
  height: number,
  clockwise: boolean,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = height;
      canvas.height = width;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.translate(height / 2, width / 2);
      ctx.rotate(((clockwise ? 90 : -90) * Math.PI) / 180);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image for rotation"));
    img.src = dataUrl;
  });

/**
 * Renders a draggable, resizable image/signature annotation.
 *
 * @category Component
 */
export const ImageHighlight = ({
  highlight,
  onChange,
  isScrolledTo,
  bounds,
  onContextMenu,
  onEditStart,
  onEditEnd,
  style,
  dragIcon,
  onDelete,
  deleteIcon,
  onImageChange,
}: ImageHighlightProps) => {
  const [isSelected, setIsSelected] = useState(false);
  useClearTipWhileSelected(isSelected);
  const rootRef = useRef<HTMLDivElement>(null);

  const highlightClass = isScrolledTo ? "ImageHighlight--scrolledTo" : "";
  const selectedClass = isSelected ? "ImageHighlight--selected" : "";

  // Deselect on click outside / Escape (selection interaction model).
  useEffect(() => {
    if (!isSelected) return;
    const handlePointerDown = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsSelected(false);
      }
    };
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSelected(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isSelected]);

  // Generate key based on position for Rnd remount on position changes
  const key = `${highlight.position.boundingRect.width}${highlight.position.boundingRect.height}${highlight.position.boundingRect.left}${highlight.position.boundingRect.top}`;

  const imageUrl = highlight.content?.image;

  // Not enough room above the box for the toolbar (e.g. the image sits at
  // the very top of the page) — flip it below instead of letting it float
  // up over whatever page content is above the box.
  const flipToolbar = highlight.position.boundingRect.top < 40;

  // Rotate 90° at a time: re-render the raster with swapped dimensions and
  // swap the bounding rect to match, keeping the box centered in place.
  const handleRotate = async (clockwise: boolean) => {
    if (!imageUrl) return;
    const { width, height, left, top, pageNumber } =
      highlight.position.boundingRect;
    const newImage = await rotateImageDataUrl(imageUrl, width, height, clockwise);
    onImageChange?.(newImage);
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    onChange?.({
      left: centerX - height / 2,
      top: centerY - width / 2,
      width: height,
      height: width,
      pageNumber,
    });
  };

  return (
    <div
      className={`ImageHighlight ${highlightClass} ${selectedClass}`}
      onContextMenu={onContextMenu}
      ref={rootRef}
    >
      <Rnd
        className="ImageHighlight__rnd"
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
        minWidth={50}
        minHeight={50}
        key={key}
        bounds={bounds}
        lockAspectRatio={true}
        // The whole image body drags; only the toolbar controls are excluded.
        cancel=".ImageHighlight__toolbar"
        // A click still selects the highlight (shows the toolbar).
        onClick={(event: Event) => {
          event.stopPropagation();
          event.preventDefault();
          setIsSelected(true);
        }}
        style={style}
      >
        <div className="ImageHighlight__container">
          {(onDelete || onImageChange) && (
            <div
              className={`ImageHighlight__toolbar ${flipToolbar ? "ImageHighlight__toolbar--below" : ""}`}
            >
              {onImageChange && imageUrl && (
                <>
                  <button
                    className="ImageHighlight__rotate-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRotate(false);
                    }}
                    title="Rotate left"
                    type="button"
                  >
                    <RotateCcw width={14} height={14} />
                  </button>
                  <button
                    className="ImageHighlight__rotate-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRotate(true);
                    }}
                    title="Rotate right"
                    type="button"
                  >
                    <RotateCw width={14} height={14} />
                  </button>
                  <div className="ImageHighlight__toolbar-divider" />
                </>
              )}
              {onDelete && (
                <button
                  className="ImageHighlight__delete-button"
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
          )}
          <div className="ImageHighlight__content">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Highlight"
                className="ImageHighlight__image"
                draggable={false}
              />
            ) : (
              <div className="ImageHighlight__placeholder">No image</div>
            )}
          </div>
        </div>
      </Rnd>
    </div>
  );
};
