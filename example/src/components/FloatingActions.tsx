import React, { useState } from "react";
import {
  Plus,
  X,
  Highlighter,
  StickyNote,
  Image,
  PenTool,
  Pencil,
} from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { cn } from "../lib/utils";

interface FloatingActionsProps {
  highlightPen: boolean;
  onToggleHighlightPen: () => void;
  freetextMode: boolean;
  onToggleFreetextMode: () => void;
  onAddImage: () => void;
  onAddSignature: () => void;
  drawingMode: boolean;
  onToggleDrawingMode: () => void;
  drawingStrokeColor: string;
  onDrawingColorChange: (color: string) => void;
  drawingStrokeWidth: number;
  onDrawingWidthChange: (width: number) => void;
}

const colorOptions = [
  "#000000",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

export function FloatingActions({
  highlightPen,
  onToggleHighlightPen,
  freetextMode,
  onToggleFreetextMode,
  onAddImage,
  onAddSignature,
  drawingMode,
  onToggleDrawingMode,
  drawingStrokeColor,
  onDrawingColorChange,
  drawingStrokeWidth,
  onDrawingWidthChange,
}: FloatingActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isAnyModeActive = highlightPen || freetextMode || drawingMode;

  return (
    <TooltipProvider>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
        {/* Drawing options panel - shown when drawing mode is active */}
        {drawingMode && (
          <div className="mb-2 rounded-lg border bg-background p-3 shadow-lg">
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Color
                </p>
                <div className="flex gap-1">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                        drawingStrokeColor === color
                          ? "border-primary"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => onDrawingColorChange(color)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Width: {drawingStrokeWidth}px
                </p>
                <Slider
                  value={[drawingStrokeWidth]}
                  onValueChange={([value]) => onDrawingWidthChange(value)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-40"
                />
              </div>
            </div>
          </div>
        )}

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
                  onClick={() => {
                    onToggleDrawingMode();
                    if (!drawingMode) setIsOpen(false);
                  }}
                >
                  <Pencil className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {drawingMode ? "Exit drawing mode" : "Draw"}
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
