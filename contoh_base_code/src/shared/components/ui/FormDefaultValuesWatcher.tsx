import { useEffect, useRef } from 'react';
import { type DefaultValues, type FieldValues, type UseFormReturn } from 'react-hook-form';

interface FormDefaultValuesWatcherProps<T extends FieldValues> {
  methods: UseFormReturn<T>;
  defaultValues: DefaultValues<T>;
}

/**
 * Sinkronkan ulang form saat `defaultValues` berubah — mis. data detail
 * tiba belakangan di halaman edit. `useForm` hanya memakai defaultValues
 * saat inisialisasi, jadi tanpa ini form edit akan tetap kosong.
 *
 * Dipakai di dalam children render-prop `FormGroup`:
 * `<FormDefaultValuesWatcher methods={methods} defaultValues={defaultValues} />`
 */
function FormDefaultValuesWatcher<T extends FieldValues>({
  methods,
  defaultValues,
}: FormDefaultValuesWatcherProps<T>) {
  const prevSerialized = useRef(JSON.stringify(defaultValues));

  useEffect(() => {
    const serialized = JSON.stringify(defaultValues);
    if (serialized !== prevSerialized.current) {
      prevSerialized.current = serialized;
      methods.reset(defaultValues);
    }
  }, [defaultValues, methods]);

  return null;
}

export default FormDefaultValuesWatcher;
