import type { LTWH } from "../types";

const intersects = (a: LTWH, b: LTWH) =>
  a.left < b.left + b.width &&
  a.left + a.width > b.left &&
  a.top < b.top + b.height &&
  a.top + a.height > b.top;

export const copyTextToClipboard = async (text: string) => {
  if (!text) return;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

export const extractTextFromHighlightRect = (
  anchor: HTMLElement,
  rect: LTWH,
) => {
  const page = anchor.closest(".page") as HTMLElement | null;
  const textLayer = page?.querySelector(".textLayer");

  if (!page || !textLayer) return "";

  const pageRect = page.getBoundingClientRect();
  const targetRect: LTWH = {
    left: pageRect.left + rect.left,
    top: pageRect.top + rect.top,
    width: rect.width,
    height: rect.height,
  };

  const matches = Array.from(textLayer.querySelectorAll("span"))
    .map((span) => {
      const spanRect = span.getBoundingClientRect();

      return {
        text: span.textContent || "",
        rect: {
          left: spanRect.left,
          top: spanRect.top,
          width: spanRect.width,
          height: spanRect.height,
        },
      };
    })
    .filter(({ text, rect }) => text.trim() && intersects(rect, targetRect))
    .sort((a, b) => {
      const lineDelta = a.rect.top - b.rect.top;
      return Math.abs(lineDelta) > 4 ? lineDelta : a.rect.left - b.rect.left;
    });

  return matches
    .map(({ text }) => text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};
