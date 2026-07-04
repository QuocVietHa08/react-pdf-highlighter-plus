# API & Components Reference

Complete reference for components, hooks, types, and utility functions exported from react-pdf-highlighter-plus.

---

## Core Components

### PdfLoader

Loads a PDF.js document from a URL or file. Provides the loaded document to children via context.

**Import**:
```tsx
import { PdfLoader } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface PdfLoaderProps {
  /** PDF location: URL string or DocumentInitParameters object */
  url: string | DocumentInitParameters;

  /** Child components (receive PDFDocumentProxy via context) */
  children: ReactNode;

  /** HTTP headers for authenticated requests */
  httpHeaders?: Record<string, string>;

  /** Include credentials in requests */
  withCredentials?: boolean;

  /** Disable automatic page prefetching */
  disableAutoFetch?: boolean;

  /** Disable streaming (use range requests only) */
  disableStream?: boolean;

  /** Size of range request chunks (bytes) */
  rangeChunkSize?: number;

  /** Enable URL-keyed document caching */
  enableCache?: boolean;

  /** Loading progress callback: (current, total) */
  onProgress?: (current: number, total: number) => void;

  /** Loading placeholder component */
  skeleton?: ReactNode;
}
```

**Example**:
```tsx
<PdfLoader url="https://example.com/document.pdf" skeleton={<Loading />}>
  <PdfHighlighter {...props}>
    <HighlightContainer />
  </PdfHighlighter>
</PdfLoader>
```

---

### PdfHighlighter

Core PDF viewer component. Manages PDF.js rendering, selections, and provides context utilities.

**Import**:
```tsx
import { PdfHighlighter } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface PdfHighlighterProps {
  /** Loaded PDF.js document */
  pdfDocument: PDFDocumentProxy;

  /** Highlights to render */
  highlights: Highlight[];

  /** Callback on text/area selection: (position, content, hide) */
  onSelectionFinished?: (
    position: ScaledPosition,
    content: PdfSelection,
    hideTipAndSelection: () => void
  ) => void;

  /** Callback for ghost highlight creation */
  onCreateGhostHighlight?: (highlight: GhostHighlight) => void;

  /** Callback for ghost highlight removal */
  onRemoveGhostHighlight?: () => void;

  /** Callback for text search results */
  onSearch?: (results: PdfSearchResult[]) => void;

  /** Enable area selection (Alt+drag by default) */
  enableAreaSelection?: (event: MouseEvent) => boolean;

  /** Enable text selection (default: true) */
  enableTextSelection?: boolean;

  /** Theme configuration */
  theme?: PdfHighlighterTheme;

  /** Starting page (1-indexed) for deep linking */
  initialPage?: number;

  /** Callback on page change */
  onPageChange?: (page: number) => void;

  /** Callback on zoom change */
  onZoomChange?: (scale: number) => void;

  /** Custom container background color */
  containerBackgroundColor?: string;

  /** Custom selection color */
  selectionTipColor?: string;

  /** Custom tip component for selections */
  selectionTip?: ReactNode;

  /** Child highlight container */
  children: ReactNode;

  /** Ref to access viewer utilities */
  utilsRef?: React.MutableRefObject<PdfHighlighterUtils | null>;
}

interface PdfHighlighterTheme {
  mode?: "light" | "dark";
  containerBackgroundColor?: string;
  scrollbarThumbColor?: string;
  scrollbarTrackColor?: string;
  darkModeColors?: { background: string; foreground: string };
  darkModeInvertIntensity?: number; // Deprecated
}
```

**Example**:
```tsx
const utilsRef = useRef<PdfHighlighterUtils>(null);

<PdfHighlighter
  pdfDocument={pdfDocument}
  highlights={highlights}
  onSelectionFinished={(position, content, hide) => {
    // Create highlight
  }}
  enableAreaSelection={(e) => e.altKey}
  theme={{ mode: "dark" }}
  initialPage={1}
  onPageChange={(page) => console.log(page)}
  utilsRef={utilsRef}
>
  <HighlightContainer highlights={highlights} />
</PdfHighlighter>
```

---

## Highlight Components

### TextHighlight

Renders a colored text highlight with optional underline or strikethrough.

**Import**:
```tsx
import { TextHighlight } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface TextHighlightProps {
  isScrolledTo?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: TextHighlightStyle;
}

interface TextHighlightStyle {
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  cursor?: string;
}
```

---

### AreaHighlight

Draggable/resizable rectangular region highlight via `react-rnd`.

**Import**:
```tsx
import { AreaHighlight } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface AreaHighlightProps {
  isScrolledTo?: boolean;
  onSelectionFinished?: (newPosition: ScaledPosition) => void;
  style?: AreaHighlightStyle;
}

interface AreaHighlightStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
}
```

---

### FreetextHighlight

Draggable, editable sticky note with text and styling.

**Import**:
```tsx
import { FreetextHighlight } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface FreetextHighlightProps {
  isScrolledTo?: boolean;
  onUpdate?: (content: FreetextContent) => void;
  style?: FreetextStyle;
  compact?: boolean;
}

interface FreetextStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
  borderColor?: string;
  borderRadius?: string;
}
```

---

### DrawingHighlight

Freehand pen strokes rendered on canvas.

**Import**:
```tsx
import { DrawingHighlight } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface DrawingHighlightProps {
  isScrolledTo?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  readOnly?: boolean;
}
```

---

### ShapeHighlight

Vector shapes (rectangle, circle, arrow) with customizable stroke.

**Import**:
```tsx
import { ShapeHighlight } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface ShapeHighlightProps {
  isScrolledTo?: boolean;
  readOnly?: boolean;
  style?: ShapeStyle;
}

interface ShapeStyle {
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  opacity?: number;
}
```

---

### ImageHighlight

Embedded image on page with drag/resize support.

**Import**:
```tsx
import { ImageHighlight } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface ImageHighlightProps {
  isScrolledTo?: boolean;
  onImageUpload?: (dataUrl: string) => void;
  onSelectionFinished?: (newPosition: ScaledPosition) => void;
}
```

---

### SignaturePad

Handwritten signature capture or display.

**Import**:
```tsx
import { SignaturePad } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface SignaturePadProps {
  onSignatureFinished?: (strokes: DrawingStroke[], position: ScaledPosition) => void;
  strokeColor?: string;
  strokeWidth?: number;
  readOnly?: boolean;
}
```

---

## Canvas Components (For Creating Annotations)

### DrawingCanvas

Interactive canvas for drawing freehand strokes.

**Import**:
```tsx
import { DrawingCanvas } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface DrawingCanvasProps {
  onDrawingFinished?: (strokes: DrawingStroke[], position: ScaledPosition) => void;
  strokeColor?: string;
  strokeWidth?: number;
  readOnly?: boolean;
}
```

---

### ShapeCanvas

Interactive canvas for drawing shapes (rectangle, circle, arrow).

**Import**:
```tsx
import { ShapeCanvas } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface ShapeCanvasProps {
  onShapeFinished?: (shape: ShapeData, position: ScaledPosition) => void;
  shapeType?: "rectangle" | "circle" | "arrow";
  strokeColor?: string;
  strokeWidth?: number;
}
```

---

## Left Panel

### LeftPanel

Navigation UI with outline and thumbnails.

**Import**:
```tsx
import { LeftPanel } from "react-pdf-highlighter-plus";
```

**Props**:
```typescript
interface LeftPanelProps {
  pdfDocument: PDFDocumentProxy;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  mode?: "light" | "dark";
  theme?: LeftPanelTheme;
}

interface LeftPanelTheme {
  containerBackgroundColor?: string;
  tabStyles?: TabStyles;
  footerStyles?: FooterStyles;
  toggleButtonStyles?: ToggleButtonStyles;
}
```

---

## Contexts & Hooks

### usePdfHighlighterContext

Provides viewer utilities for controlling selection, tips, scroll, and search.

**Import**:
```tsx
import { usePdfHighlighterContext, PdfHighlighterUtils } from "react-pdf-highlighter-plus";
```

**Returns**:
```typescript
interface PdfHighlighterUtils {
  isEditingOrHighlighting(): boolean;
  getCurrentSelection(): PdfSelection | null;
  getGhostHighlight(): GhostHighlight | null;
  removeGhostHighlight(): void;
  toggleEditInProgress(flag?: boolean): void;
  isEditInProgress(): boolean;
  isSelectionInProgress(): boolean;
  scrollToHighlight(highlight: Highlight): void;
  setTip(tip: Tip | null): void;
  updateTipPosition(): void;
  search(query: string, options?: PdfSearchOptions): Promise<PdfSearchResult[]>;
}
```

**Example**:
```tsx
function MyComponent() {
  const { scrollToHighlight, setTip, search } = usePdfHighlighterContext();

  return (
    <button onClick={() => scrollToHighlight(highlights[0])}>
      Scroll to First
    </button>
  );
}
```

---

### useHighlightContainerContext

Provides utilities for rendering individual highlights.

**Import**:
```tsx
import { useHighlightContainerContext, HighlightContainerUtils } from "react-pdf-highlighter-plus";
```

**Returns**:
```typescript
interface HighlightContainerUtils {
  highlight: Highlight;
  viewportToScaled(viewport: ViewportPosition): ScaledPosition;
  screenshot(): Promise<string | null>;
  isScrolledTo: boolean;
  highlightBindings: DOMRect;
}
```

**Example**:
```tsx
function HighlightContainer() {
  const { highlight, isScrolledTo, viewportToScaled, screenshot } =
    useHighlightContainerContext();

  return <TextHighlight isScrolledTo={isScrolledTo} />;
}
```

---

### usePageNavigation

Hook for page navigation within PdfHighlighter.

**Import**:
```tsx
import { usePageNavigation } from "react-pdf-highlighter-plus";
```

**Returns**:
```typescript
{
  currentPage: number;
  goToPage(page: number): void;
  nextPage(): void;
  prevPage(): void;
  totalPages: number;
}
```

---

### useDocumentOutline

Extract document outline (table of contents) from PDF metadata.

**Import**:
```tsx
import { useDocumentOutline } from "react-pdf-highlighter-plus";
```

**Returns**:
```typescript
{
  outline: OutlineItem[];
  loading: boolean;
  error?: Error;
}
```

---

### useThumbnails

Generate page thumbnails for navigation.

**Import**:
```tsx
import { useThumbnails } from "react-pdf-highlighter-plus";
```

**Returns**:
```typescript
{
  thumbnails: ThumbnailItem[];
  loading: boolean;
  error?: Error;
}
```

---

## Text Extraction & Search

### extractSentences

Extract sentence-level text from a PDF for read-aloud or citation.

**Import**:
```tsx
import { extractSentences } from "react-pdf-highlighter-plus";
```

**Signature**:
```typescript
async function extractSentences(
  pdfDocument: PDFDocumentProxy,
  options?: ExtractSentencesOptions
): Promise<PdfSentence[]>
```

**Options**:
```typescript
interface ExtractSentencesOptions {
  pages?: "all" | number[];
  includePositions?: boolean;  // Include ScaledPosition for rendering
  normalize?: boolean;          // Normalize whitespace, hyphenation
  locale?: string;              // Intl.Segmenter locale
  idPrefix?: string;            // ID prefix (e.g., "ai-")
  readingOrder?: "auto" | "document" | "position";
  columnDetection?: "auto" | "none";
  includeTextUnitTypes?: string[];
}
```

**Returns**:
```typescript
interface PdfSentence {
  id: string;
  text: string;
  rawText: string;
  pageNumber: number;
  indexInPage: number;
  globalIndex: number;
  position?: ScaledPosition;  // For rendering highlights
  source: {
    startOffset: number;
    endOffset: number;
    textItemIndexes: number[];
  };
}
```

**Example**:
```tsx
const sentences = await extractSentences(pdfDocument, {
  pages: [1, 2],
  idPrefix: "ai-",
});

sentences.forEach((s) => console.log(s.text, s.position));
```

---

### getTextPosition

Find text in PDF and return its ScaledPosition for highlighting.

**Import**:
```tsx
import { getTextPosition } from "react-pdf-highlighter-plus";
```

**Signature**:
```typescript
async function getTextPosition(
  pdfDocument: PDFDocumentProxy,
  query: string,
  options?: { pages?: "all" | number[] }
): Promise<TextPositionMatch | null>
```

**Returns**:
```typescript
interface TextPositionMatch {
  text: string;
  position: ScaledPosition;
  pageNumber: number;
}
```

**Example**:
```tsx
const match = await getTextPosition(pdfDocument, "your quote");
if (match) {
  const highlight = { id: "h1", position: match.position };
  setHighlights([...highlights, highlight]);
}
```

---

### extractPageTextItems

Lower-level text extraction for custom text grouping.

**Import**:
```tsx
import { extractPageTextItems } from "react-pdf-highlighter-plus";
```

**Signature**:
```typescript
async function extractPageTextItems(
  pdfDocument: PDFDocumentProxy,
  options?: { pages?: "all" | number[] }
): Promise<PdfExtractedPage[]>
```

---

### extractTextUnits

Extract layout-aware text units (paragraphs, headings, footnotes, etc.).

**Import**:
```tsx
import { extractTextUnits } from "react-pdf-highlighter-plus";
```

**Signature**:
```typescript
async function extractTextUnits(
  pdfDocument: PDFDocumentProxy,
  options?: { pages?: "all" | number[] }
): Promise<PdfTextUnit[]>
```

---

## Coordinate Conversion

### viewportPositionToScaled

Convert viewport coordinates to scaled (normalized) coordinates.

**Import**:
```tsx
import { viewportPositionToScaled } from "react-pdf-highlighter-plus";
```

**Signature**:
```typescript
function viewportPositionToScaled(
  viewport: ViewportPosition,
  pdfViewer: PDFViewer,
  pageNumber: number
): ScaledPosition
```

---

### scaledPositionToViewport

Convert scaled coordinates to viewport coordinates.

**Import**:
```tsx
import { scaledPositionToViewport } from "react-pdf-highlighter-plus";
```

**Signature**:
```typescript
function scaledPositionToViewport(
  scaled: ScaledPosition,
  pdfViewer: PDFViewer,
  pageNumber: number
): ViewportPosition
```

---

## PDF Export

### exportPdf

Export annotated PDF with all highlights embedded.

**Import**:
```tsx
import { exportPdf } from "react-pdf-highlighter-plus";
```

**Signature**:
```typescript
async function exportPdf(
  pdfDocument: PDFDocumentProxy,
  highlights: ExportableHighlight[],
  options?: ExportPdfOptions
): Promise<PDFDocument>
```

**Options**:
```typescript
interface ExportPdfOptions {
  textHighlightColor?: string;     // Default: "rgba(255, 226, 143, 0.5)"
  areaHighlightColor?: string;     // Default: "rgba(255, 226, 143, 0.5)"
  defaultFreetextColor?: string;   // Default: "#333333"
  defaultFreetextBgColor?: string; // Default: "#ffffc8"
  defaultFreetextFontSize?: number; // Default: 14
  onProgress?: (current, total) => void;
}
```

**Example**:
```tsx
const pdf = await exportPdf(pdfDocument, highlights, {
  textHighlightColor: "rgba(255, 226, 143, 0.5)",
});

const blob = pdf.asBlob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "annotated.pdf";
a.click();
```

---

## Types

### Highlight

Base highlight type.

```typescript
interface Highlight {
  id: string;
  position: ScaledPosition;
  type?: "text" | "area" | "freetext" | "drawing" | "shape" | "signature" | "image";
  content?: Record<string, any>;
  [key: string]: any;  // Allow custom fields
}
```

---

### ScaledPosition

Normalized (0–1) coordinates relative to page.

```typescript
interface ScaledPosition {
  boundingRect: Scaled;
  rects: Scaled[];
  usePdfCoordinates?: boolean;
}

interface Scaled {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber: number;
}
```

---

### ViewportPosition

Pixel coordinates in current view.

```typescript
interface ViewportPosition {
  boundingRect: LTWHP;
  rects: LTWHP[];
}

interface LTWHP {
  left: number;
  top: number;
  width: number;
  height: number;
  pageNumber: number;
}
```

---

### PdfSelection

Active text or area selection.

```typescript
interface PdfSelection {
  text: string;
  image?: string;
  // Additional data from PDF.js
}
```

---

### GhostHighlight

Temporary highlight during in-progress selection.

```typescript
interface GhostHighlight {
  position: ScaledPosition;
  isScrolledTo?: boolean;
}
```

---

### DrawingStroke

Freehand drawing stroke.

```typescript
interface DrawingStroke {
  points: DrawingPoint[];
  color: string;
  width: number;
}

interface DrawingPoint {
  x: number;
  y: number;
}
```

---

### ShapeData

Vector shape data.

```typescript
interface ShapeData {
  type: "rectangle" | "circle" | "arrow";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
}
```

---

## Tips & Popups

### Tip Type

```typescript
interface Tip {
  highlight: Highlight;
  // OR
  position: Viewport Position;
  content: ReactNode;
}
```

---

## Search

### Search Options

```typescript
interface PdfSearchOptions {
  caseSensitive?: boolean;
  entireWord?: boolean;
  highlightAll?: boolean;
  matchDiacritics?: boolean;
}
```

### Search Results

```typescript
interface PdfSearchResult {
  pageNumber: number;
  position: ScaledPosition;
  text: string;
}
```

---

## Error Handling

All async functions return promises that may reject with errors. Always wrap in try/catch:

```tsx
try {
  const sentences = await extractSentences(pdfDocument);
} catch (error) {
  console.error("Extraction failed:", error);
}
```

---

## Common Usage Patterns

### Full-Featured Highlight Container

```tsx
function HighlightContainer({ highlights }) {
  const { setTip, getCurrentSelection, toggleEditInProgress } =
    usePdfHighlighterContext();

  return (
    <>
      {highlights.map((h) => (
        <MonitoredHighlightContainer key={h.id} highlight={h}>
          {h.type === "text" && <TextHighlight />}
          {h.type === "area" && (
            <AreaHighlight
              onSelectionFinished={(pos) => {
                // Update position
              }}
            />
          )}
          {h.type === "freetext" && (
            <FreetextHighlight
              onUpdate={(content) => {
                // Update content
              }}
            />
          )}
        </MonitoredHighlightContainer>
      ))}
    </>
  );
}
```

### Search & Navigate

```tsx
const { search, scrollToHighlight } = usePdfHighlighterContext();

const results = await search("keyword", { caseSensitive: false });
if (results.length > 0) {
  const match = {
    id: "search-result",
    position: results[0].position,
    type: "text",
  };
  scrollToHighlight(match);
}
```

