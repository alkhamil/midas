export interface SubmitResult {
  success: boolean;
  fieldErrors?: Record<string, string>;
  toastMessage?: string;
  data?: unknown;
}
