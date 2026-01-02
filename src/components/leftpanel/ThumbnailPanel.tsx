import React, { useMemo } from 'react';
import { ThumbnailItem } from './ThumbnailItem';
import type { ThumbnailData } from '../../types';

export interface ThumbnailPanelProps {
  /** Total number of pages */
  totalPages: number;
  /** Current page number for highlighting */
  currentPage: number;
  /** Function to get thumbnail data for a page */
  getThumbnail: (pageNumber: number) => ThumbnailData;
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
}

/**
 * Panel displaying page thumbnails in a clean, single-column grid layout.
 * Optimized for easy page navigation with visual feedback.
 */
export const ThumbnailPanel: React.FC<ThumbnailPanelProps> = ({
  totalPages,
  currentPage,
  getThumbnail,
  loadThumbnail,
  onPageSelect,
  showPageNumbers = true,
  className = '',
  renderThumbnail,
}) => {
  // Generate array of page numbers
  const pageNumbers = useMemo(() => {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }, [totalPages]);

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
      className={`thumbnail-panel ${className}`}
      style={{
        padding: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {pageNumbers.map((pageNumber) => {
          const thumbnail = getThumbnail(pageNumber);
          const isActive = currentPage === pageNumber;

          // Allow custom rendering
          if (renderThumbnail) {
            return (
              <div
                key={pageNumber}
                onClick={() => onPageSelect(pageNumber)}
                style={{ cursor: 'pointer' }}
              >
                {renderThumbnail(pageNumber, thumbnail, isActive)}
              </div>
            );
          }

          return (
            <ThumbnailItem
              key={pageNumber}
              pageNumber={pageNumber}
              thumbnail={thumbnail}
              isActive={isActive}
              onLoad={loadThumbnail}
              onClick={onPageSelect}
              showPageNumber={showPageNumbers}
            />
          );
        })}
      </div>
    </div>
  );
};
