// Auto-match of variable slots: on template bind and whenever a matching collection appears or is renamed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBinding, autoMatchCollection } from '../src/behavior-engine/binding.js';
import { planAutoMatch } from '../src/behavior-engine/binding.js';
import { planTemplateChange } from '../src/behavior-engine/panel.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

const button = TEMPLATES.get('button');
const variant = { id: 'c-variant', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }] };
const size = { id: 'c-size', name: 'Size', modes: [{ id: 'sm', name: 'Small' }] };
const unbound = () => ({ id: 'm1', name: 'Button', behavior: { version: 1, templateId: 'button', variables: { variant: null, size: null } } });

test('a template bound while the collections exist matches both slots', () => {
    const plan = planTemplateChange({ id: 'm1' }, [], 'button', [variant, size]);
    assert.deepEqual(plan.binding.variables, { variant: 'c-variant', size: 'c-size' });
});

test('a collection created after the bind binds the slot that is still unbound', () => {
    const master = unbound();
    assert.deepEqual(planAutoMatch([master], [variant]), [{ node: master, variables: { variant: 'c-variant' } }]);
});

test('a collection renamed to the slot name binds it', () => {
    const master = unbound();
    const renamed = { ...size, name: 'Size' };
    const colour = { id: 'c-size', name: 'Colour', modes: size.modes };
    assert.deepEqual(planAutoMatch([master], [colour]), []);
    assert.deepEqual(planAutoMatch([master], [renamed]), [{ node: master, variables: { size: 'c-size' } }]);
});

test('a slot that already has a binding is never changed, even when another collection has its name', () => {
    const master = unbound();
    master.behavior.variables.variant = 'c-other';
    const other = { id: 'c-other', name: 'Brand', modes: [] };
    assert.deepEqual(planAutoMatch([master], [other, variant]), []);
});

test('no match stays unbound: a near name is not a match', () => {
    const master = unbound();
    const near = [{ id: 'c-x', name: 'Variants', modes: [] }, { id: 'c-y', name: 'Var', modes: [] }];
    assert.deepEqual(planAutoMatch([master], near), []);
    assert.equal(autoMatchCollection('Variant', near), null);
});

test('two collections with the slot name: neither is chosen, because the choice would be a guess', () => {
    const master = unbound();
    const twins = [{ ...variant, id: 'c-a' }, { ...variant, id: 'c-b' }];
    assert.equal(autoMatchCollection('Variant', twins), null);
    assert.deepEqual(planAutoMatch([master], twins), []);
});

test('the name is compared ignoring case and surrounding spaces', () => {
    assert.equal(autoMatchCollection('variant', [{ id: 'c-v', name: '  Variant ', modes: [] }]), 'c-v');
});

test('masters without a binding are skipped', () => {
    assert.deepEqual(planAutoMatch([{ id: 'plain' }], [variant]), []);
});
