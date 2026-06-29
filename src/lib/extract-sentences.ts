import type { PDFDocumentProxy, PageViewport } from "pdfjs-dist";
import type { Highlight, LTWHP, ScaledPosition } from "../types";
import getBoundingRect from "./get-bounding-rect";
import { viewportToScaled } from "./coordinates";

type PdfTextContentItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

export type PdfTextItem = {
  text: string;
  index: number;
  pageNumber: number;
  rect: LTWHP;
  fontName?: string;
  columnIndex?: number;
};

export type PdfTextColumn = {
  index: number;
  left: number;
  right: number;
  width: number;
  textItemIndexes: number[];
};

export type PdfExtractedPage = {
  pageNumber: number;
  width: number;
  height: number;
  textItems: PdfTextItem[];
  columns?: PdfTextColumn[];
};

export type PdfTextUnitType =
  | "paragraph"
  | "title"
  | "heading"
  | "author"
  | "affiliation"
  | "footnote"
  | "reference"
  | "unknown";

export type PdfTextUnit = {
  id: string;
  type: PdfTextUnitType;
  text: string;
  rawText: string;
  pageNumber: number;
  indexInPage: number;
  columnIndex?: number;
  position?: ScaledPosition;
  source?: {
    textItemIndexes: number[];
  };
};

export type PdfSentenceSource = {
  startOffset: number;
  endOffset: number;
  textItemIndexes: number[];
};

export type PdfSentence = {
  id: string;
  text: string;
  rawText: string;
  pageNumber: number;
  indexInPage: number;
  globalIndex: number;
  columnIndex?: number;
  position?: ScaledPosition;
  source?: PdfSentenceSource;
};

export type PdfReadingOrder = "auto" | "document" | "position";
export type PdfColumnDetection = "auto" | "none";

export type ExtractSentencesOptions = {
  pages?: "all" | number[];
  includePositions?: boolean;
  includeSources?: boolean;
  normalize?: boolean;
  locale?: string;
  idPrefix?: string;
  includeTextUnitTypes?: PdfTextUnitType[];
  readingOrder?: PdfReadingOrder;
  columnDetection?: PdfColumnDetection;
};

type ResolvedExtractSentencesOptions = Required<
  Omit<ExtractSentencesOptions, "includeTextUnitTypes">
> & {
  includeTextUnitTypes: PdfTextUnitType[];
};

type PageTextStream = {
  text: string;
  charItemIndexes: Array<number | null>;
};

type SentenceRange = {
  text: string;
  start: number;
  end: number;
};

const DEFAULT_OPTIONS: ResolvedExtractSentencesOptions = {
  pages: "all",
  includePositions: false,
  includeSources: false,
  normalize: true,
  locale: "en",
  idPrefix: "",
  includeTextUnitTypes: ["paragraph"],
  readingOrder: "auto",
  columnDetection: "auto",
};

const isTextItem = (item: unknown): item is PdfTextContentItem => {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as { str: unknown }).str === "string" &&
    "transform" in item &&
    Array.isArray((item as { transform: unknown }).transform)
  );
};

const shouldInsertSpace = (previous: string, next: string) => {
  if (!previous || !next) return false;
  if (/\s$/.test(previous) || /^\s/.test(next)) return false;
  if (/^[,.;:!?)]/.test(next)) return false;
  if (/[([{]$/.test(previous)) return false;
  return true;
};

const getLastNonWhitespace = (text: string) => {
  const match = text.match(/\S(?=\s*$)/);
  return match?.[0] ?? "";
};

type PdfTextItemTextKind =
  | "singleGlyph"
  | "wordLike"
  | "punctuation"
  | "space"
  | "other";

const getTrimmedChars = (text: string) => Array.from(text.trim());

const getItemTextKind = (text: string): PdfTextItemTextKind => {
  if (!text.trim()) return "space";
  if (/^[,.;:!?)\]}]+$/.test(text.trim())) return "punctuation";

  const chars = getTrimmedChars(text);

  if (chars.length === 1 && /[\p{L}\p{N}]/u.test(chars[0])) {
    return "singleGlyph";
  }

  if (/[\p{L}\p{N}]/u.test(text)) return "wordLike";

  return "other";
};

const getMedianGlyphWidth = (textItems: PdfTextItem[]) => {
  const glyphWidths = textItems
    .map((item) => {
      const textLength = Math.max(getTrimmedChars(item.text).length, 1);
      return item.rect.width / textLength;
    })
    .filter((width) => Number.isFinite(width) && width > 0)
    .sort((a, b) => a - b);

  if (glyphWidths.length === 0) return 0;

  return glyphWidths[Math.floor(glyphWidths.length / 2)];
};

const getHorizontalGap = (
  previousItem: PdfTextItem,
  nextItem: PdfTextItem,
  medianGlyphWidth: number,
) => {
  const previousRight = previousItem.rect.left + previousItem.rect.width;
  const gap = nextItem.rect.left - previousRight;
  const zeroTolerance = Math.max(medianGlyphWidth * 0.08, 0.35);

  return Math.abs(gap) <= zeroTolerance ? 0 : gap;
};

const shouldInsertSpaceBetweenItems = (
  previousItem: PdfTextItem | undefined,
  nextItem: PdfTextItem,
  currentText: string,
  averageHeight: number,
  medianGlyphWidth: number,
) => {
  if (!previousItem || !currentText || !nextItem.text) return false;
  if (/\s$/.test(currentText) || /^\s/.test(nextItem.text)) return false;

  const previousChar = getLastNonWhitespace(currentText);
  const nextChar = Array.from(nextItem.text.trim())[0] ?? "";
  const previousKind = getItemTextKind(previousItem.text);
  const nextKind = getItemTextKind(nextItem.text);

  if (!nextChar) return false;
  if (nextKind === "punctuation" || /^[,.;:!?)]/.test(nextChar)) return false;
  if (/[([{]$/.test(previousChar)) return false;

  const gap = getHorizontalGap(previousItem, nextItem, medianGlyphWidth);

  if (gap < 0) return false;

  const glyphWidth = Math.max(
    medianGlyphWidth,
    averageHeight * 0.18,
    1,
  );
  const singleGlyphPair = previousKind === "singleGlyph" && nextKind === "singleGlyph";

  if (singleGlyphPair) {
    return gap > Math.max(glyphWidth * 0.35, 1.0);
  }

  if (
    (previousKind === "wordLike" || previousKind === "singleGlyph") &&
    (nextKind === "wordLike" || nextKind === "singleGlyph")
  ) {
    return gap > Math.max(glyphWidth * 0.08, 0.35);
  }

  return shouldInsertSpace(currentText, nextItem.text);
};

const appendTextItem = (
  currentText: string,
  item: PdfTextItem,
  previousItem: PdfTextItem | undefined,
  averageHeight: number,
  medianGlyphWidth: number,
) => {
  return `${currentText}${
    shouldInsertSpaceBetweenItems(
      previousItem,
      item,
      currentText,
      averageHeight,
      medianGlyphWidth,
    )
      ? " "
      : ""
  }${item.text}`;
};

const getAverageItemHeight = (textItems: PdfTextItem[]) => {
  const heights = textItems
    .map((item) => item.rect.height)
    .filter((height) => height > 0)
    .sort((a, b) => a - b);

  if (heights.length === 0) return 0;

  return heights[Math.floor(heights.length / 2)];
};

const areTextItemsOnSameLine = (
  previous: PdfTextItem,
  next: PdfTextItem,
  averageHeight: number,
) => {
  const previousMiddle = previous.rect.top + previous.rect.height / 2;
  const nextMiddle = next.rect.top + next.rect.height / 2;
  const tolerance = Math.max(averageHeight * 0.45, 2);

  return Math.abs(previousMiddle - nextMiddle) <= tolerance;
};

const getTextItemRect = (
  item: PdfTextContentItem,
  viewport: PageViewport,
  pageNumber: number,
): LTWHP => {
  const [, , , , x, y] = item.transform;
  const width = Math.abs(item.width ?? 0);
  const height = Math.abs(item.height ?? 0);

  const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([
    x,
    y,
    x + width,
    y + height,
  ]);

  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
    pageNumber,
  };
};

const resolvePageNumbers = (
  pdfDocument: PDFDocumentProxy,
  pages: ExtractSentencesOptions["pages"],
) => {
  if (pages === "all" || pages === undefined) {
    return Array.from({ length: pdfDocument.numPages }, (_, index) => index + 1);
  }

  return [...new Set(pages)]
    .filter((pageNumber) => pageNumber >= 1 && pageNumber <= pdfDocument.numPages)
    .sort((a, b) => a - b);
};

const buildPageTextStream = (textItems: PdfTextItem[]): PageTextStream => {
  let text = "";
  const charItemIndexes: Array<number | null> = [];
  const averageHeight = getAverageItemHeight(textItems);
  const medianGlyphWidth = getMedianGlyphWidth(textItems);
  let previousItem: PdfTextItem | undefined;

  textItems.forEach((item) => {
    if (!item.text) return;

    if (
      shouldInsertSpaceBetweenItems(
        previousItem,
        item,
        text,
        averageHeight,
        medianGlyphWidth,
      )
    ) {
      text += " ";
      charItemIndexes.push(null);
    }

    for (const char of item.text) {
      text += char;
      charItemIndexes.push(item.index);
    }

    previousItem = item;
  });

  return { text, charItemIndexes };
};

const normalizePdfLigatures = (text: string) => {
  return text
    .replace(/ﬃ/g, "ffi")
    .replace(/ﬄ/g, "ffl")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/ﬀ/g, "ff");
};

const cleanupPdfHyphenSpacing = (text: string) => {
  return text.replace(
    /\b([\p{L}\p{N}]{2,})\s+-\s+([\p{L}\p{N}]{2,})\b/gu,
    "$1-$2",
  );
};

export const normalizePdfSentenceText = (text: string) => {
  return cleanupPdfHyphenSpacing(normalizePdfLigatures(text))
    .replace(/(\p{L}+)-\s+(\p{L}+)/gu, "$1-$2")
    .replace(/\[\s*([^\]]*?)\s*\]/g, (_, citation: string) => {
      const normalizedCitation = citation
        .replace(/\s*,\s*/g, ", ")
        .replace(/\s+/g, " ")
        .trim();

      return `[${normalizedCitation}]`;
    })
    .replace(/\s+/g, " ")
    .trim();
};

export const splitPdfSentences = (
  text: string,
  locale: string = DEFAULT_OPTIONS.locale,
): SentenceRange[] => {
  const segmenterConstructor = Intl.Segmenter;

  if (segmenterConstructor) {
    const segmenter = new segmenterConstructor(locale, {
      granularity: "sentence",
    });

    return Array.from(segmenter.segment(text))
      .map((segment) => ({
        text: segment.segment.trim(),
        start: segment.index + segment.segment.search(/\S/),
        end: segment.index + segment.segment.trimEnd().length,
      }))
      .filter((sentence) => sentence.text.length > 0 && sentence.start >= 0);
  }

  const ranges: SentenceRange[] = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (!/[.!?]/.test(char)) continue;

    const nextText = text.slice(index + 1);
    const nextNonSpace = nextText.match(/\S/);
    const nextChar = nextNonSpace?.[0] ?? "";
    const shouldSplit =
      nextChar === "" || /[A-Z([{"']/.test(nextChar);

    if (!shouldSplit) continue;

    const rawSentence = text.slice(start, index + 1);
    const leadingWhitespace = rawSentence.search(/\S/);
    const sentenceStart = start + Math.max(leadingWhitespace, 0);
    const sentenceText = rawSentence.trim();

    if (sentenceText) {
      ranges.push({
        text: sentenceText,
        start: sentenceStart,
        end: start + rawSentence.trimEnd().length,
      });
    }

    start = index + 1;
  }

  const finalRawSentence = text.slice(start);
  const leadingWhitespace = finalRawSentence.search(/\S/);
  const finalText = finalRawSentence.trim();

  if (finalText) {
    ranges.push({
      text: finalText,
      start: start + Math.max(leadingWhitespace, 0),
      end: start + finalRawSentence.trimEnd().length,
    });
  }

  return ranges;
};

const getSentenceTextItemIndexes = (
  charItemIndexes: Array<number | null>,
  start: number,
  end: number,
) => {
  const indexes = new Set<number>();

  for (let index = start; index < end; index += 1) {
    const itemIndex = charItemIndexes[index];
    if (itemIndex !== null && itemIndex !== undefined) {
      indexes.add(itemIndex);
    }
  }

  return Array.from(indexes).sort((a, b) => a - b);
};

const getScaledPosition = (
  textItems: PdfTextItem[],
  textItemIndexes: number[],
  page: PdfExtractedPage,
): ScaledPosition | undefined => {
  const indexSet = new Set(textItemIndexes);
  const rects = textItems
    .filter((item) => indexSet.has(item.index))
    .map((item) => item.rect)
    .filter((rect) => rect.width > 0 && rect.height > 0);

  if (rects.length === 0) return undefined;

  const boundingRect = getBoundingRect(rects);

  return {
    boundingRect: viewportToScaled(boundingRect, page),
    rects: rects.map((rect) => viewportToScaled(rect, page)),
  };
};

const getTextItemsPosition = (
  textItems: PdfTextItem[],
  textItemIndexes: number[],
  page: PdfExtractedPage,
  includePositions: boolean,
) => {
  return includePositions
    ? getScaledPosition(textItems, textItemIndexes, page)
    : undefined;
};

const getTextItemsBoundingRect = (textItems: PdfTextItem[]) => {
  const rects = textItems
    .map((item) => item.rect)
    .filter((rect) => rect.width > 0 && rect.height > 0);

  return rects.length > 0 ? getBoundingRect(rects) : undefined;
};

const getOrderedTextItems = (
  textItems: PdfTextItem[],
  readingOrder: PdfReadingOrder,
) => {
  if (readingOrder === "document") return [...textItems];

  const averageHeight = getAverageItemHeight(textItems);

  return [...textItems].sort((a, b) => {
    const topDelta = a.rect.top - b.rect.top;
    if (Math.abs(topDelta) > Math.max(averageHeight * 0.45, 2)) {
      return topDelta;
    }

    return a.rect.left - b.rect.left;
  });
};

const groupTextItemsIntoLines = (textItems: PdfTextItem[]) => {
  const averageHeight = getAverageItemHeight(textItems);
  const sortedItems = getOrderedTextItems(textItems, "position");
  const lines: PdfTextItem[][] = [];

  sortedItems.forEach((item) => {
    const currentLine = lines[lines.length - 1];
    const previousItem = currentLine?.[currentLine.length - 1];

    if (
      currentLine &&
      previousItem &&
      areTextItemsOnSameLine(previousItem, item, averageHeight)
    ) {
      currentLine.push(item);
      currentLine.sort((a, b) => a.rect.left - b.rect.left);
      return;
    }

    lines.push([item]);
  });

  return lines;
};

const isLikelyBodyTextItem = (item: PdfTextItem, page: PdfExtractedPage) => {
  const text = item.text.trim();
  if (!text) return false;
  if ((item.rect.top < page.height * 0.12 && page.pageNumber === 1) || item.rect.top > page.height * 0.88) {
    return false;
  }
  if (isLikelyFootnoteOrReference(text)) return false;
  return true;
};

const getColumnRanges = (textItems: PdfTextItem[], page: PdfExtractedPage) => {
  if (textItems.length < 24) return undefined;

  const minLeft = Math.min(...textItems.map((item) => item.rect.left));
  const maxRight = Math.max(
    ...textItems.map((item) => item.rect.left + item.rect.width),
  );
  const pageSpan = maxRight - minLeft;
  const binCount = 80;
  const bins = Array.from({ length: binCount }, () => 0);

  textItems.forEach((item) => {
    const left = item.rect.left;
    const right = item.rect.left + item.rect.width;
    const startBin = Math.max(
      0,
      Math.floor(((left - minLeft) / pageSpan) * binCount),
    );
    const endBin = Math.min(
      binCount - 1,
      Math.ceil(((right - minLeft) / pageSpan) * binCount),
    );

    for (let index = startBin; index <= endBin; index += 1) {
      bins[index] += 1;
    }
  });

  const centerStart = Math.floor(binCount * 0.35);
  const centerEnd = Math.ceil(binCount * 0.65);
  let bestGapStart = -1;
  let bestGapEnd = -1;
  let currentGapStart = -1;

  for (let index = centerStart; index <= centerEnd; index += 1) {
    if (bins[index] === 0) {
      if (currentGapStart === -1) currentGapStart = index;
      continue;
    }

    if (currentGapStart !== -1 && index - currentGapStart > bestGapEnd - bestGapStart) {
      bestGapStart = currentGapStart;
      bestGapEnd = index;
    }

    currentGapStart = -1;
  }

  if (
    currentGapStart !== -1 &&
    centerEnd + 1 - currentGapStart > bestGapEnd - bestGapStart
  ) {
    bestGapStart = currentGapStart;
    bestGapEnd = centerEnd + 1;
  }

  const gapBins = bestGapEnd - bestGapStart;
  const gapWidth = (gapBins / binCount) * pageSpan;
  const minGapWidth = Math.max(page.width * 0.035, 14);

  if (bestGapStart < 0 || gapWidth < minGapWidth) return undefined;

  const gapLeft = minLeft + (bestGapStart / binCount) * pageSpan;
  const gapRight = minLeft + (bestGapEnd / binCount) * pageSpan;
  const splitX = (gapLeft + gapRight) / 2;
  const leftItems = textItems.filter(
    (item) => item.rect.left + item.rect.width / 2 < splitX,
  );
  const rightItems = textItems.filter(
    (item) => item.rect.left + item.rect.width / 2 >= splitX,
  );

  if (leftItems.length < 10 || rightItems.length < 10) return undefined;

  const leftRange = {
    left: Math.min(...leftItems.map((item) => item.rect.left)),
    right: Math.max(...leftItems.map((item) => item.rect.left + item.rect.width)),
  };
  const rightRange = {
    left: Math.min(...rightItems.map((item) => item.rect.left)),
    right: Math.max(...rightItems.map((item) => item.rect.left + item.rect.width)),
  };
  const leftHeight = getAverageItemHeight(leftItems);
  const rightHeight = getAverageItemHeight(rightItems);

  if (
    leftHeight > 0 &&
    rightHeight > 0 &&
    Math.max(leftHeight, rightHeight) / Math.min(leftHeight, rightHeight) > 1.45
  ) {
    return undefined;
  }

  return [leftRange, rightRange];
};

const assignColumnsToPage = (
  page: PdfExtractedPage,
  columnDetection: PdfColumnDetection,
): PdfExtractedPage => {
  if (columnDetection === "none") {
    return {
      ...page,
      textItems: page.textItems.map((item) => ({ ...item, columnIndex: 0 })),
      columns: [
        {
          index: 0,
          left: 0,
          right: page.width,
          width: page.width,
          textItemIndexes: page.textItems.map((item) => item.index),
        },
      ],
    };
  }

  const bodyItems = page.textItems.filter((item) =>
    isLikelyBodyTextItem(item, page),
  );
  const ranges = getColumnRanges(bodyItems, page);

  if (!ranges) {
    return {
      ...page,
      textItems: page.textItems.map((item) => ({ ...item, columnIndex: 0 })),
      columns: [
        {
          index: 0,
          left: 0,
          right: page.width,
          width: page.width,
          textItemIndexes: page.textItems.map((item) => item.index),
        },
      ],
    };
  }

  const splitX = (ranges[0].right + ranges[1].left) / 2;
  const textItems = page.textItems.map((item) => {
    const centerX = item.rect.left + item.rect.width / 2;
    return {
      ...item,
      columnIndex: centerX < splitX ? 0 : 1,
    };
  });

  const columns = ranges.map((range, index) => ({
    index,
    left: range.left,
    right: range.right,
    width: range.right - range.left,
    textItemIndexes: textItems
      .filter((item) => item.columnIndex === index)
      .map((item) => item.index),
  }));

  return { ...page, textItems, columns };
};

const isFullWidthBlock = (
  block: PdfTextItem[][],
  page: PdfExtractedPage,
  detectedColumnCount: number,
) => {
  if (detectedColumnCount < 2) return false;

  const textItems = block.flat();
  const boundingRect = getTextItemsBoundingRect(textItems);
  if (!boundingRect) return false;

  return boundingRect.width > page.width * 0.72;
};

const buildBlocksForItems = (
  textItems: PdfTextItem[],
  page: PdfExtractedPage,
) => {
  const lines = groupTextItemsIntoLines(textItems);
  const averageHeight = getAverageItemHeight(textItems);
  const blocks: PdfTextItem[][][] = [];

  lines.forEach((line) => {
    const currentBlock = blocks[blocks.length - 1];
    const previousLine = currentBlock?.[currentBlock.length - 1];

    if (
      currentBlock &&
      previousLine &&
      !shouldStartNewBlock(previousLine, line, page, averageHeight)
    ) {
      currentBlock.push(line);
      return;
    }

    blocks.push([line]);
  });

  return blocks;
};

const compareBlocksByPosition = (
  left: { block: PdfTextItem[][] },
  right: { block: PdfTextItem[][] },
) => {
  const leftRect = getTextItemsBoundingRect(left.block.flat());
  const rightRect = getTextItemsBoundingRect(right.block.flat());

  return (leftRect?.top ?? 0) - (rightRect?.top ?? 0);
};

const compareBlocksByColumnReadingOrder = (
  left: { block: PdfTextItem[][]; columnIndex?: number },
  right: { block: PdfTextItem[][]; columnIndex?: number },
) => {
  const columnDelta = (left.columnIndex ?? 0) - (right.columnIndex ?? 0);
  if (columnDelta !== 0) return columnDelta;

  return compareBlocksByPosition(left, right);
};

const buildTextUnit = ({
  block,
  columnIndex,
  indexInPage,
  includePositions,
  idPrefix,
  page,
  shouldNormalize,
}: {
  block: PdfTextItem[][];
  columnIndex?: number;
  indexInPage: number;
  includePositions: boolean;
  idPrefix: string;
  page: PdfExtractedPage;
  shouldNormalize: boolean;
}): PdfTextUnit => {
  const textItems = block.flat();
  const rawText = block.map(getLineText).join(" ");
  const textItemIndexes = textItems.map((item) => item.index);
  const type = classifyTextUnit(rawText, textItemIndexes, page);
  const position = getTextItemsPosition(
    page.textItems,
    textItemIndexes,
    page,
    includePositions,
  );

  return {
    id: `${idPrefix}p${page.pageNumber}-u${indexInPage}`,
    type,
    text: shouldNormalize ? normalizePdfSentenceText(rawText) : rawText.trim(),
    rawText: rawText.trim(),
    pageNumber: page.pageNumber,
    indexInPage,
    ...(columnIndex !== undefined ? { columnIndex } : {}),
    ...(position ? { position } : {}),
    source: {
      textItemIndexes,
    },
  };
};

const getLineText = (line: PdfTextItem[]) => {
  const averageHeight = getAverageItemHeight(line);
  const medianGlyphWidth = getMedianGlyphWidth(line);

  return line.reduce((text, item, index) => {
    return appendTextItem(
      text,
      item,
      line[index - 1],
      averageHeight,
      medianGlyphWidth,
    );
  }, "");
};

const getLineRect = (line: PdfTextItem[]) => getBoundingRect(line.map((item) => item.rect));

const shouldStartNewBlock = (
  previousLine: PdfTextItem[],
  nextLine: PdfTextItem[],
  page: PdfExtractedPage,
  averageHeight: number,
) => {
  const previousRect = getLineRect(previousLine);
  const nextRect = getLineRect(nextLine);
  const verticalGap = nextRect.top - (previousRect.top + previousRect.height);
  const leftDelta = Math.abs(nextRect.left - previousRect.left);
  const previousText = getLineText(previousLine).trim();
  const nextText = getLineText(nextLine).trim();

  if (verticalGap > Math.max(averageHeight * 1.15, 7)) return true;
  if (leftDelta > page.width * 0.18) return true;
  if (isLikelyStandaloneBlock(previousText) || isLikelyStandaloneBlock(nextText)) {
    return true;
  }

  return false;
};

const isLikelyStandaloneBlock = (text: string) => {
  const normalizedText = normalizePdfSentenceText(text);
  if (!normalizedText) return false;
  if (isLikelySectionHeading(normalizedText)) return true;
  if (isLikelyFootnoteOrReference(normalizedText)) return true;
  return false;
};

const isLikelySectionHeading = (text: string) => {
  if (text.length > 80) return false;
  if (/^\d+(\.\d+)*\.?\s+[A-Z]/.test(text)) return true;

  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;

  const uppercaseLetters = text.replace(/[^A-Z]/g, "");
  return uppercaseLetters.length / letters.length > 0.75;
};

const isLikelyFootnoteOrReference = (text: string) => {
  return (
    /^\d+\s*https?:\/\//i.test(text) ||
    /^\[\d+\]/.test(text) ||
    /https?:\/\/|doi\.org|arxiv\.org/i.test(text)
  );
};

const isLikelyAuthor = (text: string) => {
  return (
    text.length <= 80 &&
    !/[.!?]$/.test(text) &&
    /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,4}$/.test(text)
  );
};

const isLikelyAffiliation = (text: string) => {
  return (
    text.length <= 160 &&
    /university|institute|department|school|college|faculty|laboratory|germany|usa|china|france|italy|spain|canada|japan|korea/i.test(
      text,
    )
  );
};

const classifyTextUnit = (
  rawText: string,
  textItemIndexes: number[],
  page: PdfExtractedPage,
) => {
  const text = normalizePdfSentenceText(rawText);
  const textItems = page.textItems.filter((item) =>
    textItemIndexes.includes(item.index),
  );
  const rects = textItems.map((item) => item.rect);
  const boundingRect = rects.length > 0 ? getBoundingRect(rects) : undefined;
  const averagePageHeight = getAverageItemHeight(page.textItems);
  const averageUnitHeight = getAverageItemHeight(textItems);
  const isTopOfFirstPage =
    page.pageNumber === 1 && (boundingRect?.top ?? page.height) < page.height * 0.2;
  const isBottomOfPage =
    (boundingRect?.top ?? 0) > page.height * 0.78;
  const isLargeText =
    averagePageHeight > 0 && averageUnitHeight > averagePageHeight * 1.25;
  const isCentered =
    boundingRect !== undefined &&
    Math.abs(boundingRect.left + boundingRect.width / 2 - page.width / 2) <
      page.width * 0.16;

  if (isLikelyFootnoteOrReference(text) || (isBottomOfPage && /^\d+\s/.test(text))) {
    return text.includes("://") || /^\d+\s*https?:\/\//i.test(text)
      ? "footnote"
      : "reference";
  }

  if (isLikelySectionHeading(text)) return "heading";

  if (isTopOfFirstPage && isLargeText && isCentered) return "title";
  if (isTopOfFirstPage && isLikelyAuthor(text)) return "author";
  if (isTopOfFirstPage && isLikelyAffiliation(text)) return "affiliation";

  return "paragraph";
};

export const extractTextUnitsFromPages = (
  pages: PdfExtractedPage[],
  options: Pick<
    ExtractSentencesOptions,
    "includePositions" | "includeSources" | "normalize" | "idPrefix" | "readingOrder" | "columnDetection"
  > = {},
): PdfTextUnit[] => {
  const includePositions = options.includePositions ?? DEFAULT_OPTIONS.includePositions;
  const includeSources = options.includeSources ?? DEFAULT_OPTIONS.includeSources;
  const shouldNormalize = options.normalize ?? DEFAULT_OPTIONS.normalize;
  const idPrefix = options.idPrefix ?? DEFAULT_OPTIONS.idPrefix;
  const readingOrder = options.readingOrder ?? DEFAULT_OPTIONS.readingOrder;
  const columnDetection = options.columnDetection ?? DEFAULT_OPTIONS.columnDetection;
  const units: PdfTextUnit[] = [];

  pages.forEach((page) => {
    const pageWithColumns = assignColumnsToPage(page, columnDetection);
    const detectedColumnCount = pageWithColumns.columns?.length ?? 1;
    const columnIndexes =
      detectedColumnCount > 1 && readingOrder !== "document"
        ? pageWithColumns.columns?.map((column) => column.index) ?? [0]
        : [0];
    const blocks: Array<{ block: PdfTextItem[][]; columnIndex?: number }> = [];

    if (readingOrder === "document") {
      blocks.push(
        ...buildBlocksForItems(pageWithColumns.textItems, pageWithColumns).map(
          (block) => ({ block }),
        ),
      );
    } else {
      const allBlocks = columnIndexes.flatMap((columnIndex) =>
        buildBlocksForItems(
          pageWithColumns.textItems.filter(
            (item) => item.columnIndex === columnIndex,
          ),
          pageWithColumns,
        ).map((block) => ({ block, columnIndex })),
      );
      const fullWidthBlocks = allBlocks.filter(({ block }) =>
        isFullWidthBlock(block, pageWithColumns, detectedColumnCount),
      );
      const columnBlocks = allBlocks.filter(
        ({ block }) => !isFullWidthBlock(block, pageWithColumns, detectedColumnCount),
      );
      const topFullWidthBlocks = fullWidthBlocks.filter(({ block }) => {
        const rect = getTextItemsBoundingRect(block.flat());
        return (rect?.top ?? 0) < pageWithColumns.height * 0.3;
      });
      const bottomFullWidthBlocks = fullWidthBlocks.filter(({ block }) => {
        const rect = getTextItemsBoundingRect(block.flat());
        return (rect?.top ?? 0) >= pageWithColumns.height * 0.3;
      });

      blocks.push(
        ...topFullWidthBlocks.sort(compareBlocksByPosition),
        ...columnBlocks.sort(compareBlocksByColumnReadingOrder),
        ...bottomFullWidthBlocks.sort(compareBlocksByPosition),
      );
    }

    blocks.forEach(({ block, columnIndex }, indexInPage) => {
      units.push(
        buildTextUnit({
          block,
          columnIndex,
          indexInPage,
          includePositions,
          idPrefix,
          page: pageWithColumns,
          shouldNormalize,
        }),
      );
    });
  });

  if (!includeSources) {
    return units.map(({ source: _source, ...rest }) => rest);
  }
  return units;
};

export const extractTextUnits = async (
  pdfDocument: PDFDocumentProxy,
  options: ExtractSentencesOptions = {},
): Promise<PdfTextUnit[]> => {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const pages = await extractPageTextItems(pdfDocument, {
    pages: resolvedOptions.pages,
    columnDetection: resolvedOptions.columnDetection,
  });

  return extractTextUnitsFromPages(pages, resolvedOptions);
};

export const extractPageTextItems = async (
  pdfDocument: PDFDocumentProxy,
  options: Pick<ExtractSentencesOptions, "pages" | "columnDetection"> = {},
): Promise<PdfExtractedPage[]> => {
  const pageNumbers = resolvePageNumbers(pdfDocument, options.pages);
  const columnDetection = options.columnDetection ?? DEFAULT_OPTIONS.columnDetection;
  const extractedPages: PdfExtractedPage[] = [];

  for (const pageNumber of pageNumbers) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const textItems: PdfTextItem[] = [];

    textContent.items.forEach((item, index) => {
      if (!isTextItem(item) || item.str.length === 0) return;

      textItems.push({
        text: item.str,
        index,
        pageNumber,
        rect: getTextItemRect(item, viewport, pageNumber),
      });
    });

    extractedPages.push(assignColumnsToPage({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      textItems,
    }, columnDetection));
  }

  return extractedPages;
};

export const extractSentences = async (
  pdfDocument: PDFDocumentProxy,
  options: ExtractSentencesOptions = {},
): Promise<PdfSentence[]> => {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const pages = await extractPageTextItems(pdfDocument, {
    pages: resolvedOptions.pages,
    columnDetection: resolvedOptions.columnDetection,
  });
  // Always include sources internally — unit.source.textItemIndexes is needed below
  const textUnits = extractTextUnitsFromPages(pages, { ...resolvedOptions, includeSources: true });
  const sentences: PdfSentence[] = [];
  let globalIndex = 0;

  textUnits
    .filter((unit) => resolvedOptions.includeTextUnitTypes.includes(unit.type))
    .forEach((unit) => {
    const page = pages.find((candidatePage) => candidatePage.pageNumber === unit.pageNumber);
    if (!page) return;

    const pageTextItemsByIndex = new Map(
      page.textItems.map((item) => [item.index, item]),
    );
    const stream = buildPageTextStream(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      unit.source!.textItemIndexes
        .map((textItemIndex) => pageTextItemsByIndex.get(textItemIndex))
        .filter((item): item is PdfTextItem => item !== undefined),
    );
    if (!stream.text.trim()) return;

    const sentenceRanges = splitPdfSentences(
      stream.text,
      resolvedOptions.locale,
    );

    sentenceRanges.forEach((sentenceRange, indexInPage) => {
      const textItemIndexes = getSentenceTextItemIndexes(
        stream.charItemIndexes,
        sentenceRange.start,
        sentenceRange.end,
      );
      const position = resolvedOptions.includePositions
        ? getScaledPosition(page.textItems, textItemIndexes, page)
        : undefined;
      const id = `${resolvedOptions.idPrefix}p${page.pageNumber}-u${unit.indexInPage}-s${indexInPage}`;
      const rawText = sentenceRange.text;

      sentences.push({
        id,
        text: resolvedOptions.normalize
          ? normalizePdfSentenceText(rawText)
          : rawText,
        rawText,
        pageNumber: page.pageNumber,
        indexInPage,
        globalIndex,
        ...(unit.columnIndex !== undefined ? { columnIndex: unit.columnIndex } : {}),
        ...(position ? { position } : {}),
        ...(resolvedOptions.includeSources
          ? { source: { startOffset: sentenceRange.start, endOffset: sentenceRange.end, textItemIndexes } }
          : {}),
      });

      globalIndex += 1;
    });
  });

  return sentences;
};

export const sentenceToHighlight = (
  sentence: PdfSentence,
  options: { id?: string } = {},
): Highlight => {
  if (!sentence.position) {
    throw new Error(
      "Cannot convert sentence to highlight because it has no position. Call extractSentences with includePositions: true.",
    );
  }

  return {
    id: options.id ?? sentence.id,
    type: "text",
    content: { text: sentence.text },
    position: sentence.position,
  };
};

/** Strip ALL whitespace, lowercase, unify quotes — keeping a map from each
 *  stripped-char index back to its index in the raw string. Matching on the
 *  whitespace-free form makes line-wraps / inconsistent PDF spacing irrelevant. */
const stripWhitespaceWithMap = (
  raw: string,
): { stripped: string; map: number[] } => {
  let stripped = "";
  const map: number[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i]!;
    if (/\s/.test(c)) continue;
    let ch = c.toLowerCase();
    if (ch === "‘" || ch === "’") ch = "'";
    else if (ch === "“" || ch === "”") ch = '"';
    stripped += ch;
    map.push(i);
  }
  return { stripped, map };
};

/** Levenshtein distance, bounded — returns `max + 1` as soon as it's exceeded. */
const boundedLevenshtein = (a: string, b: string, max: number): number => {
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > max) return max + 1;
  let prev = new Array<number>(bl + 1);
  let curr = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[bl]!;
};

/** Best fuzzy window: slide a query-length window over the stripped page text,
 *  anchoring on the query's first token to keep it cheap, and return the start
 *  index of the lowest-distance window within tolerance (or -1). */
const fuzzyFind = (
  haystack: string,
  needle: string,
  maxDistance: number,
): number => {
  const len = needle.length;
  if (len === 0) return -1;
  const anchor = needle.slice(0, Math.min(8, len));
  let best = -1;
  let bestDist = maxDistance + 1;
  let from = 0;
  // Probe near every occurrence of the anchor, plus a small slop window.
  while (true) {
    const at = haystack.indexOf(anchor, from);
    if (at === -1) break;
    for (let offset = -2; offset <= 2; offset++) {
      const start = at + offset;
      if (start < 0 || start + len > haystack.length) continue;
      const window = haystack.slice(start, start + len);
      const dist = boundedLevenshtein(needle, window, bestDist - 1);
      if (dist < bestDist) {
        bestDist = dist;
        best = start;
        if (dist === 0) return best;
      }
    }
    from = at + 1;
  }
  return bestDist <= maxDistance ? best : -1;
};

/**
 * The result of {@link getTextPosition}.
 *
 * @category Type
 */
export interface TextPositionMatch {
  /** Scaled position of the matched text, ready to use as a highlight position. */
  position: ScaledPosition;
  /** 1-indexed page the match was found on. */
  pageNumber: number;
  /** The exact document text that was matched. */
  matchedText: string;
  /** "exact" = whitespace-insensitive verbatim, "fuzzy" = approximate match. */
  confidence: "exact" | "fuzzy";
}

interface RawTextItem {
  text: string;
  rect: LTWHP;
}

/** Build per-character rects for a raw [start,end) range over concatenated items,
 *  splitting partial items proportionally and merging rects on the same line. */
const rectsForRange = (
  items: RawTextItem[],
  itemStarts: number[],
  start: number,
  end: number,
  pageNumber: number,
): LTWHP[] => {
  const rects: LTWHP[] = [];
  for (let k = 0; k < items.length; k++) {
    const itemStart = itemStarts[k]!;
    const item = items[k]!;
    const len = item.text.length;
    if (len === 0) continue;
    const itemEnd = itemStart + len;
    const a = Math.max(start, itemStart);
    const b = Math.min(end, itemEnd);
    if (b <= a) continue;
    const { left, top, width, height } = item.rect;
    if (!(width > 0) || !(height > 0)) continue;
    const s = (a - itemStart) / len;
    const e = (b - itemStart) / len;
    rects.push({
      left: left + s * width,
      top,
      width: (e - s) * width,
      height,
      pageNumber,
    });
  }
  // Merge rects that sit on the same line and are horizontally contiguous.
  rects.sort((p, q) => p.top - q.top || p.left - q.left);
  const merged: LTWHP[] = [];
  for (const r of rects) {
    const last = merged[merged.length - 1];
    if (
      last &&
      Math.abs(last.top - r.top) < Math.max(2, r.height * 0.4) &&
      r.left - (last.left + last.width) < Math.max(4, r.height * 0.6)
    ) {
      const right = Math.max(last.left + last.width, r.left + r.width);
      last.left = Math.min(last.left, r.left);
      last.width = right - last.left;
      last.height = Math.max(last.height, r.height);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
};

/**
 * Locate a piece of text in the PDF and return its precise position — the rects
 * of the exact phrase (sub-item, per-line), not a whole sentence. Use it to turn
 * an external quote / citation into a highlight you can render or scroll to.
 *
 * Robust to PDF quirks: matching ignores whitespace (so line-wraps and spacing
 * differences don't matter) and falls back to bounded fuzzy matching for minor
 * differences (hyphenation, OCR, slight paraphrase). Returns the first match
 * (optionally restrict the page range), or null.
 *
 * @category Utility
 */
export const getTextPosition = async (
  pdfDocument: PDFDocumentProxy,
  query: string,
  options: { pages?: "all" | number[]; fuzzy?: boolean } = {},
): Promise<TextPositionMatch | null> => {
  const { stripped: needle } = stripWhitespaceWithMap(query);
  if (!needle) return null;
  const allowFuzzy = options.fuzzy ?? true;
  const maxDistance = Math.max(2, Math.floor(needle.length * 0.15));

  const pages = await extractPageTextItems(pdfDocument, {
    pages: options.pages ?? "all",
  });

  for (const page of pages) {
    const items: RawTextItem[] = page.textItems
      .filter((it) => it.text)
      .map((it) => ({ text: it.text, rect: it.rect }));
    if (items.length === 0) continue;

    // Raw concatenation + per-item start offsets (no inserted separators).
    const itemStarts: number[] = [];
    let raw = "";
    for (const it of items) {
      itemStarts.push(raw.length);
      raw += it.text;
    }

    const { stripped, map } = stripWhitespaceWithMap(raw);
    let at = stripped.indexOf(needle);
    let confidence: "exact" | "fuzzy" = "exact";
    if (at === -1 && allowFuzzy) {
      at = fuzzyFind(stripped, needle, maxDistance);
      confidence = "fuzzy";
    }
    if (at === -1) continue;

    const rawStart = map[at]!;
    const rawEnd = map[Math.min(at + needle.length - 1, map.length - 1)]! + 1;
    const rects = rectsForRange(
      items,
      itemStarts,
      rawStart,
      rawEnd,
      page.pageNumber,
    );
    if (rects.length === 0) continue;

    const boundingRect = getBoundingRect(rects);
    return {
      position: {
        boundingRect: viewportToScaled(boundingRect, page),
        rects: rects.map((r) => viewportToScaled(r, page)),
      },
      pageNumber: page.pageNumber,
      matchedText: raw.slice(rawStart, rawEnd),
      confidence,
    };
  }

  return null;
};
