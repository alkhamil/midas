// Dialog (antd Modal structure): a box of a header (title and a close), a body (description) and a footer (the buttons in a slot).
// Size is the five Midas steps; the close and the footer are layers made while their props are on. Open and close are the Prototype's (Fase 2), not this template's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { templateDependencies } from '../src/behavior-engine/design-system.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const dialog = TEMPLATES.get('antd-dialog');
const model = modelFor(dialog);
const names = props => instanceFor(model, props).slice(1).map(n => n.behavior?.slot ?? n.behavior?.group ?? n.propBind?.slot ?? n.name);

test('the schema is valid and declares the Size and the props of a dialog', () => {
    assert.deepEqual(validateTemplateSchema(dialog), []);
    assert.deepEqual(Object.keys(dialog.props).sort(), ['closable', 'closeIcon', 'closeOnEsc', 'description', 'descriptionText', 'footer', 'size', 'title']);
    assert.deepEqual(dialog.props.size.modes, ['xs', 'sm', 'md', 'lg', 'xl']);
    assert.deepEqual(dialog.slots.map(s => s.id), ['footerContent']);
});

test('the title is always there; the close, the description and the footer are layers only while their props are on', () => {
    const off = names({ closable: false, description: false, footer: false });
    assert.ok(off.includes('header') && off.includes('title'), 'the header with its title is on by default');
    for (const hidden of ['closer', 'close', 'description', 'footer', 'footerBox', 'footerContent']) assert.ok(!off.includes(hidden), `${hidden} is not there while its prop is off`);
    const on = names({ closable: true, description: true, footer: true });
    for (const shown of ['closer', 'close', 'description', 'footer']) assert.ok(on.includes(shown), shown);
});

test('the layers run header, body, footer', () => {
    const groups = instanceFor(model, { footer: true }).map(n => n.behavior?.group ?? n.behavior?.slot).filter(g => ['header', 'body', 'footer'].includes(g));
    assert.deepEqual(groups, ['header', 'body', 'footer']);
});

test('the size ladder holds the paddings and the title and body typography of each step', () => {
    const px = role => Number(/space-(\d+)/.exec(role)?.[1]);
    const row = token => ['xs', 'sm', 'md', 'lg', 'xl'].map(mode => px(dialog.tokenRoles[token][mode]));
    assert.deepEqual(row('padding'), [16, 20, 24, 28, 32]);
    assert.equal(dialog.tokenRoles.titleTypography.md, 'text-base-strong');
});

test('the footer starts with an OK button, a Button instance at the dialog size', () => {
    const seed = dialog.slots.find(s => s.id === 'footerContent').seed[0];
    assert.equal(seed.template, 'button');
    assert.equal(seed.props.label, 'OK');
    assert.deepEqual(seed.follow, { size: 'size' });
    assert.deepEqual(templateDependencies(dialog, [...TEMPLATES.values()]), ['button']);
});

test('the export is a dialog element with the role and no hover rule', () => {
    const out = generateComponent(dialog, model.binding, model.variables, 'Dialog', model.frame, id => model.created.filter(n => n.parentId === id));
    const jsx = out.files['Dialog.jsx'] ?? out.files['Dialog.tsx'];
    assert.match(jsx, /role="dialog"/);
    assert.doesNotMatch(out.files['Dialog.css'], /\.antd-dialog(:hover|\[data-hoverable\]:hover)/, 'the box has no hover; only the close darkens');
});

test('Escape dismisses the dialog while closeOnEsc is on: the export listens for it, and the prop is a dialog prop', () => {
    assert.deepEqual(dialog.dismissKey, { key: 'Escape', prop: 'closeOnEsc' });
    assert.equal(dialog.props.closeOnEsc.type, 'boolean');
    const out = generateComponent(dialog, model.binding, model.variables, 'Dialog', model.frame, id => model.created.filter(n => n.parentId === id));
    const jsx = out.files['Dialog.jsx'] ?? out.files['Dialog.tsx'];
    assert.match(jsx, /import \{ forwardRef, useState, useEffect \} from 'react';/);
    assert.match(jsx, /const \[dismissed, setDismissed\] = useState\(false\);/, 'the typed export declares the state its closer and key use');
    assert.match(jsx, /document\.addEventListener\('keydown', onKey\)/);
    assert.match(jsx, /if \(e\.key === 'Escape' && closeOnEsc && !dismissed\) \{ setDismissed\(true\); onClose\?\.\(\); \}/);
});

test('the close icon is the title font size at each Size step', () => {
    const fontPx = role => ({ 'icon-sm': 12, 'icon-md': 14, 'icon-lg': 16, 'icon-xl': 20 })[role];
    const titleFontPx = { xs: 12, sm: 14, md: 14, lg: 16, xl: 20 };
    for (const mode of ['xs', 'sm', 'md', 'lg', 'xl']) assert.equal(fontPx(dialog.tokenRoles.closeSize[mode]), titleFontPx[mode], mode);
    assert.equal(dialog.tokenRoles.titleTypography.md, 'text-base-strong', 'the md title is 14px');
});
