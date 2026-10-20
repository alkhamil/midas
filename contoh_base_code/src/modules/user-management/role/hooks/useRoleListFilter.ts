import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { t } from 'i18next';
import '../../../../shared/i18n';
import type { FilterField } from '../../../../shared/components/ui';
import type { GetRolesParams } from '../types';
import { useDebounce, useUrlPagination } from '../../../../shared/hooks';

export function useRoleListFilter() {
  const [searchParams] = useSearchParams();
  // filterFields di dalam hook agar t() dievaluasi setelah locale modul terdaftar.
  const filterFields: FilterField[] = [
    {
      name: 'status',
      label: t('table.status'),
      type: 'select',
      placeholder: t('role.fields.status.placeholder'),
      options: [
        { label: t('common.active'), value: 'active' },
        { label: t('common.inactive'), value: 'inactive' },
      ],
    },
  ];
  const { page, setPage, pageSize, setPageSize, handlePageSizeChange } = useUrlPagination();
  const [sortKey, setSortKey] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') ?? '');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const status = searchParams.get('status');
    if (status) initial.status = status;
    return initial;
  });
  const nodata = searchParams.get('nodata');

  const queryParams: GetRolesParams = {
    search: debouncedSearchQuery || undefined,
    status: filterValues.status || undefined,
    nodata: nodata === 'true' ? 'true' : undefined,
    order: sortKey,
    sort: sortKey ? sortDir : undefined,
    page,
    size: pageSize,
  };

  const isFilterActive = !!debouncedSearchQuery || Object.values(filterValues).some(Boolean);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setPage(1);
  }

  function handleApply(values: Record<string, string>, options?: { resetPage?: boolean }) {
    setFilterValues(values);
    if (options?.resetPage !== false) setPage(1);
  }

  function handleReset() {
    setFilterValues({});
    setPage(1);
  }

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return {
    filterFields,
    page,
    setPage,
    pageSize,
    setPageSize,
    handlePageSizeChange,
    sortKey,
    sortDir,
    searchQuery,
    filterValues,
    queryParams,
    isFilterActive,
    handleSearchChange,
    handleApply,
    handleReset,
    handleSort,
  };
}
