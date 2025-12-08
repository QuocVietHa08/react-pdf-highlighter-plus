import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { viewportPositionToScaled } from "../lib/coordinates";
import { DrawingStroke, ScaledPosition, ViewportPosition } from "../types";
import "../style/DrawingCanvas.css";

import type { PDFViewer as TPDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";

/**
 * The props type for {@link DrawingCanvas}.
 *
 * @category Component Properties
 */
export interface DrawingCanvasProps {
  /**
   * Whether drawing mode is active.
   */
  isActive: boolean;

  /**
   * Stroke color for drawing.
   * @default "#000000"
   */
  strokeColor?: string;

  /**
   * Stroke width for drawing.
   * @default 3
   */
  strokeWidth?: number;

  /**
   * The PDF viewer instance.
   */
  viewer: InstanceType<typeof TPDFViewer>;

  /**
   * Callback when drawing is complete.
   *
   * @param dataUrl - The drawing as a PNG data URL.
   * @param position - Scaled position of the drawing on the page.
   * @param strokes - The stroke data for later editing.
   */
  onComplete: (dataUrl: string, position: ScaledPosition, strokes: DrawingStroke[]) => void;

  /**
   * Callback when drawing is cancelled.
   */
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

/**
 * A transparent overlay canvas for freehand drawing on PDF pages.
 * Supports mouse and touch input.
 *
 * @category Component
 */
export const DrawingCanvas = ({
  isActive,
  strokeColor = "#000000",
  strokeWidth = 3,
  viewer,
  onComplete,
  onCancel,
}: DrawingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const isDrawingRef = useRef(false);
  const [pageNumber, setPageNumber] = useState<number | null>(null);
  const [pageElement, setPageElement] = useState<HTMLElement | null>(null);

  // Find which page the user is drawing on
  const findPageFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!viewer) return null;

      for (let i = 0; i < viewer.pagesCount; i++) {
        const pageView = viewer.getPageView(i);
        if (!pageView?.div) continue;

        const rect = pageView.div.getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return {
            pageNumber: i + 1,
            element: pageView.div as HTMLElement,
            rect,
          };
        }
      }
      return null;
    },
    [viewer]
  );

  // Redraw all strokes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all completed strokes with their own color/width
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

    // Draw current stroke with current color/width
    if (currentStroke && currentStroke.points.length >= 2) {
      ctx.strokeStyle = currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(currentStroke.points[0].x, currentStroke.points[0].y);
      currentStroke.points.slice(1).forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
  }, [strokes, currentStroke]);

  // Redraw when strokes change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Handle mouse/touch down
  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      const pageInfo = findPageFromPoint(clientX, clientY);
      if (!pageInfo) return;

      console.log("DrawingCanvas: Started drawing on page", pageInfo.pageNumber);

      // Set page context if not already set
      if (pageNumber === null) {
        setPageNumber(pageInfo.pageNumber);
        setPageElement(pageInfo.element);

        // Resize canvas to match page
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = pageInfo.rect.width;
          canvas.height = pageInfo.rect.height;
          canvas.style.left = `${pageInfo.rect.left}px`;
          canvas.style.top = `${pageInfo.rect.top}px`;
        }
      } else if (pageInfo.pageNumber !== pageNumber) {
        // User trying to draw on different page - ignore
        console.log("DrawingCanvas: Ignoring - different page");
        return;
      }

      isDrawingRef.current = true;
      const pos = {
        x: clientX - pageInfo.rect.left,
        y: clientY - pageInfo.rect.top,
      };
      setCurrentStroke({ points: [pos], color: strokeColor, width: strokeWidth });
    },
    [pageNumber, findPageFromPoint, strokeColor, strokeWidth]
  );

  // Handle mouse/touch move
  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawingRef.current || !pageElement) return;

      const rect = pageElement.getBoundingClientRect();
      const pos = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };

      setCurrentStroke((prev) => {
        if (!prev) return null;
        return { ...prev, points: [...prev.points, pos] };
      });
    },
    [pageElement]
  );

  // Handle mouse/touch end
  const handleEnd = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStroke && currentStroke.points.length >= 2) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
  }, [currentStroke]);

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX, e.clientY);
    },
    [handleStart]
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Touch event handlers
  const handleTouchStart = useCallback(
    (e: ReactTouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleStart]
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleMove]
  );

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Handle keyboard events
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        console.log("DrawingCanvas: Cancelled via Escape");
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onCancel]);

  // Clear drawing
  const handleClear = () => {
    console.log("DrawingCanvas: Cleared strokes");
    setStrokes([]);
    setCurrentStroke(null);
    setPageNumber(null);
    setPageElement(null);
  };

  // Complete drawing
  const handleDone = () => {
    if (strokes.length === 0 || pageNumber === null || !pageElement || !viewer) {
      console.log("DrawingCanvas: No strokes to save");
      onCancel();
      return;
    }

    console.log("DrawingCanvas: Completing drawing with", strokes.length, "strokes");

    // Calculate bounding box of all strokes
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    strokes.forEach((stroke) => {
      stroke.points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    // Find max stroke width for padding
    const maxStrokeWidth = Math.max(...strokes.map(s => s.width));
    const padding = maxStrokeWidth * 2;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = maxX + padding;
    maxY = maxY + padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // Create a new canvas with just the drawing (cropped to bounding box)
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outputCtx = outputCanvas.getContext("2d");

    if (!outputCtx) {
      console.error("DrawingCanvas: Could not get output canvas context");
      onCancel();
      return;
    }

    // Draw all strokes offset by bounding box origin, using per-stroke color/width
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;

      outputCtx.strokeStyle = stroke.color;
      outputCtx.lineWidth = stroke.width;
      outputCtx.lineCap = "round";
      outputCtx.lineJoin = "round";

      outputCtx.beginPath();
      outputCtx.moveTo(stroke.points[0].x - minX, stroke.points[0].y - minY);
      stroke.points.slice(1).forEach((point) => {
        outputCtx.lineTo(point.x - minX, point.y - minY);
      });
      outputCtx.stroke();
    });

    const dataUrl = outputCanvas.toDataURL("image/png");

    // Create viewport position
    const viewportPosition: ViewportPosition = {
      boundingRect: {
        left: minX,
        top: minY,
        width: width,
        height: height,
        pageNumber: pageNumber,
      },
      rects: [],
    };

    const scaledPosition = viewportPositionToScaled(viewportPosition, viewer);

    // Normalize strokes relative to bounding box for storage
    const normalizedStrokes: DrawingStroke[] = strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({
        x: point.x - minX,
        y: point.y - minY,
      })),
    }));

    console.log("DrawingCanvas: Created drawing at position", scaledPosition);
    onComplete(dataUrl, scaledPosition, normalizedStrokes);

    // Reset state
    setStrokes([]);
    setCurrentStroke(null);
    setPageNumber(null);
    setPageElement(null);
  };

  if (!isActive) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="DrawingCanvas"
        style={{
          width: pageElement ? pageElement.getBoundingClientRect().width : "100%",
          height: pageElement ? pageElement.getBoundingClientRect().height : "100%",
          position: "fixed",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <div className="DrawingCanvas__controls">
        <button
          type="button"
          className="DrawingCanvas__clearButton"
          onClick={handleClear}
        >
          Clear
        </button>
        <button
          type="button"
          className="DrawingCanvas__cancelButton"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="DrawingCanvas__doneButton"
          onClick={handleDone}
        >
          Done
        </button>
      </div>
    </>
  );
};
