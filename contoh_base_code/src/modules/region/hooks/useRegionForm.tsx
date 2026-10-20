import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useToast, Badge } from '../../../shared/components/ui';
import type { DetailRow } from '../../../shared/components/ui';
import type { SubmitResult } from '../../../shared/types';
import {
  capitalize,
  isConnectionError,
  mapSubmitError,
  parseCurrency,
  splitFieldErrors,
  getErrorStateType,
  formatNumber,
} from '../../../shared/utils';
import type { Region } from '../types';
import { useRegionDetailQuery, useUpsertRegion, useSelectOptionsQuery } from '../api';

export interface FormValues {
  text: string;
  number: string;
  textarea: string;
  textarea2: string;
  password: string;
  select: string;
}

function buildDefaultValues(item?: Region): FormValues {
  return item
    ? {
        text: item.text,
        number: String(item.number ?? ''),
        textarea: item.textarea,
        textarea2: item.textarea2,
        password: item.password,
        select: item.select,
      }
    : {
        text: '',
        number: '',
        textarea: '',
        textarea2: '',
        password: '',
        select: '',
      };
}

export function useRegionForm(id?: string) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = !!id;

  const query = useRegionDetailQuery(id);
  const selectOptionsQuery = useSelectOptionsQuery();
  const upsertMutation = useUpsertRegion();

  const region = query.data;

  async function onSubmit(data: FormValues): Promise<SubmitResult> {
    try {
      const res = await upsertMutation.mutateAsync({
        id: isEdit ? id : undefined,
        data: {
          text: data.text,
          number: parseCurrency(data.number),
          textarea: data.textarea,
          textarea2: data.textarea2,
          password: data.password,
          select: data.select,
        },
      });

      showToast({ message: res.message, variant: 'success' });
      setTimeout(() => navigate('/regions'), 500);
      return { success: true };
    } catch (err: unknown) {
      const fallback = isEdit
        ? t('runtime.saveFailedUpdate', { singular: t('region.label') })
        : t('runtime.saveFailedCreate', { singular: t('region.label') });
      const result = mapSubmitError(err, fallback);
      if (result.fieldErrors) {
        const { fieldErrors, unknownMessage } = splitFieldErrors(
          result.fieldErrors,
          (field) => field,
        );
        if (unknownMessage) showToast({ message: unknownMessage, variant: 'error' });
        return Object.keys(fieldErrors).length > 0
          ? { success: false, fieldErrors }
          : { success: false };
      }
      if (result.toastMessage) {
        showToast({ message: result.toastMessage, variant: 'error' });
      }
      return result;
    }
  }

  function onCancel() {
    navigate(-1);
  }

  const detailRows = useMemo<DetailRow[]>(() => {
    if (!region) {
      return [
        { label: t('table.status'), value: '' },
        { label: t('region.fields.text.label'), value: '' },
        { label: t('region.fields.number.label'), value: '' },
        { label: t('region.fields.textarea.label'), value: '' },
        { label: t('region.fields.textarea2.label'), value: '' },
        { label: t('region.fields.password.label'), value: '' },
        { label: t('region.fields.select.label'), value: '' },
      ];
    }
    return [
      {
        label: t('table.status'),
        value: (
          <Badge variant={region.status === 'active' ? 'success' : 'secondary'}>
            {region.status === 'active' ? t('common.active') : t('common.inactive')}
          </Badge>
        ),
      },
      { label: t('region.fields.text.label'), value: region.text },
      { label: t('region.fields.number.label'), value: formatNumber(region.number) },
      { label: t('region.fields.textarea.label'), value: region.textarea },
      { label: t('region.fields.textarea2.label'), value: region.textarea2 },
      { label: t('region.fields.password.label'), value: '••••••' },
      { label: t('region.fields.select.label'), value: ({'option_1': 'Option 1', 'option_2': 'Option 2'}[region.select] ?? capitalize(String(region.select))) },
      { label: t('table.createdBy'), value: region.createdBy },
      { label: t('table.createdDate'), value: region.createdDate },
    ];
  }, [region]);

  const queryStatus: 'loading' | 'error' | 'success' = query.isLoading
    ? 'loading'
    : query.error
      ? 'error'
      : 'success';

  const defaultValues = useMemo(() => buildDefaultValues(region), [region]);

  return {
    queryStatus,
    queryMessage: query.error?.message ?? undefined,
    errorType: query.error ? getErrorStateType(query.error) : undefined,
    isNetworkError: query.error ? isConnectionError(query.error) : false,
    region,
    refresh: () => query.refetch(),
    detailRows,
    defaultValues,
    isSubmitting: upsertMutation.isPending,
    isEdit,
    onSubmit,
    onCancel,
    selectOptions: selectOptionsQuery.data ?? [],
  };
}
