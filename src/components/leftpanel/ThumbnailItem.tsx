import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import type { ThumbnailData } from '../../types';

export interface ThumbnailItemProps {
  pageNumber: number;
  thumbnail: ThumbnailData;
  isActive: boolean;
  onLoad: (pageNumber: number) => void;
  onClick: (pageNumber: number) => void;
  showPageNumber?: boolean;
  className?: string;
}

/**
 * Single thumbnail item with lazy loading via IntersectionObserver.
 * Clean, minimal design with smooth hover and active states.
 * Memoized to prevent unnecessary re-renders in virtualized lists.
 */
export const ThumbnailItem = React.memo<ThumbnailItemProps>(({
  pageNumber,
  thumbnail,
  isActive,
  onLoad,
  onClick,
  showPageNumber = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const [isHovered, setIsHovered] = useState(false);

  // Lazy load thumbnail when visible
  useEffect(() => {
    const element = containerRef.current;
    if (!element || hasLoadedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoadedRef.current) {
            hasLoadedRef.current = true;
            onLoad(pageNumber);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [pageNumber, onLoad]);

  const handleClick = () => {
    onClick(pageNumber);
  };

  // Dynamic styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '6px',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'all 0.15s ease',
    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.08)' : isHovered ? 'rgba(0, 0, 0, 0.03)' : 'transparent',
    border: isActive ? '2px solid #3b82f6' : '2px solid transparent',
  };

  // Image wrapper - width 90%, height auto with aspect ratio
  const imageContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '85%',
    aspectRatio: '8.5 / 11', // Standard page aspect ratio
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    overflow: 'hidden',
    boxShadow: isActive
      ? '0 4px 12px rgba(59, 130, 246, 0.25)'
      : isHovered
        ? '0 4px 12px rgba(0, 0, 0, 0.12)'
        : '0 1px 3px rgba(0, 0, 0, 0.08)',
    transition: 'box-shadow 0.15s ease',
  };

  const pageNumberStyle: React.CSSProperties = {
    marginTop: '6px',
    fontSize: '11px',
    fontWeight: 500,
    color: isActive ? '#3b82f6' : '#6b7280',
    transition: 'color 0.15s ease',
  };

  return (
    <div
      ref={containerRef}
      className={`thumbnail-item ${className}`}
      style={containerStyle}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Page ${pageNumber}${isActive ? ' (current)' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Thumbnail image container */}
      <div style={imageContainerStyle}>
        {/* Loading state */}
        {thumbnail.isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f9fafb',
            }}
          >
            <Loader2
              style={{
                width: 24,
                height: 24,
                color: '#9ca3af',
                animation: 'spin 1s linear infinite',
              }}
            />
          </div>
        )}

        {/* Error state */}
        {thumbnail.error && !thumbnail.isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#fef2f2',
            }}
          >
            <AlertCircle style={{ width: 20, height: 20, color: '#f87171', marginBottom: 4 }} />
            <span style={{ fontSize: 10, color: '#9ca3af' }}>Failed</span>
          </div>
        )}

        {/* Thumbnail image */}
        {thumbnail.dataUrl && !thumbnail.isLoading && (
          <img
            src={thumbnail.dataUrl}
            alt={`Page ${pageNumber}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            draggable={false}
          />
        )}

        {/* Placeholder when not yet loaded */}
        {!thumbnail.dataUrl && !thumbnail.isLoading && !thumbnail.error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f9fafb',
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 300,
                color: '#d1d5db',
              }}
            >
              {pageNumber}
            </span>
          </div>
        )}
      </div>

      {/* Page number label */}
      {showPageNumber && (
        <div style={pageNumberStyle}>
          {pageNumber}
        </div>
      )}
    </div>
  );
});
