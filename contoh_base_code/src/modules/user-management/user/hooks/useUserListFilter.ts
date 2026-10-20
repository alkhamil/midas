import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { t } from 'i18next';
import '../../../../shared/i18n';
import type { FilterField } from '../../../../shared/components/ui';
import type { GetUsersParams } from '../types';
import { getRoleOptions } from '../api';
import { useDebounce, useUrlPagination } from '../../../../shared/hooks';

export function useUserListFilter() {
  const [searchParams] = useSearchParams();
  const { page, setPage, pageSize, setPageSize, handlePageSizeChange } = useUrlPagination();
  const [sortKey, setSortKey] = useState('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') ?? '');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    if (status) initial.status = status;
    if (role) initial.role = role;
    return initial;
  });

  const filterFields: FilterField[] = [
    {
      name: 'status',
      label: t('table.status'),
      type: 'select',
      placeholder: t('user.fields.status.placeholder'),
      options: [
        { label: t('common.active'), value: 'active' },
        { label: t('common.inactive'), value: 'inactive' },
      ],
    },
    {
      name: 'role',
      label: t('user.fields.role.label'),
      type: 'select',
      placeholder: t('user.fields.role.placeholder'),
      loadOptions: getRoleOptions,
    },
  ];

  const queryParams: GetUsersParams = {
    search: debouncedSearchQuery || undefined,
    status: filterValues.status || undefined,
    role: filterValues.role || undefined,
    order: sortKey,
    sort: sortDir,
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
