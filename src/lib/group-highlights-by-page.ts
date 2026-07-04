import { GhostHighlight, Highlight } from "../types";

type GroupedHighlights = {
  [pageNumber: number]: Array<Highlight | GhostHighlight>;
};

const groupHighlightsByPage = (
  highlights: Array<Highlight | GhostHighlight | null>,
): GroupedHighlights =>
  highlights.reduce<GroupedHighlights>((acc, highlight) => {
    if (!highlight) {
      return acc;
    }
    // Deduplicated: a highlight whose rects all sit on the same page (the
    // overwhelming common case) previously produced one pageNumber entry per
    // rect plus one for boundingRect, all equal — pushing the SAME highlight
    // into that page's array that many times over and rendering it as that
    // many stacked, overlapping DOM copies.
    const pageNumbers = [
      ...new Set([
        highlight.position.boundingRect.pageNumber,
        ...highlight.position.rects.map((rect) => rect.pageNumber || 0),
      ]),
    ];

    pageNumbers.forEach((pageNumber) => {
      acc[pageNumber] ||= [];
      const pageSpecificHighlight = {
        ...highlight,
        position: {
          ...highlight.position,
          rects: highlight.position.rects.filter(
            (rect) => pageNumber === rect.pageNumber,
          ),
        },
      };
      acc[pageNumber].push(pageSpecificHighlight);
    });

    return acc;
  }, {});

export default groupHighlightsByPage;
