import { useState, useCallback, useRef, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ThumbnailData } from '../types';

interface UseThumbnailsOptions {
  pdfDocument: PDFDocumentProxy;
  thumbnailWidth?: number;
  cacheSize?: number;
  /** If true, preload all thumbnails on mount */
  preloadAll?: boolean;
}

interface UseThumbnailsResult {
  getThumbnail: (pageNumber: number) => ThumbnailData;
  loadThumbnail: (pageNumber: number) => Promise<void>;
  preloadThumbnails: (pageNumbers: number[]) => void;
  clearCache: () => void;
  totalPages: number;
  thumbnails: Map<number, ThumbnailData>;
}

/**
 * Hook for generating and caching PDF page thumbnails
 *
 * @param options - Configuration options
 * @returns Thumbnail utilities and data
 */
export function useThumbnails(options: UseThumbnailsOptions): UseThumbnailsResult {
  const { pdfDocument, thumbnailWidth = 200, cacheSize = 50, preloadAll = true } = options;

  const [thumbnails, setThumbnails] = useState<Map<number, ThumbnailData>>(
    new Map()
  );
  const loadingRef = useRef<Set<number>>(new Set());
  const loadedRef = useRef<Set<number>>(new Set());
  const cacheOrderRef = useRef<number[]>([]);

  const totalPages = pdfDocument.numPages;

  const loadThumbnail = useCallback(
    async (pageNumber: number) => {
      // Skip if already loading or loaded
      if (loadingRef.current.has(pageNumber) || loadedRef.current.has(pageNumber)) {
        return;
      }

      loadingRef.current.add(pageNumber);

      // Set loading state
      setThumbnails((prev) => {
        const next = new Map(prev);
        next.set(pageNumber, {
          pageNumber,
          dataUrl: null,
          isLoading: true,
        });
        return next;
      });

      try {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const scale = thumbnailWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const context = canvas.getContext('2d')!;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        const dataUrl = canvas.toDataURL('image/png');

        // Update cache order (LRU)
        cacheOrderRef.current = cacheOrderRef.current.filter(
          (p) => p !== pageNumber
        );
        cacheOrderRef.current.push(pageNumber);

        // Evict oldest if cache is full
        if (cacheOrderRef.current.length > cacheSize) {
          const toEvict = cacheOrderRef.current.shift()!;
          setThumbnails((prev) => {
            const next = new Map(prev);
            next.delete(toEvict);
            return next;
          });
        }

        loadedRef.current.add(pageNumber);
        setThumbnails((prev) => {
          const next = new Map(prev);
          next.set(pageNumber, {
            pageNumber,
            dataUrl,
            isLoading: false,
          });
          return next;
        });
      } catch (error) {
        console.error(`Failed to load thumbnail for page ${pageNumber}:`, error);
        setThumbnails((prev) => {
          const next = new Map(prev);
          next.set(pageNumber, {
            pageNumber,
            dataUrl: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load',
          });
          return next;
        });
      } finally {
        loadingRef.current.delete(pageNumber);
      }
    },
    [pdfDocument, thumbnailWidth, cacheSize]
  );

  const getThumbnail = useCallback(
    (pageNumber: number): ThumbnailData => {
      return (
        thumbnails.get(pageNumber) || {
          pageNumber,
          dataUrl: null,
          isLoading: false,
        }
      );
    },
    [thumbnails]
  );

  const preloadThumbnails = useCallback(
    (pageNumbers: number[]) => {
      pageNumbers.forEach((pageNumber) => {
        loadThumbnail(pageNumber);
      });
    },
    [loadThumbnail]
  );

  const clearCache = useCallback(() => {
    setThumbnails(new Map());
    cacheOrderRef.current = [];
    loadingRef.current.clear();
    loadedRef.current.clear();
  }, []);

  // Preload all thumbnails on mount if enabled
  useEffect(() => {
    if (preloadAll && totalPages > 0) {
      const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
      pageNumbers.forEach((pageNumber) => {
        loadThumbnail(pageNumber);
      });
    }
  }, [preloadAll, totalPages, loadThumbnail]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      loadingRef.current.clear();
    };
  }, []);

  return {
    getThumbnail,
    loadThumbnail,
    preloadThumbnails,
    clearCache,
    totalPages,
    thumbnails,
  };
}
