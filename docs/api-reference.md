# API Reference

## FreetextHighlight Component

A draggable, editable text annotation component for PDF documents.

### Import

```tsx
import { FreetextHighlight } from "react-pdf-highlighter-extended";
```

### Props

```typescript
interface FreetextHighlightProps {
  /**
   * The highlight to be rendered.
   */
  highlight: ViewportHighlight;

  /**
   * Callback triggered when the highlight position changes (drag).
   * @param rect - The updated highlight area with page number.
   */
  onChange?(rect: LTWHP): void;

  /**
   * Callback triggered when the text content is updated.
   * @param newText - The updated text content.
   */
  onTextChange?(newText: string): void;

  /**
   * Whether the highlight has been auto-scrolled into view.
   * Default styling renders a red border when true.
   */
  isScrolledTo?: boolean;

  /**
   * Bounds for the draggable area. Prevents moving the highlight
   * off the viewer/page. See react-rnd documentation.
   */
  bounds?: string | Element;

  /**
   * Callback triggered on right-click.
   */
  onContextMenu?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Called when the user starts editing (drag or text edit).
   */
  onEditStart?(): void;

  /**
   * Called when the user finishes editing.
   */
  onEditEnd?(): void;

  /**
   * Custom CSS styles for the container.
   */
  style?: CSSProperties;

  /**
   * Text color for the annotation content.
   * @example "#333333"
   */
  color?: string;

  /**
   * Font family for the annotation content.
   * @example "Arial, sans-serif"
   */
  fontFamily?: string;

  /**
   * Font size for the annotation content.
   * @example "14px" or "1rem"
   */
  fontSize?: string;

  /**
   * Background color for the annotation content.
   * @example "#ffffc8"
   */
  backgroundColor?: string;
}
```

### Usage Example

```tsx
<FreetextHighlight
  highlight={highlight}
  isScrolledTo={isScrolledTo}
  onChange={(boundingRect) => {
    // Save new position
    editHighlight(highlight.id, {
      position: {
        boundingRect: viewportToScaled(boundingRect),
        rects: [],
      },
    });
  }}
  onTextChange={(newText) => {
    // Save new text
    editHighlight(highlight.id, {
      content: { text: newText },
    });
  }}
  onEditStart={() => toggleEditInProgress(true)}
  onEditEnd={() => toggleEditInProgress(false)}
  color="#333333"
  backgroundColor="#ffffc8"
  fontFamily="inherit"
  fontSize="14px"
/>
```

---

## PdfHighlighter Props (Freetext-related)

### enableFreetextCreation

```typescript
enableFreetextCreation?(event: MouseEvent): boolean;
```

Condition to check before a freetext annotation click is registered.
When this returns `true`, clicking on the PDF will create a freetext annotation.

**Example:**
```tsx
<PdfHighlighter
  enableFreetextCreation={() => freetextMode}
  // ...
/>
```

### onFreetextClick

```typescript
onFreetextClick?(position: ScaledPosition): void;
```

Callback triggered when user clicks to create a freetext annotation.
Provides the scaled position where the click occurred.

**Example:**
```tsx
const handleFreetextClick = (position: ScaledPosition) => {
  const newHighlight = {
    id: generateId(),
    type: "freetext",
    position,
    content: { text: "New note" },
  };
  setHighlights([newHighlight, ...highlights]);
};

<PdfHighlighter
  onFreetextClick={handleFreetextClick}
  // ...
/>
```

---

## Types

### HighlightType

```typescript
type HighlightType = "text" | "area" | "freetext";
```

The type of highlight. Use this to determine which component to render:
- `"text"` - TextHighlight for selected text
- `"area"` - AreaHighlight for rectangular regions
- `"freetext"` - FreetextHighlight for text annotations

### LTWHP

```typescript
type LTWHP = {
  left: number;    // X coordinate of top-left
  top: number;     // Y coordinate of top-left
  width: number;   // Width of rectangle
  height: number;  // Height of rectangle
  pageNumber: number;  // 1-indexed page number
};
```

A rectangle as measured by the viewport, including page number.

### ScaledPosition

```typescript
type ScaledPosition = {
  boundingRect: Scaled;
  rects: Array<Scaled>;
  usePdfCoordinates?: boolean;
};
```

Position of a highlight with normalized coordinates.
Suitable for storage and retrieval across different viewport sizes.

### ViewportHighlight

```typescript
type ViewportHighlight<T extends Highlight = Highlight> = Omit<T, "position"> & {
  position: ViewportPosition;
};
```

A highlight with position converted to viewport coordinates for rendering.
