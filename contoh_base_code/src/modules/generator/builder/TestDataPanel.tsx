/** Canvas Test Data — isi form draft, simpan baris contoh untuk pratinjau list/detail. */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../../shared/components/ui';
import type { ModuleDefinition } from '../definitions';
import type { DynamicFormValues } from '../runtime/validation';
import { formDefaultValue } from '../runtime/validation';
import DynamicForm from '../runtime/DynamicForm';
import { makeOptionsLoader, makeRelationOptionsLoader } from '../runtime/recordsApi';
import type { SubmitResult } from '../../../shared/types';

interface TestDataPanelProps {
  def: ModuleDefinition;
  onAddRow: (values: DynamicFormValues) => void;
}

function TestDataPanel({ def, onAddRow }: TestDataPanelProps) {
  const { t } = useTranslation();
  const defaults: DynamicFormValues = useMemo(() => {
    const values: DynamicFormValues = {};
    for (const field of def.fields) values[field.name] = formDefaultValue(field);
    return values;
  }, [def.fields]);

  async function handleSubmit(data: DynamicFormValues): Promise<SubmitResult> {
    onAddRow(data);
    return { success: true };
  }

  if (def.fields.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('detail.needFields')}</p>;
  }

  return (
    <div className="flex flex-col stack-gap">
      <Alert
        variant="info"
        message={t('detail.testHint')}
      />
      <DynamicForm
        def={def}
        defaultValues={defaults}
        onSubmit={handleSubmit}
        onCancel={() => {}}
        actionsInFooter
        optionsOf={(field) => (field.options ?? []).map((option) => ({ ...option }))}
        loaderOf={(field) =>
          field.source === 'mockPagingInfinityScroll'
            ? makeOptionsLoader(def, field)
            : field.source === 'relation'
              ? makeRelationOptionsLoader(field)
              : undefined
        }
      />
    </div>
  );
}

export default TestDataPanel;
