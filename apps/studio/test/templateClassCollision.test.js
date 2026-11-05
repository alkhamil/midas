// Play draws a template with its own stylesheet, in the studio page: a class of the studio chrome with the same name as a template's root class (its id) would restyle
// the component there (the toolbar's .icon-button forced the Icon Button's svg to 16px). No selector or class of the studio may be named like a template.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TEMPLATES } from '@midas/builder-core';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const sources = { 'styles.css': read('../src/styles.css'), 'midas.js': read('../src/engine/midas.js'), 'slotRow.js': read('../src/engine/slotRow.js'), 'Shell.jsx': read('../src/components/Shell.jsx') };
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('no class of the studio chrome is named like a template, in the stylesheet or in the markup it writes', () => {
    for (const template of TEMPLATES.values()) {
        const id = escape(template.id);
        const asSelector = new RegExp(`(^|[\\s,>+~(])\\.${id}(?![\\w-])`, 'm');
        // A class attribute whose written value (no interpolation) names the template; an expression like class="${list === v}" is not a class named list.
        const asClass = new RegExp(`class(Name)?=["'][^"'$\`]*(^|[\\s"'])${id}(?![\\w-])`);
        const inClassList = new RegExp(`classList\\.(add|remove|toggle|contains)\\(['"]${id}['"]`);
        for (const [file, text] of Object.entries(sources)) {
            assert.ok(!asSelector.test(text), `${file} has a .${template.id} selector`);
            assert.ok(!asClass.test(text), `${file} writes class="${template.id}"`);
            assert.ok(!inClassList.test(text), `${file} toggles the class ${template.id}`);
        }
    }
});
