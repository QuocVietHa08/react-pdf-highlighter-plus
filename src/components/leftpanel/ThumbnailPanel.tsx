import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ThumbnailItem } from './ThumbnailItem';
import type { ThumbnailData } from '../../types';

export interface ThumbnailPanelProps {
  /** Total number of pages */
  totalPages: number;
  /** Current page number for highlighting */
  currentPage: number;
  /** Thumbnails map for reactive updates (when thumbnails load, this changes) */
  thumbnails: Map<number, ThumbnailData>;
  /** Function to load a thumbnail */
  loadThumbnail: (pageNumber: number) => Promise<void>;
  /** Callback when thumbnail is clicked */
  onPageSelect: (pageNumber: number) => void;
  /** Show page numbers under thumbnails */
  showPageNumbers?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom thumbnail renderer */
  renderThumbnail?: (
    pageNumber: number,
    thumbnail: ThumbnailData,
    isActive: boolean
  ) => React.ReactNode;
  /** Estimated height of each thumbnail item (including gap) */
  estimatedItemHeight?: number;
  /** Number of items to render outside visible area */
  overscan?: number;
  /** Gap between thumbnail items in pixels */
  gap?: number;
}

/**
 * Panel displaying page thumbnails with virtual scrolling.
 * Optimized for large PDFs (500+ pages) with only visible items rendered in DOM.
 */
export const ThumbnailPanel: React.FC<ThumbnailPanelProps> = ({
  totalPages,
  currentPage,
  thumbnails,
  loadThumbnail,
  onPageSelect,
  showPageNumbers = true,
  className = '',
  renderThumbnail,
  estimatedItemHeight = 300,
  overscan = 5,
  gap = 8,
}) => {
  // Helper to get thumbnail data from map with fallback
  const getThumbnail = (pageNumber: number): ThumbnailData => {
    return thumbnails.get(pageNumber) || {
      pageNumber,
      dataUrl: null,
      isLoading: false,
    };
  };

  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual list for performance with large documents
  // Include gap in the item size calculation
  const virtualizer = useVirtualizer({
    count: totalPages,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight + gap,
    overscan,
  });

  // Store scrollToIndex in a ref to avoid infinite loop
  // (useVirtualizer returns new object reference each render)
  const scrollToIndexRef = useRef(virtualizer.scrollToIndex);
  scrollToIndexRef.current = virtualizer.scrollToIndex;

  // Scroll to current page when it changes (e.g., from PDF viewer navigation)
  useEffect(() => {
    if (currentPage > 0 && currentPage <= totalPages) {
      scrollToIndexRef.current(currentPage - 1, { align: 'center' });
    }
  }, [currentPage, totalPages]);

  if (totalPages === 0) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
        }}
      >
        <p style={{ fontSize: 13, color: '#9ca3af' }}>No pages to display</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`thumbnail-panel ${className}`}
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '12px',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const pageNumber = virtualItem.index + 1;
          const thumbnail = getThumbnail(pageNumber);
          const isActive = currentPage === pageNumber;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size - gap}px`,
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: `${gap}px`,
              }}
            >
              {renderThumbnail ? (
                <div
                  onClick={() => onPageSelect(pageNumber)}
                  style={{ cursor: 'pointer', height: '100%' }}
                >
                  {renderThumbnail(pageNumber, thumbnail, isActive)}
                </div>
              ) : (
                <ThumbnailItem
                  pageNumber={pageNumber}
                  thumbnail={thumbnail}
                  isActive={isActive}
                  onLoad={loadThumbnail}
                  onClick={onPageSelect}
                  showPageNumber={showPageNumbers}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
