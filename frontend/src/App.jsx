import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { SIDE_NAME, emptyConv, emptyFilters, passes, passesConv, preprocess, preprocessConvenios } from './lib.js';
import { AXVAR, Icon } from './ui.jsx';
import { useSeleccion } from './seleccion.js';
import Home from './Home.jsx';
import Documents from './Documents.jsx';
import Convenios, { ConvenioDetail } from './Convenios.jsx';
import Informe from './Informe.jsx';
import Timelines from './Timelines.jsx';
import DetailPane from './DetailPane.jsx';
import HelpDialog from './HelpDialog.jsx';
import LoginDialog from './LoginDialog.jsx';
import DocForm from './DocForm.jsx';

const TABS = [['inicio', 'Inicio'], ['documentos', 'Documentos'], ['lineas', 'Líneas de tiempo'], ['convenios', 'Convenios'], ['informe', 'Informe']];
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
  const [convRaw, setConvRaw] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const seleccion = useSeleccion();
  const [CF, setCF] = useState(emptyConv);
  const [F, setF] = useState(() => ({ ...emptyFilters(), ...init.f }));
  const [ui, setUiState] = useState(init.ui);
  const [admin, setAdmin] = useState(!!getToken());
  const [dlg, setDlg] = useState(null);
  const [toast, setToast] = useState('');
  const searchRef = useRef(null);
  const setUi = useCallback(p => setUiState(s => ({ ...s, ...p })), []);
  const notify = useCallback(m => { setToast(m); window.clearTimeout(notify.t); notify.t = window.setTimeout(() => setToast(''), 4500); }, []);

  const reload = useCallback(() => api.docs().then(setRaw), []);
  useEffect(() => {
    // los convenios son un agregado: si fallan, el resto del visor sigue funcionando
    Promise.all([api.meta(), api.docs(), api.convenios().catch(() => ({ convenios: [], categorias: [] }))])
      .then(([m, d, c]) => { setMeta(m); setRaw(d); setConvRaw(c); }).catch(e => setLoadErr(e.message));
  }, []);
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
  const convenios = useMemo(() => preprocessConvenios(convRaw?.convenios || []), [convRaw]);
  const convById = useMemo(() => new Map(convenios.map(c => [c.id, c])), [convenios]);
  const convYears = useMemo(() => [...new Set(convenios.map(c => c.anio).filter(Boolean))].sort(), [convenios]);
  const esConv = ui.tab === 'convenios';
  const sel = ui.sel && !esConv ? byId.get(ui.sel) : null;
  const selConv = ui.sel && esConv ? convById.get(ui.sel) : null;
  useEffect(() => { document.title = sel ? `${sel.numero} · Normativa ISI` : selConv ? `${selConv.numero} · Convenios ISI` : 'Normativa ISI · UNViMe'; }, [sel, selConv]);

  if (loadErr) return <div className="empty"><h3>No pudimos cargar los documentos</h3><p>{loadErr}</p><p className="muted small">Revisá la conexión y recargá la página.</p></div>;
  if (!meta || !raw) return <div className="empty" role="status"><p>Cargando la normativa…</p></div>;

  const open = id => setUi({ sel: id, tab: ui.tab === 'inicio' || ui.tab === 'informe' ? 'documentos' : ui.tab });
  const abrirDeInforme = (tipo, id) => setUi({ tab: tipo === 'convenio' ? 'convenios' : 'documentos', sel: id, selTab: 'resumen' });
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
  const onSearch = e => { const q = e.target.value; setF(f => ({ ...f, q })); if (ui.tab !== 'documentos' && ui.tab !== 'convenios') setUi({ tab: 'documentos' }); };

  const detail = sel && (
    <aside className="split-detail"><DetailPane d={sel} byId={byId} lines={meta.lines} ui={ui} setUi={setUi} onClose={() => setUi({ sel: null })} onOpen={open}
      onLine={k => go('lineas', { line: k })} admin={admin} onEdit={d => needAdmin(() => setDlg({ form: 'edit', doc: d }))} onDelete={del} notify={notify} seleccion={seleccion} /></aside>
  );
  const detailConv = selConv && (
    <aside className="split-detail"><ConvenioDetail c={selConv} ui={ui} setUi={setUi} onClose={() => setUi({ sel: null })} seleccion={seleccion} notify={notify} /></aside>
  );
  const nSel = seleccion.sel.items.length;
  const convSugeridos = convenios.filter(c => passesConv(c, F, CF)).length;

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
          <button className="btn sm informe-btn" onClick={() => go('informe')} aria-label={`Informe: ${nSel} elementos elegidos`}><Icon n="report" />Informe{nSel > 0 && <b className="badge">{nSel}</b>}</button>
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
          <h2>Vinculación</h2>
          <button className="sitem" aria-current={ui.tab === 'convenios' ? 'page' : undefined} onClick={() => go('convenios')} style={{ '--tab': 'var(--a8)' }}>Convenios<span className="n">{convSugeridos}</span></button>
          <h2>Para entregar</h2>
          <button className="sitem" aria-current={ui.tab === 'informe' ? 'page' : undefined} onClick={() => go('informe')}>Informe en PDF<span className="n">{nSel}</span></button>
          <p className="foot">{docs.length} documentos del digesto relevados el 15/10/2026 y {convenios.length} convenios de Citrino relevados el {convRaw?.relevado || '26/10/2026'}. Fuentes: <a href="https://digesto.unvime.edu.ar/digesto/" target="_blank" rel="noopener noreferrer">digesto</a> y <a href="http://citrino.unvime.edu.ar/citrino/#/convenios" target="_blank" rel="noopener noreferrer">Citrino</a>.</p>
        </nav>
        <main id="main" className="content">
          {ui.tab === 'inicio' && <Home docs={docs} F={F} go={go} onOpen={open} />}
          {ui.tab === 'documentos' && <div className={`split ${sel ? 'has-detail' : ''}`}><div className="split-main"><Documents docs={docs} F={F} setF={setF} years={years} ui={ui} onOpen={open} seleccion={seleccion} notify={notify} /></div>{detail}</div>}
          {ui.tab === 'convenios' && <div className={`split ${selConv ? 'has-detail' : ''}`}><div className="split-main"><Convenios convenios={convenios} categorias={convRaw?.categorias || []} F={F} CF={CF} setCF={setCF} years={convYears} ui={ui} onOpen={open} seleccion={seleccion} notify={notify} /></div>{detailConv}</div>}
          {ui.tab === 'informe' && <Informe seleccion={seleccion} byId={byId} convById={convById} onOpen={abrirDeInforme} go={go} notify={notify} />}
          {ui.tab === 'lineas' && <div className={`split ${sel ? 'has-detail' : ''}`}><div className="split-main"><Timelines docs={docs} byId={byId} lines={meta.lines} ui={ui} setUi={setUi} onOpen={open} /></div>{detail}</div>}
        </main>
      </div>
      {(sel || selConv) && ui.tab !== 'inicio' && <div className="scrim" onClick={() => setUi({ sel: null })} aria-hidden="true" />}
      {dlg === 'help' && <HelpDialog onClose={() => setDlg(null)} />}
      {dlg === 'login' && <LoginDialog onClose={() => setDlg(null)} onOk={() => { setAdmin(true); setDlg(null); notify('Ingresaste como administrador.'); }} />}
      {dlg?.form && <DocForm meta={meta} docs={docs} byId={byId} initial={dlg.form === 'edit' ? dlg.doc : null} onClose={() => setDlg(null)} onSaved={saved} notify={notify} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
