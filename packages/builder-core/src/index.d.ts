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
  /** Interaction: trigger + action (navigate, open dropdown/overlay/popover, close overlay). */
  interactions?: Interaction[];
  /** Perilaku input field: label, area typeable, error, validasi. */
  inputBehavior?: InputBehavior;
}
export interface StyleValue { value?: string | number; variableId?: string; collectionId?: string }
export interface Interaction {
  id: string;
  trigger: 'onClick' | 'onHover' | 'onMouseEnter' | 'onFocus' | 'onBlur' | 'onChange' | 'onSubmit';
  action: {
    type: 'navigate' | 'open-dropdown' | 'open-overlay' | 'open-popover' | 'open-tooltip' | 'close-overlay';
    targetFrameId?: string;
    targetComponentId?: string;
    position?: string;
    offset?: number;
    anchor?: string;
    backdrop?: boolean;
    closeOnBackdrop?: boolean;
    close?: string;
  };
}
export interface InputBehavior {
  label?: { exists?: boolean; reference?: { type: 'layer' | 'variable'; layerId?: string; variableId?: string; collectionId?: string } };
  typeable?: { frameId?: string; inputType?: 'text' | 'email' | 'password' | 'number'; showIconId?: string; hideIconId?: string; placeholder?: StyleValue; valueCollectionId?: string; valueVariableId?: string };
  error?: { stateName?: string; border?: StyleValue; hint?: StyleValue; hintText?: string; frameId?: string };
  validation?: { required?: boolean };
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
