import sys

with open('src/engine/midas.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update import
target_import = "import { kv, settings as localStore } from '../storage.js';"
repl_import = "import { kv, settings as localStore, projectStorage } from '../storage.js';"
assert target_import in content, 'target_import not found'
content = content.replace(target_import, repl_import, 1)

# 2. DocumentModel.parse support objects directly
target_parse = """    static parse(text) {
        const d = JSON.parse(text);"""
repl_parse = """    static parse(text) {
        const d = typeof text === 'string' ? JSON.parse(text) : text;"""
assert target_parse in content, 'target_parse not found'
content = content.replace(target_parse, repl_parse, 1)

# 3. Rich text painting
target_paint = '''function paintText(ctx, n) {
    const l = layoutText(n, ctx);
    ctx.font = fontSpec(n);
    ctx.letterSpacing = `${n.letterSpacing || 0}px`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = n.textAlign || 'left';
    ctx.direction = n.direction === 'rtl' ? 'rtl' : n.direction === 'ltr' ? 'ltr' : 'inherit';
    const baseAlpha = ctx.globalAlpha;
    const x = n.textAlign === 'center' ? n.w / 2 : n.textAlign === 'right' ? n.w : 0;
    // Text can carry both a fill and a stroke; the stroke is painted after the fill, like a shape outline.
    const stroked = strokeIsOn(n);
    for (let i = 0; i < l.lines.length; i++) {
        const y = l.baseline + i * l.lineHeight;
        if (y - l.lineHeight > n.h)
            break;
        const line = l.lines[i];
        if (n.fill && n.fill !== 'none') {
            ctx.globalAlpha = baseAlpha * (n.fillOpacity ?? 1);
            ctx.fillStyle = fillStyle(ctx, n);
            ctx.fillText(line, x, y);
        }
        if (stroked) {
            ctx.globalAlpha = baseAlpha * (n.strokeOpacity ?? 1);
            ctx.strokeStyle = n.stroke;
            ctx.lineWidth = n.strokeWidth;
            ctx.lineJoin = n.strokeJoin || 'round';
            ctx.lineCap = n.strokeCap || 'round';
            ctx.strokeText(line, x, y);
        }
        if (n.textDecoration === 'underline' || n.textDecoration === 'line-through') {
            const width = ctx.measureText(line).width, start = x - (n.textAlign === 'center' ? width / 2 : n.textAlign === 'right' ? width : 0);
            ctx.globalAlpha = baseAlpha * (n.fillOpacity ?? 1);
            ctx.fillStyle = fillStyle(ctx, n);
            ctx.fillRect(start, y + (n.textDecoration === 'underline' ? n.fontSize * .12 : -n.fontSize * .3), width, Math.max(1, n.fontSize * .055));
        }
    }
    ctx.globalAlpha = baseAlpha;
    return l;
}'''

repl_paint = '''function fontSpecSpan(s, base) {
    const style = s.fontStyle || base.fontStyle || 'normal';
    const weight = s.fontWeight || base.fontWeight || 400;
    const size = s.fontSize || base.fontSize || 16;
    const fam = s.fontFamily || base.fontFamily || 'Inter';
    return `${style} ${weight} ${size}px ${fam === 'Inter' ? FONT_STACK : `"${String(fam).replace(/["\\\\]/g, '')}", sans-serif`}`;
}
function paintText(ctx, n) {
    const l = layoutText(n, ctx);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = n.textAlign || 'left';
    ctx.direction = n.direction === 'rtl' ? 'rtl' : n.direction === 'ltr' ? 'ltr' : 'inherit';
    const baseAlpha = ctx.globalAlpha;
    const x = n.textAlign === 'center' ? n.w / 2 : n.textAlign === 'right' ? n.w : 0;
    const stroked = strokeIsOn(n);
    if (n.spans && n.spans.length > 1) {
        const spanRanges = [];
        let curIdx = 0;
        for (const s of n.spans) {
            const len = (s.text || '').length;
            spanRanges.push({ span: s, start: curIdx, end: curIdx + len });
            curIdx += len;
        }
        let charOffset = 0;
        for (let i = 0; i < l.lines.length; i++) {
            const y = l.baseline + i * l.lineHeight;
            if (y - l.lineHeight > n.h)
                break;
            const line = l.lines[i];
            const lineStart = charOffset, lineEnd = lineStart + line.length;
            const lineSpans = [];
            for (const sr of spanRanges) {
                if (sr.end > lineStart && sr.start < lineEnd) {
                    const sStart = Math.max(0, lineStart - sr.start);
                    const sEnd = Math.min(sr.span.text.length, lineEnd - sr.start);
                    const slice = sr.span.text.slice(sStart, sEnd);
                    if (slice.length)
                        lineSpans.push({ span: sr.span, text: slice });
                }
            }
            let totalW = 0;
            for (const ls of lineSpans) {
                ctx.font = fontSpecSpan(ls.span, n);
                ctx.letterSpacing = `${ls.span.letterSpacing || 0}px`;
                totalW += ctx.measureText(ls.text).width;
            }
            let curX = n.textAlign === 'center' ? x - totalW / 2 : n.textAlign === 'right' ? x - totalW : x;
            for (const ls of lineSpans) {
                const s = ls.span;
                ctx.font = fontSpecSpan(s, n);
                ctx.letterSpacing = `${s.letterSpacing || 0}px`;
                const spanW = ctx.measureText(ls.text).width;
                if (s.fill && s.fill !== 'none') {
                    ctx.globalAlpha = baseAlpha * (s.fillOpacity ?? n.fillOpacity ?? 1);
                    ctx.fillStyle = s.fill;
                    ctx.fillText(ls.text, curX, y);
                }
                if (stroked) {
                    ctx.globalAlpha = baseAlpha * (n.strokeOpacity ?? 1);
                    ctx.strokeStyle = n.stroke;
                    ctx.lineWidth = n.strokeWidth;
                    ctx.lineJoin = n.strokeJoin || 'round';
                    ctx.lineCap = n.strokeCap || 'round';
                    ctx.strokeText(ls.text, curX, y);
                }
                if (s.textDecoration === 'underline' || s.textDecoration === 'line-through') {
                    ctx.globalAlpha = baseAlpha * (s.fillOpacity ?? 1);
                    ctx.fillStyle = s.fill || n.fill;
                    ctx.fillRect(curX, y + (s.textDecoration === 'underline' ? s.fontSize * .12 : -s.fontSize * .3), spanW, Math.max(1, s.fontSize * .055));
                }
                curX += spanW;
            }
            charOffset += line.length + 1;
        }
        ctx.globalAlpha = baseAlpha;
        return l;
    }
    ctx.font = fontSpec(n);
    ctx.letterSpacing = `${n.letterSpacing || 0}px`;
    for (let i = 0; i < l.lines.length; i++) {
        const y = l.baseline + i * l.lineHeight;
        if (y - l.lineHeight > n.h)
            break;
        const line = l.lines[i];
        if (n.fill && n.fill !== 'none') {
            ctx.globalAlpha = baseAlpha * (n.fillOpacity ?? 1);
            ctx.fillStyle = fillStyle(ctx, n);
            ctx.fillText(line, x, y);
        }
        if (stroked) {
            ctx.globalAlpha = baseAlpha * (n.strokeOpacity ?? 1);
            ctx.strokeStyle = n.stroke;
            ctx.lineWidth = n.strokeWidth;
            ctx.lineJoin = n.strokeJoin || 'round';
            ctx.lineCap = n.strokeCap || 'round';
            ctx.strokeText(line, x, y);
        }
        if (n.textDecoration === 'underline' || n.textDecoration === 'line-through') {
            const width = ctx.measureText(line).width, start = x - (n.textAlign === 'center' ? width / 2 : n.textAlign === 'right' ? width : 0);
            ctx.globalAlpha = baseAlpha * (n.fillOpacity ?? 1);
            ctx.fillStyle = fillStyle(ctx, n);
            ctx.fillRect(start, y + (n.textDecoration === 'underline' ? n.fontSize * .12 : -n.fontSize * .3), width, Math.max(1, n.fontSize * .055));
        }
    }
    ctx.globalAlpha = baseAlpha;
    return l;
}'''
assert target_paint in content, 'target_paint not found'
content = content.replace(target_paint, repl_paint, 1)

# 4. SVG rich text support
target_svg = '''        if (n.type === 'text') {
            const l = layoutText(n), anchor = n.textAlign === 'center' ? 'middle' : n.textAlign === 'right' ? 'end' : 'start', x = n.textAlign === 'center' ? n.w / 2 : n.textAlign === 'right' ? n.w : 0;
            defs += `<clipPath id="${prefix}t"><rect width="${f(n.w)}" height="${f(n.h)}"/></clipPath>`;
            // Text strokes are drawn under the fill with paint-order so the letterforms stay crisp.
            const textStroke = strokeIsOn(n) ? ` stroke="${e(n.stroke)}" stroke-opacity="${f(n.strokeOpacity ?? 1)}" stroke-width="${f(n.strokeWidth)}" stroke-linejoin="${e(n.strokeJoin || 'round')}" paint-order="stroke"` : '';
            item = `<text clip-path="url(#${prefix}t)" font-family="${e(n.fontFamily)}, sans-serif" font-size="${f(n.fontSize)}" font-weight="${e(n.fontWeight)}" font-style="${e(n.fontStyle)}" letter-spacing="${f(n.letterSpacing || 0)}" text-anchor="${anchor}" text-decoration="${e(n.textDecoration || 'none')}" direction="${n.direction === 'rtl' ? 'rtl' : 'ltr'}" fill="${e(fill)}" fill-opacity="${f(n.fillOpacity ?? 1)}"${textStroke} xml:space="preserve">${l.lines.map((line, i) => `<tspan x="${f(x)}" y="${f(l.baseline + i * l.lineHeight)}">${e(line)}</tspan>`).join('')}</text>`;
        }'''

repl_svg = '''        if (n.type === 'text') {
            const l = layoutText(n), anchor = n.textAlign === 'center' ? 'middle' : n.textAlign === 'right' ? 'end' : 'start', x = n.textAlign === 'center' ? n.w / 2 : n.textAlign === 'right' ? n.w : 0;
            defs += `<clipPath id="${prefix}t"><rect width="${f(n.w)}" height="${f(n.h)}"/></clipPath>`;
            const textStroke = strokeIsOn(n) ? ` stroke="${e(n.stroke)}" stroke-opacity="${f(n.strokeOpacity ?? 1)}" stroke-width="${f(n.strokeWidth)}" stroke-linejoin="${e(n.strokeJoin || 'round')}" paint-order="stroke"` : '';
            if (n.spans && n.spans.length > 1) {
                const tspans = n.spans.map(s => {
                    const style = s.fontStyle || 'normal', weight = s.fontWeight || 400, size = s.fontSize || n.fontSize, fam = s.fontFamily || n.fontFamily, sfill = s.fill || n.fill, fillOp = s.fillOpacity ?? n.fillOpacity ?? 1, decor = s.textDecoration || 'none';
                    return `<tspan font-family="${e(fam)}, sans-serif" font-size="${f(size)}" font-weight="${e(weight)}" font-style="${e(style)}" fill="${e(sfill)}" fill-opacity="${f(fillOp)}" text-decoration="${e(decor)}">${e(s.text)}</tspan>`;
                }).join('');
                item = `<text clip-path="url(#${prefix}t)" text-anchor="${anchor}" direction="${n.direction === 'rtl' ? 'rtl' : 'ltr'}" x="${f(x)}" y="${f(l.baseline)}"${textStroke} xml:space="preserve">${tspans}</text>`;
            } else {
                item = `<text clip-path="url(#${prefix}t)" font-family="${e(n.fontFamily)}, sans-serif" font-size="${f(n.fontSize)}" font-weight="${e(n.fontWeight)}" font-style="${e(n.fontStyle)}" letter-spacing="${f(n.letterSpacing || 0)}" text-anchor="${anchor}" text-decoration="${e(n.textDecoration || 'none')}" direction="${n.direction === 'rtl' ? 'rtl' : 'ltr'}" fill="${e(fill)}" fill-opacity="${f(n.fillOpacity ?? 1)}"${textStroke} xml:space="preserve">${l.lines.map((line, i) => `<tspan x="${f(x)}" y="${f(l.baseline + i * l.lineHeight)}">${e(line)}</tspan>`).join('')}</text>`;
            }
        }'''
assert target_svg in content, 'target_svg not found'
content = content.replace(target_svg, repl_svg, 1)

# 5. Incremental save and save status
target_save = '''async function save() {
    clearTimeout(saveTimer);
    const data = doc.serialize();
    try {
        let m = lib.index.find(x => x.id === lib.fileId);
        if (!m) {
            const now = Date.now();
            m = { id: lib.fileId, name: doc.data.name, created: now, updated: now, opened: now, thumb: null };
            lib.index.unshift(m);
        }
        await kvPut('file:' + lib.fileId, data);
        m.name = doc.data.name;
        m.updated = Date.now();
        await libSaveIndex();
        await kvPut('last', lib.fileId);
        state.dirty = false;
        $('#save-indicator').innerHTML = '<i></i> Saved locally';
    }
    catch (e) {
        $('#save-indicator').innerHTML = '<i style="background:var(--danger)"></i> Save failed';
        toast('Could not save to browser storage. Export your .midas file to keep your work.');
    }
}'''

repl_save = '''let savingInProgress = false;
let saveQueued = false;
async function save() {
    clearTimeout(saveTimer);
    if (!lib.fileId)
        return;
    if (savingInProgress) {
        saveQueued = true;
        return;
    }
    savingInProgress = true;
    saveQueued = false;
    const indicator = $('#save-indicator');
    if (indicator) indicator.innerHTML = '<i class="spin"></i> Saving…';
    try {
        let m = lib.index.find(x => x.id === lib.fileId);
        if (!m) {
            const now = Date.now();
            m = { id: lib.fileId, name: doc.data.name, created: now, updated: now, opened: now, thumb: null };
            lib.index.unshift(m);
        }
        await projectStorage.saveActivePage(lib.fileId, doc.data, doc.page);
        m.name = doc.data.name;
        m.updated = Date.now();
        await libSaveIndex();
        await kvPut('last', lib.fileId);
        state.dirty = false;
        if (indicator) indicator.innerHTML = '<i></i> Saved locally';
    }
    catch (e) {
        console.error('Save failed:', e);
        if (indicator) indicator.innerHTML = '<i style="background:var(--danger)"></i> Save failed';
        const quota = await projectStorage.getQuota();
        if (quota && quota.isLow) {
            toast(`Browser storage quota is nearly full (${quota.percent}% used). Export your .midas file.`);
        } else {
            toast('Could not save to browser storage. Export your .midas file to keep your work.');
        }
    }
    finally {
        savingInProgress = false;
        if (saveQueued) {
            saveQueued = false;
            saveSoon();
        }
    }
}'''
assert target_save in content, 'target_save not found'
content = content.replace(target_save, repl_save, 1)

# 6. saveFile full export
target_save_file = "function saveFile() { finishText(); download(new Blob([doc.serialize()], { type: 'application/json' }), safeName(doc.data.name) + '.midas'); toast('Portable document exported. Includes all pages and images.'); }"
repl_save_file = '''async function saveFile() {
    finishText();
    toast('Preparing .midas export…');
    try {
        const json = await projectStorage.exportProject(lib.fileId, doc.data);
        download(new Blob([json], { type: 'application/json' }), safeName(doc.data.name) + '.midas');
        toast('Portable document exported. Includes all pages and images.');
    }
    catch (e) {
        download(new Blob([doc.serialize()], { type: 'application/json' }), safeName(doc.data.name) + '.midas');
        toast('Portable document exported.');
    }
}'''
assert target_save_file in content, 'target_save_file not found'
content = content.replace(target_save_file, repl_save_file, 1)

# 7. File library methods: libOpen, libDuplicate, libDelete, libDownload
target_lib_open = '''    if (id !== lib.fileId) {
        await save();
        const json = await kvGet('file:' + id);
        if (!json) {
            toast('This file could not be found.');
            return;
        }
        let data;
        try {
            data = DocumentModel.parse(json);
        }
        catch (e) {
            toast('This file could not be opened: ' + e.message);
            return;
        }
        await loadIntoEditor(data, id);
    }'''

repl_lib_open = '''    if (id !== lib.fileId) {
        await save();
        let data = await projectStorage.loadProject(id);
        if (!data) {
            toast('This file could not be found.');
            return;
        }
        try {
            data = DocumentModel.parse(data);
        }
        catch (e) {
            toast('This file could not be opened: ' + e.message);
            return;
        }
        await loadIntoEditor(data, id);
    }'''
assert target_lib_open in content, 'target_lib_open not found'
content = content.replace(target_lib_open, repl_lib_open, 1)

target_lib_dup = '''async function libDuplicate(id) {
    const meta = lib.index.find(m => m.id === id), json = await libJson(id);
    if (!meta || !json)
        return;
    const data = JSON.parse(json), nid = uid(), now = Date.now();
    data.name = `${meta.name} copy`;
    await kvPut('file:' + nid, JSON.stringify(data));
    lib.index.unshift({ ...meta, id: nid, name: data.name, created: now, updated: now, opened: now, trashed: undefined });
    await libSaveIndex();
    renderHome();
}'''

repl_lib_dup = '''async function libDuplicate(id) {
    const meta = lib.index.find(m => m.id === id);
    if (!meta)
        return;
    const data = await projectStorage.loadProject(id);
    if (!data)
        return;
    const nid = uid(), now = Date.now();
    data.name = `${meta.name} copy`;
    data.id = nid;
    await projectStorage.saveProject(nid, data);
    lib.index.unshift({ ...meta, id: nid, name: data.name, created: now, updated: now, opened: now, trashed: undefined });
    await libSaveIndex();
    renderHome();
}'''
assert target_lib_dup in content, 'target_lib_dup not found'
content = content.replace(target_lib_dup, repl_lib_dup, 1)

target_lib_del = '''async function libDelete(id) {
    const meta = lib.index.find(m => m.id === id);
    if (!meta || !confirm(`Delete “${meta.name}” permanently? This can't be undone.`))
        return;
    if (id === lib.fileId)
        await libNew('blank', { stay: true });
    lib.index = lib.index.filter(m => m.id !== id);
    await kvDel('file:' + id);
    await libSaveIndex();
    renderHome();
}'''

repl_lib_del = '''async function libDelete(id) {
    const meta = lib.index.find(m => m.id === id);
    if (!meta || !confirm(`Delete “${meta.name}” permanently? This can't be undone.`))
        return;
    if (id === lib.fileId)
        await libNew('blank', { stay: true });
    lib.index = lib.index.filter(m => m.id !== id);
    await projectStorage.deleteProject(id);
    await libSaveIndex();
    renderHome();
}'''
assert target_lib_del in content, 'target_lib_del not found'
content = content.replace(target_lib_del, repl_lib_del, 1)

target_lib_down = '''async function libDownload(id) {
    const meta = lib.index.find(m => m.id === id), json = await libJson(id);
    if (meta && json)
        download(new Blob([json], { type: 'application/json' }), safeName(meta.name) + '.midas');
}'''

repl_lib_down = '''async function libDownload(id) {
    const meta = lib.index.find(m => m.id === id);
    if (!meta)
        return;
    try {
        const json = await projectStorage.exportProject(id);
        download(new Blob([json], { type: 'application/json' }), safeName(meta.name) + '.midas');
    } catch {
        toast('Could not export document.');
    }
}'''
assert target_lib_down in content, 'target_lib_down not found'
content = content.replace(target_lib_down, repl_lib_down, 1)

# 8. libImportFile chunked saving and direct parse
target_import_file = '''        if (isFig) {
            toast('Reading Figma file…');
            await new Promise(r => setTimeout(r, 30));
            const res = await figToMidas(file);
            report = res.report;
            window.__lastFigReport = report;
            console.info('[Figma import]', report);
            data = DocumentModel.parse(JSON.stringify(res.data));
        }
        else
            data = DocumentModel.parse(await file.text());
        await save();
        const id = uid(), now = Date.now();
        lib.index.unshift({ id, name: data.name || 'Imported file', created: now, updated: now, opened: now, thumb: null });
        await loadIntoEditor(data, id);
        await save();
        hideHome();'''

repl_import_file = '''        if (isFig) {
            toast('Reading Figma file…');
            await new Promise(r => setTimeout(r, 30));
            const progressToast = (p) => {
                toast(`Importing Figma: Page ${p.pageIndex}/${p.totalPages} (${p.pageName}) · ${p.layers.toLocaleString()} layers`);
            };
            const res = await figToMidas(file, progressToast);
            report = res.report;
            window.__lastFigReport = report;
            console.info('[Figma import]', report);
            data = DocumentModel.parse(res.data);
        }
        else
            data = DocumentModel.parse(await file.text());
        await save();
        const id = uid(), now = Date.now();
        lib.index.unshift({ id, name: data.name || 'Imported file', created: now, updated: now, opened: now, thumb: null });
        toast('Saving project to local storage…');
        await projectStorage.saveProject(id, data, {
            onProgress: (p) => {
                toast(`Saving to storage: Page ${p.savedPages}/${p.totalPages} (${p.pageName})`);
            }
        });
        await loadIntoEditor(data, id);
        libSaveIndex().catch(() => {});
        kvPut('last', id).catch(() => {});
        hideHome();'''
assert target_import_file in content, 'target_import_file not found'
content = content.replace(target_import_file, repl_import_file, 1)

# 9. applyText: character-range rich text
target_apply_text = '''    const applyText = (n, f) => {
        n.text = f.textData?.characters ?? n.text ?? '';
        const style = f.fontName?.style || 'Regular';
        n.fontFamily = f.fontName?.family || n.fontFamily || 'Inter';
        n.fontWeight = /thin|hairline/i.test(style) ? 100 : /extra.?light|ultra.?light/i.test(style) ? 200 : /light/i.test(style) ? 300 : /semi.?bold|demi/i.test(style) ? 600 : /extra.?bold|ultra.?bold/i.test(style) ? 800 : /black|heavy/i.test(style) ? 900 : /bold/i.test(style) ? 700 : /medium/i.test(style) ? 500 : 400;
        n.fontStyle = /italic|oblique/i.test(style) ? 'italic' : 'normal';
        n.fontSize = f.fontSize || n.fontSize || 14;
        const lh = f.lineHeight;
        n.lineHeight = !lh ? 1.2 : lh.units === 'PIXELS' ? Math.round(lh.value / n.fontSize * 1000) / 1000 : lh.units === 'PERCENT' ? lh.value / 100 : lh.value || 1.2;
        const ls = f.letterSpacing;
        n.letterSpacing = !ls ? 0 : ls.units === 'PERCENT' ? Math.round(ls.value / 100 * n.fontSize * 100) / 100 : ls.value || 0;
        n.textAlign = { CENTER: 'center', RIGHT: 'right' }[f.textAlignHorizontal] || 'left';
        n.textCase = { UPPER: 'upper', LOWER: 'lower', TITLE: 'title' }[f.textCase] || 'none';
        n.textDecoration = { UNDERLINE: 'underline', STRIKETHROUGH: 'line-through' }[f.textDecoration] || 'none';
        n.autoW = f.textAutoResize === 'WIDTH_AND_HEIGHT';
        if (f.textData?.styleOverrideTable?.length)
            note('mixed text styles flattened to the first style');
    };'''

repl_apply_text = '''    const createSpan = (text, styleId, lookup, base) => {
        const ov = lookup.get(styleId) || {};
        const st = ov.fontName?.style || base.fontStyle;
        const fw = ov.fontName?.style
            ? (/thin|hairline/i.test(st) ? 100 : /extra.?light|ultra.?light/i.test(st) ? 200 : /light/i.test(st) ? 300 : /semi.?bold|demi/i.test(st) ? 600 : /extra.?bold|ultra.?bold/i.test(st) ? 800 : /black|heavy/i.test(st) ? 900 : /bold/i.test(st) ? 700 : /medium/i.test(st) ? 500 : 400)
            : base.fontWeight;
        const fs = ov.fontName?.style ? (/italic|oblique/i.test(st) ? 'italic' : 'normal') : base.fontStyle;
        let fill = base.fill, fillOpacity = base.fillOpacity ?? 1;
        if (ov.fillPaints?.length) {
            const fp = ov.fillPaints.find(p => p.visible !== false && p.type === 'SOLID');
            if (fp) {
                fill = hexOf(fp.color);
                fillOpacity = Math.round((fp.opacity ?? 1) * (fp.color?.a ?? 1) * 1000) / 1000;
            }
        }
        return {
            text,
            fontFamily: ov.fontName?.family || base.fontFamily,
            fontSize: ov.fontSize || base.fontSize,
            fontWeight: fw,
            fontStyle: fs,
            fill,
            fillOpacity,
            letterSpacing: ov.letterSpacing ? (ov.letterSpacing.units === 'PERCENT' ? Math.round(ov.letterSpacing.value / 100 * (ov.fontSize || base.fontSize) * 100) / 100 : ov.letterSpacing.value || 0) : base.letterSpacing,
            lineHeight: ov.lineHeight ? (ov.lineHeight.units === 'PIXELS' ? Math.round(ov.lineHeight.value / (ov.fontSize || base.fontSize) * 1000) / 1000 : ov.lineHeight.units === 'PERCENT' ? ov.lineHeight.value / 100 : ov.lineHeight.value || 1.2) : base.lineHeight,
            textDecoration: ov.textDecoration ? ({ UNDERLINE: 'underline', STRIKETHROUGH: 'line-through' }[ov.textDecoration] || 'none') : base.textDecoration
        };
    };
    const applyText = (n, f) => {
        n.text = f.textData?.characters ?? n.text ?? '';
        const style = f.fontName?.style || 'Regular';
        n.fontFamily = f.fontName?.family || n.fontFamily || 'Inter';
        n.fontWeight = /thin|hairline/i.test(style) ? 100 : /extra.?light|ultra.?light/i.test(style) ? 200 : /light/i.test(style) ? 300 : /semi.?bold|demi/i.test(style) ? 600 : /extra.?bold|ultra.?bold/i.test(style) ? 800 : /black|heavy/i.test(style) ? 900 : /bold/i.test(style) ? 700 : /medium/i.test(style) ? 500 : 400;
        n.fontStyle = /italic|oblique/i.test(style) ? 'italic' : 'normal';
        n.fontSize = f.fontSize || n.fontSize || 14;
        const lh = f.lineHeight;
        n.lineHeight = !lh ? 1.2 : lh.units === 'PIXELS' ? Math.round(lh.value / n.fontSize * 1000) / 1000 : lh.units === 'PERCENT' ? lh.value / 100 : lh.value || 1.2;
        const ls = f.letterSpacing;
        n.letterSpacing = !ls ? 0 : ls.units === 'PERCENT' ? Math.round(ls.value / 100 * n.fontSize * 100) / 100 : ls.value || 0;
        n.textAlign = { CENTER: 'center', RIGHT: 'right' }[f.textAlignHorizontal] || 'left';
        n.textCase = { UPPER: 'upper', LOWER: 'lower', TITLE: 'title' }[f.textCase] || 'none';
        n.textDecoration = { UNDERLINE: 'underline', STRIKETHROUGH: 'line-through' }[f.textDecoration] || 'none';
        n.autoW = f.textAutoResize === 'WIDTH_AND_HEIGHT';
        const td = f.textData;
        if (td?.characterStyleIDs?.length && td?.styleOverrideTable?.length && n.text.length) {
            const table = td.styleOverrideTable, lookup = new Map();
            table.forEach((entry, idx) => {
                const id = entry.styleID !== undefined ? entry.styleID : idx + 1;
                lookup.set(id, entry);
            });
            const chars = Array.from(n.text), styleIDs = td.characterStyleIDs, spans = [];
            let curStyleId = styleIDs[0] || 0, curText = '';
            for (let i = 0; i < chars.length; i++) {
                const sid = styleIDs[i] || 0;
                if (sid !== curStyleId && curText.length > 0) {
                    spans.push(createSpan(curText, curStyleId, lookup, n));
                    curText = '';
                    curStyleId = sid;
                }
                curText += chars[i];
            }
            if (curText.length > 0)
                spans.push(createSpan(curText, curStyleId, lookup, n));
            if (spans.length > 1)
                n.spans = spans;
            else if (f.textData?.styleOverrideTable?.length)
                note('mixed text styles flattened to the first style');
        }
    };'''
assert target_apply_text in content, 'target_apply_text not found'
content = content.replace(target_apply_text, repl_apply_text, 1)

# 10. makeMidas: Boolean operations and Masks
target_make_midas = '''    const SHAPES = { RECTANGLE: 'rect', ROUNDED_RECTANGLE: 'rect', ELLIPSE: 'ellipse', LINE: 'line', TEXT: 'text', GROUP: 'group', BOOLEAN_OPERATION: 'group' };
    const makeMidas = (f, pf, out, parentMidas) => {
        const k = gkey(f.guid), vector = ['VECTOR', 'STAR', 'REGULAR_POLYGON'].includes(f.type);
        let type = FRAMEISH.has(f.type) ? 'frame' : SHAPES[f.type] || (vector ? 'group' : null);
        if (!type) {
            skip(f.type);
            return null;
        }
        const n = node(type, { name: f.name || type, visible: f.visible !== false, locked: !!f.locked, opacity: f.opacity ?? 1 });
        n.parentId = parentMidas ? parentMidas.id : null;
        geometry(n, f);
        if (type === 'line')
            n.h = .1;
        applyConstraints(n, f);
        if (type === 'frame') {
            n.clip = f.type === 'SECTION' ? false : !f.frameMaskDisabled;
            applyFills(n, f);
            applyLayout(n, f);
        }
        else if (type === 'rect' || type === 'ellipse') {
            applyFills(n, f);
        }
        else if (type === 'text') {
            applyFills(n, f);
            applyText(n, f);
            n.layoutSizingH = n.autoW ? 'hug' : 'fixed';
            n.layoutSizingV = f.textAutoResize === 'NONE' || f.textAutoResize === undefined && !n.autoW ? 'fixed' : 'hug';
        }
        else if (type === 'group')
            n.fill = 'none';
        if (type !== 'group' && type !== 'text') {
            applyRadius(n, f);
            if (type === 'line') {
                n.fill = 'none';
                n.fills = [];
            }
        }
        if (type !== 'group')
            applyStroke(n, f);
        if (type !== 'group')
            applyEffects(n, f);
        else if (f.effects?.length)
            note('effects on groups ignored');
        if (f.mask)
            note('mask layers imported as normal layers');
        if (f.type === 'BOOLEAN_OPERATION')
            note('boolean operations imported as grouped shapes');'''

repl_make_midas = '''    const SHAPES = { RECTANGLE: 'rect', ROUNDED_RECTANGLE: 'rect', ELLIPSE: 'ellipse', LINE: 'line', TEXT: 'text', GROUP: 'group', BOOLEAN_OPERATION: 'path' };
    const makeMidas = (f, pf, out, parentMidas) => {
        const k = gkey(f.guid), vector = ['VECTOR', 'STAR', 'REGULAR_POLYGON'].includes(f.type), isBool = f.type === 'BOOLEAN_OPERATION';
        let type = FRAMEISH.has(f.type) ? 'frame' : isBool ? 'path' : SHAPES[f.type] || (vector ? 'group' : null);
        if (!type) {
            skip(f.type);
            return null;
        }
        const n = node(type, { name: f.name || type, visible: f.visible !== false, locked: !!f.locked, opacity: f.opacity ?? 1 });
        n.parentId = parentMidas ? parentMidas.id : null;
        geometry(n, f);
        if (type === 'line')
            n.h = .1;
        applyConstraints(n, f);
        if (isBool) {
            const opMap = { UNION: 'union', 0: 'union', INTERSECT: 'intersect', 1: 'intersect', SUBTRACT: 'subtract', 2: 'subtract', XOR: 'exclude', EXCLUDE: 'exclude', 3: 'exclude' };
            n.booleanOp = opMap[f.booleanOperation] || 'union';
            n.fill = 'none';
        }
        if (f.mask)
            n.isMask = true;
        if (type === 'frame') {
            n.clip = f.type === 'SECTION' ? false : !f.frameMaskDisabled;
            applyFills(n, f);
            applyLayout(n, f);
        }
        else if (type === 'rect' || type === 'ellipse') {
            applyFills(n, f);
        }
        else if (type === 'text') {
            applyFills(n, f);
            applyText(n, f);
            n.layoutSizingH = n.autoW ? 'hug' : 'fixed';
            n.layoutSizingV = f.textAutoResize === 'NONE' || f.textAutoResize === undefined && !n.autoW ? 'fixed' : 'hug';
        }
        else if (type === 'group' || isBool)
            n.fill = 'none';
        if (type !== 'group' && type !== 'text') {
            applyRadius(n, f);
            if (type === 'line') {
                n.fill = 'none';
                n.fills = [];
            }
        }
        if (type !== 'group')
            applyStroke(n, f);
        if (type !== 'group')
            applyEffects(n, f);
        else if (f.effects?.length)
            note('effects on groups ignored');'''
assert target_make_midas in content, 'target_make_midas not found'
content = content.replace(target_make_midas, repl_make_midas, 1)

# 11. figToMidas chunked execution & progress
target_fig_loop = '''    const pages = [];
    for (const c of canvases) {
        const nodes = [];
        for (const ch of kids.get(gkey(c.guid)) || [])
            walk(ch, null, null, nodes);
        pages.push({ id: uid(), name: c.name || `Page ${pages.length + 1}`, nodes, canvas: c });
        rep.pages++;
    }'''

repl_fig_loop = '''    const pages = [];
    let processedLayers = 0;
    for (let ci = 0; ci < canvases.length; ci++) {
        if (abortSignal?.aborted)
            throw new Error('Import cancelled by user.');
        const c = canvases[ci];
        const nodes = [];
        for (const ch of kids.get(gkey(c.guid)) || [])
            walk(ch, null, null, nodes);
        processedLayers += nodes.length;
        pages.push({ id: uid(), name: c.name || `Page ${pages.length + 1}`, nodes, canvas: c });
        rep.pages++;
        if (onProgress) {
            onProgress({
                pageIndex: ci + 1,
                totalPages: canvases.length,
                pageName: c.name || `Page ${ci + 1}`,
                layers: processedLayers
            });
        }
        if (ci % 2 === 0)
            await new Promise(r => setTimeout(r, 0));
    }'''
assert target_fig_loop in content, 'target_fig_loop not found'
content = content.replace(target_fig_loop, repl_fig_loop, 1)

target_fig_fn = 'async function figToMidas(file) {'
repl_fig_fn = 'async function figToMidas(file, onProgress, abortSignal) {'
assert target_fig_fn in content, 'target_fig_fn not found'
content = content.replace(target_fig_fn, repl_fig_fn, 1)

with open('src/engine/midas.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Successfully applied all modifications to src/engine/midas.js.')
