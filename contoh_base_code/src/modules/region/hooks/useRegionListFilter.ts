import { t } from 'i18next';
import '../../../shared/i18n';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { FilterField } from '../../../shared/components/ui';
import type { GetRegionsParams } from '../types';
import { useDebounce, useUrlPagination } from '../../../shared/hooks';

export function useRegionListFilter() {
  const [searchParams] = useSearchParams();
  // filterFields dibangun di dalam hook: t() modul dievaluasi saat render,
  // setelah addModuleLocales terdaftar (konstanta level-modul membeku jadi key mentah).
  const filterFields: FilterField[] = [
    {
        name: 'status',
        label: t('table.status'),
        type: 'select',
        options: [
          { label: t('common.active'), value: 'active' },
          { label: t('common.inactive'), value: 'inactive' },
        ],
      },
    {
        name: 'text',
        label: t('region.fields.text.label'),
        type: 'text',
        placeholder: t('filter.containsPh'),
      },
    {
        name: 'number',
        label: t('region.fields.number.label'),
        type: 'text',
      },
    {
        name: 'textarea',
        label: t('region.fields.textarea.label'),
        type: 'text',
        placeholder: t('filter.containsPh'),
      },
    {
        name: 'textarea2',
        label: t('region.fields.textarea2.label'),
        type: 'text',
        placeholder: t('filter.containsPh'),
      },
    {
        name: 'select',
        label: t('region.fields.select.label'),
        type: 'select',
        options: [
          { label: 'Option 1', value: 'option_1' },
          { label: 'Option 2', value: 'option_2' },
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
    const statusValue = searchParams.get('status');
    if (statusValue) initial.status = statusValue;
    const textValue = searchParams.get('text');
    if (textValue) initial.text = textValue;
    const numberValue = searchParams.get('number');
    if (numberValue) initial.number = numberValue;
    const textareaValue = searchParams.get('textarea');
    if (textareaValue) initial.textarea = textareaValue;
    const textarea2Value = searchParams.get('textarea2');
    if (textarea2Value) initial.textarea2 = textarea2Value;
    const selectValue = searchParams.get('select');
    if (selectValue) initial.select = selectValue;
    return initial;
  });

  const queryParams: GetRegionsParams = {
    search: debouncedSearchQuery || undefined,
    status: filterValues.status || undefined,
    text: filterValues.text || undefined,
    number: filterValues.number || undefined,
    textarea: filterValues.textarea || undefined,
    textarea2: filterValues.textarea2 || undefined,
    select: filterValues.select || undefined,
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
