import { getDocument } from "./pdfjs-dom";

export const findOrCreateHighlightConfigLayer = (anchor: HTMLElement) => {
  const pageLayer = anchor.closest(".page") as HTMLElement | null;

  if (!pageLayer) return null;

  const doc = getDocument(pageLayer);
  let layer = Array.from(pageLayer.children).find((child) =>
    child.classList.contains("PdfHighlighter__config-layer"),
  ) as HTMLElement | undefined;

  if (!layer) {
    layer = doc.createElement("div");
    layer.className = "PdfHighlighter__config-layer";
    pageLayer.appendChild(layer);
  }

  return layer;
};
