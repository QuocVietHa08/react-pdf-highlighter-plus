import { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
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
import { createRoot, type Root } from "react-dom/client";
import {
  PdfHighlighterContext,
  PdfSearchOptions,
  PdfHighlighterUtils,
} from "../contexts/PdfHighlighterContext";
import { scaledToViewport, viewportPositionToScaled } from "../lib/coordinates";
import { createDarkModeColorMap, type RenderColorMap } from "../lib/dark-mode";
import { applyContextRecolor } from "../lib/recolor-context";
import getBoundingRect from "../lib/get-bounding-rect";
import getClientRects from "../lib/get-client-rects";
import groupHighlightsByPage from "../lib/group-highlights-by-page";
import {
  asElement,
  findOrCreateContainerLayer,
  getDocument,
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

import type { EventBus as TEventBus, PDFFindController as TPDFFindController, PDFLinkService as TPDFLinkService, PDFViewer as TPDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";

let EventBus: typeof TEventBus, PDFFindController: typeof TPDFFindController, PDFLinkService: typeof TPDFLinkService, PDFViewer: typeof TPDFViewer;

(async () => {
  // Due to breaking changes in PDF.js 4.0.189. See issue #17228
  const pdfjs = await import("pdfjs-dist/web/pdf_viewer.mjs");
  EventBus = pdfjs.EventBus;
  PDFFindController = pdfjs.PDFFindController;
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
   * Theme mode. In dark mode, pages are recolored at draw time (hue-preserving,
   * photos kept) using {@link PdfHighlighterTheme.darkModeColors}.
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
   * @deprecated Dark mode now recolors at draw time (OKLab, hue-preserving,
   * photos untouched) instead of a CSS `invert()` filter. This value is
   * ignored. Use {@link PdfHighlighterTheme.darkModeColors} instead.
   */
  darkModeInvertIntensity?: number;

  /**
   * Dark-mode recolor palette. White paper maps to `background` and black
   * text/line-art to `foreground`, recolored per-color at draw time (OKLab
   * ramp) so hues are preserved and embedded photos keep their pixels.
   * Only used when `mode === "dark"`.
   * @default { background: "#141210", foreground: "#eae6e0" }
   */
  darkModeColors?: {
    /** Replaces the white paper background. */
    background: string;
    /** Replaces black text and line art. */
    foreground: string;
  };
}

// Warm gray (red >= green >= blue): easier on the eyes than pure black, and
// white paper maps onto it exactly. Matches lector's default dark palette.
const DEFAULT_DARK_MODE_COLORS = {
  background: "#141210",
  foreground: "#eae6e0",
};

// Unmount a per-page React root, deferred so it never runs synchronously inside
// a React render/commit (which React warns about). Tolerates double-unmount.
const unmountReactRoot = (root?: Root | null) => {
  if (!root) return;
  queueMicrotask(() => {
    try {
      root.unmount();
    } catch {
      /* already unmounted */
    }
  });
};

const RECOLOR_PATCHED = Symbol("pdfRecolorPatched");

/**
 * Patches a loaded PDF document so every page renders through the dark-mode
 * recolor map (when one is active). PDF.js draws each page by calling
 * `page.render({ canvasContext })`; we wrap that context with
 * `applyContextRecolor` right before the real render and restore it after, so
 * text/vector art is recolored at draw time while photos (drawImage) keep
 * their pixels. The map is read live via `getMap()` so a palette/scheme toggle
 * only needs a re-render, not a re-patch. Idempotent per document and page.
 */
const patchPageRenderRecolor = (
  pdfDocument: PDFDocumentProxy,
  getMap: () => RenderColorMap | null,
) => {
  const doc = pdfDocument as PDFDocumentProxy & { [RECOLOR_PATCHED]?: boolean };
  if (doc[RECOLOR_PATCHED]) return;
  doc[RECOLOR_PATCHED] = true;

  const origGetPage = doc.getPage.bind(doc);
  doc.getPage = (pageNumber: number) =>
    origGetPage(pageNumber).then((page) => {
      const p = page as PDFPageProxy & { [RECOLOR_PATCHED]?: boolean };
      if (p[RECOLOR_PATCHED]) return p;
      p[RECOLOR_PATCHED] = true;

      const origRender = p.render.bind(p);
      p.render = ((params: Parameters<typeof origRender>[0]) => {
        const map = getMap();
        const ctx = params?.canvasContext as
          | CanvasRenderingContext2D
          | undefined;
        if (map && ctx) {
          const cleanup = applyContextRecolor(ctx, map);
          const task = origRender(params);
          // Restore pristine context when the page settles (done OR cancelled),
          // so pdf.js readbacks and the next render observe original colors.
          task.promise.then(cleanup, cleanup);
          return task;
        }
        return origRender(params);
      }) as typeof p.render;
      return p;
    });
};

const defaultLightTheme: Required<PdfHighlighterTheme> = {
  mode: "light",
  containerBackgroundColor: "#e5e5e5",
  scrollbarThumbColor: "#9f9f9f",
  scrollbarTrackColor: "#d1d1d1",
  darkModeInvertIntensity: 0.9,
  darkModeColors: DEFAULT_DARK_MODE_COLORS,
};

const defaultDarkTheme: Required<PdfHighlighterTheme> = {
  mode: "dark",
  containerBackgroundColor: "#3a3a3a",  // Lighter than PDF page for contrast
  scrollbarThumbColor: "#6b6b6b",
  scrollbarTrackColor: "#2c2c2c",
  darkModeInvertIntensity: 0.9,
  darkModeColors: DEFAULT_DARK_MODE_COLORS,
};

const findOrCreateHighlightLayer = (textLayer: HTMLElement) => {
  return findOrCreateContainerLayer(
    textLayer,
    "PdfHighlighter__highlight-layer",
  );
};

const findOrCreateNoteLayer = (textLayer: HTMLElement) => {
  const pageLayer = textLayer.closest(".page") as HTMLElement | null;
  const container = pageLayer;

  if (!container) return null;

  const doc = getDocument(container);
  let layer = Array.from(container.children).find((child) =>
    child.classList.contains("PdfHighlighter__note-layer"),
  );

  // To ensure predictable zIndexing, wait until the pdfjs element has children.
  if (!layer && container.children.length) {
    layer = doc.createElement("div");
    layer.className = "PdfHighlighter__note-layer";
    container.appendChild(layer);
  }

  return layer;
};

const isFreetextHighlight = (highlight: Highlight | GhostHighlight) =>
  "type" in highlight && highlight.type === "freetext";

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
   * Fired when the user changes zoom by pinch / ctrl+wheel gesture, with the new
   * numeric scale. Use it to keep an external zoom indicator / `pdfScaleValue`
   * state in sync.
   *
   * @param scale - The new numeric scale (e.g. 1.25).
   */
  onZoomChange?(scale: number): void;

  /**
   * Page to scroll to once the document first finishes loading (1-indexed).
   * Use for deep-linking (e.g. `?page=12`) or restoring a saved position.
   * Applied only on initial load, not on subsequent re-renders.
   */
  initialPage?: number;

  /**
   * Callback fired whenever the current (most visible) page changes, including
   * the initial page. Use to sync the page into a URL/localStorage.
   *
   * @param pageNumber - The new current page (1-indexed).
   */
  onPageChange?(pageNumber: number): void;

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
  onZoomChange,
  initialPage,
  onPageChange,
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
  drawingStrokeColor: drawingStrokeColorProp,
  drawingStrokeWidth = 3,
  enableShapeMode,
  onShapeComplete,
  onShapeCancel,
  shapeStrokeColor: shapeStrokeColorProp,
  shapeStrokeWidth = 2,
  theme: userTheme,
}: PdfHighlighterProps) => {
  // Resolve theme with defaults based on mode
  const resolvedTheme = useMemo(() => {
    const mode = userTheme?.mode ?? "light";
    const defaults = mode === "light" ? defaultLightTheme : defaultDarkTheme;
    return { ...defaults, ...userTheme, mode };
  }, [userTheme]);

  // Draw-time recolor map (lector-ported). Dark mode only; null = render
  // document colors as-is. Photos are preserved (the wrapper skips drawImage),
  // unlike PDF.js `pageColors`. String key drives effect re-runs on a real
  // palette/mode change only.
  const recolorKey =
    resolvedTheme.mode === "dark"
      ? `${resolvedTheme.darkModeColors.background}|${resolvedTheme.darkModeColors.foreground}`
      : "light";
  const recolorMap = useMemo(
    () =>
      resolvedTheme.mode === "dark"
        ? createDarkModeColorMap(resolvedTheme.darkModeColors)
        : null,
    // recolorKey captures the palette + mode; map identity is stable per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recolorKey],
  );
  // The patched page.render reads the live map from this ref, so toggling the
  // palette never needs re-patching — only a re-render (setDocument).
  const recolorMapRef = useRef(recolorMap);
  recolorMapRef.current = recolorMap;

  // Default drawing/shape ink follows the scheme: white on a dark page, black on
  // light, so strokes stay visible. An explicit prop always wins.
  const defaultStrokeColor = resolvedTheme.mode === "dark" ? "#ffffff" : "#000000";
  const drawingStrokeColor = drawingStrokeColorProp ?? defaultStrokeColor;
  const shapeStrokeColor = shapeStrokeColorProp ?? defaultStrokeColor;

  // State
  const [tip, setTip] = useState<Tip | null>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);

  // Refs
  const containerNodeRef = useRef<HTMLDivElement | null>(null);
  const highlightBindingsRef = useRef<{ [page: number]: HighlightBindings }>(
    {},
  );
  const noteBindingsRef = useRef<{ [page: number]: HighlightBindings }>({});
  const highlightsRef = useRef(highlights);
  const childrenRef = useRef(children);
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
  const renderRetryTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>(
    [],
  );
  const resumeScrollAwayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const findControllerRef = useRef<InstanceType<typeof PDFFindController> | null>(null);
  const viewerRef = useRef<InstanceType<typeof PDFViewer> | null>(null);
  // Last document the viewer ran setDocument for (to tell first load from a
  // toggle) and the last (document + recolor) key actually rendered. The key
  // dedupes StrictMode's double-invoke: without it, two overlapping async
  // setDocument calls make pdf.js append the page list twice (a 12-page doc
  // shows 24 pages).
  const prevDocRef = useRef<PDFDocumentProxy | null>(null);
  const lastRenderKeyRef = useRef<string | null>(null);

  highlightsRef.current = highlights;
  childrenRef.current = children;

  // Initialise PDF Viewer
  useLayoutEffect(() => {
    if (!containerNodeRef.current) return;

    // Dedupe StrictMode's double-invoke (and any identical re-run): the same
    // document + recolor key must not call setDocument twice, or pdf.js renders
    // the page list twice. recolorKey changes on a real palette/scheme toggle.
    const renderKey = `${(pdfDocument as { fingerprints?: unknown }).fingerprints ?? pdfDocument.numPages}::${recolorKey}`;
    if (lastRenderKeyRef.current === renderKey) {
      console.log("[PdfHighlighter] skip duplicate setDocument", renderKey);
      return;
    }

    findControllerRef.current =
      findControllerRef.current ||
      new PDFFindController({
        eventBus: eventBusRef.current,
        linkService: linkServiceRef.current,
      });

    viewerRef.current =
      viewerRef.current ||
      new PDFViewer({
        container: containerNodeRef.current,
        eventBus: eventBusRef.current,
        findController: findControllerRef.current,
        textLayerMode: 2,
        removePageBorders: true,
        linkService: linkServiceRef.current,
      });

    // Draw-time dark-mode recolor: patch the document's page.render to wrap the
    // canvas context with the live map (idempotent). Toggling the palette only
    // re-runs this effect (recolorKey dep) → setDocument re-renders the pages →
    // the patched render picks up the new map from recolorMapRef.
    patchPageRenderRecolor(pdfDocument, () => recolorMapRef.current);

    // Toggle vs first load: same document object means this re-run is a
    // palette/scheme toggle, where setDocument would otherwise reset both the
    // scroll position (resetView -> top) and the zoom (handleScaleValue
    // re-applies the pdfScaleValue prop on pagesinit). Capture the live scroll
    // (as a fraction of the scrollable range, so it survives any height change)
    // and the live zoom, then restore both once the rebuilt pages re-init.
    const isToggle = prevDocRef.current === pdfDocument;
    prevDocRef.current = pdfDocument;

    let scrollFraction = 0;
    let savedScaleValue: string | number | undefined;
    if (isToggle && viewerRef.current.container) {
      const c = viewerRef.current.container;
      const range = c.scrollHeight - c.clientHeight;
      scrollFraction = range > 0 ? c.scrollTop / range : 0;
      // currentScaleValue is "auto"/"page-width"/... or a numeric zoom; keep
      // whichever it is so a responsive scale stays responsive and an explicit
      // zoom stays exact. Fall back to the computed numeric scale.
      savedScaleValue =
        viewerRef.current.currentScaleValue ?? viewerRef.current.currentScale;
    }

    console.log("[PdfHighlighter] recolor active?", {
      mode: resolvedTheme.mode,
      hasMap: !!recolorMapRef.current,
      palette: resolvedTheme.darkModeColors,
      isToggle,
      scrollFraction,
      savedScaleValue,
    });

    if (isToggle) {
      const restoreView = () => {
        eventBusRef.current.off("pagesinit", restoreView);
        // Restore zoom first (this fires after handleScaleValue's pagesinit
        // handler, so it wins), then the scroll fraction in an rAF once the
        // re-scaled layout has settled and the scrollable range is final.
        if (savedScaleValue != null && viewerRef.current) {
          viewerRef.current.currentScaleValue = String(savedScaleValue);
        }
        requestAnimationFrame(() => {
          const c = viewerRef.current?.container;
          if (!c) return;
          const range = c.scrollHeight - c.clientHeight;
          c.scrollTop = scrollFraction * Math.max(0, range);
          console.log("[PdfHighlighter] restored view after toggle", {
            scrollFraction,
            scrollTop: c.scrollTop,
            scaleValue: viewerRef.current?.currentScaleValue,
          });
        });
      };
      eventBusRef.current.on("pagesinit", restoreView);
    }

    lastRenderKeyRef.current = renderKey;
    viewerRef.current.setDocument(pdfDocument);
    linkServiceRef.current.setDocument(pdfDocument);
    linkServiceRef.current.setViewer(viewerRef.current);
    setIsViewerReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDocument, recolorKey]);

  // Initialise viewer event listeners
  useLayoutEffect(() => {
    if (!containerNodeRef.current) return;

    resizeObserverRef.current = new ResizeObserver(handleScaleValue);
    resizeObserverRef.current.observe(containerNodeRef.current);

    const doc = containerNodeRef.current.ownerDocument;

    eventBusRef.current.on("textlayerrendered", scheduleRenderHighlightLayers);
    eventBusRef.current.on("pagerendered", scheduleRenderHighlightLayers);
    eventBusRef.current.on("pagesinit", handleScaleValue);
    doc.addEventListener("keydown", handleKeyDown);
    doc.addEventListener("copy", handleCopy, true);

    scheduleRenderHighlightLayers();

    return () => {
      eventBusRef.current.off("pagesinit", handleScaleValue);
      eventBusRef.current.off("pagerendered", scheduleRenderHighlightLayers);
      eventBusRef.current.off("textlayerrendered", scheduleRenderHighlightLayers);
      doc.removeEventListener("keydown", handleKeyDown);
      doc.removeEventListener("copy", handleCopy, true);
      resizeObserverRef.current?.disconnect();
      renderRetryTimeoutsRef.current.forEach(clearTimeout);
      renderRetryTimeoutsRef.current = [];
      if (resumeScrollAwayTimeoutRef.current) {
        clearTimeout(resumeScrollAwayTimeoutRef.current);
        resumeScrollAwayTimeoutRef.current = null;
      }
    };
  }, [selectionTip, highlights, onSelectionFinished]);

  // Unmount every per-page highlight/note React root when the viewer unmounts —
  // these roots are mounted into PDF.js-owned DOM (outside React's tree) so they
  // are not torn down automatically and would otherwise leak.
  useEffect(() => {
    return () => {
      for (const binding of Object.values(highlightBindingsRef.current))
        unmountReactRoot(binding?.reactRoot);
      for (const binding of Object.values(noteBindingsRef.current))
        unmountReactRoot(binding?.reactRoot);
    };
  }, []);

  // Page tracking + deep-link / initial page. Registered after the listeners
  // effect so this `pagesinit` handler runs after handleScaleValue (scale set
  // before we scroll to the initial page). Refs keep the listeners stable so we
  // never resubscribe on prop changes.
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const initialPageRef = useRef(initialPage);
  initialPageRef.current = initialPage;
  const initialPageAppliedRef = useRef(false);
  // While the initial page is being homed in, the viewer fires spurious
  // pagechanging events (1, target, 1, 2…) as scale/resize relayout settles.
  // This holds the target during that window so we (a) suppress URL writes that
  // would clobber the deep link and (b) re-assert the target until it sticks.
  const pendingInitialPageRef = useRef<number | null>(null);

  useEffect(() => {
    const eventBus = eventBusRef.current;

    const handlePageChanging = (evt: { pageNumber: number }) => {
      // Don't let the load-time bounce overwrite the deep-linked page.
      if (pendingInitialPageRef.current != null) return;
      onPageChangeRef.current?.(evt.pageNumber);
    };
    eventBus.on("pagechanging", handlePageChanging);

    // First load only: home in on the requested initial page once pages exist.
    // Guarded so a dark-mode toggle (which also fires pagesinit) never re-jumps.
    const handlePagesInit = () => {
      if (initialPageAppliedRef.current) return;
      initialPageAppliedRef.current = true;
      const page = initialPageRef.current;
      console.log("[PdfHighlighter] pagesinit, initialPage =", page);
      if (!page || page <= 1) return;

      pendingInitialPageRef.current = page;
      let tries = 0;
      let matches = 0;

      // Poll: scale/resize relayout keeps yanking the view back to the top for
      // a few hundred ms after load. Re-assert the target until the viewer
      // reports it as the current page for a few consecutive ticks, then
      // release and write the URL once. Bounded so we never spin forever.
      const tick = () => {
        const viewer = viewerRef.current;
        if (!viewer || pendingInitialPageRef.current == null) return;
        tries++;

        if (viewer.currentPageNumber === page) {
          matches++;
        } else {
          matches = 0;
          try {
            viewer.scrollPageIntoView({ pageNumber: page });
          } catch (e) {
            console.log("[PdfHighlighter] scrollPageIntoView threw", e);
          }
        }

        if (matches >= 3) {
          pendingInitialPageRef.current = null;
          onPageChangeRef.current?.(page); // ensure URL = the resolved page
          console.log("[PdfHighlighter] initialPage settled at", page);
          return;
        }
        if (tries > 40) {
          pendingInitialPageRef.current = null;
          console.log("[PdfHighlighter] initialPage gave up at", page);
          return;
        }
        setTimeout(tick, 50);
      };
      setTimeout(tick, 0);
    };
    eventBus.on("pagesinit", handlePagesInit);

    return () => {
      eventBus.off("pagechanging", handlePageChanging);
      eventBus.off("pagesinit", handlePagesInit);
      pendingInitialPageRef.current = null;
    };
  }, []);

  // Pinch-to-zoom: ctrl/⌘ + wheel (trackpad pinch) and two-finger touch. For
  // smoothness we DON'T re-rasterise per frame (that's janky). During the
  // gesture we only apply a GPU-composited CSS `transform: scale()` to the
  // .pdfViewer — buttery, anchored to the cursor / pinch centre via
  // transform-origin. When the gesture settles we commit ONCE: set the real
  // PDF.js scale (one crisp re-raster) and fix the scroll so the anchor stays
  // put. This is the lector approach adapted to PDFViewer.
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  useEffect(() => {
    const container = containerNodeRef.current;
    if (!container || !isViewerReady) return;

    const MIN_SCALE = 0.25;
    const MAX_SCALE = 10;
    const COMMIT_DELAY = 140; // ms of no wheel events before committing

    // Live gesture state. originX/Y are the anchor in CONTENT coords (fixed for
    // the whole gesture); anchorX/Y are the same point relative to the container.
    const g = {
      active: false,
      startScale: 1,
      startScrollLeft: 0,
      startScrollTop: 0,
      anchorX: 0,
      anchorY: 0,
      originX: 0,
      originY: 0,
      k: 1,
      raf: 0,
      commitTimer: 0 as number | ReturnType<typeof setTimeout>,
    };

    const pdfViewerEl = () =>
      container.querySelector(".pdfViewer") as HTMLElement | null;

    const clampK = (k: number) =>
      Math.min(
        MAX_SCALE / g.startScale,
        Math.max(MIN_SCALE / g.startScale, k),
      );

    const begin = (anchorX: number, anchorY: number) => {
      const viewer = viewerRef.current;
      const el = pdfViewerEl();
      if (!viewer || !el) return false;
      g.active = true;
      g.startScale = viewer.currentScale;
      g.startScrollLeft = container.scrollLeft;
      g.startScrollTop = container.scrollTop;
      g.anchorX = anchorX;
      g.anchorY = anchorY;
      g.originX = container.scrollLeft + anchorX;
      g.originY = container.scrollTop + anchorY;
      g.k = 1;
      // Scale about the anchor point (in the element's own coord space) so it
      // stays under the fingers; no layout/scroll change during the preview.
      el.style.transformOrigin = `${g.originX}px ${g.originY}px`;
      el.style.willChange = "transform";
      return true;
    };

    const previewRaf = () => {
      g.raf = 0;
      const el = pdfViewerEl();
      if (el) el.style.transform = `scale(${g.k})`;
    };
    const preview = () => {
      if (!g.raf) g.raf = requestAnimationFrame(previewRaf);
    };

    const commit = () => {
      if (!g.active) return;
      g.active = false;
      if (g.raf) {
        cancelAnimationFrame(g.raf);
        g.raf = 0;
      }
      const viewer = viewerRef.current;
      const el = pdfViewerEl();
      if (el) {
        el.style.transform = "";
        el.style.transformOrigin = "";
        el.style.willChange = "";
      }
      if (!viewer) return;
      const finalScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, g.startScale * g.k),
      );
      const ratio = finalScale / g.startScale;
      // Re-raster once at the new scale, then anchor the scroll so the content
      // point under the gesture stays in place.
      viewer.currentScaleValue = String(finalScale);
      container.scrollLeft = g.originX * ratio - g.anchorX;
      container.scrollTop = g.originY * ratio - g.anchorY;
      onZoomChangeRef.current?.(finalScale);
      console.log("[PdfHighlighter] pinch commit", {
        from: g.startScale,
        to: finalScale,
      });
    };

    const scheduleCommit = () => {
      clearTimeout(g.commitTimer);
      g.commitTimer = setTimeout(commit, COMMIT_DELAY);
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // pinch / ctrl-scroll only
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const ax = e.clientX - rect.left;
      const ay = e.clientY - rect.top;
      if (!g.active && !begin(ax, ay)) return;
      // Exponential: each notch is a constant ratio. Up = zoom in.
      g.k = clampK(g.k * Math.exp(-e.deltaY * 0.01));
      preview();
      scheduleCommit(); // wheel has no end event — commit after it stops
    };
    container.addEventListener("wheel", handleWheel, { passive: false });

    // Two-finger touch pinch via pointer events.
    const pointers = new Map<number, PointerEvent>();
    let startDist = 0;
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") pointers.set(e.pointerId, e);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, e);
      if (pointers.size !== 2) return;
      e.preventDefault();
      const d = spread();
      const [a, b] = [...pointers.values()];
      const rect = container.getBoundingClientRect();
      const cx = (a.clientX + b.clientX) / 2 - rect.left;
      const cy = (a.clientY + b.clientY) / 2 - rect.top;
      if (!g.active) {
        startDist = d;
        if (!begin(cx, cy)) return;
        return;
      }
      g.k = clampK(d / startDist);
      preview();
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2 && g.active) {
        startDist = 0;
        commit(); // pinch ended — commit immediately
      }
    };
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove, { passive: false });
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      clearTimeout(g.commitTimer);
      if (g.raf) cancelAnimationFrame(g.raf);
      const el = pdfViewerEl();
      if (el) {
        el.style.transform = "";
        el.style.transformOrigin = "";
        el.style.willChange = "";
      }
    };
  }, [isViewerReady]);

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

  const handleCopy = (event: ClipboardEvent) => {
    const container = containerNodeRef.current;

    if (!container || !event.clipboardData) return;

    const target = event.target;
    const targetElement =
      target instanceof HTMLElement
        ? target
        : target instanceof Node
          ? target.parentElement
          : null;

    if (
      targetElement &&
      (targetElement.closest("input, textarea, [contenteditable='true']") ||
        targetElement.closest(".PdfHighlighter__tip-container"))
    ) {
      return;
    }

    const selection = getWindow(container).getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

    if (
      !selection ||
      selection.isCollapsed ||
      !range ||
      !container.contains(range.commonAncestorContainer)
    ) {
      return;
    }

    const text =
      selectionRef.current?.content.text?.trim() ||
      selection.toString().split("\n").join(" ").trim();

    if (!text) return;

    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
    event.stopPropagation();
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
    shouldRenderHighlight?: (highlight: Highlight | GhostHighlight) => boolean,
  ) => {
    if (!viewerRef.current) return;

    highlightBindings.reactRoot.render(
      <PdfHighlighterContext.Provider value={pdfHighlighterUtils}>
        <HighlightLayer
          highlightsByPage={groupHighlightsByPage([
            ...highlightsRef.current,
            ghostHighlightRef.current,
          ])}
          pageNumber={pageNumber}
          scrolledToHighlightId={scrolledToHighlightIdRef.current}
          viewer={viewerRef.current}
          highlightBindings={highlightBindings}
          shouldRenderHighlight={shouldRenderHighlight}
          children={childrenRef.current}
        />
      </PdfHighlighterContext.Provider>,
    );
  };

  const renderHighlightLayers = () => {
    if (!viewerRef.current) return;

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const { textLayer } = viewerRef.current!.getPageView(pageNumber - 1) || {};
      if (!textLayer) continue; // Viewer hasn't rendered page yet

      const textLayerDiv = textLayer.div; // textLayer.div for version >=3.0 and textLayer.textLayerDiv otherwise.
      const highlightLayer = findOrCreateHighlightLayer(textLayerDiv);
      const noteLayer = findOrCreateNoteLayer(textLayerDiv);

      if (highlightLayer) {
        let highlightBindings = highlightBindingsRef.current[pageNumber];

        // Need to check if container is still attached to the DOM as PDF.js can unload pages.
        if (!highlightBindings?.container?.isConnected) {
          // The old page was unloaded by PDF.js — unmount its React root before
          // replacing it, otherwise the detached tree leaks. Deferred so we
          // never unmount synchronously during a React render.
          unmountReactRoot(highlightBindings?.reactRoot);
          highlightBindings = {
            reactRoot: createRoot(highlightLayer),
            container: highlightLayer,
            textLayer: textLayerDiv,
          };
          highlightBindingsRef.current[pageNumber] = highlightBindings;
        }

        renderHighlightLayer(
          highlightBindings,
          pageNumber,
          (highlight) => !isFreetextHighlight(highlight),
        );
      }

      if (noteLayer) {
        let noteBindings = noteBindingsRef.current[pageNumber];

        if (!noteBindings?.container?.isConnected) {
          unmountReactRoot(noteBindings?.reactRoot);
          noteBindings = {
            reactRoot: createRoot(noteLayer),
            container: noteLayer,
            textLayer: textLayerDiv,
          };
          noteBindingsRef.current[pageNumber] = noteBindings;
        }

        renderHighlightLayer(noteBindings, pageNumber, isFreetextHighlight);
      }
    }
  };

  const scheduleRenderHighlightLayers = () => {
    renderHighlightLayers();

    renderRetryTimeoutsRef.current.forEach(clearTimeout);
    renderRetryTimeoutsRef.current = [50, 150, 350, 750, 1200].map((delay) =>
      setTimeout(renderHighlightLayers, delay),
    );
  };

  const resumeScrollAwayListenerAfterNavigation = () => {
    const container = viewerRef.current?.container;
    if (!container) return;

    if (resumeScrollAwayTimeoutRef.current) {
      clearTimeout(resumeScrollAwayTimeoutRef.current);
    }

    resumeScrollAwayTimeoutRef.current = setTimeout(() => {
      container.addEventListener("scroll", handleScroll, {
        once: true,
      });
      resumeScrollAwayTimeoutRef.current = null;
    }, 1200);
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
    scheduleRenderHighlightLayers();

    resumeScrollAwayListenerAfterNavigation();
  };

  const dispatchFind = (
    query: string,
    findPrevious: boolean,
    options: PdfSearchOptions = {},
    type?: "again" | "highlightallchange",
  ) => {
    eventBusRef.current.dispatch("find", {
      source: findControllerRef.current || viewerRef.current,
      type,
      query,
      phraseSearch: true,
      caseSensitive: options.caseSensitive ?? false,
      entireWord: options.entireWord ?? false,
      highlightAll: options.highlightAll ?? true,
      findPrevious,
      matchDiacritics: options.matchDiacritics ?? false,
    });
  };

  const currentSearchRef = useRef<{
    query: string;
    options: PdfSearchOptions;
  }>({
    query: "",
    options: {},
  });

  const search = (query: string, options: PdfSearchOptions = {}) => {
    currentSearchRef.current = { query, options };

    if (!query.trim()) {
      clearSearch();
      return;
    }

    dispatchFind(query, false, options);
  };

  const findNext = () => {
    const { query, options } = currentSearchRef.current;
    if (!query.trim()) return;
    dispatchFind(query, false, options, "again");
  };

  const findPrevious = () => {
    const { query, options } = currentSearchRef.current;
    if (!query.trim()) return;
    dispatchFind(query, true, options, "again");
  };

  const clearSearch = () => {
    currentSearchRef.current = { query: "", options: {} };
    eventBusRef.current.dispatch("findbarclose", {
      source: findControllerRef.current || viewerRef.current,
    });
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
    search,
    findNext,
    findPrevious,
    clearSearch,
    goToPage: (pageNumber: number) => {
      console.log('[PdfHighlighter] goToPage called with page:', pageNumber);
      const viewer = viewerRef.current;
      if (!viewer) {
        console.log('[PdfHighlighter] goToPage: viewer not available');
        return;
      }

      // Check if viewer container has a valid offsetParent (required by PDF.js)
      const container = viewer.container;
      console.log('[PdfHighlighter] goToPage: container:', !!container, 'offsetParent:', !!container?.offsetParent);
      if (container && container.offsetParent) {
        try {
          console.log('[PdfHighlighter] goToPage: using viewer.scrollPageIntoView');
          viewer.scrollPageIntoView({ pageNumber });
          return;
        } catch (e) {
          console.log('[PdfHighlighter] goToPage: scrollPageIntoView threw error:', e);
          // Fall through to DOM-based scrolling
        }
      }

      // Fallback: Use DOM-based scrolling when PDF.js scrollPageIntoView fails
      const pageElement = container?.querySelector(`.page[data-page-number="${pageNumber}"]`) as HTMLElement | null;
      console.log('[PdfHighlighter] goToPage: DOM fallback, pageElement found:', !!pageElement);
      if (pageElement && container) {
        // PDF.js pages use position:absolute with inline style.top set to their position
        // Parse the inline style.top value to get the scroll target
        const styleTop = pageElement.style.top;
        const scrollTarget = styleTop ? parseInt(styleTop, 10) : 0;
        console.log('[PdfHighlighter] goToPage: style.top =', styleTop, 'scrollTarget =', scrollTarget);

        if (scrollTarget > 0) {
          container.scrollTo({
            top: scrollTarget,
            behavior: 'smooth'
          });
        } else {
          // Fallback: use getBoundingClientRect if style.top is not set
          const containerRect = container.getBoundingClientRect();
          const pageRect = pageElement.getBoundingClientRect();
          const scrollTop = container.scrollTop + (pageRect.top - containerRect.top);
          console.log('[PdfHighlighter] goToPage: using getBoundingClientRect, scrollTop =', scrollTop);
          container.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        }
      } else {
        // Try document-wide search as last resort
        const docPageElement = document.querySelector(`.page[data-page-number="${pageNumber}"]`) as HTMLElement | null;
        console.log('[PdfHighlighter] goToPage: document-wide search, found:', !!docPageElement);
        if (docPageElement) {
          // Parse inline style.top
          const styleTop = docPageElement.style.top;
          const scrollTarget = styleTop ? parseInt(styleTop, 10) : 0;
          const scrollContainer = docPageElement.closest('.pdfViewer')?.parentElement as HTMLElement | null;

          if (scrollContainer && scrollTarget > 0) {
            console.log('[PdfHighlighter] goToPage: document search, scrolling to style.top =', scrollTarget);
            scrollContainer.scrollTo({
              top: scrollTarget,
              behavior: 'smooth'
            });
          } else {
            // Last resort: use scrollIntoView
            console.log('[PdfHighlighter] goToPage: using scrollIntoView fallback');
            docPageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
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
