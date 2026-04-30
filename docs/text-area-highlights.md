# Text and Area Highlights

Text and area highlights share the same rendering model:

- Highlight geometry renders in `.PdfHighlighter__highlight-layer` so it stays aligned with the PDF.js text layer.
- Toolbar controls render in `.PdfHighlighter__config-layer` so controls stay above PDF content.
- Copy buttons copy text and briefly change to a check icon after success.

## Text Highlights

`TextHighlight` renders one rectangle per selected text span. It supports background highlight, underline, and strikethrough styles.

```tsx
<TextHighlight
  highlight={highlight}
  isScrolledTo={isScrolledTo}
  highlightColor={highlight.highlightColor}
  highlightStyle={highlight.highlightStyle}
  copyText={highlight.content?.text}
/>
```

## Area Highlights

`AreaHighlight` renders a draggable and resizable rectangular annotation.

```tsx
<AreaHighlight
  highlight={highlight}
  isScrolledTo={isScrolledTo}
  bounds={highlightBindings.textLayer}
  copyText={highlight.content?.text}
  onChange={(rect) => {
    editHighlight(highlight.id, {
      position: {
        boundingRect: viewportToScaled(rect),
        rects: [],
      },
    });
  }}
/>
```

## Copy Logic

Text highlights copy `highlight.content.text` when available.

Area highlights copy `highlight.content.text` when available. If no text is stored, the component looks at PDF.js `.textLayer` spans that intersect the area rectangle, reconstructs the visible text, and copies that text.

After copying succeeds, the copy icon changes to a check icon for `1.5s`.
