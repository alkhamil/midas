// Dropdown kustom Code Builder (pengganti <select> bawaan browser): popover di-portal ke body supaya tidak
// terpotong panel, bisa di-scroll, mendukung grup, keyboard (↑ ↓ Enter Esc), dan tema Studio.
// API sengaja sama dengan <select>: anak <option>/<optgroup>, `value`, dan `onChange(e)` dengan `e.target.value`.
import { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const textOf = node => Children.toArray(node).map(n => (typeof n === 'string' || typeof n === 'number' ? String(n) : isValidElement(n) ? textOf(n.props.children) : '')).join('');

function parse(children, group = null, out = []) {
    Children.forEach(children, c => {
        if (!isValidElement(c)) return;
        if (c.type === 'optgroup') parse(c.props.children, c.props.label, out);
        else if (c.type === 'option') out.push({ value: String(c.props.value ?? textOf(c.props.children)), label: textOf(c.props.children), disabled: !!c.props.disabled, group });
        else if (c.props?.children) parse(c.props.children, group, out);
    });
    return out;
}

const Chevron = () => <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Check = () => <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2 5 8.6 9.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export function Select({ value, onChange, children, className = '', disabled, placeholder = 'Pilih…', title, 'aria-label': ariaLabel }) {
    const options = useMemo(() => parse(children), [children]);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [pos, setPos] = useState(null);
    const btn = useRef(null), pop = useRef(null);
    const current = options.find(o => o.value === String(value ?? ''));

    const openMenu = () => {
        if (disabled) return;
        const r = btn.current.getBoundingClientRect();
        const below = window.innerHeight - r.bottom, above = r.top;
        const up = below < 200 && above > below;
        const maxHeight = Math.max(120, Math.min(280, (up ? above : below) - 12));
        const width = Math.max(r.width, 160);
        setPos({ left: Math.min(r.left, window.innerWidth - width - 8), width, maxHeight, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
        setActive(Math.max(0, options.findIndex(o => o.value === String(value ?? ''))));
        setOpen(true);
    };
    const close = () => { setOpen(false); btn.current?.focus(); };
    const choose = o => {
        if (o.disabled) return;
        onChange?.({ target: { value: o.value } });
        close();
    };

    useEffect(() => {
        if (!open) return;
        const away = e => { if (!pop.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
        const hide = e => { if (!pop.current?.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', away, true);
        window.addEventListener('resize', hide);
        window.addEventListener('scroll', hide, true);
        return () => {
            document.removeEventListener('mousedown', away, true);
            window.removeEventListener('resize', hide);
            window.removeEventListener('scroll', hide, true);
        };
    }, [open]);

    // Item aktif selalu terlihat saat navigasi keyboard.
    useEffect(() => { if (open) pop.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [open, active]);

    const onKey = e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) return openMenu();
            const d = e.key === 'ArrowDown' ? 1 : -1;
            let i = active;
            for (let n = 0; n < options.length; n++) {
                i = (i + d + options.length) % options.length;
                if (!options[i].disabled) break;
            }
            setActive(i);
        }
        else if ((e.key === 'Enter' || e.key === ' ') && open) {
            e.preventDefault();
            if (options[active]) choose(options[active]);
        }
        else if (e.key === 'Escape' && open) {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
        else if (e.key === 'Tab' && open) setOpen(false);
    };

    return (
        <>
            <button
                ref={btn} type="button" className={`cb-dd ${open ? 'open' : ''} ${className}`} disabled={disabled} title={title} aria-label={ariaLabel}
                aria-haspopup="listbox" aria-expanded={open} onClick={() => (open ? setOpen(false) : openMenu())} onKeyDown={onKey}
            >
                <span className={`cb-dd-label ${current && current.label ? '' : 'placeholder'}`}>{current && current.label ? current.label : placeholder}</span>
                <Chevron />
            </button>
            {open && pos && createPortal(
                <div ref={pop} className="cb-dd-pop" role="listbox" style={pos} onWheel={e => e.stopPropagation()}>
                    {options.map((o, i) => (
                        <div key={`${o.group}-${o.value}-${i}`}>
                            {o.group && o.group !== options[i - 1]?.group && <div className="cb-dd-group">{o.group}</div>}
                            <div
                                role="option" aria-selected={o.value === String(value ?? '')} data-active={i === active} aria-disabled={o.disabled}
                                className={`cb-dd-item ${o.value === String(value ?? '') ? 'sel' : ''} ${i === active ? 'act' : ''} ${o.disabled ? 'off' : ''} ${o.group ? 'grouped' : ''}`}
                                onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => choose(o)}
                            >
                                <span className="cb-dd-check">{o.value === String(value ?? '') && <Check />}</span>
                                <span className="cb-dd-text">{o.label || '—'}</span>
                            </div>
                        </div>
                    ))}
                    {!options.length && <div className="cb-dd-empty">Tidak ada pilihan</div>}
                </div>,
                document.body,
            )}
        </>
    );
}
