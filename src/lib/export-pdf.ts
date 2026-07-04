import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import type { Scaled, ScaledPosition, ShapeData } from "../types";

/**
 * Options for the PDF export function.
 *
 * @category Type
 */
export interface ExportPdfOptions {
  /** Default color for text highlights. Default: "rgba(255, 226, 143, 0.5)" */
  textHighlightColor?: string;
  /** Default color for area highlights. Default: "rgba(255, 226, 143, 0.5)" */
  areaHighlightColor?: string;
  /** Default text color for freetext. Default: "#333333" */
  defaultFreetextColor?: string;
  /** Default background for freetext. Default: "#ffffc8" */
  defaultFreetextBgColor?: string;
  /** Default font size for freetext. Default: 14 */
  defaultFreetextFontSize?: number;
  /** Progress callback for large PDFs */
  onProgress?: (current: number, total: number) => void;
}

/**
 * A highlight that can be exported to PDF.
 *
 * @category Type
 */
export interface ExportableHighlight {
  id: string;
  type?: "text" | "area" | "freetext" | "image" | "drawing" | "shape";
  content?: {
    text?: string;
    image?: string; // Base64 data URL
    shape?: ShapeData; // Shape data for shape highlights
  };
  position: ScaledPosition;
  /** Per-highlight color override (for text/area highlights) */
  highlightColor?: string;
  /** Style mode for text highlights: "highlight" (default), "underline", or "strikethrough" */
  highlightStyle?: "highlight" | "underline" | "strikethrough";
  /** Text color for freetext highlights */
  color?: string;
  /** Background color for freetext highlights */
  backgroundColor?: string;
  /** Font size for freetext highlights */
  fontSize?: string;
  /** Font family for freetext highlights (not used in export, Helvetica is always used) */
  fontFamily?: string;
  /** Shape type for shape highlights */
  shapeType?: "rectangle" | "circle" | "arrow";
  /** Stroke color for shape highlights */
  strokeColor?: string;
  /** Stroke width for shape highlights */
  strokeWidth?: number;
}

/**
 * Parse a color string to RGB values (0-1 range).
 */
function parseColor(color: string): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  // Handle rgba(r, g, b, a) and rgb(r, g, b)
  const rgbaMatch = color.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
  );
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]) / 255,
      g: parseInt(rgbaMatch[2]) / 255,
      b: parseInt(rgbaMatch[3]) / 255,
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // Handle hex (#RRGGBB or #RGB)
  const hex = color.replace("#", "");
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16) / 255,
      g: parseInt(hex[1] + hex[1], 16) / 255,
      b: parseInt(hex[2] + hex[2], 16) / 255,
      a: 1,
    };
  }
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: 1,
    };
  }

  // Default yellow
  return { r: 1, g: 0.89, b: 0.56, a: 0.5 };
}

/**
 * Convert ScaledPosition coordinates to PDF points.
 * PDF coordinate system has origin at bottom-left.
 */
function scaledToPdfPoints(
  scaled: Scaled,
  page: PDFPage
): { x: number; y: number; width: number; height: number } {
  const pdfWidth = page.getWidth();
  const pdfHeight = page.getHeight();

  // Calculate position ratios
  const xRatio = pdfWidth / scaled.width;
  const yRatio = pdfHeight / scaled.height;

  const x = scaled.x1 * xRatio;
  const width = (scaled.x2 - scaled.x1) * xRatio;
  const height = (scaled.y2 - scaled.y1) * yRatio;

  // Flip Y (PDF origin is bottom-left, screen origin is top-left)
  const y = pdfHeight - scaled.y1 * yRatio - height;

  return { x, y, width, height };
}

/**
 * Convert base64 data URL to bytes.
 */
function dataUrlToBytes(dataUrl: string): {
  bytes: Uint8Array;
  type: "png" | "jpg";
} {
  const base64 = dataUrl.split(",")[1];
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  const type = dataUrl.includes("image/png") ? "png" : "jpg";
  return { bytes, type };
}

/**
 * Detect the encoded image format from a data URL's MIME type.
 * pdf-lib can embed PNG and JPEG directly; anything else (notably SVG) must be
 * rasterized to PNG first.
 */
function dataUrlFormat(dataUrl: string): "png" | "jpg" | "other" {
  const mime = dataUrl.slice(5, dataUrl.indexOf(";")).toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  return "other";
}

/**
 * Corner radius (in PDF points) baked into exported image/drawing highlights so
 * they match the rounded `--rphp-radius: 9px` box used in the on-screen preview.
 */
const CONTENT_RADIUS_PT = 9;

/** Trace a rounded-rectangle subpath (fallback for browsers without ctx.roundRect). */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(w, 0, w, h, radius);
  ctx.arcTo(w, h, 0, h, radius);
  ctx.arcTo(0, h, 0, 0, radius);
  ctx.arcTo(0, 0, w, 0, radius);
  ctx.closePath();
}

/**
 * Composite an image/drawing highlight onto an offscreen canvas exactly as the
 * preview renders it, then return PNG bytes for pdf-lib to embed. This does
 * three things the old raw-embed path couldn't:
 *
 *  1. Handles SVG/WebP/etc. — the previous code blindly fed non-PNG to embedJpg,
 *     failing with "SOI not found in JPEG" and dropping the image.
 *  2. Bakes in the rounded corners (`--rphp-radius`) so export matches preview.
 *  3. Applies the correct object-fit — `fill` for images (stretch to box),
 *     `contain` for drawings (keep aspect, centered on a white backing) — so a
 *     drawing whose aspect differs from its box is no longer distorted.
 *
 * The canvas is sized to the box's aspect ratio, so the caller draws it filling
 * the box (rotation handling unchanged). Requires a DOM; returns null
 * server-side so the caller can fall back to a direct embed.
 *
 * @param boxWidthPts / boxHeightPts - Box size in PDF points, used for aspect
 *   ratio, raster resolution, and radius scaling.
 */
async function compositeHighlightImageToPng(
  dataUrl: string,
  boxWidthPts: number,
  boxHeightPts: number,
  opts: { fit: "fill" | "contain"; background?: string },
): Promise<Uint8Array | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return null;
  }

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
  if (!img) return null;

  // Render at 2× the box size (in points) so the baked-in result stays crisp
  // when embedded and scaled back to the box.
  const scale = 2;
  const cw = Math.max(1, Math.round(boxWidthPts * scale));
  const ch = Math.max(1, Math.round(boxHeightPts * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Clip everything to the rounded box so corners are transparent (page shows
  // through), matching the preview's `overflow: hidden` rounded content box.
  roundedRectPath(ctx, cw, ch, CONTENT_RADIUS_PT * scale);
  ctx.clip();

  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, cw, ch);
  }

  const iw = img.naturalWidth || cw;
  const ih = img.naturalHeight || ch;

  if (opts.fit === "contain") {
    const s = Math.min(cw / iw, ch / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  } else {
    ctx.drawImage(img, 0, 0, cw, ch);
  }

  return dataUrlToBytes(canvas.toDataURL("image/png")).bytes;
}

/**
 * Draw a filled rounded rectangle. pdf-lib has no rounded-rect primitive, so
 * this builds an SVG path and draws it via drawSvgPath. Matches the preview's
 * `--rphp-radius: 9px` rounded highlight/area/freetext boxes, which the old
 * drawRectangle calls rendered with sharp corners.
 *
 * @param x, y - Bottom-left of the box in PDF points (Y up, as elsewhere here).
 */
function drawRoundedRectangle(
  page: PDFPage,
  o: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: ReturnType<typeof rgb>;
    opacity: number;
    radius: number;
  }
): void {
  const r = Math.max(0, Math.min(o.radius, o.width / 2, o.height / 2));
  if (r <= 0) {
    page.drawRectangle({
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      color: o.color,
      opacity: o.opacity,
    });
    return;
  }
  const { width: w, height: h } = o;
  // Path is in SVG space (origin top-left, Y down). drawSvgPath anchors SVG
  // (0,0) at the given (x, y), so pass the box's TOP edge (o.y + h) as y.
  const path =
    `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} ` +
    `V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} ` +
    `H ${r} A ${r} ${r} 0 0 1 0 ${h - r} ` +
    `V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(path, {
    x: o.x,
    y: o.y + h,
    color: o.color,
    opacity: o.opacity,
  });
}

/**
 * Wrap text into multiple lines that fit within maxWidth.
 * Long words are broken character by character (like CSS word-wrap: break-word).
 */
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  if (!text || maxWidth <= 0) return [];

  const lines: string[] = [];

  // Split by newlines first to preserve intentional line breaks
  const paragraphs = text.split(/\n/);

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        // Push current line if exists
        if (currentLine) {
          lines.push(currentLine);
          currentLine = "";
        }

        // Check if word itself is too wide - break it character by character
        if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
          let remaining = word;
          while (remaining.length > 0) {
            let charCount = 1;
            // Find how many characters fit in maxWidth
            while (
              charCount < remaining.length &&
              font.widthOfTextAtSize(remaining.substring(0, charCount + 1), fontSize) <= maxWidth
            ) {
              charCount++;
            }
            const chunk = remaining.substring(0, charCount);
            remaining = remaining.substring(charCount);

            if (remaining.length > 0) {
              // More characters remaining, push this chunk as a complete line
              lines.push(chunk);
            } else {
              // Last chunk, keep it as current line (may combine with next word)
              currentLine = chunk;
            }
          }
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

/**
 * Group highlights by page number.
 */
function groupByPage(
  highlights: ExportableHighlight[]
): Map<number, ExportableHighlight[]> {
  const map = new Map<number, ExportableHighlight[]>();
  for (const h of highlights) {
    const pageNum = h.position.boundingRect.pageNumber;
    if (!map.has(pageNum)) map.set(pageNum, []);
    map.get(pageNum)!.push(h);
  }
  return map;
}

/**
 * Render a text highlight (multiple rectangles for multi-line selections).
 * Supports highlight (background), underline, and strikethrough styles.
 */
async function renderTextHighlight(
  page: PDFPage,
  highlight: ExportableHighlight,
  options: ExportPdfOptions
): Promise<void> {
  // Per-highlight color override or fallback to default
  const colorStr =
    highlight.highlightColor ||
    options.textHighlightColor ||
    "rgba(255, 226, 143, 0.5)";
  const color = parseColor(colorStr);
  const highlightStyle = highlight.highlightStyle || "highlight";

  // Text highlights use rects array for multi-line selections
  const rects =
    highlight.position.rects.length > 0
      ? highlight.position.rects
      : [highlight.position.boundingRect];

  for (const rect of rects) {
    const { x, y, width, height } = scaledToPdfPoints(rect, page);

    if (highlightStyle === "highlight") {
      // Draw filled rounded rectangle for background highlight (rounded to
      // match the preview's `--rphp-radius` highlight parts; clamps to a pill
      // on short rects).
      drawRoundedRectangle(page, {
        x,
        y,
        width,
        height,
        color: rgb(color.r, color.g, color.b),
        opacity: color.a,
        radius: CONTENT_RADIUS_PT,
      });
    } else if (highlightStyle === "underline") {
      // Draw line at bottom of rectangle
      const lineThickness = Math.max(1, height * 0.1);
      page.drawRectangle({
        x,
        y,
        width,
        height: lineThickness,
        color: rgb(color.r, color.g, color.b),
        opacity: color.a,
      });
    } else if (highlightStyle === "strikethrough") {
      // Draw line through middle of rectangle
      const lineThickness = Math.max(1, height * 0.1);
      const lineY = y + height / 2 - lineThickness / 2;
      page.drawRectangle({
        x,
        y: lineY,
        width,
        height: lineThickness,
        color: rgb(color.r, color.g, color.b),
        opacity: color.a,
      });
    }
  }
}

/**
 * Render an area highlight (single rectangle).
 */
async function renderAreaHighlight(
  page: PDFPage,
  highlight: ExportableHighlight,
  options: ExportPdfOptions
): Promise<void> {
  // Per-highlight color override or fallback to default
  const colorStr =
    highlight.highlightColor ||
    options.areaHighlightColor ||
    "rgba(255, 226, 143, 0.5)";
  const color = parseColor(colorStr);
  const { x, y, width, height } = scaledToPdfPoints(
    highlight.position.boundingRect,
    page
  );

  drawRoundedRectangle(page, {
    x,
    y,
    width,
    height,
    color: rgb(color.r, color.g, color.b),
    opacity: color.a,
    radius: CONTENT_RADIUS_PT,
  });
}

/**
 * Render a freetext highlight (background rectangle + text).
 * Text is wrapped to fit within the box.
 */
async function renderFreetextHighlight(
  page: PDFPage,
  highlight: ExportableHighlight,
  options: ExportPdfOptions,
  font: PDFFont
): Promise<void> {
  const text = highlight.content?.text || "";
  const textColor = parseColor(
    highlight.color || options.defaultFreetextColor || "#333333"
  );

  // Get box dimensions in PDF points
  const { x, y, width, height } = scaledToPdfPoints(
    highlight.position.boundingRect,
    page
  );

  // Scale font size by the same ratio used for the box coordinates
  // This ensures the font scales proportionally with the box
  const pdfHeight = page.getHeight();
  const yRatio = pdfHeight / highlight.position.boundingRect.height;
  const storedFontSize =
    parseInt(highlight.fontSize || "") || options.defaultFreetextFontSize || 14;
  const fontSize = storedFontSize * yRatio;

  console.log("Freetext export:", {
    storedFontSize,
    yRatio,
    fontSize,
    boxDimensions: { x, y, width, height },
    text: text.substring(0, 50),
  });

  // Draw background (skip if transparent)
  const bgColorValue = highlight.backgroundColor || options.defaultFreetextBgColor || "#ffffc8";
  if (bgColorValue !== "transparent") {
    const bgColor = parseColor(bgColorValue);
    drawRoundedRectangle(page, {
      x,
      y,
      width,
      height,
      color: rgb(bgColor.r, bgColor.g, bgColor.b),
      opacity: bgColor.a,
      radius: CONTENT_RADIUS_PT,
    });
  }

  // Draw wrapped text with scaled padding
  const padding = 4 * yRatio;
  const maxWidth = width - padding * 2;
  const lineHeight = fontSize * 1.3;

  if (maxWidth > 0 && text) {
    const lines = wrapText(text, font, fontSize, maxWidth);
    let currentY = y + height - fontSize - padding;

    for (const line of lines) {
      // Stop if we've run out of vertical space
      if (currentY < y + padding) break;

      // Skip empty lines but still move down
      if (line.trim()) {
        page.drawText(line, {
          x: x + padding,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(textColor.r, textColor.g, textColor.b),
        });
      }

      currentY -= lineHeight;
    }
  }
}

/**
 * Transform visual coordinates to raw MediaBox coordinates.
 * pdf-lib's drawImage uses raw MediaBox space, but our coordinates are in visual space.
 */
function transformToRawCoordinates(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  const rotation = page.getRotation().angle;
  const pageWidth = page.getWidth(); // Visual width
  const pageHeight = page.getHeight(); // Visual height

  if (rotation === 90) {
    // Visual (x, y) → Raw MediaBox coordinates
    // When rotated 90° CCW, visual top-left maps to raw bottom-left
    return {
      x: y,
      y: pageWidth - x - width,
      width: height,
      height: width,
    };
  } else if (rotation === 180) {
    // Rotated 180°, origin flips to opposite corner
    return {
      x: pageWidth - x - width,
      y: pageHeight - y - height,
      width,
      height,
    };
  } else if (rotation === 270) {
    // When rotated 90° CW (270° CCW)
    return {
      x: pageHeight - y - height,
      y: x,
      width: height,
      height: width,
    };
  }

  // No rotation - coordinates are already correct
  return { x, y, width, height };
}

/**
 * Render an image or drawing highlight (embedded image).
 * Handles page rotation by transforming visual coordinates to raw MediaBox space.
 * The image is composited to match the preview's rounded, white-backed content
 * box before embedding, so corners, backing, and aspect-fit all line up.
 *
 * @param kind - "image" fills the box (object-fit: fill, like a photo tile);
 *   "drawing" fits inside keeping aspect (object-fit: contain) on a white
 *   backing, matching each type's CSS in the preview.
 */
async function renderImageHighlight(
  pdfDoc: PDFDocument,
  page: PDFPage,
  highlight: ExportableHighlight,
  kind: "image" | "drawing" = "image"
): Promise<void> {
  const imageDataUrl = highlight.content?.image;
  if (!imageDataUrl) return;

  try {
    // Calculate coordinates in visual space - use full bounding box dimensions
    const visualCoords = scaledToPdfPoints(
      highlight.position.boundingRect,
      page
    );

    // Composite to a PNG that bakes in the preview's rounded corners and
    // per-type object-fit. No background fill: signatures and drawings are
    // transparent-PNG ink, so they read as ink-only over the page — matching
    // shape highlights (rectangle/arrow), which are stroke-only on a
    // transparent background. Opaque photos still cover their box on their own.
    // Falls back to a direct embed when no canvas is available (e.g.
    // server-side) — sharp corners, but never drops the image (and still
    // rasterizes SVG, which pdf-lib can't embed itself).
    let image;
    const pngBytes = await compositeHighlightImageToPng(
      imageDataUrl,
      visualCoords.width,
      visualCoords.height,
      { fit: kind === "drawing" ? "contain" : "fill" }
    );
    if (pngBytes) {
      image = await pdfDoc.embedPng(pngBytes);
    } else {
      const format = dataUrlFormat(imageDataUrl);
      if (format === "png") {
        image = await pdfDoc.embedPng(dataUrlToBytes(imageDataUrl).bytes);
      } else if (format === "jpg") {
        image = await pdfDoc.embedJpg(dataUrlToBytes(imageDataUrl).bytes);
      } else {
        console.error("Cannot embed image: unsupported format and no canvas to rasterize");
        return;
      }
    }

    // Transform to raw MediaBox coordinates based on page rotation
    const rawCoords = transformToRawCoordinates(
      page,
      visualCoords.x,
      visualCoords.y,
      visualCoords.width,
      visualCoords.height
    );

    console.log("Image export:", {
      rotation: page.getRotation().angle,
      visualCoords,
      rawCoords,
    });

    // Draw image filling the entire bounding box
    page.drawImage(image, {
      x: rawCoords.x,
      y: rawCoords.y,
      width: rawCoords.width,
      height: rawCoords.height,
    });
  } catch (error) {
    console.error("Failed to embed image:", error);
  }
}

/**
 * Render a shape highlight (rectangle, circle, or arrow).
 */
async function renderShapeHighlight(
  page: PDFPage,
  highlight: ExportableHighlight
): Promise<void> {
  // Get shape data from content or top-level properties
  const shapeType = highlight.content?.shape?.shapeType || highlight.shapeType || "rectangle";
  const strokeColorStr = highlight.content?.shape?.strokeColor || highlight.strokeColor || "#000000";
  const strokeWidth = highlight.content?.shape?.strokeWidth || highlight.strokeWidth || 2;

  const color = parseColor(strokeColorStr);
  const { x, y, width, height } = scaledToPdfPoints(
    highlight.position.boundingRect,
    page
  );

  switch (shapeType) {
    case "rectangle":
      page.drawRectangle({
        x,
        y,
        width,
        height,
        borderColor: rgb(color.r, color.g, color.b),
        borderWidth: strokeWidth,
        opacity: color.a,
      });
      break;

    case "circle":
      page.drawEllipse({
        x: x + width / 2,
        y: y + height / 2,
        xScale: width / 2,
        yScale: height / 2,
        borderColor: rgb(color.r, color.g, color.b),
        borderWidth: strokeWidth,
        opacity: color.a,
      });
      break;

    case "arrow": {
      // Use stored start/end points if available, otherwise default to left-to-right
      const startPt = highlight.content?.shape?.startPoint;
      const endPt = highlight.content?.shape?.endPoint;

      // Calculate actual coordinates
      // Note: PDF coordinates have Y going up, so we need to flip the Y
      const startX = startPt ? x + startPt.x * width : x;
      const startY = startPt ? y + (1 - startPt.y) * height : y + height / 2;
      const endX = endPt ? x + endPt.x * width : x + width;
      const endY = endPt ? y + (1 - endPt.y) * height : y + height / 2;

      // Draw the main line
      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        color: rgb(color.r, color.g, color.b),
        thickness: strokeWidth,
        opacity: color.a,
      });

      // Calculate arrowhead direction
      const angle = Math.atan2(endY - startY, endX - startX);
      const arrowSize = Math.min(15, width * 0.2, height * 0.4);
      const arrowAngle = Math.PI / 6; // 30 degrees

      // Draw arrowhead (two lines forming a V at the end)
      page.drawLine({
        start: {
          x: endX - arrowSize * Math.cos(angle - arrowAngle),
          y: endY - arrowSize * Math.sin(angle - arrowAngle),
        },
        end: { x: endX, y: endY },
        color: rgb(color.r, color.g, color.b),
        thickness: strokeWidth,
        opacity: color.a,
      });
      page.drawLine({
        start: {
          x: endX - arrowSize * Math.cos(angle + arrowAngle),
          y: endY - arrowSize * Math.sin(angle + arrowAngle),
        },
        end: { x: endX, y: endY },
        color: rgb(color.r, color.g, color.b),
        thickness: strokeWidth,
        opacity: color.a,
      });
      break;
    }
  }
}

/**
 * Export a PDF with annotations embedded.
 *
 * @param pdfSource - The source PDF as a URL string, Uint8Array, or ArrayBuffer
 * @param highlights - Array of highlights to embed in the PDF
 * @param options - Export options for customizing colors and behavior
 * @returns Promise<Uint8Array> - The modified PDF as bytes
 *
 * @example
 * ```typescript
 * const pdfBytes = await exportPdf(pdfUrl, highlights, {
 *   textHighlightColor: "rgba(255, 255, 0, 0.4)",
 *   onProgress: (current, total) => console.log(`${current}/${total} pages`)
 * });
 *
 * // Download the file
 * const blob = new Blob([pdfBytes], { type: "application/pdf" });
 * const url = URL.createObjectURL(blob);
 * const a = document.createElement("a");
 * a.href = url;
 * a.download = "annotated.pdf";
 * a.click();
 * URL.revokeObjectURL(url);
 * ```
 *
 * @category Function
 */
export async function exportPdf(
  pdfSource: string | Uint8Array | ArrayBuffer,
  highlights: ExportableHighlight[],
  options: ExportPdfOptions = {}
): Promise<Uint8Array> {
  // Load PDF
  let pdfBytes: ArrayBuffer;
  if (typeof pdfSource === "string") {
    const response = await fetch(pdfSource);
    pdfBytes = await response.arrayBuffer();
  } else {
    pdfBytes =
      pdfSource instanceof Uint8Array
        ? pdfSource.buffer.slice(
            pdfSource.byteOffset,
            pdfSource.byteOffset + pdfSource.byteLength
          )
        : pdfSource;
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Group by page and render
  const byPage = groupByPage(highlights);
  const totalPages = byPage.size;
  let currentPage = 0;

  for (const [pageNum, pageHighlights] of byPage) {
    const page = pages[pageNum - 1]; // 1-indexed to 0-indexed
    if (!page) continue;

    for (const highlight of pageHighlights) {
      switch (highlight.type) {
        case "text":
          await renderTextHighlight(page, highlight, options);
          break;
        case "area":
          await renderAreaHighlight(page, highlight, options);
          break;
        case "freetext":
          await renderFreetextHighlight(page, highlight, options, font);
          break;
        case "image":
          await renderImageHighlight(pdfDoc, page, highlight);
          break;
        case "drawing":
          // Drawings are stored as PNG images, reuse image highlight rendering
          // but with contain-fit so an ink drawing keeps its aspect ratio.
          await renderImageHighlight(pdfDoc, page, highlight, "drawing");
          break;
        case "shape":
          await renderShapeHighlight(page, highlight);
          break;
        default:
          // Default to area highlight for backwards compatibility
          await renderAreaHighlight(page, highlight, options);
      }
    }

    currentPage++;
    options.onProgress?.(currentPage, totalPages);
  }

  return pdfDoc.save();
}
