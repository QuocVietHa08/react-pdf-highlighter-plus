import React from "react";
import { Download, Minus, PanelLeftClose, PanelLeft, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface HeaderProps {
  pdfScaleValue: number | undefined;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExportPdf: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Header({
  pdfScaleValue,
  onZoomIn,
  onZoomOut,
  onExportPdf,
  sidebarOpen,
  onToggleSidebar,
}: HeaderProps) {
  const displayZoom = pdfScaleValue
    ? `${Math.round(pdfScaleValue * 100)}%`
    : "Auto";

  return (
    <TooltipProvider>
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        {/* Left section - Logo and sidebar toggle */}
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSidebar}
                className="h-9 w-9"
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-5 w-5" />
                ) : (
                  <PanelLeft className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="text-sm font-bold text-primary-foreground">
                PDF
              </span>
            </div>
            <span className="text-lg font-semibold">Highlighter</span>
          </div>
        </div>

        {/* Right section - Zoom controls and export */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-md border bg-muted/50 p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onZoomOut}
                  className="h-7 w-7"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>

            <span className="min-w-[60px] text-center text-sm font-medium">
              {displayZoom}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onZoomIn}
                  className="h-7 w-7"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Export button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onExportPdf}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export PDF with annotations</TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}
