import React, { useEffect, useRef, useState } from 'react';
import { ESTADOS, ESTADO_AYUDA } from './lib.js';

const P = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  download: <><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" /><path d="M12 17h.01" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12 5 5 9-10" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m5.7 5.7 12.6 12.6" /></>,
  circle: <circle cx="12" cy="12" r="8" />,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /></>,
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  layers: <><path d="m12 4 9 5-9 5-9-5 9-5Z" /><path d="m3 14 9 5 9-5" /></>,
  scale: <><path d="M12 4v16M6 20h12" /><path d="M5 7h14" /><path d="m5 7-3 7a3 3 0 0 0 6 0L5 7Zm14 0-3 7a3 3 0 0 0 6 0l-3-7Z" /></>,
  book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></>,
  rocket: <><path d="M5 19c0-3 1-5 3-7l4-4c3-3 6-3 8-3 0 2 0 5-3 8l-4 4c-2 2-4 3-7 3" /><circle cx="15" cy="9" r="1.5" /></>,
  chart: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
  flag: <><path d="M6 21V4" /><path d="M6 5h11l-2 4 2 4H6" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5a3 3 0 0 1 0 6M18 20a5 5 0 0 0-3-4.5" /></>,
  report: <><path d="M8 4h8a2 2 0 0 1 2 2v14H6V6a2 2 0 0 1 2-2Z" /><path d="M9 4v2h6V4" /><path d="M9 11h6M9 15h4" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>,
};
export const Icon = ({ n }) => <svg className="i" viewBox="0 0 24 24" aria-hidden="true">{P[n]}</svg>;

export const StatusChip = ({ k }) => <span className={`status s-${k}`} title={ESTADO_AYUDA[k]}><i className="dot" aria-hidden="true" />{ESTADOS[k]}</span>;

export const AXICON = { 'Anexo 7': 'scale', 'Anexo 8': 'book', 'Anexo 9': 'rocket', 'Anexo 10': 'chart', 'Informe de seguimiento': 'flag', 'Otros': 'users', 'Descartar': 'ban' };
export const AXVAR = { 'Anexo 7': 'var(--a7)', 'Anexo 8': 'var(--a8)', 'Anexo 9': 'var(--a9)', 'Anexo 10': 'var(--a10)', 'Informe de seguimiento': 'var(--a-seg)', 'Otros': 'var(--a-otros)', 'Descartar': 'var(--line-2)' };
export const AnexoMark = ({ a }) => <span className="sw" style={{ '--ax': AXVAR[a] }} aria-hidden="true" />;

/* Selector desplegable con casillas (multi) o opciones únicas (single) */
export function Menu({ label, options, value, onChange, single = false, wide = false, right = false, prefix = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const out = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc); };
  }, [open]);
  const selected = single ? options.find(o => o.value === value) : null;
  const n = single ? 0 : value.length;
  return (
    <div className="pop-wrap" ref={ref}>
      <button type="button" className={`fbtn ${n || (single && value !== options[0].value) ? 'on' : ''}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {single ? <>{prefix}{selected?.label}</> : <>{label}{n > 0 && <b>{n}</b>}</>}<Icon n="chevron" />
      </button>
      {open && (
        <div className={`pop ${right ? 'right' : ''}`} role="group" aria-label={label} style={wide ? { minWidth: 330 } : undefined}>
          {!single && <div className="hd"><span>{label}</span>{n > 0 && <button type="button" className="linkish" onClick={() => onChange([])}>Quitar selección</button>}</div>}
          {options.map(o => (
            <label key={o.value} className="opt">
              <input type={single ? 'radio' : 'checkbox'} name={single ? label : undefined} checked={single ? value === o.value : value.includes(o.value)}
                onChange={() => { if (single) { onChange(o.value); setOpen(false); } else onChange(value.includes(o.value) ? value.filter(x => x !== o.value) : [...value, o.value]); }} />
              <span>{o.label}</span>{o.count != null && <span className="n">{o.count}</span>}
            </label>
          ))}
          {!options.length && <div className="hd">No hay opciones con los filtros actuales.</div>}
        </div>
      )}
    </div>
  );
}

/* Contenedor desplegable genérico (para filtros con contenido propio) */
export function Popover({ label, active, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const out = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="pop-wrap" ref={ref}>
      <button type="button" className={`fbtn ${active ? 'on' : ''}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}>{label}<Icon n="chevron" /></button>
      {open && <div className="pop" style={{ padding: 14 }}>{children}</div>}
    </div>
  );
}

/* Casilla para sumar un documento o convenio al informe */
export function SelBox({ checked, onChange, label }) {
  return (
    <label className="selbox" onClick={e => e.stopPropagation()} title={checked ? 'Quitar del informe' : 'Agregar al informe'}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span aria-hidden="true"><Icon n="check" /></span>
    </label>
  );
}

/* Enlace a un documento: <a href> real (clic derecho / Ctrl+clic abren otra pestaña); el clic normal navega sin recargar */
export function DocLink({ id, onOpen, className, children, title, style }) {
  return (
    <a href={`#t=documentos&id=${id}`} className={className} title={title} style={style}
      onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); onOpen(id); }}>{children}</a>
  );
}
