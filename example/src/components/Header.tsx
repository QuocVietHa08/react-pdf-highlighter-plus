import React, { useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Minimize2,
  Link2,
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
  onLoadUrl?: (url: string) => void;
  searchQuery: string;
  searchCurrent: number;
  searchTotal: number;
  isSearchPending: boolean;
  searchCaseSensitive: boolean;
  searchWholeWord: boolean;
  noteCompactMode: boolean;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
  onSearchClear: () => void;
  onToggleSearchCaseSensitive: () => void;
  onToggleSearchWholeWord: () => void;
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
  onLoadUrl,
  searchQuery,
  searchCurrent,
  searchTotal,
  isSearchPending,
  searchCaseSensitive,
  searchWholeWord,
  noteCompactMode,
  onSearchQueryChange,
  onSearchSubmit,
  onSearchNext,
  onSearchPrevious,
  onSearchClear,
  onToggleSearchCaseSensitive,
  onToggleSearchWholeWord,
  onToggleNoteCompactMode,
  onExtractSentences,
  isExtractingSentences,
  extractedSentenceCount,
  sentenceExtractionPages,
  onSentenceExtractionPagesChange,
}: HeaderProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [openPdfModal, setOpenPdfModal] = React.useState(false);
  const [linkInput, setLinkInput] = React.useState("");
  const dialogRef = React.useRef<HTMLDivElement>(null);

  const submitLink = () => {
    const link = linkInput.trim();
    if (!link || !onLoadUrl) return;
    onLoadUrl(link);
    setLinkInput("");
    setOpenPdfModal(false);
  };

  // Modal a11y: close on Esc, trap Tab focus inside the dialog, and return focus
  // to the trigger on close.
  React.useEffect(() => {
    if (!openPdfModal) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenPdfModal(false);
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [openPdfModal]);
  const displayZoom = pdfScaleValue
    ? `${Math.round(pdfScaleValue * 100)}%`
    : "Auto";

  // Cmd/Ctrl+F focuses the PDF search box (overrides the browser find).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // In the search box: Enter = next match (or run search if not yet searched),
  // Shift+Enter = previous, Escape = clear.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onSearchPrevious();
      else if (searchTotal > 0) onSearchNext();
      else onSearchSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onSearchClear();
      searchInputRef.current?.blur();
    }
  };

  const handlePdfFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onLoadLocalPdf) {
      onLoadLocalPdf(file);
      setOpenPdfModal(false);
    }
    // Reset so same file can be selected again
    event.target.value = "";
  };

  return (
    <TooltipProvider>
      <header className="flex h-14 items-center justify-between gap-2 overflow-x-auto border-b bg-background px-4">
        {/* Left section - Logo and sidebar toggle */}
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSidebar}
                aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                aria-expanded={sidebarOpen}
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

          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="text-sm font-bold text-primary-foreground">
                PDF
              </span>
            </div>
            <span className="text-lg font-semibold">Highlighter</span>
          </div>
        </div>

        {/* Right section - Zoom controls and export */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Search controls */}
          <form
            role="search"
            className="flex items-center gap-1 rounded-md border bg-muted/50 p-1"
            onSubmit={(event) => {
              event.preventDefault();
              onSearchSubmit();
            }}
          >
            <Search className="ml-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search PDF"
              aria-label="Search PDF"
              className="h-7 w-44 border-0 bg-transparent px-2 py-1 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={searchCaseSensitive ? "secondary" : "ghost"}
                  size="icon"
                  onClick={onToggleSearchCaseSensitive}
                  className="h-7 w-7 text-xs font-semibold"
                  aria-label="Match case"
                  aria-pressed={searchCaseSensitive}
                >
                  Aa
                </Button>
              </TooltipTrigger>
              <TooltipContent>Match case</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={searchWholeWord ? "secondary" : "ghost"}
                  size="icon"
                  onClick={onToggleSearchWholeWord}
                  className="h-7 w-7 text-xs font-semibold"
                  aria-label="Match whole word"
                  aria-pressed={searchWholeWord}
                >
                  W
                </Button>
              </TooltipTrigger>
              <TooltipContent>Whole word</TooltipContent>
            </Tooltip>
            <span
              className="min-w-[54px] text-center text-xs text-muted-foreground"
              aria-live="polite"
              aria-label={
                searchTotal > 0
                  ? `Match ${searchCurrent} of ${searchTotal}`
                  : searchQuery
                    ? "No matches"
                    : undefined
              }
            >
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
                  aria-label="Previous match"
                  className="h-7 w-7"
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
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
                  aria-label="Next match"
                  className="h-7 w-7"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
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
                  aria-label="Clear search"
                  className="h-7 w-7"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
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
                  aria-label="Zoom out"
                  className="h-7 w-7"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>

            <span
              className="min-w-[60px] text-center text-sm font-medium"
              aria-live="polite"
              aria-label={`Zoom ${displayZoom}`}
            >
              {displayZoom}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onZoomIn}
                  aria-label="Zoom in"
                  className="h-7 w-7"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
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
                aria-label={noteCompactMode ? "Show full notes" : "Compact notes"}
                aria-pressed={noteCompactMode}
                className="h-9 w-9"
              >
                <Minimize2 className="h-5 w-5" aria-hidden="true" />
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
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                aria-pressed={darkMode}
                className="h-9 w-9"
              >
                {darkMode ? (
                  <Sun className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Moon className="h-5 w-5" aria-hidden="true" />
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
                onClick={() => setOpenPdfModal(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Open PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open a local file or a URL</TooltipContent>
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

      {/* Open PDF modal: local file or URL */}
      {openPdfModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpenPdfModal(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-pdf-title"
            className="w-full max-w-md rounded-lg border bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="open-pdf-title" className="text-base font-semibold">
                Open PDF
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Close dialog"
                onClick={() => setOpenPdfModal(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Option 1: upload local file */}
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-md border border-dashed p-4 text-left transition-colors hover:bg-muted/50"
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Upload a local PDF</div>
                <div className="text-xs text-muted-foreground">
                  Choose a .pdf file from your device
                </div>
              </div>
            </button>

            <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Option 2: paste a URL */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                Load from a URL
              </div>
              <Input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitLink();
                  }
                }}
                placeholder="https://… (Firebase Storage, etc.)"
                autoFocus
              />
              <Button
                className="w-full"
                size="sm"
                onClick={submitLink}
                disabled={!linkInput.trim()}
              >
                Load PDF
              </Button>
              <p className="text-xs text-muted-foreground">
                The server must allow CORS for cross-origin URLs.
              </p>
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
