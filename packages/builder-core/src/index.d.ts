// Tipe publik @midas/builder-core (implementasi JS murni; tipe longgar supaya Studio/CLI mudah memakainya).
export interface BuilderField { name: string; label?: string; type: string; required?: boolean; sortable?: boolean; filterable?: boolean; options?: string[]; relation?: string }
export interface NodeConfig {
  props?: Record<string, string | number | boolean>;
  text?: string;
  hidden?: boolean;
  field?: string;
  action?: { type: 'none' | 'navigate' | 'submit' | 'back'; screenId?: string };
  table?: { columns?: string[]; rowActions?: ('view' | 'edit' | 'delete')[]; pageSize?: number };
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

export function suggestScreens(frameName: string): { role: string; purpose?: string }[];
export function activeNavPath(layout: { items: NavEntry[] }, modules: BuilderModule[], module: BuilderModule): string | undefined;
