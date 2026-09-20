import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiSearch, FiCheck } from 'react-icons/fi';
import './SearchableSelect.css';

/**
 * Drop-in replacement for a raw <select>.
 *
 * The menu renders through a portal on document.body and is positioned from
 * the trigger's viewport rect, so it can never be clipped by a modal, a card
 * with overflow:hidden, or a scrolling table. It flips above the trigger when
 * there is more room there, and a search box appears once the list is long.
 *
 * Props mirror a select closely so call sites stay simple:
 *   value         current value (string | number)
 *   onChange      called with the raw value, like e.target.value
 *   options       [{ value, label, hint? }]
 *   placeholder   shown when nothing is selected
 *   searchAfter   list length at which the search box appears (default 8)
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  searchAfter = 8,
  id,
  name,
  className = '',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) {
  const reactId  = useId();
  const listId   = `${id || reactId}-listbox`;
  const triggerRef = useRef(null);
  const menuRef    = useRef(null);
  const searchRef  = useRef(null);

  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState('');
  const [active, setActive] = useState(-1);
  const [pos,    setPos]    = useState({ top: 0, left: 0, width: 0, drop: 'down' });

  const selected = useMemo(
    () => options.find(o => String(o.value) === String(value)) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      String(o.label).toLowerCase().includes(q) ||
      String(o.hint || '').toLowerCase().includes(q),
    );
  }, [options, query]);

  const showSearch = options.length >= searchAfter;

  /* ── Position the menu from the trigger rect ─────────────── */
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const below = window.innerHeight - r.bottom - gap;
    const above = r.top - gap;
    const wanted = Math.min(320, Math.max(160, filtered.length * 40 + (showSearch ? 52 : 0) + 12));
    const drop = below < wanted && above > below ? 'up' : 'down';
    const maxH = Math.max(140, Math.min(wanted, drop === 'down' ? below : above));

    // Keep the menu inside the viewport on narrow screens
    const width = Math.max(r.width, 180);
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));

    setPos({
      top: drop === 'down' ? r.bottom + gap : r.top - gap,
      left,
      width,
      maxH,
      drop,
    });
  }, [filtered.length, showSearch]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, place]);

  /* ── Outside click / Escape ──────────────────────────────── */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* ── Focus the search box when the menu opens ────────────── */
  useEffect(() => {
    if (!open) { setQuery(''); return; }
    setActive(filtered.findIndex(o => String(o.value) === String(value)));
    if (showSearch) requestAnimationFrame(() => searchRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function commit(option) {
    onChange?.(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKey(e) {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault(); setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault(); setActive(filtered.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) commit(filtered[active]);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  /* Keep the highlighted row in view while arrowing */
  useEffect(() => {
    if (!open || active < 0) return;
    const node = menuRef.current?.querySelector(`[data-idx="${active}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  return (
    <div className={`ss ${className}`.trim()}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`ss-trigger${open ? ' is-open' : ''}${selected ? '' : ' is-placeholder'}`}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onTriggerKey}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        <span className="ss-value">{selected ? selected.label : placeholder}</span>
        <FiChevronDown size={15} className="ss-caret" aria-hidden="true" />
      </button>

      {/* Keeps the value in native form submissions / FormData */}
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      {open && createPortal(
        <div
          ref={menuRef}
          id={listId}
          className={`ss-menu ss-menu--${pos.drop}`}
          style={{
            top: pos.drop === 'down' ? pos.top : undefined,
            bottom: pos.drop === 'up' ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxH,
          }}
          onKeyDown={onListKey}
        >
          {showSearch && (
            <div className="ss-search">
              <FiSearch size={14} className="ss-search-icon" aria-hidden="true" />
              <input
                ref={searchRef}
                className="ss-search-input"
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder="Search…"
                aria-label="Filter options"
              />
            </div>
          )}

          <ul className="ss-list" role="listbox" aria-label={ariaLabel || 'Options'} tabIndex={-1}>
            {filtered.map((o, i) => {
              const isSel = String(o.value) === String(value);
              return (
                <li key={`${o.value}`} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    data-idx={i}
                    className={`ss-option${i === active ? ' is-active' : ''}${isSel ? ' is-selected' : ''}`}
                    onClick={() => commit(o)}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span className="ss-option-text">
                      <span className="ss-option-label">{o.label}</span>
                      {o.hint && <span className="ss-option-hint">{o.hint}</span>}
                    </span>
                    {isSel && <FiCheck size={14} className="ss-option-check" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}

            {filtered.length === 0 && (
              <li className="ss-empty" role="none">No matches</li>
            )}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
