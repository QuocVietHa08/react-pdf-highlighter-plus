import debounce from "lodash.debounce";
import { PDFDocumentProxy } from "pdfjs-dist";
import React, {
  CSSProperties,
  PointerEventHandler,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  PdfHighlighterContext,
  PdfHighlighterUtils,
} from "../contexts/PdfHighlighterContext";
import { scaledToViewport, viewportPositionToScaled } from "../lib/coordinates";
import getBoundingRect from "../lib/get-bounding-rect";
import getClientRects from "../lib/get-client-rects";
import groupHighlightsByPage from "../lib/group-highlights-by-page";
import {
  asElement,
  findOrCreateContainerLayer,
  getPageFromElement,
  getPagesFromRange,
  getWindow,
  isHTMLElement,
} from "../lib/pdfjs-dom";
import {
  Content,
  DrawingStroke,
  GhostHighlight,
  Highlight,
  HighlightBindings,
  PdfScaleValue,
  PdfSelection,
  ScaledPosition,
  ShapeData,
  ShapeType,
  Tip,
  ViewportPosition,
} from "../types";
import { DrawingCanvas } from "./DrawingCanvas";
import { HighlightLayer } from "./HighlightLayer";
import { MouseSelection } from "./MouseSelection";
import { ShapeCanvas } from "./ShapeCanvas";
import { TipContainer } from "./TipContainer";

import type { EventBus as TEventBus, PDFLinkService as TPDFLinkService, PDFViewer as TPDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";

let EventBus: typeof TEventBus, PDFLinkService: typeof TPDFLinkService, PDFViewer: typeof TPDFViewer;

(async () => {
  // Due to breaking changes in PDF.js 4.0.189. See issue #17228
  const pdfjs = await import("pdfjs-dist/web/pdf_viewer.mjs");
  EventBus = pdfjs.EventBus;
  PDFLinkService = pdfjs.PDFLinkService;
  PDFViewer = pdfjs.PDFViewer;
})();


const SCROLL_MARGIN = 10;
const DEFAULT_SCALE_VALUE = "auto";
const DEFAULT_TEXT_SELECTION_COLOR = "rgba(153,193,218,255)";

/**
 * Theme configuration for PdfHighlighter styling.
 * Controls the appearance of the PDF viewer including dark mode support.
 *
 * @category Type
 */
export interface PdfHighlighterTheme {
  /**
   * Theme mode - controls PDF page color inversion.
   * In dark mode, PDF pages are inverted for comfortable reading.
   * @default "light"
   */
  mode?: "light" | "dark";

  /**
   * Background color of the viewer container.
   * @default "#e5e5e5" for light mode, "#1e1e1e" for dark mode
   */
  containerBackgroundColor?: string;

  /**
   * Scrollbar thumb color.
   * @default "#9f9f9f" for light mode, "#6b6b6b" for dark mode
   */
  scrollbarThumbColor?: string;

  /**
   * Scrollbar track color.
   * @default "#d1d1d1" for light mode, "#2c2c2c" for dark mode
   */
  scrollbarTrackColor?: string;

  /**
   * Inversion intensity for dark mode (0-1).
   * Lower values create softer dark backgrounds that are easier on the eyes.
   * - 1.0 = Pure black background (harsh)
   * - 0.9 = Dark gray ~#1a1a1a (recommended)
   * - 0.85 = Softer gray ~#262626 (very comfortable)
   * - 0.8 = Medium gray ~#333333 (maximum softness)
   * @default 0.9
   */
  darkModeInvertIntensity?: number;
}

const defaultLightTheme: Required<PdfHighlighterTheme> = {
  mode: "light",
  containerBackgroundColor: "#e5e5e5",
  scrollbarThumbColor: "#9f9f9f",
  scrollbarTrackColor: "#d1d1d1",
  darkModeInvertIntensity: 0.9,
};

const defaultDarkTheme: Required<PdfHighlighterTheme> = {
  mode: "dark",
  containerBackgroundColor: "#3a3a3a",  // Lighter than PDF page (~#1a1a1a) for contrast
  scrollbarThumbColor: "#6b6b6b",
  scrollbarTrackColor: "#2c2c2c",
  darkModeInvertIntensity: 0.9,
};

const findOrCreateHighlightLayer = (textLayer: HTMLElement) => {
  return findOrCreateContainerLayer(
    textLayer,
    "PdfHighlighter__highlight-layer",
  );
};

const disableTextSelection = (viewer: InstanceType<typeof PDFViewer>, flag: boolean) => {
  viewer.viewer?.classList.toggle("PdfHighlighter--disable-selection", flag);
};

/**
 * The props type for {@link PdfHighlighter}.
 *
 * @category Component Properties
 */
export interface PdfHighlighterProps {
  /**
   * Array of all highlights to be organised and fed through to the child
   * highlight container.
   */
  highlights: Array<Highlight>;

  /**
   * Event is called only once whenever the user changes scroll after
   * the autoscroll function, scrollToHighlight, has been called.
   */
  onScrollAway?(): void;

  /**
   * What scale to render the PDF at inside the viewer.
   */
  pdfScaleValue?: PdfScaleValue;

  /**
   * Callback triggered whenever a user finishes making a mouse selection or has
   * selected text.
   *
   * @param PdfSelection - Content and positioning of the selection. NOTE:
   * `makeGhostHighlight` will not work if the selection disappears.
   */
  onSelection?(PdfSelection: PdfSelection): void;

  /**
   * Callback triggered whenever a ghost (non-permanent) highlight is created.
   *
   * @param ghostHighlight - Ghost Highlight that has been created.
   */
  onCreateGhostHighlight?(ghostHighlight: GhostHighlight): void;

  /**
   * Callback triggered whenever a ghost (non-permanent) highlight is removed.
   *
   * @param ghostHighlight - Ghost Highlight that has been removed.
   */
  onRemoveGhostHighlight?(ghostHighlight: GhostHighlight): void;

  /**
   * Optional element that can be displayed as a tip whenever a user makes a
   * selection.
   */
  selectionTip?: ReactNode;

  /**
   * Condition to check before any mouse selection starts.
   *
   * @param event - mouse event associated with the new selection.
   * @returns - `True` if mouse selection should start.
   */
  enableAreaSelection?(event: MouseEvent): boolean;

  /**
   * When true, shows crosshair cursor indicating area selection mode is active.
   * Use this when area selection should be persistently enabled (not just on modifier key).
   */
  areaSelectionMode?: boolean;

  /**
   * Optional CSS styling for the rectangular mouse selection.
   */
  mouseSelectionStyle?: CSSProperties;

  /**
   * PDF document to view and overlay highlights.
   */
  pdfDocument: PDFDocumentProxy;

  /**
   * This should be a highlight container/renderer of some sorts. It will be
   * given appropriate context for a single highlight which it can then use to
   * render a TextHighlight, AreaHighlight, etc. in the correct place.
   */
  children: ReactNode;

  /**
   * Coloring for unhighlighted, selected text.
   */
  textSelectionColor?: string;

  /**
   * Creates a reference to the PdfHighlighterContext above the component.
   *
   * @param pdfHighlighterUtils - various useful tools with a PdfHighlighter.
   * See {@link PdfHighlighterContext} for more description.
   */
  utilsRef(pdfHighlighterUtils: PdfHighlighterUtils): void;

  /**
   * Style properties for the PdfHighlighter (scrollbar, background, etc.), NOT
   * the PDF.js viewer it encloses. If you want to edit the latter, use the
   * other style props like `textSelectionColor` or overwrite pdf_viewer.css
   */
  style?: CSSProperties;

  /**
   * Condition to check before freetext creation starts.
   *
   * @param event - mouse event associated with the click.
   * @returns - `True` if freetext creation should occur.
   */
  enableFreetextCreation?(event: MouseEvent): boolean;

  /**
   * Callback triggered when user clicks to create a freetext annotation.
   *
   * @param position - Scaled position where the click occurred.
   */
  onFreetextClick?(position: ScaledPosition): void;

  /**
   * Condition to check before image creation starts.
   *
   * @param event - mouse event associated with the click.
   * @returns - `True` if image creation should occur.
   */
  enableImageCreation?(event: MouseEvent): boolean;

  /**
   * Callback triggered when user clicks to create an image annotation.
   *
   * @param position - Scaled position where the click occurred.
   */
  onImageClick?(position: ScaledPosition): void;

  /**
   * Whether drawing mode is enabled.
   */
  enableDrawingMode?: boolean;

  /**
   * Callback triggered when a drawing is completed.
   *
   * @param dataUrl - The drawing as a PNG data URL.
   * @param position - Scaled position of the drawing on the page.
   * @param strokes - The stroke data for later editing.
   */
  onDrawingComplete?(dataUrl: string, position: ScaledPosition, strokes: DrawingStroke[]): void;

  /**
   * Callback triggered when drawing is cancelled.
   */
  onDrawingCancel?(): void;

  /**
   * Stroke color for drawing mode.
   * @default "#000000"
   */
  drawingStrokeColor?: string;

  /**
   * Stroke width for drawing mode.
   * @default 3
   */
  drawingStrokeWidth?: number;

  /**
   * The type of shape to create, or null if shape mode is not active.
   */
  enableShapeMode?: ShapeType | null;

  /**
   * Callback triggered when a shape is completed.
   *
   * @param position - Scaled position of the shape on the page.
   * @param shape - The shape data (type, color, width).
   */
  onShapeComplete?(position: ScaledPosition, shape: ShapeData): void;

  /**
   * Callback triggered when shape creation is cancelled.
   */
  onShapeCancel?(): void;

  /**
   * Stroke color for shape mode.
   * @default "#000000"
   */
  shapeStrokeColor?: string;

  /**
   * Stroke width for shape mode.
   * @default 2
   */
  shapeStrokeWidth?: number;

  /**
   * Theme configuration for the PDF viewer.
   * Controls container background color and PDF page color inversion for dark mode.
   *
   * @default { mode: "light" }
   */
  theme?: PdfHighlighterTheme;
}

/**
 * This is a large-scale PDF viewer component designed to facilitate
 * highlighting. It should be used as a child to a {@link PdfLoader} to ensure
 * proper document loading. This does not itself render any highlights, but
 * instead its child should be the container component for each individual
 * highlight. This component will be provided appropriate HighlightContext for
 * rendering.
 *
 * @category Component
 */
export const PdfHighlighter = ({
  highlights,
  onScrollAway,
  pdfScaleValue = DEFAULT_SCALE_VALUE,
  onSelection: onSelectionFinished,
  onCreateGhostHighlight,
  onRemoveGhostHighlight,
  selectionTip,
  enableAreaSelection,
  areaSelectionMode,
  mouseSelectionStyle,
  pdfDocument,
  children,
  textSelectionColor = DEFAULT_TEXT_SELECTION_COLOR,
  utilsRef,
  style,
  enableFreetextCreation,
  onFreetextClick,
  enableImageCreation,
  onImageClick,
  enableDrawingMode,
  onDrawingComplete,
  onDrawingCancel,
  drawingStrokeColor = "#000000",
  drawingStrokeWidth = 3,
  enableShapeMode,
  onShapeComplete,
  onShapeCancel,
  shapeStrokeColor = "#000000",
  shapeStrokeWidth = 2,
  theme: userTheme,
}: PdfHighlighterProps) => {
  // Resolve theme with defaults based on mode
  const resolvedTheme = useMemo(() => {
    const mode = userTheme?.mode ?? "light";
    const defaults = mode === "light" ? defaultLightTheme : defaultDarkTheme;
    return { ...defaults, ...userTheme, mode };
  }, [userTheme]);

  // State
  const [tip, setTip] = useState<Tip | null>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);

  // Refs
  const containerNodeRef = useRef<HTMLDivElement | null>(null);
  const highlightBindingsRef = useRef<{ [page: number]: HighlightBindings }>(
    {},
  );
  const ghostHighlightRef = useRef<GhostHighlight | null>(null);
  const selectionRef = useRef<PdfSelection | null>(null);
  const scrolledToHighlightIdRef = useRef<string | null>(null);
  const isAreaSelectionInProgressRef = useRef(false);
  const isEditInProgressRef = useRef(false);
  const updateTipPositionRef = useRef(() => { });

  const eventBusRef = useRef<InstanceType<typeof EventBus>>(new EventBus());
  const linkServiceRef = useRef<InstanceType<typeof PDFLinkService>>(
    new PDFLinkService({
      eventBus: eventBusRef.current,
      externalLinkTarget: 2,
    }),
  );
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const viewerRef = useRef<InstanceType<typeof PDFViewer> | null>(null);

  // Initialise PDF Viewer
  useLayoutEffect(() => {
    if (!containerNodeRef.current) return;

    const debouncedDocumentInit = debounce(() => {
      viewerRef.current =
        viewerRef.current ||
        new PDFViewer({
          container: containerNodeRef.current!,
          eventBus: eventBusRef.current,
          textLayerMode: 2,
          removePageBorders: true,
          linkService: linkServiceRef.current,
        });

      viewerRef.current.setDocument(pdfDocument);
      linkServiceRef.current.setDocument(pdfDocument);
      linkServiceRef.current.setViewer(viewerRef.current);
      setIsViewerReady(true);
    }, 100);

    debouncedDocumentInit();

    return () => {
      debouncedDocumentInit.cancel();
    };
  }, [document]);

  // Initialise viewer event listeners
  useLayoutEffect(() => {
    if (!containerNodeRef.current) return;

    resizeObserverRef.current = new ResizeObserver(handleScaleValue);
    resizeObserverRef.current.observe(containerNodeRef.current);

    const doc = containerNodeRef.current.ownerDocument;

    eventBusRef.current.on("textlayerrendered", renderHighlightLayers);
    eventBusRef.current.on("pagesinit", handleScaleValue);
    doc.addEventListener("keydown", handleKeyDown);

    renderHighlightLayers();

    return () => {
      eventBusRef.current.off("pagesinit", handleScaleValue);
      eventBusRef.current.off("textlayerrendered", renderHighlightLayers);
      doc.removeEventListener("keydown", handleKeyDown);
      resizeObserverRef.current?.disconnect();
    };
  }, [selectionTip, highlights, onSelectionFinished]);

  // Event listeners
  const handleScroll = () => {
    onScrollAway && onScrollAway();
    scrolledToHighlightIdRef.current = null;
    renderHighlightLayers();
  };

  const handleMouseUp: PointerEventHandler = () => {
    const container = containerNodeRef.current;
    const selection = getWindow(container).getSelection();

    if (!container || !selection || selection.isCollapsed || !viewerRef.current)
      return;

    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    // Check the selected text is in the document, not the tip
    if (!range || !container.contains(range.commonAncestorContainer)) return;

    const pages = getPagesFromRange(range);
    if (!pages || pages.length === 0) return;

    const rects = getClientRects(range, pages);
    if (rects.length === 0) return;

    const viewportPosition: ViewportPosition = {
      boundingRect: getBoundingRect(rects),
      rects,
    };

    const scaledPosition = viewportPositionToScaled(
      viewportPosition,
      viewerRef.current,
    );

    const content: Content = {
      text: selection.toString().split("\n").join(" "), // Make all line breaks spaces
    };

    selectionRef.current = {
      content,
      type: "text",
      position: scaledPosition,
      makeGhostHighlight: () => {
        ghostHighlightRef.current = {
          content: content,
          type: "text",
          position: scaledPosition,
        };

        onCreateGhostHighlight &&
          onCreateGhostHighlight(ghostHighlightRef.current);
        clearTextSelection();
        renderHighlightLayers();
        return ghostHighlightRef.current;
      },
    };

    onSelectionFinished && onSelectionFinished(selectionRef.current);

    selectionTip &&
      setTip({ position: viewportPosition, content: selectionTip });
  };

  const handleMouseDown: PointerEventHandler = (event) => {
    if (
      !isHTMLElement(event.target) ||
      asElement(event.target).closest(".PdfHighlighter__tip-container") // Ignore selections on tip container
    ) {
      return;
    }

    // Check for freetext creation mode
    if (
      enableFreetextCreation?.(event.nativeEvent) &&
      onFreetextClick &&
      !isEditInProgressRef.current
    ) {
      const target = asElement(event.target);
      const page = getPageFromElement(target);

      if (page && viewerRef.current) {
        const pageRect = page.node.getBoundingClientRect();
        const clickX = event.clientX - pageRect.left;
        const clickY = event.clientY - pageRect.top;

        // Default size for new freetext note
        const defaultWidth = 150;
        const defaultHeight = 80;

        const viewportPosition: ViewportPosition = {
          boundingRect: {
            left: clickX,
            top: clickY,
            width: defaultWidth,
            height: defaultHeight,
            pageNumber: page.number,
          },
          rects: [],
        };

        const scaledPosition = viewportPositionToScaled(
          viewportPosition,
          viewerRef.current,
        );

        onFreetextClick(scaledPosition);
        return; // Don't proceed with normal mousedown handling
      }
    }

    // Check for image creation mode
    if (
      enableImageCreation?.(event.nativeEvent) &&
      onImageClick &&
      !isEditInProgressRef.current
    ) {
      const target = asElement(event.target);
      const page = getPageFromElement(target);

      if (page && viewerRef.current) {
        const pageRect = page.node.getBoundingClientRect();
        const clickX = event.clientX - pageRect.left;
        const clickY = event.clientY - pageRect.top;

        // Default size for new image
        const defaultWidth = 150;
        const defaultHeight = 100;

        const viewportPosition: ViewportPosition = {
          boundingRect: {
            left: clickX,
            top: clickY,
            width: defaultWidth,
            height: defaultHeight,
            pageNumber: page.number,
          },
          rects: [],
        };

        const scaledPosition = viewportPositionToScaled(
          viewportPosition,
          viewerRef.current,
        );

        onImageClick(scaledPosition);
        return; // Don't proceed with normal mousedown handling
      }
    }

    setTip(null);
    clearTextSelection(); // TODO: Check if clearing text selection only if not clicking on tip breaks anything.
    removeGhostHighlight();
    toggleEditInProgress(false);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Escape") {
      clearTextSelection();
      removeGhostHighlight();
      setTip(null);
    }
  };

  const handleScaleValue = () => {
    if (viewerRef.current) {
      viewerRef.current.currentScaleValue = pdfScaleValue.toString();
    }
  };

  // Render Highlight layers
  const renderHighlightLayer = (
    highlightBindings: HighlightBindings,
    pageNumber: number,
  ) => {
    if (!viewerRef.current) return;

    highlightBindings.reactRoot.render(
      <PdfHighlighterContext.Provider value={pdfHighlighterUtils}>
        <HighlightLayer
          highlightsByPage={groupHighlightsByPage([
            ...highlights,
            ghostHighlightRef.current,
          ])}
          pageNumber={pageNumber}
          scrolledToHighlightId={scrolledToHighlightIdRef.current}
          viewer={viewerRef.current}
          highlightBindings={highlightBindings}
          children={children}
        />
      </PdfHighlighterContext.Provider>,
    );
  };

  const renderHighlightLayers = () => {
    if (!viewerRef.current) return;

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const highlightBindings = highlightBindingsRef.current[pageNumber];

      // Need to check if container is still attached to the DOM as PDF.js can unload pages.
      if (highlightBindings?.container?.isConnected) {
        renderHighlightLayer(highlightBindings, pageNumber);
      } else {
        const { textLayer } =
          viewerRef.current!.getPageView(pageNumber - 1) || {};
        if (!textLayer) continue; // Viewer hasn't rendered page yet

        // textLayer.div for version >=3.0 and textLayer.textLayerDiv otherwise.
        const highlightLayer = findOrCreateHighlightLayer(
          textLayer.div,
        );

        if (highlightLayer) {
          const reactRoot = createRoot(highlightLayer);
          highlightBindingsRef.current[pageNumber] = {
            reactRoot,
            container: highlightLayer,
            textLayer: textLayer.div, // textLayer.div for version >=3.0 and textLayer.textLayerDiv otherwise.
          };

          renderHighlightLayer(
            highlightBindingsRef.current[pageNumber],
            pageNumber,
          );
        }
      }
    }
  };

  // Utils
  const isEditingOrHighlighting = () => {
    return (
      Boolean(selectionRef.current) ||
      Boolean(ghostHighlightRef.current) ||
      isAreaSelectionInProgressRef.current ||
      isEditInProgressRef.current
    );
  };

  const toggleEditInProgress = (flag?: boolean) => {
    if (flag !== undefined) {
      isEditInProgressRef.current = flag;
    } else {
      isEditInProgressRef.current = !isEditInProgressRef.current;
    }

    // Disable text selection
    if (viewerRef.current)
      viewerRef.current.viewer?.classList.toggle(
        "PdfHighlighter--disable-selection",
        isEditInProgressRef.current,
      );
  };

  const removeGhostHighlight = () => {
    if (onRemoveGhostHighlight && ghostHighlightRef.current)
      onRemoveGhostHighlight(ghostHighlightRef.current);
    ghostHighlightRef.current = null;
    renderHighlightLayers();
  };

  const clearTextSelection = () => {
    selectionRef.current = null;

    const container = containerNodeRef.current;
    const selection = getWindow(container).getSelection();
    if (!container || !selection) return;
    selection.removeAllRanges();
  };

  const scrollToHighlight = (highlight: Highlight) => {
    const { boundingRect, usePdfCoordinates } = highlight.position;
    const pageNumber = boundingRect.pageNumber;

    // Remove scroll listener in case user auto-scrolls in succession.
    viewerRef.current!.container.removeEventListener("scroll", handleScroll);

    const pageViewport = viewerRef.current!.getPageView(
      pageNumber - 1,
    ).viewport;

    viewerRef.current!.scrollPageIntoView({
      pageNumber,
      destArray: [
        null, // null since we pass pageNumber already as an arg
        { name: "XYZ" },
        ...pageViewport.convertToPdfPoint(
          0, // Default x coord
          scaledToViewport(boundingRect, pageViewport, usePdfCoordinates).top -
          SCROLL_MARGIN,
        ),
        0, // Default z coord
      ],
    });

    scrolledToHighlightIdRef.current = highlight.id;
    renderHighlightLayers();

    // wait for scrolling to finish
    setTimeout(() => {
      viewerRef.current!.container.addEventListener("scroll", handleScroll, {
        once: true,
      });
    }, 100);
  };

  const pdfHighlighterUtils: PdfHighlighterUtils = {
    isEditingOrHighlighting,
    getCurrentSelection: () => selectionRef.current,
    getGhostHighlight: () => ghostHighlightRef.current,
    removeGhostHighlight,
    toggleEditInProgress,
    isEditInProgress: () => isEditInProgressRef.current,
    isSelectionInProgress: () =>
      Boolean(selectionRef.current) || isAreaSelectionInProgressRef.current,
    scrollToHighlight,
    getViewer: () => viewerRef.current,
    getTip: () => tip,
    setTip,
    updateTipPosition: updateTipPositionRef.current,
    getLinkService: () => linkServiceRef.current,
    getEventBus: () => eventBusRef.current,
    goToPage: (pageNumber: number) => {
      viewerRef.current?.scrollPageIntoView({ pageNumber });
    },
  };

  // Only call utilsRef once when viewer is ready to prevent infinite re-render loop
  const utilsRefCalledRef = useRef(false);
  useEffect(() => {
    if (viewerRef.current && !utilsRefCalledRef.current) {
      utilsRefCalledRef.current = true;
      utilsRef(pdfHighlighterUtils);
    }
  }, [pdfHighlighterUtils, utilsRef]);

  // Check if freetext or image mode is active for cursor styling
  const isFreetextMode = enableFreetextCreation?.({} as MouseEvent) ?? false;
  const isImageMode = enableImageCreation?.({} as MouseEvent) ?? false;

  // Build class name based on active modes and theme
  let containerClassName = 'PdfHighlighter';
  if (resolvedTheme.mode === 'dark') containerClassName += ' PdfHighlighter--dark';
  if (isFreetextMode) containerClassName += ' PdfHighlighter--freetext-mode';
  if (isImageMode) containerClassName += ' PdfHighlighter--image-mode';
  if (enableDrawingMode) containerClassName += ' PdfHighlighter--drawing-mode';
  if (enableShapeMode) containerClassName += ' PdfHighlighter--shape-mode';
  if (areaSelectionMode) containerClassName += ' PdfHighlighter--area-mode';

  // Merge user style with theme background
  const containerStyle: CSSProperties = {
    ...style,
    backgroundColor: resolvedTheme.containerBackgroundColor,
  };

  return (
    <PdfHighlighterContext.Provider value={pdfHighlighterUtils}>
      <div
        ref={containerNodeRef}
        className={containerClassName}
        onPointerDown={handleMouseDown}
        onPointerUp={handleMouseUp}
        style={containerStyle}
      >
        <div className="pdfViewer" />
        <style>
          {`
          .textLayer ::selection {
            background: ${textSelectionColor};
          }
          .PdfHighlighter::-webkit-scrollbar-thumb {
            background-color: ${resolvedTheme.scrollbarThumbColor};
          }
          .PdfHighlighter::-webkit-scrollbar-track,
          .PdfHighlighter::-webkit-scrollbar-track-piece {
            background-color: ${resolvedTheme.scrollbarTrackColor};
          }
          ${resolvedTheme.mode === 'dark' ? `
          .PdfHighlighter--dark .page {
            filter: invert(${resolvedTheme.darkModeInvertIntensity}) hue-rotate(180deg) brightness(1.05);
          }
          .PdfHighlighter--dark .PdfHighlighter__highlight-layer {
            filter: invert(${resolvedTheme.darkModeInvertIntensity}) hue-rotate(180deg) brightness(0.95);
          }
          ` : ''}
        `}
        </style>
        {isViewerReady && (
          <TipContainer
            viewer={viewerRef.current!}
            updateTipPositionRef={updateTipPositionRef}
          />
        )}
        {isViewerReady && enableAreaSelection && (
          <MouseSelection
            viewer={viewerRef.current!}
            onChange={(isVisible) =>
              (isAreaSelectionInProgressRef.current = isVisible)
            }
            enableAreaSelection={enableAreaSelection}
            style={mouseSelectionStyle}
            onDragStart={() => disableTextSelection(viewerRef.current!, true)}
            onReset={() => {
              selectionRef.current = null;
              disableTextSelection(viewerRef.current!, false);
            }}
            onSelection={(
              viewportPosition,
              scaledPosition,
              image,
              resetSelection,
            ) => {
              selectionRef.current = {
                content: { image },
                type: "area",
                position: scaledPosition,
                makeGhostHighlight: () => {
                  ghostHighlightRef.current = {
                    position: scaledPosition,
                    type: "area",
                    content: { image },
                  };
                  onCreateGhostHighlight &&
                    onCreateGhostHighlight(ghostHighlightRef.current);
                  resetSelection();
                  renderHighlightLayers();
                  return ghostHighlightRef.current;
                },
              };

              onSelectionFinished && onSelectionFinished(selectionRef.current);
              selectionTip &&
                setTip({ position: viewportPosition, content: selectionTip });
            }}
          />
        )}
        {isViewerReady && enableDrawingMode && (
          <DrawingCanvas
            isActive={enableDrawingMode}
            strokeColor={drawingStrokeColor}
            strokeWidth={drawingStrokeWidth}
            viewer={viewerRef.current!}
            onComplete={(dataUrl, position, strokes) => {
              console.log("PdfHighlighter: Drawing complete");
              onDrawingComplete?.(dataUrl, position, strokes);
            }}
            onCancel={() => {
              console.log("PdfHighlighter: Drawing cancelled");
              onDrawingCancel?.();
            }}
          />
        )}
        {isViewerReady && enableShapeMode && (
          <ShapeCanvas
            isActive={!!enableShapeMode}
            shapeType={enableShapeMode}
            strokeColor={shapeStrokeColor}
            strokeWidth={shapeStrokeWidth}
            viewer={viewerRef.current!}
            onComplete={(position, shape) => {
              console.log("PdfHighlighter: Shape complete", shape.shapeType);
              onShapeComplete?.(position, shape);
            }}
            onCancel={() => {
              console.log("PdfHighlighter: Shape cancelled");
              onShapeCancel?.();
            }}
          />
        )}
      </div>
    </PdfHighlighterContext.Provider>
  );
};
