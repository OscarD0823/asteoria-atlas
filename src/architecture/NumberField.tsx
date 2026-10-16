import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { fromMeters, toMeters, type DisplayUnit } from './units';
export const UnitContext = createContext<DisplayUnit>('m');
export default function Numeric({ label, value, unit = 'm', onChange }: { label: string; value: number; unit?: string; onChange: (v: number) => boolean }) {
  const displayUnit = useContext(UnitContext), converted = unit === 'm' ? fromMeters(value, displayUnit) : value, suffix = unit === 'm' ? displayUnit : unit;
  const [draft, setDraft] = useState(String(converted)), cancel = useRef(false);
  useEffect(() => setDraft(String(Math.round(converted * 10000) / 10000)), [converted]);
  return <label className="pa-field"><span>{label}</span><div><input aria-label={label} inputMode="decimal" value={draft} onChange={e => setDraft(e.target.value)} onFocus={e => e.target.select()} onBlur={() => { if (cancel.current) { cancel.current = false; setDraft(String(converted)); return; } const n = Number(draft.replace(',', '.')); if (!draft.trim() || !Number.isFinite(n) || !onChange(unit === 'm' ? toMeters(n, displayUnit) : n)) setDraft(String(converted)); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancel.current = true; e.currentTarget.blur(); } }}/><small>{suffix}</small></div></label>;
}
