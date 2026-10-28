// The documentation site of a published library: install steps, versions with release notes, and a page per component with its props
// and a live preview. Plain HTML pages, written from the package info of a version (lib/package.ts); the preview runs the package itself.
import type { PackageInfo } from './package.js';

export interface DocsVersion { seq: number; releaseNotes: string | null; publishedAt: number }
export interface DocsContext {
    slug: string;
    libraryName: string;
    origin: string;
    info: PackageInfo;
    versions: DocsVersion[];
    /** The version shown (`?v=`), and whether it is the newest. */
    seq: number;
    latest: boolean;
    docsPublic: boolean;
}

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Component = PackageInfo['components'][number];
const visible = (info: PackageInfo) => info.components.filter(c => !c.internal);
const CATEGORY_ORDER = ['Action', 'Data Entry', 'Display', 'Feedback', 'Navigation', 'Layout', 'Other'];

const CSS = `
:root{--bg:#fff;--fg:#101828;--muted:#667085;--line:#eaecf0;--soft:#f9fafb;--brand:#1d4b7a;--code:#f2f4f7;--ok:#e8f8ea;--no:#fff0ef}
@media (prefers-color-scheme:dark){:root{--bg:#0e1116;--fg:#f2f4f7;--muted:#98a2b3;--line:#232a35;--soft:#151a22;--brand:#7fb2e5;--code:#1b212b;--ok:#12261a;--no:#2a1614}}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--fg)}
a{color:var(--brand);text-decoration:none}a:hover{text-decoration:underline}
.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:16px;padding:12px 24px;border-bottom:1px solid var(--line);background:var(--bg)}
.top b{font-size:16px}.top .sp{flex:1}.top select{font:inherit;padding:4px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
.wrap{display:grid;grid-template-columns:240px minmax(0,1fr);max-width:1240px;margin:0 auto}
nav{padding:20px 16px 40px 24px;border-right:1px solid var(--line);height:calc(100vh - 53px);position:sticky;top:53px;overflow:auto;font-size:14px}
nav h4{margin:18px 0 6px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}nav a{display:block;padding:3px 8px;border-radius:6px;color:var(--fg)}nav a.on{background:var(--soft);font-weight:600}
main{padding:32px 40px 80px;min-width:0}h1{margin:0 0 8px;font-size:30px;line-height:1.2}h2{margin:36px 0 12px;font-size:20px}h3{margin:20px 0 8px;font-size:16px}
.lead{color:var(--muted);font-size:16px;margin:0 0 20px}.tags{display:flex;gap:8px;margin:0 0 14px}.tag{font-size:12px;padding:2px 8px;border-radius:99px;background:var(--soft);border:1px solid var(--line);color:var(--muted)}
pre,code{font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}pre{background:var(--code);padding:14px 16px;border-radius:10px;overflow:auto;margin:8px 0 16px;position:relative}code{background:var(--code);padding:1px 5px;border-radius:5px}pre code{background:none;padding:0}
.copy{position:absolute;top:8px;right:8px;font:12px inherit;border:1px solid var(--line);background:var(--bg);color:var(--muted);border-radius:6px;padding:2px 8px;cursor:pointer}
table{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 16px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;color:var(--muted);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}.card{display:block;border:1px solid var(--line);border-radius:10px;padding:12px 14px;color:var(--fg)}.card:hover{background:var(--soft);text-decoration:none}.card small{display:block;color:var(--muted)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.do,.dont{border-radius:10px;padding:12px 14px}.do{background:var(--ok)}.dont{background:var(--no)}.do b,.dont b{display:block;margin-bottom:4px}.do ul,.dont ul{margin:0;padding-left:18px}
.stage{border:1px solid var(--line);border-radius:12px;padding:32px;background:var(--bg);min-height:120px;overflow:auto}.stage[data-theme=light]{background:#fff}.stage[data-theme=dark]{background:#0e1116}
.bar{display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:12px 0}.bar label{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--muted)}.bar input[type=text],.bar select{font:inherit;padding:3px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);max-width:180px}
.note{border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0}.note h3{margin:0 0 2px}.note time{color:var(--muted);font-size:13px}
.warn{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-size:14px;color:var(--muted)}
@media(max-width:860px){.wrap{display:block}nav{position:static;height:auto;border:0;border-bottom:1px solid var(--line)}main{padding:24px 16px}.cols{grid-template-columns:1fr}}
`;

/** Release notes as HTML: paragraphs, and lines that start with "- " as a list. */
export function notesHtml(notes: string | null): string {
    const text = String(notes ?? '').trim();
    if (!text) return '<p class="lead">No release notes for this version.</p>';
    const out: string[] = [];
    let list: string[] = [];
    const flush = () => { if (list.length) { out.push(`<ul>${list.join('')}</ul>`); list = []; } };
    for (const line of text.split(/\r?\n/)) {
        const m = /^\s*[-*•]\s+(.*)$/.exec(line);
        if (m) list.push(`<li>${esc(m[1])}</li>`);
        else { flush(); if (line.trim()) out.push(`<p>${esc(line)}</p>`); }
    }
    flush();
    return out.join('');
}

const code = (src: string) => `<pre><code>${esc(src)}</code></pre>`;
const date = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const pkgOf = (c: DocsContext) => c.info.packageName;

function layout(c: DocsContext, active: string, title: string, body: string, extraHead = ''): string {
    const q = c.latest ? '' : `?v=${c.seq}`;
    const base = `/docs/${c.slug}`;
    const groups = new Map<string, Component[]>();
    for (const comp of visible(c.info)) {
        const cat = comp.doc?.category && CATEGORY_ORDER.includes(comp.doc.category) ? comp.doc.category : comp.doc?.category || 'Other';
        (groups.get(cat) || groups.set(cat, []).get(cat)!).push(comp);
    }
    const cats = [...groups.keys()].sort((a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99));
    const nav = [
        `<a class="${active === 'home' ? 'on' : ''}" href="${base}${q}">Getting started</a>`,
        `<a class="${active === 'versions' ? 'on' : ''}" href="${base}/versions${q}">Versions &amp; release notes</a>`,
        `<a class="${active === 'icons' ? 'on' : ''}" href="${base}/icons${q}">Icons (${c.info.icons.length})</a>`,
        ...cats.map(cat => `<h4>${esc(cat)}</h4>${groups.get(cat)!.sort((a, b) => a.name.localeCompare(b.name)).map(k => `<a class="${active === `c:${k.exportName}` ? 'on' : ''}" href="${base}/components/${slugify(k.exportName)}${q}">${esc(k.name)}</a>`).join('')}`),
    ].join('');
    const options = c.versions.map(v => `<option value="${v.seq}" ${v.seq === c.seq ? 'selected' : ''}>1.0.${v.seq}${v.seq === c.versions[0]?.seq ? ' (latest)' : ''}</option>`).join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · ${esc(c.libraryName)}</title><style>${CSS}</style>${extraHead}</head><body>
<div class="top"><b>${esc(c.libraryName)}</b><span class="tag">${esc(pkgOf(c))}</span><span class="sp"></span><label>Version <select id="ver" aria-label="Version">${options}</select></label></div>
<div class="wrap"><nav>${nav}</nav><main>${body}</main></div>
<script>document.getElementById('ver').onchange=function(){var u=new URL(location.href);if(this.value==='${c.versions[0]?.seq}')u.searchParams.delete('v');else u.searchParams.set('v',this.value);location.href=u.toString()};
document.querySelectorAll('.copy').forEach(function(b){b.onclick=function(){navigator.clipboard.writeText(b.parentElement.querySelector('code').textContent);b.textContent='Copied';setTimeout(function(){b.textContent='Copy'},1200)}});</script></body></html>`;
}

const copyable = (src: string) => `<pre><button class="copy" type="button">Copy</button><code>${esc(src)}</code></pre>`;

export function homePage(c: DocsContext): string {
    const host = new URL(c.origin).host;
    const v = c.versions.find(x => x.seq === c.seq);
    const comps = visible(c.info);
    const first = comps.find(k => k.exportName === 'Button') || comps[0];
    const install = c.latest ? `npm install ${pkgOf(c)}` : `npm install ${pkgOf(c)}@${c.info.version}`;
    const body = `<h1>${esc(c.libraryName)}</h1>
<p class="lead">${comps.length} React components and ${c.info.icons.length} icons, generated from the design. Version <b>${esc(c.info.version)}</b>${v ? ` · published ${date(v.publishedAt)}` : ''}.</p>
<h2>Install</h2>
<p>The package comes from the Midas server. Create an API token in Midas (<b>API tokens</b>), then put this in your project's <code>.npmrc</code>:</p>
${copyable(`${pkgOf(c).split('/')[0]}:registry=${c.origin}/api/registry/\n//${host}/api/registry/:_authToken=<your API token>`)}
${copyable(install)}
<h2>Use</h2>
${copyable(`import '${pkgOf(c)}/tokens.css';\nimport '${pkgOf(c)}/styles.css';\nimport { ${first?.exportName ?? 'Button'} } from '${pkgOf(c)}';`)}
<p>No Tailwind is needed in your project: <code>styles.css</code> is already compiled, and every class has the <code>mds:</code> prefix so it never clashes with your own. Set <code>data-theme="dark"</code> on an ancestor to switch to the dark theme.</p>
<h3>With Tailwind in your project</h3>
<p>Import <code>styles.css</code> before Tailwind so your own classes win over the components' (<code>&lt;Button className="px-6" /&gt;</code>). To write <code>bg-primary</code>, <code>text-muted-foreground</code> and so on with this library's colours:</p>
${copyable(`@import '${pkgOf(c)}/styles.css';\n@import 'tailwindcss';\n@import '${pkgOf(c)}/tokens.css';\n@import '${pkgOf(c)}/tailwind.theme.css';   /* Tailwind 4 */`)}
<p>Tailwind 3: <code>presets: [require('${pkgOf(c)}/tailwind.preset')]</code> in <code>tailwind.config.js</code>.</p>
<h2>Components</h2>
<div class="grid">${comps.sort((a, b) => a.name.localeCompare(b.name)).map(k => `<a class="card" href="/docs/${c.slug}/components/${slugify(k.exportName)}${c.latest ? '' : `?v=${c.seq}`}">${esc(k.name)}<small>${esc(k.doc?.category || '')}</small></a>`).join('')}</div>`;
    return layout(c, 'home', 'Getting started', body);
}

export function versionsPage(c: DocsContext): string {
    const body = `<h1>Versions &amp; release notes</h1><p class="lead">Every publish is a new version.</p>
${c.versions.map(v => `<div class="note"><h3>1.0.${v.seq}${v.seq === c.versions[0]?.seq ? ' <span class="tag">latest</span>' : ''}</h3><time>${date(v.publishedAt)}</time>${notesHtml(v.releaseNotes)}
<p><a href="/docs/${c.slug}${v.seq === c.versions[0]?.seq ? '' : `?v=${v.seq}`}">Open this version's docs</a> · <code>npm install ${esc(pkgOf(c))}@1.0.${v.seq}</code></p></div>`).join('')}`;
    return layout(c, 'versions', 'Versions', body);
}

export function iconsPage(c: DocsContext): string {
    const body = `<h1>Icons</h1><p class="lead">${c.info.icons.length} icons. Each takes <code>size</code> and draws in the current text colour.</p>
${code(`import { ${c.info.icons[0]?.exportName ?? 'ArrowLeftIcon'} } from '${pkgOf(c)}';\n\n<${c.info.icons[0]?.exportName ?? 'ArrowLeftIcon'} size={20} />`)}
<div class="grid" id="icons">${c.info.icons.map(i => `<div class="card" data-icon="${esc(i.exportName)}"><span class="ic"></span><small>${esc(i.exportName)}</small></div>`).join('')}</div>
<script src="/docs/${c.slug}/_/preview.js?v=${c.seq}"></script>
<script>var m=window.__midas;if(m)document.querySelectorAll('[data-icon]').forEach(function(el){var C=m.lib[el.dataset.icon];if(C)m.createRoot(el.querySelector('.ic')).render(m.createElement(C,{size:24}))})</script>`;
    return layout(c, 'icons', 'Icons', body, `<link rel="stylesheet" href="/docs/${c.slug}/_/tokens.css?v=${c.seq}">`);
}

export function componentPage(c: DocsContext, comp: Component): string {
    const d = comp.doc;
    const props = comp.props;
    const rows = props.map(p => {
        const type = p.type === 'enum' ? Object.values(p.values ?? {}).map(v => `<code>"${esc(v)}"</code>`).join(' | ') : p.type === 'node' ? '<code>ReactNode</code>' : `<code>${p.type}</code>`;
        const def = p.type === 'node' || p.def === undefined ? '<span class="tag">design icon</span>' : `<code>${esc(JSON.stringify(p.def))}</code>`;
        return `<tr><td><code>${esc(p.name)}</code></td><td>${type}</td><td>${p.type === 'node' ? '—' : def}</td><td>${esc(p.label ?? '')}</td></tr>`;
    }).join('');
    const list = (items?: string[]) => (items?.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
    const preview = `<h2>Preview</h2>
<div class="bar" id="controls"></div>
<div class="stage" id="stage" data-theme="light"></div>
<div class="bar"><label><input type="checkbox" id="dark"> Dark theme</label></div>
<div id="code"></div>
<noscript><p class="warn">The live preview needs JavaScript.</p></noscript>`;
    const meta = { exportName: comp.exportName, props: props.map(p => ({ name: p.name, type: p.type, values: p.type === 'enum' ? Object.values(p.values ?? {}) : undefined, def: p.def })) };
    const script = `<script id="meta" type="application/json">${JSON.stringify(meta).replace(/</g, '\\u003c')}</script>
<script src="/docs/${c.slug}/_/preview.js?v=${c.seq}"></script>
<script>(function(){var M=JSON.parse(document.getElementById('meta').textContent),m=window.__midas;if(!m){document.getElementById('stage').innerHTML='<p class="warn">The preview could not be loaded.</p>';return}
var C=m.lib[M.exportName],stage=document.getElementById('stage'),root=m.createRoot(stage),st={};
M.props.forEach(function(p){if(p.type!=='node')st[p.name]=p.def===undefined?(p.type==='boolean'?false:p.type==='enum'?p.values[0]:''):p.def});
var bar=document.getElementById('controls');
M.props.forEach(function(p){if(p.type==='node')return;var l=document.createElement('label'),i;l.textContent=p.name+' ';
if(p.type==='enum'){i=document.createElement('select');p.values.forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v;if(v===st[p.name])o.selected=true;i.appendChild(o)});i.onchange=function(){st[p.name]=i.value;draw()}}
else if(p.type==='boolean'){i=document.createElement('input');i.type='checkbox';i.checked=!!st[p.name];i.onchange=function(){st[p.name]=i.checked;draw()}}
else{i=document.createElement('input');i.type='text';i.value=st[p.name];i.oninput=function(){st[p.name]=i.value;draw()}}
l.appendChild(i);bar.appendChild(l)});
document.getElementById('dark').onchange=function(){stage.dataset.theme=this.checked?'dark':'light'};
function draw(){root.render(m.createElement(C,st));var a=[];M.props.forEach(function(p){if(p.type==='node')return;var v=st[p.name],d=p.def===undefined?(p.type==='boolean'?false:p.type==='enum'?p.values[0]:''):p.def;if(v===d)return;a.push(p.type==='boolean'?(v?p.name:p.name+'={false}'):p.name+'="'+String(v).replace(/"/g,'&quot;')+'"')});
var s='<'+M.exportName+(a.length?' '+a.join(' '):'')+' />';var pre=document.createElement('pre'),cd=document.createElement('code');cd.textContent=s;pre.appendChild(cd);var o=document.getElementById('code');o.innerHTML='';o.appendChild(pre)}
draw()})()</script>`;
    const body = `<h1>${esc(comp.name)}</h1>
<div class="tags">${d?.category ? `<span class="tag">${esc(d.category)}</span>` : ''}${d?.status ? `<span class="tag">${esc(d.status)}</span>` : ''}<span class="tag">${esc(c.info.version)}</span></div>
${d?.description ? `<p class="lead">${esc(d.description)}</p>` : ''}
${preview}
<h2>Import</h2>${copyable(`import { ${comp.exportName} } from '${pkgOf(c)}';`)}
<h2>Props</h2>
${props.length ? `<table><thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Design property</th></tr></thead><tbody>${rows}</tbody></table><p class="lead">Every component also takes <code>className</code>, <code>style</code> and <code>testId</code>.</p>` : '<p class="lead">No props besides <code>className</code>, <code>style</code> and <code>testId</code>.</p>'}
${d?.dos?.length || d?.donts?.length ? `<h2>Usage</h2><div class="cols"><div class="do"><b>Do</b>${list(d?.dos)}</div><div class="dont"><b>Don't</b>${list(d?.donts)}</div></div>` : ''}
${d?.a11y?.length ? `<h2>Accessibility</h2>${list(d.a11y)}` : ''}`;
    return layout(c, `c:${comp.exportName}`, comp.name, body + script, `<link rel="stylesheet" href="/docs/${c.slug}/_/tokens.css?v=${c.seq}"><link rel="stylesheet" href="/docs/${c.slug}/_/styles.css?v=${c.seq}">`);
}

export const notFoundPage = (message: string) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Documentation</title><style>${CSS}</style><main style="max-width:560px;margin:15vh auto;padding:0 24px"><h1>Documentation</h1><p class="lead">${esc(message)}</p><p><a href="/">Open Midas</a></p></main>`;
