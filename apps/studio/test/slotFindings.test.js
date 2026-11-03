// The Behavior tab of an instance that has no template still shows its Diagnostics: a content slot belongs to a plain component as often as to a
// template, and a slot below its minimum, above its maximum or holding a layer it does not take is reported on the instance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behaviorPanelHtml } from '../src/engine/behaviorPanel.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = { templateId: null, rows: [] };
const html = findings => behaviorPanelHtml({ kind: 'instance', panel: plain, esc, findings });
const finding = { severity: 'warning', code: 'slot-below-min', node: 'Login card', nodeId: 'inst', slot: 'slot', message: 'Login card: slot "Content" holds 0 layers, at least 1 needed.' };

test('an instance with no template says so, and shows no Diagnostics while it has none', () => {
    for (const findings of [[], null, undefined]) {
        const markup = html(findings);
        assert.match(markup, /This component has no template\. Bind the main component first\./);
        assert.doesNotMatch(markup, /Diagnostics/, String(findings));
    }
});

test('an instance with no template shows its slot findings under Diagnostics, as a warning with its message', () => {
    const markup = html([finding]);
    assert.match(markup, /This component has no template/);
    assert.match(markup, /<span>Diagnostics<\/span>/);
    assert.match(markup, /<span class="badge">Warning<\/span>/);
    assert.match(markup, /Login card: slot &quot;Content&quot; holds 0 layers, at least 1 needed\./);
});

test('the slot findings of an instance follow the same list limit as every other finding', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...finding, message: `finding ${i}` }));
    const markup = html(many);
    assert.equal((markup.match(/finding \d/g) ?? []).length, 5, 'five shown');
    assert.match(markup, /View all \(7\)/);
});
