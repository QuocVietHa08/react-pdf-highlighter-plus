import { useState, useEffect, useCallback } from 'react';

interface PDFViewer {
  scrollPageIntoView: (params: { pageNumber: number }) => void;
  pagesCount: number;
  currentPageNumber?: number;
}

interface EventBus {
  on: (event: string, callback: (evt: { pageNumber: number }) => void) => void;
  off: (event: string, callback: (evt: { pageNumber: number }) => void) => void;
}

interface UsePageNavigationOptions {
  viewer: PDFViewer | unknown | null;
  eventBus?: EventBus | unknown | null;
}

interface UsePageNavigationResult {
  currentPage: number;
  totalPages: number;
  goToPage: (pageNumber: number) => void;
}

/**
 * Hook for tracking current page and navigating to pages
 *
 * @param options - Configuration options
 * @returns Page navigation utilities
 */
export function usePageNavigation(
  options: UsePageNavigationOptions
): UsePageNavigationResult {
  const { viewer, eventBus } = options;
  const [currentPage, setCurrentPage] = useState(1);

  // Type guard for EventBus
  const isEventBus = (obj: unknown): obj is EventBus => {
    return obj !== null && typeof obj === 'object' && 'on' in obj && 'off' in obj;
  };

  // Type guard for PDFViewer
  const isViewer = (obj: unknown): obj is PDFViewer => {
    return obj !== null && typeof obj === 'object' && 'scrollPageIntoView' in obj;
  };

  useEffect(() => {
    if (!eventBus || !isEventBus(eventBus)) return;

    const handlePageChange = (evt: { pageNumber: number }) => {
      setCurrentPage(evt.pageNumber);
    };

    eventBus.on('pagechanging', handlePageChange);

    return () => {
      eventBus.off('pagechanging', handlePageChange);
    };
  }, [eventBus]);

  // Sync with viewer's current page on mount
  useEffect(() => {
    if (viewer && isViewer(viewer) && viewer.currentPageNumber) {
      setCurrentPage(viewer.currentPageNumber);
    }
  }, [viewer]);

  const goToPage = useCallback(
    (pageNumber: number) => {
      // Try viewer-based navigation first
      if (viewer && isViewer(viewer)) {
        const totalPages = viewer.pagesCount || 0;
        if (pageNumber >= 1 && pageNumber <= totalPages) {
          viewer.scrollPageIntoView({ pageNumber });
          return;
        }
      }

      // Fallback: DOM-based navigation
      // PDF.js renders pages with data-page-number attribute
      const pageElement = document.querySelector(
        `.page[data-page-number="${pageNumber}"]`
      );
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentPage(pageNumber);
      }
    },
    [viewer]
  );

  const totalPages = viewer && isViewer(viewer) ? viewer.pagesCount || 0 : 0;

  return {
    currentPage,
    totalPages,
    goToPage,
  };
}
