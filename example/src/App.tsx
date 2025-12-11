import React, { MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import CommentForm from "./CommentForm";
import ContextMenu, { ContextMenuProps } from "./ContextMenu";
import ExpandableTip from "./ExpandableTip";
import HighlightContainer from "./HighlightContainer";
import Sidebar from "./Sidebar";
import { Header } from "./components/Header";
import { FloatingActions } from "./components/FloatingActions";
import {
  DrawingStroke,
  GhostHighlight,
  Highlight,
  PdfHighlighter,
  PdfHighlighterUtils,
  PdfLoader,
  ScaledPosition,
  SignaturePad,
  Tip,
  ViewportHighlight,
  exportPdf,
} from "./react-pdf-highlighter-extended";
import "./style/App.css";
import { testHighlights as _testHighlights } from "./test-highlights";
import { CommentedHighlight } from "./types";

const TEST_HIGHLIGHTS = _testHighlights;
const PRIMARY_PDF_URL = "https://arxiv.org/pdf/2203.11115";
const SECONDARY_PDF_URL = "https://arxiv.org/pdf/1604.02480";

const getNextId = () => String(Math.random()).slice(2);

const parseIdFromHash = () => {
  return document.location.hash.slice("#highlight-".length);
};

const resetHash = () => {
  document.location.hash = "";
};

const App = () => {
  const [url, setUrl] = useState(PRIMARY_PDF_URL);
  const [highlights, setHighlights] = useState<Array<CommentedHighlight>>(
    TEST_HIGHLIGHTS[PRIMARY_PDF_URL] ?? [],
  );
  const currentPdfIndexRef = useRef(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
  const [pdfScaleValue, setPdfScaleValue] = useState<number | undefined>(
    undefined,
  );
  const [highlightPen, setHighlightPen] = useState<boolean>(false);
  const [freetextMode, setFreetextMode] = useState<boolean>(false);
  const [imageMode, setImageMode] = useState<boolean>(false);
  const [areaMode, setAreaMode] = useState<boolean>(false);
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState<boolean>(false);
  const [pendingImageData, setPendingImageData] = useState<string | null>(null);
  // Drawing mode state
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [drawingStrokeColor, setDrawingStrokeColor] = useState<string>("#000000");
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState<number>(3);
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [scrolledToHighlightId, setScrolledToHighlightId] = useState<string | null>(null);

  // Refs for PdfHighlighter utilities
  const highlighterUtilsRef = useRef<PdfHighlighterUtils>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleDocument = () => {
    const urls = [PRIMARY_PDF_URL, SECONDARY_PDF_URL];
    currentPdfIndexRef.current = (currentPdfIndexRef.current + 1) % urls.length;
    setUrl(urls[currentPdfIndexRef.current]);
    setHighlights(TEST_HIGHLIGHTS[urls[currentPdfIndexRef.current]] ?? []);
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

  const handleExportPdf = async () => {
    console.log("Exporting PDF with annotations...");
    try {
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
      {/* Header */}
      <Header
        pdfScaleValue={pdfScaleValue}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onExportPdf={handleExportPdf}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          highlights={highlights}
          resetHighlights={resetHighlights}
          toggleDocument={toggleDocument}
          scrolledToHighlightId={scrolledToHighlightId}
          onEditHighlight={handleEditFromSidebar}
          onDeleteHighlight={deleteHighlight}
          isOpen={sidebarOpen}
        />

        {/* PDF Viewer */}
        <div className="relative flex-1 overflow-hidden">
          <PdfLoader document={url}>
            {(pdfDocument) => (
              <PdfHighlighter
                enableAreaSelection={(event) => event.altKey || areaMode}
                areaSelectionMode={areaMode}
                pdfDocument={pdfDocument}
                onScrollAway={resetHash}
                utilsRef={(_pdfHighlighterUtils) => {
                  highlighterUtilsRef.current = _pdfHighlighterUtils;
                }}
                pdfScaleValue={pdfScaleValue}
                textSelectionColor={highlightPen ? "rgba(255, 226, 143, 1)" : undefined}
                onSelection={(highlightPen || areaMode) ? (selection) => {
                  addHighlight(selection.makeGhostHighlight(), "");
                  if (areaMode) setAreaMode(false);
                } : undefined}
                selectionTip={highlightPen ? undefined : <ExpandableTip addHighlight={addHighlight} />}
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
                style={{
                  height: "100%",
                }}
              >
                <HighlightContainer
                  editHighlight={editHighlight}
                  deleteHighlight={(id) => deleteHighlight({ id } as Highlight)}
                  onContextMenu={handleContextMenu}
                />
              </PdfHighlighter>
            )}
          </PdfLoader>

          {/* Floating Actions */}
          <FloatingActions
            highlightPen={highlightPen}
            onToggleHighlightPen={() => setHighlightPen(!highlightPen)}
            freetextMode={freetextMode}
            onToggleFreetextMode={() => setFreetextMode(!freetextMode)}
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
