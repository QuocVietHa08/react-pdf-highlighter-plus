import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import type { Scaled, ScaledPosition } from "../types";

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
  type?: "text" | "area" | "freetext" | "image" | "drawing";
  content?: {
    text?: string;
    image?: string; // Base64 data URL
  };
  position: ScaledPosition;
  /** Per-highlight color override (for text/area highlights) */
  highlightColor?: string;
  /** Text color for freetext highlights */
  color?: string;
  /** Background color for freetext highlights */
  backgroundColor?: string;
  /** Font size for freetext highlights */
  fontSize?: string;
  /** Font family for freetext highlights (not used in export, Helvetica is always used) */
  fontFamily?: string;
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

  // Text highlights use rects array for multi-line selections
  const rects =
    highlight.position.rects.length > 0
      ? highlight.position.rects
      : [highlight.position.boundingRect];

  for (const rect of rects) {
    const { x, y, width, height } = scaledToPdfPoints(rect, page);
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: rgb(color.r, color.g, color.b),
      opacity: color.a,
    });
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

  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(color.r, color.g, color.b),
    opacity: color.a,
  });
}

/**
 * Render a freetext highlight (background rectangle + text).
 * Text is truncated if it doesn't fit.
 */
async function renderFreetextHighlight(
  page: PDFPage,
  highlight: ExportableHighlight,
  options: ExportPdfOptions,
  font: PDFFont
): Promise<void> {
  const text = highlight.content?.text || "";
  const bgColor = parseColor(
    highlight.backgroundColor || options.defaultFreetextBgColor || "#ffffc8"
  );
  const textColor = parseColor(
    highlight.color || options.defaultFreetextColor || "#333333"
  );
  const fontSize =
    parseInt(highlight.fontSize || "") || options.defaultFreetextFontSize || 14;

  const { x, y, width, height } = scaledToPdfPoints(
    highlight.position.boundingRect,
    page
  );

  // Draw background
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(bgColor.r, bgColor.g, bgColor.b),
    opacity: bgColor.a,
  });

  // Draw text with padding (truncate if too long)
  const padding = 4;
  const maxWidth = width - padding * 2;

  if (maxWidth > 0 && text) {
    page.drawText(text, {
      x: x + padding,
      y: y + height - fontSize - padding,
      size: fontSize,
      font,
      color: rgb(textColor.r, textColor.g, textColor.b),
      maxWidth: maxWidth,
    });
  }
}

/**
 * Render an image highlight (embedded image).
 */
async function renderImageHighlight(
  pdfDoc: PDFDocument,
  page: PDFPage,
  highlight: ExportableHighlight
): Promise<void> {
  const imageDataUrl = highlight.content?.image;
  if (!imageDataUrl) return;

  try {
    const { bytes, type } = dataUrlToBytes(imageDataUrl);
    const image =
      type === "png"
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes);

    const { x, y, width, height } = scaledToPdfPoints(
      highlight.position.boundingRect,
      page
    );

    page.drawImage(image, { x, y, width, height });
  } catch (error) {
    console.error("Failed to embed image:", error);
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
          await renderImageHighlight(pdfDoc, page, highlight);
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
