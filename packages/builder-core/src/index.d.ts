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

export * from './library/index.js';
