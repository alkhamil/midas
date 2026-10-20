import { t } from 'i18next';
import '../i18n';

export const listEmptyState = (
  moduleListName: string,
  description?: string,
) =>
  ({
    title: t('runtime.emptyList', { singular: moduleListName }),
    description: description ?? t('runtime.emptyDesc'),
  }) as const;
