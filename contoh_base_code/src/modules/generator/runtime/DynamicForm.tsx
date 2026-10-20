/** Form generik — field + validasi + grid layout dari definisi modul. */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import {
  Button,
  Card,
  FormDefaultValuesWatcher,
  FormGroup,
  NavigationGuard,
} from '../../../shared/components/ui';
import type { SubmitResult } from '../../../shared/types';
import type { UseFormReturn } from 'react-hook-form';
import type { GeneratorFieldConfig } from '../types';
import type { ModuleDefinition } from '../definitions';
import { definitionTestId, type DynamicOption } from './types';
import { type DynamicFormValues } from './validation';
import type { LoadOptionsFn } from '../../../shared/components/ui/fields/SelectField';
import { colSpanClass } from './grid';
import { moduleTitle } from './moduleI18n';
import { renderDynamicField } from './fieldRenderer';

interface DynamicFormProps {
  def: ModuleDefinition;
  defaultValues: DynamicFormValues;
  onSubmit: (data: DynamicFormValues) => Promise<SubmitResult>;
  onCancel: () => void;
  isEdit?: boolean;
  isSubmitting?: boolean;
  optionsOf: (field: GeneratorFieldConfig) => DynamicOption[];
  loaderOf: (field: GeneratorFieldConfig) => LoadOptionsFn | undefined;
  /** Tombol aksi di footer Card (dengan divider), bukan inline di body. */
  actionsInFooter?: boolean;
}

function DynamicForm({
  def,
  defaultValues,
  onSubmit,
  onCancel,
  isEdit = false,
  isSubmitting = false,
  optionsOf,
  loaderOf,
  actionsInFooter = false,
}: DynamicFormProps) {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const setErrorRef = useRef<
    ((name: string, error: { message: string }) => void) | null
  >(null);
  const methodsRef = useRef<UseFormReturn<DynamicFormValues> | null>(null);
  const testPrefix = definitionTestId(def.key);

  const handleFormSubmit = useCallback(
    async (data: DynamicFormValues) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setSubmitted(false);
      let success = false;
      try {
        const result = await onSubmit(data);
        if (result.fieldErrors && setErrorRef.current) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            setErrorRef.current(field, { message });
          }
        }
        success = result.success;
        if (result.success) {
          methodsRef.current?.reset(data);
          setSubmitted(true);
        }
      } finally {
        if (!success) {
          submittingRef.current = false;
          setSubmitting(false);
        }
      }
    },
    [onSubmit],
  );

  const byName = new Map(def.fields.map((field) => [field.name, field]));
  const layout = [...def.layout.form]
    .sort((a, b) => a.order - b.order)
    .filter((item) => (item.kind ?? 'field') !== 'field' || byName.has(item.field));

  function renderActionButtons(methods: UseFormReturn<DynamicFormValues>): ReactNode {
    return (
      <>
        <Button
          type="button"
          data-testid={`${testPrefix}-cancel-button`}
          className="w-30"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting || submitting}
        >
          {t('common.cancel')}
        </Button>
        <Button
          data-testid={`${testPrefix}-submit-button`}
          className="w-30"
          variant="primary"
          onClick={methods.handleSubmit(handleFormSubmit)}
          disabled={isSubmitting || submitting}
        >
          {isEdit ? t('common.update') : t('common.create')}
        </Button>
      </>
    );
  }

  function renderFields(): ReactNode {
    return (
      <div className="grid grid-cols-12 field-gap">
        {layout.map((item) => {
          const kind = item.kind ?? 'field';
          if (kind === 'section') {
            return (
              <div key={item.field} className={colSpanClass(item.colSpan)}>
                <p className="border-b border-border pb-1 text-sm font-semibold text-foreground">
                  {item.label ?? 'Section'}
                </p>
              </div>
            );
          }
          if (kind === 'divider') {
            return (
              <div key={item.field} className={colSpanClass(item.colSpan)}>
                <hr className="border-border" />
              </div>
            );
          }
          const field = byName.get(item.field);
          if (!field) return null;
          return (
            <div key={field.name} className={colSpanClass(item.colSpan)}>
              {renderDynamicField(field, { def, testPrefix, optionsOf, loaderOf, span: item.colSpan })}
            </div>
          );
        })}
      </div>
    );
  }

  function renderBackButton(): ReactNode {
    return (
      <div>
        <Button
          type="button"
          data-testid={`${testPrefix}-back-button`}
          variant="secondary"
          icon={<ChevronLeft className="h-4 w-4" />}
          onClick={onCancel}
        >
          {t('common.back')}
        </Button>
      </div>
    );
  }

  if (actionsInFooter) {
    return (
      <div className="flex min-h-full flex-col stack-gap">
        {renderBackButton()}
        <FormGroup<DynamicFormValues>
          testId={`${testPrefix}-form`}
          defaultValues={defaultValues}
          onSubmit={handleFormSubmit}
        >
          {(methods) => {
            setErrorRef.current = methods.setError;
            methodsRef.current = methods;
            return (
              <Card
                testId={`${testPrefix}-form-card`}
                title={moduleTitle(def, isEdit ? 'edit' : 'create', isEdit ? t('runtime.editTitle', { singular: def.singularLabel }) : t('runtime.createTitle', { singular: def.singularLabel }))}
                footer={renderActionButtons(methods)}
              >
                <FormDefaultValuesWatcher methods={methods} defaultValues={defaultValues} />
                {renderFields()}
                <NavigationGuard submitted={submitted} />
              </Card>
            );
          }}
        </FormGroup>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col stack-gap">
      {renderBackButton()}
      <Card testId={`${testPrefix}-form-card`} title={moduleTitle(def, isEdit ? 'edit' : 'create', isEdit ? t('runtime.editTitle', { singular: def.singularLabel }) : t('runtime.createTitle', { singular: def.singularLabel }))}>
        <FormGroup<DynamicFormValues>
          testId={`${testPrefix}-form`}
          defaultValues={defaultValues}
          onSubmit={handleFormSubmit}
        >
          {(methods) => {
            setErrorRef.current = methods.setError;
            methodsRef.current = methods;
            return (
              <>
                <FormDefaultValuesWatcher methods={methods} defaultValues={defaultValues} />
                {renderFields()}
                <div className="mt-6 flex justify-end gap-4">
                  {renderActionButtons(methods)}
                </div>
                <NavigationGuard submitted={submitted} />
              </>
            );
          }}
        </FormGroup>
      </Card>
    </div>
  );
}

export default DynamicForm;
