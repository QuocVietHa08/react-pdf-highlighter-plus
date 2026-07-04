import React, { ReactNode, useEffect, useRef, useState } from "react";

import { GlobalWorkerOptions, OnProgressParameters, getDocument, type PDFDocumentLoadingTask, type PDFDocumentProxy } from "pdfjs-dist";
import { DocumentInitParameters, TypedArray } from "pdfjs-dist/types/src/display/api";

const DEFAULT_BEFORE_LOAD = (progress: OnProgressParameters | null) => {
  const pct =
    progress && progress.total
      ? Math.min(100, Math.floor((progress.loaded / progress.total) * 100))
      : null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        height: "100%",
        color: "currentColor",
        opacity: 0.7,
        fontSize: 13,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: "3px solid currentColor",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "pdfloader-spin 0.8s linear infinite",
        }}
      />
      <div>{pct !== null ? `Loading ${pct}%` : "Loading…"}</div>
      <style>{"@keyframes pdfloader-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
};

const DEFAULT_ERROR_MESSAGE = (error: Error) => (
  <div style={{ color: "black" }}>{error.message}</div>
);

const DEFAULT_ON_ERROR = (error: Error) => {
  throw new Error(`Error loading PDF document: ${error.message}!`);
};

const DEFAULT_WORKER_SRC = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// --- Document cache -------------------------------------------------------
// Keeps loaded documents alive across remounts (StrictMode double-mount, tab
// switches, re-opening the same URL) so they don't re-download/re-parse. The
// loading task is shared, so concurrent mounts of the same URL fetch once.
// Reference-counted: an entry is only evicted once nothing is using it AND the
// cache is over budget.
const CACHE_MAX = 3;
let lruTick = 0;

interface CacheEntry {
  task: PDFDocumentLoadingTask;
  promise: Promise<PDFDocumentProxy>;
  refs: number;
  used: number;
}

const docCache = new Map<string, CacheEntry>();

const evictIfNeeded = () => {
  if (docCache.size <= CACHE_MAX) return;
  let victimKey: string | undefined;
  let oldest = Infinity;
  for (const [key, entry] of docCache) {
    if (entry.refs === 0 && entry.used < oldest) {
      oldest = entry.used;
      victimKey = key;
    }
  }
  if (victimKey !== undefined) {
    const victim = docCache.get(victimKey)!;
    docCache.delete(victimKey);
    victim.task.destroy();
  }
};

const cacheKeyOf = (
  document: string | URL | TypedArray | DocumentInitParameters,
): string | null => {
  if (typeof document === "string") return document;
  if (document instanceof URL) return document.href;
  if (
    document &&
    typeof document === "object" &&
    !ArrayBuffer.isView(document) &&
    typeof (document as DocumentInitParameters).url === "string"
  ) {
    return (document as DocumentInitParameters).url as string;
  }
  // Raw bytes — content isn't identified by a stable key, so don't cache.
  return null;
};

interface PerfOptions {
  disableAutoFetch?: boolean;
  disableStream?: boolean;
  rangeChunkSize?: number;
  withCredentials?: boolean;
  httpHeaders?: Record<string, string>;
}

const stripUndefined = <T extends object>(obj: T): Partial<T> => {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj))
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
};

// Security defaults: PDFs can embed JavaScript (form actions, annotations) that
// pdf.js will otherwise evaluate. Viewers routinely load untrusted documents, so
// scripting is off unless the consumer explicitly re-enables it through
// DocumentInitParameters (their fields win over these defaults).
const SECURE_DEFAULTS = {
  enableScripting: false,
  isEvalSupported: false,
};

const buildSource = (
  document: string | URL | TypedArray | DocumentInitParameters,
  perf: PerfOptions,
) => {
  const cleaned = { ...SECURE_DEFAULTS, ...stripUndefined(perf) };
  if (typeof document === "string" || document instanceof URL) {
    return { url: document, ...cleaned };
  }
  if (ArrayBuffer.isView(document)) {
    // Raw bytes: streaming options don't apply, but scripting defaults do.
    return { ...SECURE_DEFAULTS, data: document };
  }
  // DocumentInitParameters — caller's explicit fields win over our defaults.
  return { ...cleaned, ...document };
};

/**
 * The props type for {@link PdfLoader}.
 *
 * @category Component Properties
 */
export interface PdfLoaderProps {
  /**
   * The document to be loaded by PDF.js.
   * If you need to pass HTTP headers, auth parameters,
   * or other pdf settings, do it through here.
   */
  document: string | URL | TypedArray | DocumentInitParameters;

  /**
   * Callback to render content before the PDF document is loaded. Receives the
   * PDF.js progress, or `null` before any progress is known (e.g. a cache hit).
   *
   * @param progress - PDF.js progress status, or null.
   * @returns - Component to be rendered in space of the PDF document while loading.
   */
  beforeLoad?(progress: OnProgressParameters | null): ReactNode;

  /**
   * Component to render in the case of any PDF loading errors.
   *
   * @param error - PDF loading error.
   * @returns - Component to be rendered in space of the PDF document.
   */
  errorMessage?(error: Error): ReactNode;

  /**
   * Child components to use/render the loaded PDF document.
   *
   * @param pdfDocument - The loaded PDF document.
   * @returns - Component to render once PDF document is loaded.
   */
  children(pdfDocument: PDFDocumentProxy): ReactNode;

  /**
   * Callback triggered whenever an error occurs.
   *
   * @param error - PDF Loading error triggering the event.
   * @returns - Component to be rendered in space of the PDF document.
   */
  onError?(error: Error): void;

  /**
   * Optional PDF.js worker source override. By default, PdfLoader resolves the
   * worker from the installed pdfjs-dist package so bundlers can emit it locally.
   */
  workerSrc?: string;

  /**
   * Only fetch the pages needed to render, instead of background-downloading the
   * whole file. Makes the first page appear fast for large PDFs served over an
   * API — provided the server supports HTTP range requests (`Accept-Ranges:
   * bytes`). Has no effect for servers without range support or for raw bytes.
   * @default true
   */
  disableAutoFetch?: boolean;

  /** Disable progressive streaming of the response. @default false */
  disableStream?: boolean;

  /** Size (bytes) of each range request when streaming. PDF.js default ~64KB. */
  rangeChunkSize?: number;

  /** Send credentials (cookies) with the document request. */
  withCredentials?: boolean;

  /** Extra HTTP headers for the document request (e.g. an auth token). */
  httpHeaders?: Record<string, string>;

  /**
   * Cache the loaded document so re-opening the same URL (or a StrictMode/
   * remount) reuses it instead of re-downloading. Only URL-based documents are
   * cached. Disable if the same URL can return different content.
   * @default true
   */
  enableCache?: boolean;
}

/**
 * A component for loading a PDF document and passing it to a child.
 *
 * @category Component
 */
export const PdfLoader = ({
  document,
  beforeLoad = DEFAULT_BEFORE_LOAD,
  errorMessage = DEFAULT_ERROR_MESSAGE,
  children,
  onError = DEFAULT_ON_ERROR,
  workerSrc = DEFAULT_WORKER_SRC,
  disableAutoFetch = true,
  disableStream,
  rangeChunkSize,
  withCredentials,
  httpHeaders,
  enableCache = true,
}: PdfLoaderProps) => {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loadingProgress, setLoadingProgress] =
    useState<OnProgressParameters | null>(null);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const httpHeadersKey = httpHeaders ? JSON.stringify(httpHeaders) : "";

  useEffect(() => {
    GlobalWorkerOptions.workerSrc = workerSrc;
    let cancelled = false;
    setPdfDocument(null);
    setError(null);
    setLoadingProgress(null);

    const key = enableCache ? cacheKeyOf(document) : null;
    let entry: CacheEntry;
    const cached = key ? docCache.get(key) : undefined;

    if (cached) {
      // Reuse the in-flight or finished load — no new network request.
      console.log("[PdfLoader] cache hit", key);
      entry = cached;
      entry.refs += 1;
      entry.used = ++lruTick;
    } else {
      console.log("[PdfLoader] loading", key ?? "(bytes)", {
        disableAutoFetch,
      });
      const task = getDocument(
        buildSource(document, {
          disableAutoFetch,
          disableStream,
          rangeChunkSize,
          withCredentials,
          httpHeaders,
        }) as Parameters<typeof getDocument>[0],
      );
      task.onProgress = (progress: OnProgressParameters) => {
        if (!cancelled)
          setLoadingProgress(progress.loaded > progress.total ? null : progress);
      };
      entry = { task, promise: task.promise, refs: 1, used: ++lruTick };
      if (key) {
        docCache.set(key, entry);
        evictIfNeeded();
      }
    }

    entry.promise
      .then((proxy: PDFDocumentProxy) => {
        if (!cancelled) setPdfDocument(proxy);
      })
      .catch((err: Error) => {
        if (cancelled || err.message === "Worker was destroyed") return;
        setError(err);
        onErrorRef.current(err);
      })
      .finally(() => {
        if (!cancelled) setLoadingProgress(null);
      });

    return () => {
      cancelled = true;
      entry.refs -= 1;
      if (key && docCache.has(key)) {
        // Keep cached for reuse; only drop if over budget and unused.
        entry.used = ++lruTick;
        evictIfNeeded();
      } else {
        // Uncached (raw bytes / caching disabled) — release it.
        entry.task.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    document,
    workerSrc,
    disableAutoFetch,
    disableStream,
    rangeChunkSize,
    withCredentials,
    httpHeadersKey,
    enableCache,
  ]);

  if (error) return errorMessage(error);
  if (pdfDocument) return children(pdfDocument);
  return beforeLoad(loadingProgress);
};
