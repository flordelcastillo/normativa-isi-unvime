import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { SIDE_NAME, emptyFilters, passes, preprocess } from './lib.js';
import { AXVAR, Icon } from './ui.jsx';
import Home from './Home.jsx';
import Documents from './Documents.jsx';
import Timelines from './Timelines.jsx';
import DetailPane from './DetailPane.jsx';
import HelpDialog from './HelpDialog.jsx';
import LoginDialog from './LoginDialog.jsx';
import DocForm from './DocForm.jsx';

const TABS = [['inicio', 'Inicio'], ['documentos', 'Documentos'], ['lineas', 'Líneas de tiempo']];
const ANEXOS = ['Anexo 7', 'Anexo 8', 'Anexo 9', 'Anexo 10', 'Informe de seguimiento', 'Otros'];

function fromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const t = p.get('t');
  return { ui: { tab: TABS.some(x => x[0] === t) ? t : 'inicio', sel: p.get('id') || null, selTab: 'resumen', line: p.get('l') || null, lineMedia: true }, f: { ax: p.get('a') ? [p.get('a')] : [], q: p.get('q') || '' } };
}

export default function App() {
  const init = useMemo(fromHash, []);
  const [meta, setMeta] = useState(null);
  const [raw, setRaw] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [F, setF] = useState(() => ({ ...emptyFilters(), ...init.f }));
  const [ui, setUiState] = useState(init.ui);
  const [admin, setAdmin] = useState(!!getToken());
  const [dlg, setDlg] = useState(null);
  const [toast, setToast] = useState('');
  const searchRef = useRef(null);
  const setUi = useCallback(p => setUiState(s => ({ ...s, ...p })), []);
  const notify = useCallback(m => { setToast(m); window.clearTimeout(notify.t); notify.t = window.setTimeout(() => setToast(''), 4500); }, []);

  const reload = useCallback(() => api.docs().then(setRaw), []);
  useEffect(() => { Promise.all([api.meta(), api.docs()]).then(([m, d]) => { setMeta(m); setRaw(d); }).catch(e => setLoadErr(e.message)); }, []);
  useEffect(() => {
    const p = new URLSearchParams(); p.set('t', ui.tab);
    if (ui.sel) p.set('id', ui.sel); if (ui.tab === 'lineas' && ui.line) p.set('l', ui.line); if (F.ax.length === 1) p.set('a', F.ax[0]); if (F.q) p.set('q', F.q);
    history.replaceState(null, '', '#' + p.toString());
  }, [ui.tab, ui.sel, ui.line, F.ax, F.q]);
  useEffect(() => {
    const h = e => {
      const typing = /input|textarea|select/i.test(e.target.tagName);
      if (e.key === '/' && !typing && !dlg) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape' && !dlg) setUi({ sel: null });
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [dlg, setUi]);

  const docs = useMemo(() => preprocess(raw || []), [raw]);
  const byId = useMemo(() => new Map(docs.map(d => [d.id, d])), [docs]);
  const years = useMemo(() => [...new Set(docs.map(d => d.anio).filter(Boolean))].sort(), [docs]);
  const sel = ui.sel ? byId.get(ui.sel) : null;
  useEffect(() => { document.title = sel ? `${sel.numero} · Normativa ISI` : 'Normativa ISI · UNViMe'; }, [sel]);

  if (loadErr) return <div className="empty"><h3>No pudimos cargar los documentos</h3><p>{loadErr}</p><p className="muted small">Revisá la conexión y recargá la página.</p></div>;
  if (!meta || !raw) return <div className="empty" role="status"><p>Cargando la normativa…</p></div>;

  const open = id => setUi({ sel: id, tab: ui.tab === 'inicio' ? 'documentos' : ui.tab });
  const go = (tab, patch = {}, q) => {
    if (patch.ax) setF(f => ({ ...f, ax: patch.ax, cat: [], q: q ?? '' })); else if (q !== undefined) setF(f => ({ ...f, q, ax: [], cat: [] }));
    setUi({ tab, ...(patch.line ? { line: patch.line } : {}), sel: null });
    window.scrollTo(0, 0);
  };
  const needAdmin = fn => { if (!getToken()) { setAdmin(false); setDlg('login'); } else fn(); };
  const logout = () => { setToken(''); setAdmin(false); notify('Cerraste la sesión de administrador.'); };
  const saved = async d => { await reload(); setDlg(null); setUi({ sel: d.id, selTab: 'resumen' }); notify(`Guardado: ${d.numero}`); };
  const del = async d => {
    if (!window.confirm(`¿Eliminar ${d.numero} y su PDF? No se puede deshacer.`)) return;
    try { await api.remove(d.id); await reload(); setUi({ sel: null }); notify(`Se eliminó ${d.numero}.`); } catch (e) { notify(e.message); }
  };
  const onSearch = e => { const q = e.target.value; setF(f => ({ ...f, q })); if (ui.tab !== 'documentos') setUi({ tab: 'documentos' }); };

  const detail = sel && (
    <aside className="split-detail"><DetailPane d={sel} byId={byId} lines={meta.lines} ui={ui} setUi={setUi} onClose={() => setUi({ sel: null })} onOpen={open}
      onLine={k => go('lineas', { line: k })} admin={admin} onEdit={d => needAdmin(() => setDlg({ form: 'edit', doc: d }))} onDelete={del} notify={notify} /></aside>
  );

  const axCount = Object.fromEntries(ANEXOS.map(x => [x, docs.filter(d => d.anexo === x && passes(d, F, { ax: 1, cat: 1, org: 1, tip: 1, est: 1 })).length]));
  const total = ANEXOS.reduce((s2, x) => s2 + axCount[x], 0);
  const goAnexo = x => { setF(f => ({ ...f, ax: x ? [x] : [], cat: [] })); setUi({ tab: 'documentos', sel: null }); window.scrollTo(0, 0); };

  return (
    <>
      <a className="skip" href="#main">Saltar al contenido</a>
      <header className="topbar">
        <button className="brand" onClick={() => go('inicio')} aria-label="Ir al inicio"><b>Normativa ISI</b><small>UNViMe</small></button>
        <div className="topsearch" role="search"><Icon n="search" /><label className="sr" htmlFor="q">Buscar normas</label>
          <input id="q" ref={searchRef} className="field" type="search" placeholder="Buscar número, tema o persona…" value={F.q} onChange={onSearch} autoComplete="off" /><kbd aria-hidden="true">/</kbd></div>
        <div className="topactions">
          <button className="iconbtn" onClick={() => setDlg('help')} aria-label="Cómo usar este visor" title="Cómo usar este visor"><Icon n="help" /></button>
          {!meta.soloLectura && (admin
            ? <><button className="btn primary sm" onClick={() => needAdmin(() => setDlg({ form: 'new' }))}><Icon n="plus" />Subir documento</button><button className="btn sm" onClick={logout}>Salir</button></>
            : <button className="btn sm" onClick={() => setDlg('login')}>Administrar</button>)}
        </div>
      </header>
      <div className="shell">
        <nav className="side" aria-label="Secciones">
          <h2>Explorar</h2>
          <button className="sitem" aria-current={ui.tab === 'inicio' ? 'page' : undefined} onClick={() => go('inicio')}>Inicio</button>
          <button className="sitem" aria-current={ui.tab === 'lineas' ? 'page' : undefined} onClick={() => go('lineas')}>Líneas de tiempo</button>
          <h2>Documentos por anexo</h2>
          <button className="sitem" aria-current={ui.tab === 'documentos' && !F.ax.length ? 'page' : undefined} onClick={() => goAnexo(null)}>Todos<span className="n">{total}</span></button>
          {ANEXOS.map(x => <button key={x} className="sitem" aria-current={ui.tab === 'documentos' && F.ax[0] === x ? 'page' : undefined} onClick={() => goAnexo(x)} style={{ '--tab': AXVAR[x] }}>{SIDE_NAME[x]}<span className="n">{axCount[x]}</span></button>)}
          <p className="foot">{docs.length} documentos relevados el 15/10/2026. Fuente oficial: <a href="https://digesto.unvime.edu.ar/digesto/" target="_blank" rel="noopener noreferrer">digesto de la UNViMe</a>.</p>
        </nav>
        <main id="main" className="content">
          {ui.tab === 'inicio' && <Home docs={docs} F={F} go={go} onOpen={open} />}
          {ui.tab === 'documentos' && <div className={`split ${sel ? 'has-detail' : ''}`}><div className="split-main"><Documents docs={docs} F={F} setF={setF} years={years} ui={ui} onOpen={open} /></div>{detail}</div>}
          {ui.tab === 'lineas' && <div className={`split ${sel ? 'has-detail' : ''}`}><div className="split-main"><Timelines docs={docs} byId={byId} lines={meta.lines} ui={ui} setUi={setUi} onOpen={open} /></div>{detail}</div>}
        </main>
      </div>
      {sel && ui.tab !== 'inicio' && <div className="scrim" onClick={() => setUi({ sel: null })} aria-hidden="true" />}
      {dlg === 'help' && <HelpDialog onClose={() => setDlg(null)} />}
      {dlg === 'login' && <LoginDialog onClose={() => setDlg(null)} onOk={() => { setAdmin(true); setDlg(null); notify('Ingresaste como administrador.'); }} />}
      {dlg?.form && <DocForm meta={meta} docs={docs} byId={byId} initial={dlg.form === 'edit' ? dlg.doc : null} onClose={() => setDlg(null)} onSaved={saved} notify={notify} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
