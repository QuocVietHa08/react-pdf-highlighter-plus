import React, { MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import CommentForm from "./CommentForm";
import ContextMenu, { ContextMenuProps } from "./ContextMenu";
import ExpandableTip from "./ExpandableTip";
import HighlightContainer from "./HighlightContainer";
import Sidebar from "./Sidebar";
import { Sparkles } from "lucide-react";
import {
  CitationsPanel,
  type CitationListItem,
} from "./components/CitationsPanel";
import { Header } from "./components/Header";
import { FloatingActions } from "./components/FloatingActions";
import {
  DrawingStroke,
  GhostHighlight,
  Highlight,
  LeftPanel,
  PdfHighlighter,
  PdfHighlighterUtils,
  PdfLoader,
  ScaledPosition,
  ShapeData,
  ShapeType,
  SignaturePad,
  Tip,
  ViewportHighlight,
  extractPageTextItems,
  extractSentences,
  extractTextUnits,
  getTextPosition,
} from "./react-pdf-highlighter-extended";
import "./style/App.css";
import { CommentedHighlight } from "./types";

const PRIMARY_PDF_URL = "https://arxiv.org/pdf/2203.11115";
const SECONDARY_PDF_URL = "https://arxiv.org/pdf/1604.02480";
type TestHighlights = Record<string, CommentedHighlight[]>;

type SearchStatus = {
  current: number;
  total: number;
  isPending: boolean;
};

const parsePageSelection = (input: string): "all" | number[] => {
  const trimmedInput = input.trim().toLowerCase();
  if (!trimmedInput || trimmedInput === "all") return "all";

  const pages = new Set<number>();

  trimmedInput.split(",").forEach((part) => {
    const trimmedPart = part.trim();
    if (!trimmedPart) return;

    const rangeMatch = trimmedPart.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const firstPage = Math.min(start, end);
      const lastPage = Math.max(start, end);

      for (let page = firstPage; page <= lastPage; page += 1) {
        pages.add(page);
      }

      return;
    }

    const page = Number(trimmedPart);
    if (Number.isInteger(page) && page > 0) {
      pages.add(page);
    }
  });

  return pages.size > 0 ? Array.from(pages).sort((a, b) => a - b) : "all";
};

const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};

const getNextId = () => String(Math.random()).slice(2);

const parseIdFromHash = () => {
  return document.location.hash.slice("#highlight-".length);
};

const resetHash = () => {
  document.location.hash = "";
};

// Test any PDF (e.g. a Firebase Storage download URL) by appending
// ?pdf=<encoded-url> to the address bar. Falls back to the sample.
const initialUrl = (() => {
  const param = new URLSearchParams(window.location.search).get("pdf");
  return param || PRIMARY_PDF_URL;
})();

const App = () => {
  const [url, setUrl] = useState<string | Uint8Array>(initialUrl);
  const [highlights, setHighlights] = useState<Array<CommentedHighlight>>([]);
  const testHighlightsRef = useRef<TestHighlights>({});
  const currentPdfIndexRef = useRef(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
  const [pdfScaleValue, setPdfScaleValue] = useState<number | undefined>(
    undefined,
  );
  const [highlightPen, setHighlightPen] = useState<boolean>(false);
  const [freetextMode, setFreetextMode] = useState<boolean>(false);
  const [noteCompactMode, setNoteCompactMode] = useState<boolean>(false);
  const [imageMode, setImageMode] = useState<boolean>(false);
  const [areaMode, setAreaMode] = useState<boolean>(false);
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState<boolean>(false);
  const [pendingImageData, setPendingImageData] = useState<string | null>(null);
  // Drawing mode state
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [drawingStrokeColor, setDrawingStrokeColor] = useState<string>("#000000");
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState<number>(3);
  // Shape mode state
  const [shapeMode, setShapeMode] = useState<ShapeType | null>(null);
  const [shapeStrokeColor, setShapeStrokeColor] = useState<string>("#000000");
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(2);
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [scrolledToHighlightId, setScrolledToHighlightId] = useState<string | null>(null);
  // Left panel state
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(true);
  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(false);
  // Current page, announced to screen readers via an aria-live region.
  const [announcedPage, setAnnouncedPage] = useState<number>(1);

  // Citations (AI quote -> precise location in the PDF).
  const [citations, setCitations] = useState<CitationListItem[]>([]);
  const [citationLoading, setCitationLoading] = useState<boolean>(false);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [citationsOpen, setCitationsOpen] = useState<boolean>(false);

  // Flip the whole app chrome (header, sidebar, cards) by toggling the `dark`
  // class on <html>; the shadcn CSS vars in App.css do the rest.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    return () => document.documentElement.classList.remove("dark");
  }, [darkMode]);

  // Responsive: below 768px the side panels become overlay drawers instead of
  // taking layout width, so the PDF gets the full screen.
  const [isMobile, setIsMobile] = useState<boolean>(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // Collapse both panels when entering mobile so the PDF isn't covered.
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setLeftPanelOpen(false);
    }
  }, [isMobile]);

  // On mobile only one drawer at a time (both anchor left); opening one closes
  // the other.
  const toggleSidebar = () =>
    setSidebarOpen((open) => {
      const next = !open;
      if (next && isMobile) setLeftPanelOpen(false);
      return next;
    });
  const handleLeftPanelOpenChange = (open: boolean) => {
    setLeftPanelOpen(open);
    if (open && isMobile) setSidebarOpen(false);
  };

  // Default the drawing/shape ink to white in dark mode and black in light, so
  // strokes are visible against the recolored page. Only flips when the color is
  // still at the opposite default — a user-picked color (red, blue, …) is kept.
  useEffect(() => {
    const flip = (prev: string) =>
      prev === "#000000" || prev === "#ffffff"
        ? darkMode
          ? "#ffffff"
          : "#000000"
        : prev;
    setDrawingStrokeColor(flip);
    setShapeStrokeColor(flip);
  }, [darkMode]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchWholeWord, setSearchWholeWord] = useState(false);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>({
    current: 0,
    total: 0,
    isPending: false,
  });
  const [isExtractingSentences, setIsExtractingSentences] = useState(false);
  const [extractedSentenceCount, setExtractedSentenceCount] = useState(0);
  const [sentenceExtractionPages, setSentenceExtractionPages] = useState("all");

  // Refs for PdfHighlighter utilities
  const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const [, forceUpdate] = useState({});
  const hasInitializedUtilsRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset utils initialization flag when URL changes so forceUpdate triggers again
  useEffect(() => {
    hasInitializedUtilsRef.current = false;
    setSearchQuery("");
    setSearchStatus({ current: 0, total: 0, isPending: false });
    setExtractedSentenceCount(0);
    setSentenceExtractionPages("all");
  }, [url]);

  useEffect(() => {
    let cancelled = false;

    import("./test-highlights").then(({ testHighlights }) => {
      if (cancelled) return;
      testHighlightsRef.current = testHighlights;
      setHighlights(testHighlights[PRIMARY_PDF_URL] ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const eventBus = highlighterUtilsRef.current?.getEventBus();
    if (
      !eventBus ||
      typeof (eventBus as { on?: unknown }).on !== "function" ||
      typeof (eventBus as { off?: unknown }).off !== "function"
    ) {
      return;
    }

    const typedEventBus = eventBus as {
      on: (eventName: string, callback: (event: any) => void) => void;
      off: (eventName: string, callback: (event: any) => void) => void;
    };

    const handleFindState = (event: {
      state?: number;
      matchesCount?: { current?: number; total?: number };
    }) => {
      setSearchStatus({
        current: event.matchesCount?.current ?? 0,
        total: event.matchesCount?.total ?? 0,
        isPending: event.state === 3,
      });
    };

    const handleMatchesCount = (event: {
      matchesCount?: { current?: number; total?: number };
    }) => {
      setSearchStatus((previous) => ({
        ...previous,
        current: event.matchesCount?.current ?? 0,
        total: event.matchesCount?.total ?? 0,
      }));
    };

    typedEventBus.on("updatefindcontrolstate", handleFindState);
    typedEventBus.on("updatefindmatchescount", handleMatchesCount);

    return () => {
      typedEventBus.off("updatefindcontrolstate", handleFindState);
      typedEventBus.off("updatefindmatchescount", handleMatchesCount);
    };
  });

  const toggleDocument = () => {
    const urls = [PRIMARY_PDF_URL, SECONDARY_PDF_URL];
    currentPdfIndexRef.current = (currentPdfIndexRef.current + 1) % urls.length;
    setUrl(urls[currentPdfIndexRef.current]);
    setHighlights(testHighlightsRef.current[urls[currentPdfIndexRef.current]] ?? []);
  };

  // Clear citations when the document changes.
  useEffect(() => {
    setCitations([]);
    setActiveCitationId(null);
  }, [url]);

  // Resolve a quote to its PRECISE position via the library's getTextPosition
  // (exact phrase rects, not a whole sentence), render it as a distinct citation
  // highlight, and scroll/flash to it. Citation highlights are kept separate
  // from the user's saved annotations (isCitation) so they don't clutter them.
  const handleFindCitation = async (quote: string): Promise<boolean> => {
    const pdfDocument = pdfDocumentRef.current;
    if (!pdfDocument) return false;
    setCitationLoading(true);
    try {
      const match = await getTextPosition(pdfDocument, quote);
      if (!match) {
        console.log("[citations] no match for quote");
        return false;
      }
      const id = getNextId();
      const highlight: CommentedHighlight = {
        id,
        type: "text",
        content: { text: match.matchedText },
        position: match.position,
        isCitation: true,
        quote,
        highlightColor: "rgba(96, 165, 250, 0.45)", // distinct blue citation
      };
      // Keep all citation highlights so every list item stays clickable.
      setHighlights((prev) => [highlight, ...prev]);
      setCitations((prev) => [
        {
          id,
          quote,
          searchText: match.matchedText,
          pageNumber: match.pageNumber,
          confidence: match.confidence,
        },
        ...prev,
      ]);
      console.log("[citations] cited", {
        page: match.pageNumber,
        confidence: match.confidence,
      });
      setActiveCitationId(id);
      setTimeout(
        () => highlighterUtilsRef.current?.scrollToHighlight(highlight),
        80,
      );
      return true;
    } finally {
      setCitationLoading(false);
    }
  };

  const handleJumpCitation = (id: string) => {
    const highlight = highlights.find((h) => h.id === id);
    if (highlight) highlighterUtilsRef.current?.scrollToHighlight(highlight);
    setActiveCitationId(id);
  };

  const handleClearCitations = () => {
    setCitations([]);
    setActiveCitationId(null);
    setHighlights((prev) =>
      prev.filter((h) => !(h as CommentedHighlight).isCitation),
    );
  };

  const handleLoadUrl = (link: string) => {
    console.log(`Loading PDF from URL: ${link}`);
    setUrl(link);
    setHighlights([]); // Clear highlights for the new document
    // Reflect the source in the address bar so it's shareable / reloadable.
    const next = new URL(window.location.href);
    next.searchParams.set("pdf", link);
    next.searchParams.delete("page");
    window.history.replaceState(null, "", next);
  };

  const handleLoadLocalPdf = (file: File) => {
    console.log(`Loading local PDF: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      setUrl(uint8Array);
      setHighlights([]); // Clear highlights for new document
      console.log(`PDF loaded: ${file.name}`);
    };
    reader.onerror = () => {
      console.error("Failed to read PDF file");
      alert("Failed to read PDF file");
    };
    reader.readAsArrayBuffer(file);
  };

  // Click listeners for context menu
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [contextMenu]);

  // Track scrolled highlight from hash
  useEffect(() => {
    const handleHashChange = () => {
      const id = parseIdFromHash();
      setScrolledToHighlightId(id || null);
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange(); // Check initial hash

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const handleContextMenu = (
    event: MouseEvent<HTMLDivElement>,
    highlight: ViewportHighlight<CommentedHighlight>,
  ) => {
    event.preventDefault();

    setContextMenu({
      xPos: event.clientX,
      yPos: event.clientY,
      deleteHighlight: () => deleteHighlight(highlight),
      editComment: () => editComment(highlight),
    });
  };

  const addHighlight = (highlight: GhostHighlight, comment: string) => {
    console.log("Saving highlight", highlight);
    setHighlights([{ ...highlight, comment, id: getNextId() }, ...highlights]);
  };

  const deleteHighlight = (highlight: ViewportHighlight | Highlight | CommentedHighlight) => {
    console.log("Deleting highlight", highlight);
    setHighlights(highlights.filter((h) => h.id != highlight.id));
  };

  const editHighlight = (
    idToUpdate: string,
    edit: Partial<CommentedHighlight>,
  ) => {
    console.log(`Editing highlight ${idToUpdate} with `, edit);
    setHighlights(
      highlights.map((highlight) =>
        highlight.id === idToUpdate ? { ...highlight, ...edit } : highlight,
      ),
    );
  };

  const handleFreetextClick = (position: ScaledPosition) => {
    console.log("Creating freetext highlight", position);
    const newHighlight: CommentedHighlight = {
      id: getNextId(),
      type: "freetext",
      position,
      content: { text: "New note" },
      comment: "",
    };
    setHighlights([newHighlight, ...highlights]);
    setFreetextMode(false); // Exit mode after creating
  };

  const handleImageClick = (position: ScaledPosition) => {
    console.log("Creating image highlight", position);
    if (pendingImageData) {
      // Load image to get its natural dimensions
      const img = new Image();
      img.onload = () => {
        const imageAspect = img.naturalWidth / img.naturalHeight;
        const boundingRect = position.boundingRect;

        // Keep the width from click position, adjust height to maintain aspect ratio
        const currentWidth = boundingRect.x2 - boundingRect.x1;
        const adjustedHeight = currentWidth / imageAspect;

        // Create adjusted position with correct aspect ratio
        const adjustedPosition: ScaledPosition = {
          ...position,
          boundingRect: {
            ...boundingRect,
            y2: boundingRect.y1 + adjustedHeight,
          },
          rects: position.rects.map(rect => ({
            ...rect,
            y2: rect.y1 + adjustedHeight,
          })),
        };

        const newHighlight: CommentedHighlight = {
          id: getNextId(),
          type: "image",
          position: adjustedPosition,
          content: { image: pendingImageData },
          comment: "",
        };
        setHighlights([newHighlight, ...highlights]);
        setPendingImageData(null);
        setImageMode(false);
      };
      img.src = pendingImageData;
    }
  };

  const handleAddImage = () => {
    // Trigger file input click
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        console.log("Image loaded, entering image mode");
        setPendingImageData(dataUrl);
        setImageMode(true);
      };
      reader.readAsDataURL(file);
    }
    // Reset the input so the same file can be selected again
    event.target.value = "";
  };

  const handleAddSignature = () => {
    setIsSignaturePadOpen(true);
  };

  const handleSignatureComplete = (dataUrl: string) => {
    console.log("Signature complete, entering image mode");
    setPendingImageData(dataUrl);
    setIsSignaturePadOpen(false);
    setImageMode(true);
  };

  const handleDrawingComplete = (dataUrl: string, position: ScaledPosition, strokes: DrawingStroke[]) => {
    console.log("Drawing complete", position, "with", strokes.length, "strokes");
    const newHighlight: CommentedHighlight = {
      id: getNextId(),
      type: "drawing",
      position,
      content: { image: dataUrl, strokes },
      comment: "",
    };
    setHighlights([newHighlight, ...highlights]);
    setDrawingMode(false);
  };

  const handleDrawingCancel = () => {
    console.log("Drawing cancelled");
    setDrawingMode(false);
  };

  const handleShapeComplete = (position: ScaledPosition, shape: ShapeData) => {
    console.log("Shape complete", shape.shapeType, position);
    const newHighlight: CommentedHighlight = {
      id: getNextId(),
      type: "shape",
      position,
      content: { shape },
      shapeType: shape.shapeType,
      strokeColor: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      comment: "",
    };
    setHighlights([newHighlight, ...highlights]);
    setShapeMode(null);
  };

  const handleShapeCancel = () => {
    console.log("Shape cancelled");
    setShapeMode(null);
  };

  const handleExportPdf = async () => {
    console.log("Exporting PDF with annotations...");
    try {
      const { exportPdf } = await import("./react-pdf-highlighter-extended");
      const pdfBytes = await exportPdf(url, highlights, {
        onProgress: (current, total) => {
          console.log(`Exporting page ${current}/${total}`);
        },
      });

      // Download the file
      const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "annotated-document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      console.log("PDF exported successfully!");
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert("Failed to export PDF. See console for details.");
    }
  };

  const handleZoomIn = () => {
    const currentScale = pdfScaleValue || 1;
    setPdfScaleValue(Math.min(currentScale + 0.25, 3));
  };

  const handleZoomOut = () => {
    const currentScale = pdfScaleValue || 1;
    setPdfScaleValue(Math.max(currentScale - 0.25, 0.5));
  };

  const runSearch = (
    query: string,
    caseSensitive = searchCaseSensitive,
    entireWord = searchWholeWord,
  ) => {
    const trimmed = query.trim();
    if (!trimmed) {
      highlighterUtilsRef.current?.clearSearch();
      setSearchStatus({ current: 0, total: 0, isPending: false });
      return;
    }
    setSearchStatus((previous) => ({ ...previous, isPending: true }));
    highlighterUtilsRef.current?.search(trimmed, {
      highlightAll: true,
      caseSensitive,
      entireWord,
    });
  };

  const handleSearchSubmit = () => runSearch(searchQuery);

  // Re-run the active search when an option toggles, so results update live.
  useEffect(() => {
    if (searchQuery.trim()) runSearch(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCaseSensitive, searchWholeWord]);

  const handleSearchClear = () => {
    setSearchQuery("");
    setSearchStatus({ current: 0, total: 0, isPending: false });
    highlighterUtilsRef.current?.clearSearch();
  };

  const handleExtractSentences = async () => {
    const pdfDocument = pdfDocumentRef.current;
    if (!pdfDocument || isExtractingSentences) return;

    setIsExtractingSentences(true);

    try {
      const pages = parsePageSelection(sentenceExtractionPages);
      const extractionOptions = {
        pages,
      };
      const [extractedPages, textUnits, sentences] = await Promise.all([
        extractPageTextItems(pdfDocument, extractionOptions),
        extractTextUnits(pdfDocument, extractionOptions),
        extractSentences(pdfDocument, extractionOptions),
      ]);
      const exportPayload = {
        pageSelection: pages,
        pages: extractedPages.map((page) => ({
          pageNumber: page.pageNumber,
          width: page.width,
          height: page.height,
          columns: page.columns ?? [],
          textUnits: textUnits.filter(
            (unit) => unit.pageNumber === page.pageNumber,
          ),
          sentences: sentences.filter(
            (sentence) => sentence.pageNumber === page.pageNumber,
          ),
        })),
      };
      const pageLabel = Array.isArray(pages) ? pages.join("-") : "all";

      console.log("Extracted PDF text units", textUnits);
      console.log("Extracted PDF sentences", sentences);
      setExtractedSentenceCount(sentences.length);
      downloadJson(exportPayload, `pdf-sentences-${pageLabel}.json`);
    } catch (error) {
      console.error("Failed to extract sentences:", error);
      alert("Failed to extract sentences. See console for details.");
    } finally {
      setIsExtractingSentences(false);
    }
  };

  const resetHighlights = () => {
    setHighlights([]);
  };

  const getHighlightById = useCallback((id: string) => {
    return highlights.find((highlight) => highlight.id === id);
  }, [highlights]);

  // Open comment tip and update highlight with new user input
  const editComment = (highlight: ViewportHighlight<CommentedHighlight>) => {
    if (!highlighterUtilsRef.current) return;

    const editCommentTip: Tip = {
      position: highlight.position,
      content: (
        <CommentForm
          placeHolder={highlight.comment}
          onSubmit={(input) => {
            editHighlight(highlight.id, { comment: input });
            highlighterUtilsRef.current!.setTip(null);
            highlighterUtilsRef.current!.toggleEditInProgress(false);
          }}
        ></CommentForm>
      ),
    };

    highlighterUtilsRef.current.setTip(editCommentTip);
    highlighterUtilsRef.current.toggleEditInProgress(true);
  };

  // Handle editing from sidebar - scroll to highlight first, then prompt user
  const handleEditFromSidebar = (highlight: CommentedHighlight) => {
    // Update the hash to scroll to the highlight
    document.location.hash = `highlight-${highlight.id}`;
    // The actual edit tip will need to be triggered after scrolling
    // For now, we just scroll - user can right-click to edit
  };

  // Scroll to highlight based on hash in the URL
  const scrollToHighlightFromHash = useCallback(() => {
    const highlight = getHighlightById(parseIdFromHash());

    if (highlight && highlighterUtilsRef.current) {
      highlighterUtilsRef.current.scrollToHighlight(highlight);
    }
  }, [getHighlightById]);

  // Hash listeners for autoscrolling to highlights
  useEffect(() => {
    window.addEventListener("hashchange", scrollToHighlightFromHash);

    return () => {
      window.removeEventListener("hashchange", scrollToHighlightFromHash);
    };
  }, [scrollToHighlightFromHash]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Screen-reader announcement of the current page */}
      <div className="sr-only" aria-live="polite" role="status">
        Page {announcedPage}
      </div>
      {/* Header */}
      <Header
        pdfScaleValue={pdfScaleValue}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onExportPdf={handleExportPdf}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onLoadLocalPdf={handleLoadLocalPdf}
        onLoadUrl={handleLoadUrl}
        searchQuery={searchQuery}
        searchCurrent={searchStatus.current}
        searchTotal={searchStatus.total}
        isSearchPending={searchStatus.isPending}
        noteCompactMode={noteCompactMode}
        searchCaseSensitive={searchCaseSensitive}
        searchWholeWord={searchWholeWord}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onSearchNext={() => highlighterUtilsRef.current?.findNext()}
        onSearchPrevious={() => highlighterUtilsRef.current?.findPrevious()}
        onSearchClear={handleSearchClear}
        onToggleSearchCaseSensitive={() => setSearchCaseSensitive((v) => !v)}
        onToggleSearchWholeWord={() => setSearchWholeWord((v) => !v)}
        onToggleNoteCompactMode={() => setNoteCompactMode(!noteCompactMode)}
        onExtractSentences={handleExtractSentences}
        isExtractingSentences={isExtractingSentences}
        extractedSentenceCount={extractedSentenceCount}
        sentenceExtractionPages={sentenceExtractionPages}
        onSentenceExtractionPagesChange={setSentenceExtractionPages}
      />

      {/* Main content */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Backdrop for mobile drawers */}
        {isMobile && (sidebarOpen || leftPanelOpen) && (
          <div
            className="absolute inset-0 z-30 bg-black/40"
            onClick={() => {
              setSidebarOpen(false);
              setLeftPanelOpen(false);
            }}
          />
        )}

        {/* Sidebar (overlay drawer on mobile) */}
        <div
          className={
            isMobile
              ? `absolute inset-y-0 left-0 z-40 transition-transform duration-300 ${
                  sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`
              : "contents"
          }
        >
          <Sidebar
            highlights={highlights.filter(
              (h) => !(h as CommentedHighlight).isCitation,
            )}
            resetHighlights={resetHighlights}
            toggleDocument={toggleDocument}
            scrolledToHighlightId={scrolledToHighlightId}
            onEditHighlight={handleEditFromSidebar}
            onDeleteHighlight={deleteHighlight}
            isOpen={isMobile ? true : sidebarOpen}
          />
        </div>

        {/* PDF Viewer with Left Panel */}
        <div className="relative flex-1 overflow-hidden flex h-full">
          <PdfLoader document={url}>
            {(pdfDocument) => {
              pdfDocumentRef.current = pdfDocument;

              return (
                <div className="flex h-full w-full">
                {/* Left Panel - Outline & Thumbnails (overlay drawer on mobile) */}
                <div
                  className={
                    isMobile ? "absolute inset-y-0 left-0 z-40 h-full" : "contents"
                  }
                >
                <LeftPanel
                  pdfDocument={pdfDocument}
                  mode={darkMode ? "dark" : "light"}
                  viewer={highlighterUtilsRef.current?.getViewer()}
                  linkService={highlighterUtilsRef.current?.getLinkService()}
                  eventBus={highlighterUtilsRef.current?.getEventBus()}
                  goToPage={highlighterUtilsRef.current?.goToPage}
                  isOpen={leftPanelOpen}
                  onOpenChange={handleLeftPanelOpenChange}
                  width={280}
                  defaultTab="outline"
                />
                </div>

                {/* PDF Highlighter */}
                <div className="flex-1 relative overflow-hidden">
                  <PdfHighlighter
                    enableAreaSelection={(event) => event.altKey || areaMode}
                    areaSelectionMode={areaMode}
                    pdfDocument={pdfDocument}
                    theme={{ mode: darkMode ? "dark" : "light" }}
                    onScrollAway={resetHash}
                    initialPage={
                      Number(
                        new URLSearchParams(window.location.search).get("page"),
                      ) || undefined
                    }
                    onPageChange={(page) => {
                      setAnnouncedPage(page);
                      const url = new URL(window.location.href);
                      // Page 1 is the default — keep the URL clean instead of
                      // writing ?page=1 on a fresh load.
                      if (page <= 1) url.searchParams.delete("page");
                      else url.searchParams.set("page", String(page));
                      window.history.replaceState(null, "", url);
                      console.log("[example] page ->", page, url.search);
                    }}
                    utilsRef={(_pdfHighlighterUtils) => {
                      highlighterUtilsRef.current = _pdfHighlighterUtils;
                      // Only force update ONCE to prevent infinite re-render loop
                      if (!hasInitializedUtilsRef.current) {
                        hasInitializedUtilsRef.current = true;
                        forceUpdate({});
                      }
                    }}
                    pdfScaleValue={pdfScaleValue}
                    onZoomChange={(scale) =>
                      setPdfScaleValue(Math.round(scale * 100) / 100)
                    }
                    textSelectionColor={highlightPen ? "rgba(255, 226, 143, 1)" : undefined}
                    onSelection={highlightPen ? (selection) => {
                      addHighlight(selection.makeGhostHighlight(), "");
                    } : undefined}
                    selectionTip={highlightPen ? undefined : (
                      <ExpandableTip
                        addHighlight={(highlight, comment) => {
                          addHighlight(highlight, comment);
                          if (areaMode) setAreaMode(false);
                        }}
                      />
                    )}
                    highlights={highlights}
                    enableFreetextCreation={() => freetextMode}
                    onFreetextClick={handleFreetextClick}
                    enableImageCreation={() => imageMode}
                    onImageClick={handleImageClick}
                    enableDrawingMode={drawingMode}
                    onDrawingComplete={handleDrawingComplete}
                    onDrawingCancel={handleDrawingCancel}
                    drawingStrokeColor={drawingStrokeColor}
                    drawingStrokeWidth={drawingStrokeWidth}
                    enableShapeMode={shapeMode}
                    onShapeComplete={handleShapeComplete}
                    onShapeCancel={handleShapeCancel}
                    shapeStrokeColor={shapeStrokeColor}
                    shapeStrokeWidth={shapeStrokeWidth}
                    style={{
                      height: "100%",
                    }}
                  >
                    <HighlightContainer
                      editHighlight={editHighlight}
                      deleteHighlight={(id) => deleteHighlight({ id } as Highlight)}
                      onContextMenu={handleContextMenu}
                      noteCompactMode={noteCompactMode}
                    />
                  </PdfHighlighter>

                  {/* Citations demo (AI quote -> jump + highlight) */}
                  <div className="absolute bottom-4 left-4 z-20">
                    {citationsOpen ? (
                      <CitationsPanel
                        citations={citations}
                        activeId={activeCitationId}
                        loading={citationLoading}
                        onFind={handleFindCitation}
                        onJump={handleJumpCitation}
                        onClear={handleClearCitations}
                        onClose={() => setCitationsOpen(false)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCitationsOpen(true)}
                        aria-label="Open citations"
                        className="inline-flex items-center gap-2 rounded-full border bg-background/95 px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur transition-colors hover:bg-muted"
                      >
                        <Sparkles
                          className="h-4 w-4 text-blue-500"
                          aria-hidden="true"
                        />
                        Citations
                        {citations.length > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
                            {citations.length}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                </div>
              );
            }}
          </PdfLoader>

          {/* Floating Actions */}
          <FloatingActions
            highlightPen={highlightPen}
            onToggleHighlightPen={() => setHighlightPen(!highlightPen)}
            freetextMode={freetextMode}
            onToggleFreetextMode={() => setFreetextMode(!freetextMode)}
            noteCompactMode={noteCompactMode}
            onToggleNoteCompactMode={() => setNoteCompactMode(!noteCompactMode)}
            areaMode={areaMode}
            onToggleAreaMode={() => setAreaMode(!areaMode)}
            onAddImage={handleAddImage}
            onAddSignature={handleAddSignature}
            drawingMode={drawingMode}
            onToggleDrawingMode={() => setDrawingMode(!drawingMode)}
            drawingStrokeColor={drawingStrokeColor}
            onDrawingColorChange={setDrawingStrokeColor}
            drawingStrokeWidth={drawingStrokeWidth}
            onDrawingWidthChange={setDrawingStrokeWidth}
            shapeMode={shapeMode}
            onSetShapeMode={setShapeMode}
            shapeStrokeColor={shapeStrokeColor}
            onShapeColorChange={setShapeStrokeColor}
            shapeStrokeWidth={shapeStrokeWidth}
            onShapeWidthChange={setShapeStrokeWidth}
          />
        </div>
      </div>

      {contextMenu && <ContextMenu {...contextMenu} />}

      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileSelect}
      />

      {/* Signature pad modal */}
      <SignaturePad
        isOpen={isSignaturePadOpen}
        onComplete={handleSignatureComplete}
        onClose={() => setIsSignaturePadOpen(false)}
      />
    </div>
  );
};

export default App;
