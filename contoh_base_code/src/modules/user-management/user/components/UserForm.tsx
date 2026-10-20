import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseFormReturn } from 'react-hook-form';
import {
  Card,
  Button,
  FormGroup,
  FormItem,
  SelectField,
  SwitchField,
  TextField,
  PasswordField,
  NavigationGuard,
} from '../../../../shared/components/ui';
import { getRoleOptions } from '../api';
import {
  getEmailRules,
  getNameRules,
  getPasswordRules,
  getRoleIdRules,
  getUsernameRules,
} from '../validation/userValidation';
import type { FormValues } from '../hooks';
import type { SubmitResult } from '../../../../shared/types';
import type { User } from '../types';

interface UserFormProps {
  defaultValues: FormValues;
  /**
   * User yang sedang di-edit (undefined saat mode create). Dipakai untuk
   * men-seed label field Role supaya langsung tampil benar walau opsinya
   * belum ke-fetch lewat loadOptions.
   */
  user?: User;
  onSubmit: (data: FormValues) => Promise<SubmitResult>;
  onCancel: () => void;
  isEdit?: boolean;
}

function UserForm({ defaultValues, user, onSubmit, onCancel, isEdit = false }: UserFormProps) {
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
      testId="user-form-card"
      title={
        isEdit
          ? t('runtime.editTitle', { singular: t('user.label') })
          : t('runtime.createTitle', { singular: t('user.label') })
      }
    >
      <FormGroup<FormValues>
        testId="user-form"
        defaultValues={defaultValues}
        onSubmit={handleFormSubmit}
      >
        {(methods) => {
          setErrorRef.current = methods.setError;
          methodsRef.current = methods;
          const isSubmitting = methods.formState.isSubmitting;
          return (
            <>
              <div className="space-y-8">
                <FormItem
                  testId="user-name"
                  label={t('user.fields.name.label')}
                  name="name"
                  component={TextField}
                  rules={getNameRules(t)}
                  layout="horizontal"
                  placeholder={t('user.fields.name.placeholder')}
                  maxLength={100}
                />

                <FormItem
                  testId="user-role"
                  label={t('user.fields.role.label')}
                  name="role_id"
                  component={SelectField}
                  rules={getRoleIdRules(t)}
                  layout="horizontal"
                  placeholder={t('user.fields.role.placeholder')}
                  clearable={false}
                  loadOptions={getRoleOptions}
                  searchable
                  defaultOption={
                    user ? { value: user.role_id, label: user.role_name } : undefined
                  }
                />

                <FormItem
                  testId="user-username"
                  label={t('user.fields.username.label')}
                  name="username"
                  component={TextField}
                  rules={getUsernameRules(t)}
                  layout="horizontal"
                  placeholder={t('user.fields.username.placeholder')}
                  maxLength={50}
                />

                <FormItem
                  testId="user-email"
                  label={t('user.fields.email.label')}
                  name="email"
                  component={TextField}
                  rules={getEmailRules(t)}
                  layout="horizontal"
                  placeholder={t('user.fields.email.placeholder')}
                />

                {!isEdit && (
                  <FormItem
                    testId="user-password"
                    label={t('user.fields.password.label')}
                    name="password"
                    component={PasswordField}
                    rules={getPasswordRules(t)}
                    layout="horizontal"
                    placeholder={t('user.fields.password.placeholder')}
                  />
                )}

                <FormItem
                  testId="user-status"
                  label={t('user.fields.status.label')}
                  name="status"
                  component={SwitchField}
                  layout="horizontal"
                  showCheckedLabels={false}
                  switchLabel={t('common.active')}
                />
              </div>

              <div className="-mx-5 mt-6 flex items-center justify-end gap-3 border-t border-gray-100 px-5 pt-4">
                <Button
                  data-testid="user-back-button"
                  type="button"
                  variant="secondary"
                  className="w-30"
                  onClick={onCancel}
                >
                  {t('common.back')}
                </Button>
                <Button
                  data-testid="user-submit-button"
                  type="submit"
                  className="w-30"
                  disabled={isSubmitting || submitting}
                >
                  {isEdit ? t('common.save') : t('common.create')}
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

export default UserForm;
