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
