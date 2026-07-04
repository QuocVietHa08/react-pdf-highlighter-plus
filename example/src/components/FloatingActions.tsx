import React, { useState } from "react";
import {
  Plus,
  X,
  Highlighter,
  StickyNote,
  Image,
  Minimize2,
  PenTool,
  Pencil,
  Square,
  Circle,
  ArrowRight,
  RectangleHorizontal,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { cn } from "../lib/utils";

type ShapeType = "rectangle" | "circle" | "arrow";

interface FloatingActionsProps {
  highlightPen: boolean;
  onToggleHighlightPen: () => void;
  freetextMode: boolean;
  onToggleFreetextMode: () => void;
  noteCompactMode: boolean;
  onToggleNoteCompactMode: () => void;
  areaMode: boolean;
  onToggleAreaMode: () => void;
  onAddImage: () => void;
  onAddSignature: () => void;
  drawingMode: boolean;
  onToggleDrawingMode: () => void;
  // Shape mode props
  shapeMode: ShapeType | null;
  onSetShapeMode: (mode: ShapeType | null) => void;
}

export function FloatingActions({
  highlightPen,
  onToggleHighlightPen,
  freetextMode,
  onToggleFreetextMode,
  noteCompactMode,
  onToggleNoteCompactMode,
  areaMode,
  onToggleAreaMode,
  onAddImage,
  onAddSignature,
  drawingMode,
  onToggleDrawingMode,
  shapeMode,
  onSetShapeMode,
}: FloatingActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isAnyModeActive = highlightPen || freetextMode || noteCompactMode || areaMode || drawingMode || !!shapeMode;

  return (
    <TooltipProvider>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
        {/* Colour & width are no longer configured up-front: draw or place a
            shape, then adjust it from the highlight's own toolbar. So there's
            no options panel here — just the tool buttons below. */}

        {/* Action buttons - shown when FAB is open */}
        {isOpen && (
          <div className="flex flex-col-reverse gap-2">
            {/* Highlight Pen */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={highlightPen ? "default" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={() => {
                    onToggleHighlightPen();
                    if (!highlightPen) setIsOpen(false);
                  }}
                >
                  <Highlighter className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {highlightPen ? "Exit highlight mode" : "Highlight pen"}
              </TooltipContent>
            </Tooltip>

            {/* Add Note */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={freetextMode ? "default" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={() => {
                    onToggleFreetextMode();
                    if (!freetextMode) setIsOpen(false);
                  }}
                >
                  <StickyNote className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {freetextMode ? "Exit note mode" : "Add note"}
              </TooltipContent>
            </Tooltip>

            {/* Compact Notes */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={noteCompactMode ? "default" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={onToggleNoteCompactMode}
                >
                  <Minimize2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {noteCompactMode ? "Show full notes" : "Compact notes"}
              </TooltipContent>
            </Tooltip>

            {/* Area Highlight */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={areaMode ? "default" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={() => {
                    console.log("Area mode toggled:", !areaMode);
                    onToggleAreaMode();
                    if (!areaMode) setIsOpen(false);
                  }}
                >
                  <Square className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {areaMode ? "Exit area mode" : "Area highlight"}
              </TooltipContent>
            </Tooltip>

            {/* Add Image */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={() => {
                    onAddImage();
                    setIsOpen(false);
                  }}
                >
                  <Image className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Add image</TooltipContent>
            </Tooltip>

            {/* Add Signature */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={() => {
                    onAddSignature();
                    setIsOpen(false);
                  }}
                >
                  <PenTool className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Add signature</TooltipContent>
            </Tooltip>

            {/* Drawing Mode */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={drawingMode ? "default" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={onToggleDrawingMode}
                >
                  <Pencil className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {drawingMode ? "Exit drawing mode" : "Draw"}
              </TooltipContent>
            </Tooltip>

            {/* Shape Mode - Rectangle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={shapeMode === "rectangle" ? "default" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={() =>
                    onSetShapeMode(shapeMode === "rectangle" ? null : "rectangle")
                  }
                >
                  <RectangleHorizontal className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {shapeMode === "rectangle" ? "Exit rectangle mode" : "Draw rectangle"}
              </TooltipContent>
            </Tooltip>

            {/* Shape Mode - Circle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={shapeMode === "circle" ? "default" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={() =>
                    onSetShapeMode(shapeMode === "circle" ? null : "circle")
                  }
                >
                  <Circle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {shapeMode === "circle" ? "Exit circle mode" : "Draw circle"}
              </TooltipContent>
            </Tooltip>

            {/* Shape Mode - Arrow */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={shapeMode === "arrow" ? "default" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-md"
                  onClick={() =>
                    onSetShapeMode(shapeMode === "arrow" ? null : "arrow")
                  }
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {shapeMode === "arrow" ? "Exit arrow mode" : "Draw arrow"}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Main FAB button */}
        <Button
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg transition-transform",
            isOpen && "rotate-45",
            isAnyModeActive && "bg-primary"
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>
    </TooltipProvider>
  );
}
