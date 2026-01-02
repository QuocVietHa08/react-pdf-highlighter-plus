import { useState, useEffect, useCallback, useMemo } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { OutlineItem, ProcessedOutlineItem } from '../types';

interface UseDocumentOutlineOptions {
  pdfDocument: PDFDocumentProxy;
  linkService?: { goToDestination: (dest: unknown) => void } | unknown | null;
}

interface UseDocumentOutlineResult {
  outline: ProcessedOutlineItem[] | null;
  isLoading: boolean;
  error: Error | null;
  navigateToItem: (item: ProcessedOutlineItem) => void;
  flatOutline: ProcessedOutlineItem[];
  hasOutline: boolean;
}

/**
 * Helper to process outline items recursively and resolve destinations to page numbers
 */
async function processOutlineItems(
  pdfDocument: PDFDocumentProxy,
  items: OutlineItem[],
  level: number
): Promise<ProcessedOutlineItem[]> {
  const processed: ProcessedOutlineItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let pageNumber = 1;

    // Resolve destination to page number
    if (item.dest) {
      try {
        const dest =
          typeof item.dest === 'string'
            ? await pdfDocument.getDestination(item.dest)
            : item.dest;

        if (dest && Array.isArray(dest) && dest[0]) {
          const pageIndex = await pdfDocument.getPageIndex(dest[0]);
          pageNumber = pageIndex + 1; // Convert to 1-indexed
        }
      } catch {
        // Keep default page 1 if resolution fails
        console.log(`Failed to resolve destination for outline item: ${item.title}`);
      }
    }

    const children = item.items?.length
      ? await processOutlineItems(pdfDocument, item.items, level + 1)
      : [];

    processed.push({
      id: `outline-${level}-${i}`,
      title: item.title,
      pageNumber,
      dest: item.dest,
      level,
      bold: item.bold,
      italic: item.italic,
      children,
    });
  }

  return processed;
}

/**
 * Flatten outline tree into a single array for searching
 */
function flattenOutline(items: ProcessedOutlineItem[]): ProcessedOutlineItem[] {
  const result: ProcessedOutlineItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children.length) {
      result.push(...flattenOutline(item.children));
    }
  }
  return result;
}

/**
 * Hook to fetch and process PDF document outline (table of contents)
 *
 * @param options - Configuration options
 * @returns Outline data and navigation utilities
 */
export function useDocumentOutline(
  options: UseDocumentOutlineOptions
): UseDocumentOutlineResult {
  const { pdfDocument, linkService } = options;
  const [outline, setOutline] = useState<ProcessedOutlineItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOutline() {
      try {
        setIsLoading(true);
        setError(null);

        const rawOutline = await pdfDocument.getOutline();
        console.log('Raw outline from PDF:', rawOutline);

        if (cancelled) return;

        if (!rawOutline || rawOutline.length === 0) {
          setOutline([]);
          return;
        }

        const processedOutline = await processOutlineItems(
          pdfDocument,
          rawOutline as OutlineItem[],
          0
        );

        if (cancelled) return;

        console.log('Processed outline:', processedOutline);
        setOutline(processedOutline);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load outline:', err);
        setError(err instanceof Error ? err : new Error('Failed to load outline'));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchOutline();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument]);

  const navigateToItem = useCallback(
    (item: ProcessedOutlineItem) => {
      console.log('Navigating to outline item:', item);
      if (linkService && item.dest && typeof linkService === 'object' && 'goToDestination' in linkService) {
        (linkService as { goToDestination: (dest: unknown) => void }).goToDestination(item.dest);
      }
    },
    [linkService]
  );

  const flatOutline = useMemo(() => {
    if (!outline) return [];
    return flattenOutline(outline);
  }, [outline]);

  const hasOutline = useMemo(() => {
    return outline !== null && outline.length > 0;
  }, [outline]);

  return { outline, isLoading, error, navigateToItem, flatOutline, hasOutline };
}
