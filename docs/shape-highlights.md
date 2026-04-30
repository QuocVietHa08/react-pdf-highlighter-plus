# Shape Highlights

Shape highlights support rectangles, circles, and arrows.

## Creation

`PdfHighlighter` uses `enableShapeMode` to decide whether shape creation is active.

```tsx
<PdfHighlighter
  enableShapeMode={shapeMode} // "rectangle" | "circle" | "arrow" | null
  onShapeComplete={(position, shape) => {
    addHighlight({
      id: getNextId(),
      type: "shape",
      position,
      content: { shape },
    });
  }}
  shapeStrokeColor="#000000"
  shapeStrokeWidth={2}
>
  <HighlightContainer />
</PdfHighlighter>
```

`ShapeCanvas` tracks pointer start and end positions, creates a scaled bounding rectangle, and stores shape metadata.

## Rendering

`ShapeHighlight` renders the shape as SVG:

- rectangle uses `<rect>`
- circle uses `<ellipse>`
- arrow uses `<line>` and an SVG marker

Shape geometry renders in `.PdfHighlighter__highlight-layer` so it stays aligned with PDF coordinates.

## Controls

The shape toolbar and style panel render in `.PdfHighlighter__config-layer`. This keeps the controls above PDF content without changing the shape geometry layer.

```tsx
<ShapeHighlight
  highlight={highlight}
  shapeType={highlight.content?.shape?.shapeType}
  strokeColor={highlight.content?.shape?.strokeColor}
  strokeWidth={highlight.content?.shape?.strokeWidth}
  onStyleChange={(style) => editHighlight(highlight.id, style)}
/>
```
