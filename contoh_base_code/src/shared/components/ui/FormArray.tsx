/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { useFieldArray, useFormContext, useWatch, type FieldValues, type Path } from 'react-hook-form';

interface FormArrayProps<T extends FieldValues> {
  name: Path<T>;
  children: (args: {
    fields: { id: string }[];
    append: (value: any) => void;
    remove: (index: number) => void;
    isAddDisabled: boolean;
  }) => React.ReactNode;
  className?: string;
  testId?: string;
}

function FormArray<T extends FieldValues>({
  name,
  children,
  className,
  testId,
}: FormArrayProps<T>) {
  const { control } = useFormContext<T>();
  const { fields, append, remove } = useFieldArray<T>({
    control,
    name: name as any,
  });

  const values = useWatch({
    control,
    name: name as any,
  });

  const isAddDisabled = useMemo(() => {
    if (fields.length === 0) return false;

    const lastIndex = fields.length - 1;
    const lastRow = values?.[lastIndex];
    if (!lastRow) return false;

    return Object.values(lastRow).some(
      (v) => v === '' || v === null || v === undefined,
    );
  }, [fields, values]);

  const safeAppend = (value: any) => {
    append(value, { shouldFocus: true });
  };

  return (
    <div data-testid={testId} className={className}>
      {children({
        fields,
        append: safeAppend,
        remove,
        isAddDisabled,
      })}
    </div>
  );
}

export default FormArray;
