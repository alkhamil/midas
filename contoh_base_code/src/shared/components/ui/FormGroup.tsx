import { type ReactNode } from 'react';
import {
  useForm,
  FormProvider,
  type DefaultValues,
  type UseFormReturn,
  type UseFormProps,
  type FieldValues,
} from 'react-hook-form';

interface FormGroupProps<T extends FieldValues> {
  defaultValues: DefaultValues<T>;
  onSubmit: (data: T) => void;
  children: ReactNode | ((methods: UseFormReturn<T>) => ReactNode);
  className?: string;
  testId?: string;
  mode?: UseFormProps<T>['mode'];
  /** Id form — untuk tombol submit di luar form (mis. footer Dialog via `form=`). */
  id?: string;
}

function FormGroup<T extends FieldValues>({
  defaultValues,
  onSubmit,
  children,
  className = '',
  testId,
  mode = 'onBlur',
  id,
}: FormGroupProps<T>) {
  const methods: UseFormReturn<T> = useForm<T>({ defaultValues, mode });

  return (
    <FormProvider {...methods}>
      <form
        id={id}
        data-testid={testId}
        onSubmit={methods.handleSubmit(onSubmit)}
        className={className}
      >
        {typeof children === 'function' ? children(methods) : children}
      </form>
    </FormProvider>
  );
}

export default FormGroup;
