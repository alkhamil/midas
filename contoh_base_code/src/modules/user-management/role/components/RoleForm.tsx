import { useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Button,
  FormGroup,
  FormItem,
  TextField,
  NavigationGuard,
} from '../../../../shared/components/ui';
import type { FormValues } from '../hooks';
import type { SubmitResult } from '../../../../shared/types';
import { getNameRules, getPermissionsRules } from '../validation/roleValidation';
import { type UseFormReturn } from 'react-hook-form';
import PermissionTable from './PermissionTable';

interface RoleFormProps {
  defaultValues: FormValues;
  onSubmit: (data: FormValues) => Promise<SubmitResult>;
  onCancel: () => void;
  isEdit?: boolean;
  isSubmitting?: boolean;
  catalog: string[];
}

function RoleForm({
  defaultValues,
  onSubmit,
  onCancel,
  isEdit = false,
  isSubmitting = false,
  catalog,
}: RoleFormProps) {
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
    <Card
      testId="role-form-card"
      title={
        isEdit
          ? t('runtime.editTitle', { singular: t('role.label') })
          : t('runtime.createTitle', { singular: t('role.label') })
      }
    >
      <FormGroup<FormValues>
        testId="role-form"
        defaultValues={defaultValues}
        onSubmit={handleFormSubmit}
      >
        {(methods) => {
          setErrorRef.current = methods.setError;
          methodsRef.current = methods;

          return (
            <>
              <div className="space-y-6">
                <FormItem
                  testId="role-name"
                  label={t('role.fields.name.label')}
                  name="name"
                  component={TextField}
                  rules={getNameRules(t)}
                  maxLength={100}
                  layout="horizontal"
                  placeholder={t('role.fields.name.placeholder')}
                />

                <FormItem
                  testId="role-permissions"
                  label={t('role.fields.permissions.label')}
                  name="permissions"
                  component={PermissionTable}
                  rules={getPermissionsRules(t)}
                  layout="horizontal"
                  align="start"
                  catalog={catalog}
                />
              </div>

              <div className="-mx-5 mt-6 flex items-center justify-end gap-2 border-t border-gray-100 px-5 pt-4">
                <Button
                  data-testid="role-back-button"
                  type="button"
                  variant="secondary"
                  className="w-30"
                  onClick={onCancel}
                >
                  {t('common.back')}
                </Button>
                <Button
                  data-testid="role-submit-button"
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
  );
}

export default RoleForm;
