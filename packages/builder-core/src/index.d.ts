// Tipe publik @midas/builder-core (implementasi JS murni; tipe longgar supaya Studio/CLI mudah memakainya).
export interface BuilderField { name: string; label?: string; type: string; required?: boolean; sortable?: boolean; filterable?: boolean; options?: string[]; relation?: string }
export interface NodeConfig {
  props?: Record<string, string | number | boolean>;
  text?: string;
  hidden?: boolean;
  field?: string;
  action?: { type: 'none' | 'navigate' | 'submit' | 'back'; screenId?: string };
  table?: { columns?: string[]; rowActions?: ('view' | 'edit' | 'delete')[]; pageSize?: number };
  /** State mapping: setiap state → properti → nilai (variable collection + variable, atau nilai manual). */
  stateMapping?: Record<string, Record<string, StyleValue>>;
  /** Interaction: trigger + actions (navigate, open dropdown/overlay/popover, close overlay, set variable, set selected). */
  interactions?: Interaction[];
  /** Perilaku input field: layer typeable, tipe input, validasi. */
  inputBehavior?: InputBehavior;
}
export interface StyleValue { value?: string | number; variableId?: string; collectionId?: string }
export interface Action {
  type: 'navigate' | 'open-dropdown' | 'open-overlay' | 'open-popover' | 'close-overlay' | 'set-variable' | 'set-selected';
  targetFrameId?: string;
  targetComponentId?: string;
  position?: string;
  offset?: number;
  anchor?: string;
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  close?: string;
  /** set-variable: the variable collection and the mode it switches to (all its variables follow). */
  collectionId?: string;
  modeId?: string;
  /** set-variable in older files: one variable and the value it is given. */
  variableId?: string;
  value?: string | number | boolean;
  /** set-selected: flip, switch on, or switch on and the others of its kind off. */
  mode?: 'toggle' | 'select' | 'exclusive';
}
export interface Interaction {
  id: string;
  trigger: 'onClick' | 'onHover' | 'onMouseEnter' | 'onFocus' | 'onBlur' | 'onChange' | 'onSubmit';
  /** Run in order when the trigger fires. */
  actions: Action[];
}
export interface InputBehavior {
  typeable?: { frameId?: string; inputType?: 'text' | 'email' | 'password' | 'number'; showIconId?: string; hideIconId?: string };
  validation?: { required?: boolean; trigger?: 'blur' | 'change' | 'submit' };
}
export interface BuilderScreen { id: string; frameId: string; pageId: string; name: string; role: string; nodes?: Record<string, NodeConfig> }
export interface BuilderModule { id: string; name: string; label: string; parentId: string | null; permissionKey?: string; pageId: string; entity?: { fields: BuilderField[] }; screens: BuilderScreen[] }
export interface BuilderLayout { appName?: string; userName?: string; userRole?: string; items?: { moduleId: string; label?: string; icon?: string; hidden?: boolean }[] }
export interface BuilderConfig { modules: BuilderModule[]; layout?: BuilderLayout }
export interface ScreenNode { kind: 'component' | 'box' | 'text' | 'unsupported'; nodeId: string; name: string; [k: string]: unknown }
export interface Issue { nodeId?: string; nodeName?: string; severity: 'error' | 'warning'; message: string }
export interface DocContext { byId: Map<string, any>; [k: string]: unknown }

export function makeContext(input: { nodes: any[]; variables: any; mappings?: any[]; libraryId?: string | null; fileId?: string | null }): DocContext;
export function screenTree(ctx: DocContext, frameId: string, nodeConfig?: Record<string, NodeConfig>): { tree: ScreenNode | null; issues: Issue[] };
export function buildTrees(config: BuilderConfig, ctx: DocContext): Map<string, { tree: ScreenNode | null; issues: Issue[] }>;
export function generateProject(project: { name: string; config: BuilderConfig }, trees: Map<string, { tree: ScreenNode | null }>): { files: Record<string, string>; warnings: string[]; layout: unknown };
export interface NavEntry { moduleId: string; label: string; icon: string; hidden: boolean; path?: string; permissionKey: string; children?: Omit<NavEntry, 'children'>[] }
export function resolveLayout(config: BuilderConfig): { appName: string; userName: string; userRole: string; items: NavEntry[] };
export function screenPath(modules: BuilderModule[], mod: BuilderModule, screen: BuilderScreen): string;
export function zipFiles(files: Record<string, string>, root?: string): Uint8Array;
export function projectIssues(project: any, ctx: { byId: Map<string, any>; pages: any[] }): any[];
export function cleanNodeCfg<T>(cfg: T): Partial<T>;
export function findTreeNode(tree: ScreenNode | null, id: string): ScreenNode | null;
export function tableModel(entity: { fields: BuilderField[] } | undefined, cfg?: NodeConfig): { columns: { key: string; header: string; type: string }[]; rowActions: string[]; pageSize: number };
export function fieldBinding(entity: { fields: BuilderField[] } | undefined, node: any): BuilderField | null;
export function autoAction(mod: BuilderModule, screen: Pick<BuilderScreen, 'role'>, label?: string): NodeConfig['action'];
export const camelCase: (s: string) => string;
export const kebabCase: (s: string) => string;
export const pascalCase: (s: string) => string;
export const titleCase: (s: string) => string;

export function inferFields(ctx: any, frameIds: string[], modules?: { id: string; label: string; name: string }[]): any[];
export function suggestScreens(frameName: string): { role: string; purpose?: string }[];
export function activeNavPath(layout: { items: NavEntry[] }, modules: BuilderModule[], module: BuilderModule): string | undefined;

export function generateComponent(opts: {
  ctx: any;
  mapping: { componentKey: string; componentName: string; exportName: string; propsMap: { props: any[] } };
  types?: 'generated' | 'inline';
  iconOf?: (componentKey: string) => string | null;
  importPrefix?: string;
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
