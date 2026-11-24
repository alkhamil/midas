// Pagination (Figma): the Selection item is a layer only while Show rows per page is on; Position picks the page numbers as layers (no hidden layer).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent, componentNameOf } from '../src/behavior-engine/codegen.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const pagination = TEMPLATES.get('antd-pagination');
const model = modelFor(pagination);
const slotsOf = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.name);

test('Pagination is registered, valid, and takes Size from the variable collection, the rest from literals', () => {
    assert.ok(pagination, 'Pagination is in the registry');
    assert.deepEqual(validateTemplateSchema(pagination, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.equal(pagination.props.size.source, 'variable');
    assert.equal(pagination.props.showRowsPerPage.type, 'boolean');
    assert.deepEqual(pagination.props.position.options, ['start', 'mid', 'end']);
});

test('Show rows per page is a layer switch: the Selection item is in the instance while on, and not at all while off', () => {
    const on = slotsOf({ showRowsPerPage: true });
    assert.ok(on.includes('selection') && on.includes('selectValue') && on.includes('rowsText') && on.includes('selectIcon'));
    const off = slotsOf({ showRowsPerPage: false });
    for (const id of ['selection', 'select', 'selectValue', 'selectIcon', 'rowsText']) assert.ok(!off.includes(id), `${id} is not a layer while off`);
});

test('the four arrows are on every instance, and Position picks only its own page numbers', () => {
    for (const position of ['start', 'mid', 'end']) {
        const names = slotsOf({ position });
        for (const id of ['first', 'prev', 'next', 'last']) assert.ok(names.includes(id), `${id} at ${position}`);
        const shown = names.filter(n => /^(start|mid|end)-\d+$/.test(n));
        assert.ok(shown.length > 0 && shown.every(n => n.startsWith(`${position}-`)), `only the ${position} pages at ${position}`);
    }
    assert.equal(slotsOf({ position: 'start' }).filter(n => /^(start|mid|end)-\d+$/.test(n)).length, 6);
    assert.equal(slotsOf({ position: 'mid' }).filter(n => /^(start|mid|end)-\d+$/.test(n)).length, 7);
    assert.equal(slotsOf({ position: 'end' }).filter(n => /^(start|mid|end)-\d+$/.test(n)).length, 6);
});

test('the export draws the rows text and the arrows', () => {
    const files = generateComponent(pagination, model.binding, model.variables, componentNameOf(pagination), model.frame, () => []).files;
    const tsx = Object.entries(files).find(([name]) => /.(tsx|jsx)$/.test(name))[1];
    assert.match(tsx, /antd-pagination-rowsText/);
    assert.match(tsx, /antd-pagination-first/);
});

test('every page number and every arrow takes a hover fill, and a dimmed arrow takes none (the ellipsis is not a number)', () => {
    const hovered = pagination.press.map(p => p.slot);
    assert.ok(hovered.includes('start-0') && hovered.includes('mid-3') && hovered.includes('end-5'));
    for (const id of ['btnFirst', 'btnPrev', 'btnNext', 'btnLast']) assert.ok(hovered.includes(id), id);
    const files = generateComponent(pagination, model.binding, model.variables, componentNameOf(pagination), model.frame, () => []).files;
    const css = Object.entries(files).find(([name]) => name.endsWith('.css'))[1];
    assert.match(css, /\.antd-pagination-start-0:hover \{\n {2}background-color: var\(/);
    assert.match(css, /\.antd-pagination\[data-at-start\] \.antd-pagination-btnFirst \{/);
});
