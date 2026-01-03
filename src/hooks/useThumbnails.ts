import { useState, useCallback, useRef, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ThumbnailData } from '../types';

export interface UseThumbnailsOptions {
  pdfDocument: PDFDocumentProxy;
  /** Width of generated thumbnails in pixels @default 200 */
  thumbnailWidth?: number;
  /** Maximum number of thumbnails to cache @default 150 */
  cacheSize?: number;
  /** If true, preload all thumbnails on mount. Set to false for large PDFs @default false */
  preloadAll?: boolean;
  /** JPEG quality for thumbnail images (0-1) @default 0.8 */
  imageQuality?: number;
}

export interface UseThumbnailsResult {
  getThumbnail: (pageNumber: number) => ThumbnailData;
  loadThumbnail: (pageNumber: number) => Promise<void>;
  preloadThumbnails: (pageNumbers: number[]) => void;
  clearCache: () => void;
  totalPages: number;
  thumbnails: Map<number, ThumbnailData>;
}

/**
 * Hook for generating and caching PDF page thumbnails.
 * Optimized for large documents with LRU caching and batched state updates.
 *
 * @param options - Configuration options
 * @returns Thumbnail utilities and data
 */
// Maximum concurrent PDF.js render operations to prevent browser freeze
const MAX_CONCURRENT_RENDERS = 3;

export function useThumbnails(options: UseThumbnailsOptions): UseThumbnailsResult {
  const {
    pdfDocument,
    thumbnailWidth = 200,
    cacheSize = 150,        // Increased from 50 for better scrolling experience
    preloadAll = false,     // Changed to false - let virtualization control loading
    imageQuality = 0.8,
  } = options;

  const [thumbnails, setThumbnails] = useState<Map<number, ThumbnailData>>(
    new Map()
  );
  const loadingRef = useRef<Set<number>>(new Set());
  const loadedRef = useRef<Set<number>>(new Set());
  const cacheOrderRef = useRef<number[]>([]);

  // Render queue to limit concurrent operations
  const renderQueueRef = useRef<number[]>([]);
  const activeRendersRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  // Store thumbnails in ref for stable getThumbnail callback
  const thumbnailsRef = useRef<Map<number, ThumbnailData>>(thumbnails);
  thumbnailsRef.current = thumbnails;

  // Batch state updates to reduce re-renders
  const pendingUpdatesRef = useRef<Map<number, ThumbnailData>>(new Map());
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = pdfDocument.numPages;

  // Flush pending updates to state
  const flushUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.size === 0) return;

    setThumbnails((prev) => {
      const next = new Map(prev);
      pendingUpdatesRef.current.forEach((data, pageNumber) => {
        next.set(pageNumber, data);

        // Update cache order for loaded thumbnails
        if (data.dataUrl && !data.isLoading) {
          cacheOrderRef.current = cacheOrderRef.current.filter(p => p !== pageNumber);
          cacheOrderRef.current.push(pageNumber);

          // Evict oldest entries if cache is full
          while (cacheOrderRef.current.length > cacheSize) {
            const toEvict = cacheOrderRef.current.shift()!;
            next.delete(toEvict);
            loadedRef.current.delete(toEvict);
          }
        }
      });
      pendingUpdatesRef.current.clear();
      return next;
    });
  }, [cacheSize]);

  // Queue an update for batching
  const queueUpdate = useCallback((pageNumber: number, data: ThumbnailData) => {
    pendingUpdatesRef.current.set(pageNumber, data);

    if (!flushTimeoutRef.current) {
      flushTimeoutRef.current = setTimeout(() => {
        flushTimeoutRef.current = null;
        flushUpdates();
      }, 50);  // Batch updates every 50ms
    }
  }, [flushUpdates]);

  // Internal function to actually render a thumbnail
  const renderThumbnail = useCallback(
    async (pageNumber: number) => {
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

        // Use JPEG for smaller file size (~50% smaller than PNG)
        const dataUrl = canvas.toDataURL('image/jpeg', imageQuality);

        // Free canvas memory immediately
        canvas.width = 0;
        canvas.height = 0;

        loadedRef.current.add(pageNumber);

        // Queue update for batching (reduces re-renders)
        queueUpdate(pageNumber, {
          pageNumber,
          dataUrl,
          isLoading: false,
        });
      } catch (error) {
        console.error(`Failed to load thumbnail for page ${pageNumber}:`, error);
        queueUpdate(pageNumber, {
          pageNumber,
          dataUrl: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load',
        });
      } finally {
        loadingRef.current.delete(pageNumber);
      }
    },
    [pdfDocument, thumbnailWidth, imageQuality, queueUpdate]
  );

  // Process render queue with concurrency limit
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (renderQueueRef.current.length > 0 && activeRendersRef.current < MAX_CONCURRENT_RENDERS) {
      const pageNumber = renderQueueRef.current.shift()!;
      activeRendersRef.current++;

      // Don't await - let multiple renders run concurrently up to the limit
      renderThumbnail(pageNumber).finally(() => {
        activeRendersRef.current--;
        // Recursively process more from queue
        if (renderQueueRef.current.length > 0) {
          isProcessingRef.current = false;
          processQueue();
        }
      });
    }

    isProcessingRef.current = false;
  }, [renderThumbnail]);

  // Public function to request a thumbnail load
  const loadThumbnail = useCallback(
    async (pageNumber: number) => {
      // Skip if already loading, loaded, or in queue
      if (loadingRef.current.has(pageNumber) || loadedRef.current.has(pageNumber)) {
        return;
      }

      // Skip if already in queue
      if (renderQueueRef.current.includes(pageNumber)) {
        return;
      }

      loadingRef.current.add(pageNumber);

      // Queue loading state for batching (reduces re-renders)
      queueUpdate(pageNumber, {
        pageNumber,
        dataUrl: null,
        isLoading: true,
      });

      // Add to queue and process
      renderQueueRef.current.push(pageNumber);
      processQueue();
    },
    [processQueue, queueUpdate]
  );

  // Stable getThumbnail using ref (doesn't change when thumbnails updates)
  const getThumbnail = useCallback(
    (pageNumber: number): ThumbnailData => {
      return (
        thumbnailsRef.current.get(pageNumber) || {
          pageNumber,
          dataUrl: null,
          isLoading: false,
        }
      );
    },
    []  // No dependencies - always stable
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

  // Preload all thumbnails on mount if enabled (not recommended for large PDFs)
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
      // Clear any pending flush timeout
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
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
