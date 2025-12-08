import React, { useRef, useEffect, useCallback } from "react";
import "../style/SignaturePad.css";

/**
 * The props type for {@link SignaturePad}.
 *
 * @category Component Properties
 */
export interface SignaturePadProps {
  /**
   * Whether the signature pad modal is open.
   */
  isOpen: boolean;

  /**
   * Callback when signature is completed.
   *
   * @param dataUrl - The signature as a PNG data URL.
   */
  onComplete: (dataUrl: string) => void;

  /**
   * Callback when the modal is closed/cancelled.
   */
  onClose: () => void;

  /**
   * Canvas width in pixels.
   * @default 400
   */
  width?: number;

  /**
   * Canvas height in pixels.
   * @default 200
   */
  height?: number;
}

/**
 * A modal component with a canvas for drawing signatures.
 * Supports both mouse and touch input.
 *
 * @category Component
 */
export const SignaturePad = ({
  isOpen,
  onComplete,
  onClose,
  width = 400,
  height = 200,
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Initialize canvas context
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up drawing style
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Clear canvas
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
  }, [isOpen, width, height]);

  const getPosition = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = true;
      lastPosRef.current = getPosition(e);
    },
    [getPosition]
  );

  const draw = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      const currentPos = getPosition(e);

      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();

      lastPosRef.current = currentPos;
    },
    [getPosition]
  );

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Mouse events
    const handleMouseDown = (e: MouseEvent) => startDrawing(e);
    const handleMouseMove = (e: MouseEvent) => draw(e);
    const handleMouseUp = () => stopDrawing();
    const handleMouseLeave = () => stopDrawing();

    // Touch events
    const handleTouchStart = (e: TouchEvent) => startDrawing(e);
    const handleTouchMove = (e: TouchEvent) => draw(e);
    const handleTouchEnd = () => stopDrawing();

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isOpen, startDrawing, draw, stopDrawing]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
  };

  const handleDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    onComplete(dataUrl);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Close if clicking the overlay background
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="SignaturePad__overlay" onClick={handleOverlayClick}>
      <div className="SignaturePad__modal">
        <h3 className="SignaturePad__title">Draw your signature</h3>
        <canvas
          ref={canvasRef}
          className="SignaturePad__canvas"
          width={width}
          height={height}
        />
        <div className="SignaturePad__buttons">
          <button
            type="button"
            className="SignaturePad__button SignaturePad__button--clear"
            onClick={handleClear}
          >
            Clear
          </button>
          <button
            type="button"
            className="SignaturePad__button SignaturePad__button--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="SignaturePad__button SignaturePad__button--done"
            onClick={handleDone}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
