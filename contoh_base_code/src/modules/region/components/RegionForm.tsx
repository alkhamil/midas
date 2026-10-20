import { useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import {
  Card,
  Button,
  FormGroup,
  FormItem,
  FormDefaultValuesWatcher,
  TextField,
  TextAreaField,
  PasswordField,
  SelectField,
  NavigationGuard,
} from '../../../shared/components/ui';
import type { FormValues } from '../hooks';
import type { SubmitResult } from '../../../shared/types';
import { type UseFormReturn } from 'react-hook-form';
import type { SelectOption } from '../types';
import { getTextRules, getNumberRules, getTextareaRules, getTextarea2Rules, getPasswordRules, getSelectRules } from '../validation/regionValidation';

interface RegionFormProps {
  defaultValues: FormValues;
  onSubmit: (data: FormValues) => Promise<SubmitResult>;
  onCancel: () => void;
  isEdit?: boolean;
  isSubmitting?: boolean;
  selectOptions: SelectOption[];
}

function RegionForm({
  defaultValues,
  onSubmit,
  onCancel,
  isEdit = false,
  isSubmitting = false,
  selectOptions,
}: RegionFormProps) {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const setErrorRef = useRef<((name: keyof FormValues, error: { message: string }) => void) | null>(
    null,
  );
  const methodsRef = useRef<UseFormReturn<FormValues> | null>(null);

  const handleFormSubmit = useCallback(
    async (data: FormValues) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setSubmitted(false);
      let success = false;
      try {
        const result = await onSubmit(data);
        if (result.fieldErrors && setErrorRef.current) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            setErrorRef.current(field as keyof FormValues, { message });
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

  return (
    <div className="flex min-h-full flex-col stack-gap">
      <div>
        <Button
          data-testid="region-back-button"
          type="button"
          variant="secondary"
          icon={<ChevronLeft className="h-4 w-4" />}
          onClick={onCancel}
        >
          {t('common.back')}
        </Button>
      </div>
      <Card testId="region-form-card" title={isEdit ? t('runtime.editTitle', { singular: t('region.label') }) : t('runtime.createTitle', { singular: t('region.label') })}>
        <FormGroup<FormValues>
          testId="region-form"
          defaultValues={defaultValues}
          onSubmit={handleFormSubmit}
        >
          {(methods) => {
            setErrorRef.current = methods.setError;
            methodsRef.current = methods;

            return (
              <>
                <FormDefaultValuesWatcher methods={methods} defaultValues={defaultValues} />

                <div className="grid grid-cols-12 field-gap">
              <div className="col-span-12">
                <FormItem
                  label={t('region.fields.textarea2.label')}
                  testId="region-textarea2"
                  name="textarea2"
                  rules={getTextarea2Rules(t)}
                  layout="horizontal"
                  component={TextAreaField}
                  placeholder={t('region.fields.textarea2.placeholder')}
                />
              </div>

              <div className="col-span-12">
                <FormItem
                  label={t('region.fields.textarea.label')}
                  testId="region-textarea"
                  name="textarea"
                  rules={getTextareaRules(t)}
                  layout="horizontal"
                  component={TextAreaField}
                  placeholder={t('region.fields.textarea.placeholder')}
                />
              </div>

              <div className="col-span-12">
                <FormItem
                  label={t('region.fields.select.label')}
                  testId="region-select"
                  name="select"
                  rules={getSelectRules(t)}
                  layout="horizontal"
                  component={SelectField}
                  placeholder={t('region.fields.select.placeholder')}
                  options={selectOptions}
                  clearable={false}
                  searchable
                />
              </div>

              <div className="col-span-12">
                <FormItem
                  label={t('region.fields.text.label')}
                  testId="region-text"
                  name="text"
                  rules={getTextRules(t)}
                  layout="horizontal"
                  component={TextField}
                  placeholder={t('region.fields.text.placeholder')}
                />
              </div>

              <div className="col-span-12">
                <FormItem
                  label={t('region.fields.password.label')}
                  testId="region-password"
                  name="password"
                  rules={getPasswordRules(t)}
                  layout="horizontal"
                  component={PasswordField}
                  placeholder={t('region.fields.password.placeholder')}
                />
              </div>

              <div className="col-span-12">
                <FormItem
                  label={t('region.fields.number.label')}
                  testId="region-number"
                  name="number"
                  rules={getNumberRules(t)}
                  layout="horizontal"
                  component={TextField}
                  currency
                  placeholder={t('region.fields.number.placeholder')}
                />
              </div>
                </div>

                <div className="-mx-5 mt-6 flex items-center justify-end gap-2 border-t border-border px-5 pt-4">
                  <Button
                    data-testid="region-cancel-button"
                    type="button"
                    variant="secondary"
                    className="w-30"
                    onClick={onCancel}
                  >
                    {t('common.cancel')}
                  </Button>
                <Button
                  data-testid="region-submit-button"
                  type="submit"
                  className="w-30"
                  disabled={isSubmitting || submitting}
                >
                  {isEdit ? t('common.update') : t('common.create')}
                </Button>
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

export default RegionForm;
