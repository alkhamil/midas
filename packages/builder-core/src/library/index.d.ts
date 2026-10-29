// Types of the library package generator (library/).
export function generateComponent(opts: {
  ctx: any;
  mapping: { componentKey: string; componentName: string; exportName: string; propsMap: { props: any[] } };
  types?: 'generated' | 'inline';
  iconOf?: (componentKey: string) => string | null;
  importPrefix?: string;
  resolveImport?: ((exportName: string) => string) | null;
  iconNames?: Set<string> | null;
  tailwind?: boolean;
  colors?: Set<string>;
  classes?: Set<string>;
  inputs?: { layers: Set<string>; tag: 'input' | 'textarea' } | null;
  slot?: Set<string> | null;
}): { source: string; dts: string; warnings: string[]; components: string[]; icons: string[] };

export interface LibraryPackageComponent { key: string; name: string; exportName: string; internal: boolean; /** Has hand-made behaviour (clicks, value, open...), not only hover and focus states. */ interactive?: boolean; props: { name: string; type: 'enum' | 'boolean' | 'string' | 'node'; label?: string; values?: Record<string, string>; def?: string | boolean; /** The type as a developer writes it, when it is not one of the basic ones (`SelectOption[]`). */ ts?: string; /** A value the documentation's preview passes (a list of options for a Select). */ demo?: unknown }[] }
export interface LibraryPackageIssue { level: 'error' | 'warning'; /** 'design': it still becomes code but the design needs polish; 'code': something could not be written as code. */ kind: 'design' | 'code'; component: string; layer?: string; nodeId?: string; message: string; fix: string; /** How many places the same tip appears in (variants of one component). */ count?: number }
export interface LibraryPackageResult { files: Record<string, string>; components: LibraryPackageComponent[]; icons: { key: string; name: string; exportName: string }[]; issues: LibraryPackageIssue[]; warnings: string[]; packageName: string; version: string; /** Every Tailwind class the components use (the stylesheet is compiled for them). */ classes: string[]; /** The Tailwind theme (`@theme`) the stylesheet is compiled with. */ themeCss: string }
/** A published library version → the files of a React package (`src/` sources and `dist/*.d.ts`; the server compiles `src/` to `dist/index.js`). */
export function libraryPackage(snapshot: { components: { id: string; name: string; set?: boolean; hidden?: boolean; nodes: any[] }[]; variables?: any }, opts?: { packageName?: string; version?: string; libraryName?: string; onProgress?: (e: { phase: string; current?: number; total?: number; name?: string; components?: number; icons?: number }) => void }): LibraryPackageResult;
export function buildPropsMap(holder: any, kids?: any[]): { props: any[] };
export function tokensCss(variables: any): string;
export const RUNTIME: string;
export function behaviorFor(c: { name: string; exportName: string; props: any[] }): null | { kit: 'kit' | 'generic'; inputs?: { layers: Set<string>; tag: 'input' | 'textarea' }; slot?: Set<string>; files: Record<string, string>; props: any[]; extraExports: string[] };
export const TAILWIND_PREFIX: string;
export function tailwindClasses(style: Record<string, string | number | null | undefined>, opts?: { colors?: Set<string> }): string[];
export function colorTokens(variables: any): Map<string, string>;
export function tailwindTheme(variables: any, opts?: { reset?: boolean }): string;
export function tailwindPreset(variables: any): string;
export function iconSvg(nodes: any[], rootId: string): { width: number; height: number; parts: { tag: 'path' | 'rect' | 'ellipse'; attrs: Record<string, string | number> }[]; warnings: string[] };
export function isIconComponent(component: { id: string; set?: boolean; nodes: any[] }): boolean;
export function kebabName(s: string): string;
