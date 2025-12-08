import React, { useState } from "react";

import "./style/Toolbar.css";

// Drawing style presets
const DRAWING_COLORS = ["#000000", "#FF0000", "#0000FF", "#00FF00", "#FFFF00"];
const STROKE_WIDTHS = [
  { label: "Thin", value: 1 },
  { label: "Medium", value: 3 },
  { label: "Thick", value: 5 },
];

interface ToolbarProps {
  setPdfScaleValue: (value: number) => void;
  toggleHighlightPen: () => void;
  toggleFreetextMode: () => void;
  isFreetextMode: boolean;
  onAddImage: () => void;
  onAddSignature: () => void;
  onExportPdf: () => void;
  // Drawing mode props
  isDrawingMode?: boolean;
  onToggleDrawingMode?: () => void;
  drawingStrokeColor?: string;
  onDrawingColorChange?: (color: string) => void;
  drawingStrokeWidth?: number;
  onDrawingWidthChange?: (width: number) => void;
}

const Toolbar = ({
  setPdfScaleValue,
  toggleHighlightPen,
  toggleFreetextMode,
  isFreetextMode,
  onAddImage,
  onAddSignature,
  onExportPdf,
  isDrawingMode = false,
  onToggleDrawingMode,
  drawingStrokeColor = "#000000",
  onDrawingColorChange,
  drawingStrokeWidth = 3,
  onDrawingWidthChange,
}: ToolbarProps) => {
  const [zoom, setZoom] = useState<number | null>(null);
  const [isHighlightPen, setIsHighlightPen] = useState<boolean>(false);

  const zoomIn = () => {
    if (zoom) {
      if (zoom < 4) {
        setPdfScaleValue(zoom + 0.1);
        setZoom(zoom + 0.1);
      }
    } else {
      setPdfScaleValue(1);
      setZoom(1);
    }
  };

  const zoomOut = () => {
    if (zoom) {
      if (zoom > 0.2) {
        setPdfScaleValue(zoom - 0.1);
        setZoom(zoom - 0.1);
      }
    } else {
      setPdfScaleValue(1);
      setZoom(1);
    }
  };

  return (
    <div className="Toolbar">
      <div className="ZoomControls">
        <button title="Zoom in" onClick={zoomIn}>+</button>
        <button title="Zoom out" onClick={zoomOut}>-</button>
        {zoom ? `${(zoom * 100).toFixed(0)}%` : "Auto"}
      </div>
      <button title="Highlight" className={`HighlightButton ${isHighlightPen ? 'active' : ''}`} onClick={() => {
        toggleHighlightPen();
        setIsHighlightPen(!isHighlightPen);
      }}>Toggle Highlights</button>
      <button
        title="Add Note"
        className={`FreetextButton ${isFreetextMode ? 'active' : ''}`}
        onClick={toggleFreetextMode}
      >
        {isFreetextMode ? "Exit Note Mode" : "Add Note"}
      </button>
      <button
        title="Add Image"
        className="ImageButton"
        onClick={onAddImage}
      >
        Add Image
      </button>
      <button
        title="Add Signature"
        className="SignatureButton"
        onClick={onAddSignature}
      >
        Add Signature
      </button>
      <div className="DrawingControls">
        <button
          title="Draw on PDF"
          className={`DrawButton ${isDrawingMode ? 'active' : ''}`}
          onClick={onToggleDrawingMode}
        >
          {isDrawingMode ? "Exit Draw" : "Draw"}
        </button>
      </div>
      <button
        title="Export PDF with annotations"
        className="ExportButton"
        onClick={onExportPdf}
      >
        Export PDF
      </button>
    </div>
  );
};

export default Toolbar;
