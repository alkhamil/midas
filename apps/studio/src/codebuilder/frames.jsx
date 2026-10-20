// Choosing what each frame of a module's page is: shared by "Register frames" and the new-module wizard.
import { useEffect, useMemo, useState } from 'react';
import { suggestScreens } from '@midas/builder-core';
import { Select } from './Select.jsx';

// What a frame can be registered as. "form" is one frame used for both the create and the edit screen.
export const FRAME_CHOICES = [['list', 'List'], ['form', 'Create + Edit'], ['create', 'Create'], ['edit', 'Edit'], ['view', 'View'], ['dialog:delete', 'Dialog · Delete'], ['dialog:restore', 'Dialog · Restore'], ['dialog:discard', 'Dialog · Discard'], ['custom', 'Custom page'], ['skip', 'Skip']];
export const choiceOf = list => (!list.length ? 'skip' : list.length === 2 ? 'form' : list[0].role === 'dialog' ? `dialog:${list[0].purpose}` : list[0].role);
export const screensOf = (choice, name, frame) => {
    if (choice === 'skip') return [];
    const base = { frameId: frame.id, pageId: frame.pageId, name };
    if (choice === 'form') return [{ ...base, role: 'create' }, { ...base, role: 'edit' }];
    if (choice.startsWith('dialog:')) return [{ ...base, role: 'dialog', purpose: choice.slice(7) }];
    return [{ ...base, role: choice }];
};
export const rolesOfChoice = choice => (choice === 'form' ? ['create', 'edit'] : choice.startsWith('dialog:') ? [choice] : choice === 'skip' || choice === 'custom' ? [] : [choice]);
export const cleanFrameName = f => String(f.name || '').replace(/^page\s*[·:-]\s*/i, '').trim() || f.name;

/**
 * State for the frame checklist. Defaults follow the frame names; a role that `existing` screens already have (or an earlier
 * row takes) starts as Skip. `candidates` are the frames to choose from.
 */
export function useFrameChoices(candidates, existing = []) {
    const initial = useMemo(() => {
        const used = new Set(existing.map(s => (s.role === 'dialog' ? `dialog:${s.purpose}` : s.role)));
        return Object.fromEntries(candidates.map(f => {
            let choice = choiceOf(suggestScreens(f.name));
            const taken = rolesOfChoice(choice).filter(r => used.has(r));
            if (taken.length) choice = choice === 'form' && taken.length === 1 ? (taken[0] === 'create' ? 'edit' : 'create') : 'skip';
            rolesOfChoice(choice).forEach(r => used.add(r));
            return [f.id, choice];
        }));
    }, [candidates, existing]);
    const [choices, setChoices] = useState(initial);
    useEffect(() => setChoices(initial), [initial]);
    const clash = useMemo(() => {
        const seen = new Set(), dup = new Set();
        for (const f of candidates) for (const r of rolesOfChoice(choices[f.id] || 'skip')) { if (seen.has(r)) dup.add(r); seen.add(r); }
        return dup;
    }, [candidates, choices]);
    const entries = useMemo(() => candidates.flatMap(f => screensOf(choices[f.id] || 'skip', cleanFrameName(f), f)), [candidates, choices]);
    const count = candidates.filter(f => (choices[f.id] || 'skip') !== 'skip').length;
    return { choices, setChoice: (id, v) => setChoices(c => ({ ...c, [id]: v })), clash, entries, count };
}

export function FrameChoiceList({ candidates, choices, setChoice, clash }) {
    return (
        <>
            {candidates.map(f => (
                <div key={f.id} className="cb-reg-row">
                    <span className="cb-reg-name" title={f.name}>{cleanFrameName(f)}</span>
                    <Select aria-label={`Role of ${f.name}`} value={choices[f.id] || 'skip'} onChange={e => setChoice(f.id, e.target.value)}>
                        {FRAME_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                </div>
            ))}
            {clash.size > 0 && <small className="cb-error">Two frames share the {[...clash].map(r => r.replace('dialog:', 'dialog ')).join(', ')} role — a module has one of each.</small>}
        </>
    );
}
