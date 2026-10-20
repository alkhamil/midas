import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 10;

interface UseUrlPaginationResult {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  handlePageSizeChange: (size: number) => void;
}

/**
 * Kelola `page` & `size` di query params agar nilainya bertahan saat refresh /
 * back. `size` di luar daftar opsi (mis. dimanipulasi via URL) di-clamp ke
 * default.
 */
export function useUrlPagination(): UseUrlPaginationResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPage = Number(searchParams.get('page'));
  const urlSize = Number(searchParams.get('size'));

  const [page, setPageState] = useState(urlPage > 0 ? urlPage : 1);
  const [pageSize, setPageSizeState] = useState(
    (PAGE_SIZE_OPTIONS as readonly number[]).includes(urlSize) ? urlSize : DEFAULT_PAGE_SIZE,
  );

  const updateParams = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === undefined || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  function setPage(next: number) {
    setPageState(next);
    updateParams({ page: next > 1 ? next : undefined });
  }

  function handlePageSizeChange(next: number) {
    setPageSizeState(next);
    setPage(1);
    updateParams({ size: next, page: undefined });
  }

  return { page, setPage, pageSize, setPageSize: setPageSizeState, handlePageSizeChange };
}
