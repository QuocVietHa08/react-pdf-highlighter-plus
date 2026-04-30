import React, { useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Minimize2,
  Minus,
  Moon,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Search,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLoadLocalPdf?: (file: File) => void;
  searchQuery: string;
  searchCurrent: number;
  searchTotal: number;
  isSearchPending: boolean;
  noteCompactMode: boolean;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
  onSearchClear: () => void;
  onToggleNoteCompactMode: () => void;
  onExtractSentences: () => void;
  isExtractingSentences: boolean;
  extractedSentenceCount: number;
  sentenceExtractionPages: string;
  onSentenceExtractionPagesChange: (pages: string) => void;
}

export function Header({
  pdfScaleValue,
  onZoomIn,
  onZoomOut,
  onExportPdf,
  sidebarOpen,
  onToggleSidebar,
  darkMode,
  onToggleDarkMode,
  onLoadLocalPdf,
  searchQuery,
  searchCurrent,
  searchTotal,
  isSearchPending,
  noteCompactMode,
  onSearchQueryChange,
  onSearchSubmit,
  onSearchNext,
  onSearchPrevious,
  onSearchClear,
  onToggleNoteCompactMode,
  onExtractSentences,
  isExtractingSentences,
  extractedSentenceCount,
  sentenceExtractionPages,
  onSentenceExtractionPagesChange,
}: HeaderProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const displayZoom = pdfScaleValue
    ? `${Math.round(pdfScaleValue * 100)}%`
    : "Auto";

  const handlePdfFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onLoadLocalPdf) {
      onLoadLocalPdf(file);
    }
    // Reset so same file can be selected again
    event.target.value = "";
  };

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
          {/* Search controls */}
          <form
            className="flex items-center gap-1 rounded-md border bg-muted/50 p-1"
            onSubmit={(event) => {
              event.preventDefault();
              onSearchSubmit();
            }}
          >
            <Search className="ml-2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search PDF"
              className="h-7 w-44 border-0 bg-transparent px-2 py-1 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span className="min-w-[54px] text-center text-xs text-muted-foreground">
              {isSearchPending
                ? "..."
                : searchTotal > 0
                  ? `${searchCurrent}/${searchTotal}`
                  : searchQuery
                    ? "0/0"
                    : ""}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onSearchPrevious}
                  disabled={!searchQuery}
                  className="h-7 w-7"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous match</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onSearchNext}
                  disabled={!searchQuery}
                  className="h-7 w-7"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next match</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onSearchClear}
                  disabled={!searchQuery}
                  className="h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear search</TooltipContent>
            </Tooltip>
          </form>

          <Separator orientation="vertical" className="h-6" />

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

          {/* Note display controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={noteCompactMode ? "default" : "ghost"}
                size="icon"
                onClick={onToggleNoteCompactMode}
                className="h-9 w-9"
              >
                <Minimize2 className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {noteCompactMode ? "Show full notes" : "Compact notes"}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          {/* Dark mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleDarkMode}
                className="h-9 w-9"
              >
                {darkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {darkMode ? "Light mode" : "Dark mode"}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          {/* Sentence extraction controls */}
          <div className="flex items-center gap-1 rounded-md border bg-muted/50 p-1">
            <Input
              value={sentenceExtractionPages}
              onChange={(event) =>
                onSentenceExtractionPagesChange(event.target.value)
              }
              placeholder="all"
              className="h-7 w-24 border-0 bg-transparent px-2 py-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isExtractingSentences}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onExtractSentences}
                  disabled={isExtractingSentences}
                  className="h-7"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {isExtractingSentences
                    ? "Extracting"
                    : extractedSentenceCount > 0
                      ? `${extractedSentenceCount}`
                      : "JSON"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Use all, 1, 1-3, or 1,3,5-7</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pdfInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Open PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open a local PDF file</TooltipContent>
          </Tooltip>

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

        {/* Hidden file input for PDF upload */}
        <input
          type="file"
          ref={pdfInputRef}
          style={{ display: "none" }}
          accept="application/pdf"
          onChange={handlePdfFileChange}
        />
      </header>
    </TooltipProvider>
  );
}
