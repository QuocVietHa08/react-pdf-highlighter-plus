import React, { MouseEvent, useEffect, useRef, useState } from "react";
import CommentForm from "./CommentForm";
import ContextMenu, { ContextMenuProps } from "./ContextMenu";
import ExpandableTip from "./ExpandableTip";
import HighlightContainer from "./HighlightContainer";
import Sidebar from "./Sidebar";
import Toolbar from "./Toolbar";
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
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState<boolean>(false);
  const [pendingImageData, setPendingImageData] = useState<string | null>(null);
  // Drawing mode state
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [drawingStrokeColor, setDrawingStrokeColor] = useState<string>("#000000");
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState<number>(3);

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

  const deleteHighlight = (highlight: ViewportHighlight | Highlight) => {
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
      const newHighlight: CommentedHighlight = {
        id: getNextId(),
        type: "image",
        position,
        content: { image: pendingImageData },
        comment: "",
      };
      setHighlights([newHighlight, ...highlights]);
      setPendingImageData(null);
      setImageMode(false);
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

  const resetHighlights = () => {
    setHighlights([]);
  };

  const getHighlightById = (id: string) => {
    return highlights.find((highlight) => highlight.id === id);
  };

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

  // Scroll to highlight based on hash in the URL
  const scrollToHighlightFromHash = () => {
    const highlight = getHighlightById(parseIdFromHash());

    if (highlight && highlighterUtilsRef.current) {
      highlighterUtilsRef.current.scrollToHighlight(highlight);
    }
  };

  // Hash listeners for autoscrolling to highlights
  useEffect(() => {
    window.addEventListener("hashchange", scrollToHighlightFromHash);

    return () => {
      window.removeEventListener("hashchange", scrollToHighlightFromHash);
    };
  }, [scrollToHighlightFromHash]);

  return (
    <div className="App" style={{ display: "flex", height: "100vh" }}>
      <Sidebar
        highlights={highlights}
        resetHighlights={resetHighlights}
        toggleDocument={toggleDocument}
      />
      <div
        style={{
          height: "100vh",
          width: "75vw",
          overflow: "hidden",
          position: "relative",
          flexGrow: 1,
        }}
      >
        <Toolbar
          setPdfScaleValue={(value) => setPdfScaleValue(value)}
          toggleHighlightPen={() => setHighlightPen(!highlightPen)}
          toggleFreetextMode={() => setFreetextMode(!freetextMode)}
          isFreetextMode={freetextMode}
          onAddImage={handleAddImage}
          onAddSignature={handleAddSignature}
          onExportPdf={handleExportPdf}
          isDrawingMode={drawingMode}
          onToggleDrawingMode={() => setDrawingMode(!drawingMode)}
          drawingStrokeColor={drawingStrokeColor}
          onDrawingColorChange={setDrawingStrokeColor}
          drawingStrokeWidth={drawingStrokeWidth}
          onDrawingWidthChange={setDrawingStrokeWidth}
        />
        <PdfLoader document={url}>
          {(pdfDocument) => (
            <PdfHighlighter
              enableAreaSelection={(event) => event.altKey}
              pdfDocument={pdfDocument}
              onScrollAway={resetHash}
              utilsRef={(_pdfHighlighterUtils) => {
                highlighterUtilsRef.current = _pdfHighlighterUtils;
              }}
              pdfScaleValue={pdfScaleValue}
              textSelectionColor={highlightPen ? "rgba(255, 226, 143, 1)" : undefined}
              onSelection={highlightPen ? (selection) => addHighlight(selection.makeGhostHighlight(), "") : undefined}
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
                height: "calc(100% - 41px)",
              }}
            >
              <HighlightContainer
                editHighlight={editHighlight}
                onContextMenu={handleContextMenu}
              />
            </PdfHighlighter>
          )}
        </PdfLoader>
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
