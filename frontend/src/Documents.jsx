import React, { useEffect, useMemo, useState } from 'react';
import { Icon, Menu, Popover, SelBox, StatusChip, AXVAR } from './ui.jsx';
import { ANEXO_USO, ESTADOS, MODE_LABEL, NOMBRE_ANEXO, ORG, TIP, cmpDate, emptyFilters, exportCsv, passes } from './lib.js';

const TIPN = { Ordenanza: 'Ordenanzas', Resolución: 'Resoluciones', Acta: 'Actas', Disposición: 'Disposiciones', 'Informe de autoevaluación': 'Informes de autoevaluación', 'Plan de mejora': 'Planes de mejora', Otra: 'Otros documentos' };

function Row({ d, sel, onOpen, marcado, onMarcar }) {
  return (
    <tr className="doc" aria-selected={sel} data-id={d.id} onClick={() => onOpen(d.id)}>
      <td className="chk"><SelBox checked={marcado} onChange={onMarcar} label={`Agregar al informe: ${d.numero}`} /></td>
      <td className="nm"><button className="numlink">{d.numero}</button></td>
      <td className="fe">{d.fecha || 's/f'}</td>
      <td className="rt"><b>{d.asunto}</b><small>{d.categoria}{d.actividad?.length ? (d.categoria ? ': ' : '') + d.actividad.slice(0, 2).join(', ') : ''}</small></td>
      <td className="ds">{d.estado.k !== 'vigente' ? <StatusChip k={d.estado.k} /> : null}</td>
    </tr>
  );
}

const numKey = d => { const m = /(\d+)\s*-\s*(\d{4})/.exec(d.numero || ''); return m ? +m[2] * 10000 + +m[1] : 0; };
const SORTS = { fecha: cmpDate, numero: (a, b) => numKey(a) - numKey(b) || a.numero.localeCompare(b.numero), asunto: (a, b) => a.asunto.localeCompare(b.asunto, 'es'), estado: (a, b) => a.estado.k.localeCompare(b.estado.k) || cmpDate(a, b) };

export default function Documents({ docs, F, setF, years, ui, onOpen, seleccion, notify }) {
  const [closed, setClosed] = useState(() => new Set());
  const [group, setGroup] = useState('organo');
  const [sort, setSort] = useState({ k: 'fecha', dir: 1 });
  const list = useMemo(() => docs.filter(d => passes(d, F)).sort((x, y) => SORTS[sort.k](x, y) * sort.dir), [docs, F, sort]);
  const anexoSel = F.ax.length === 1 ? F.ax[0] : null;
  const set = p => setF(f => ({ ...f, ...p }));
  const count = (key, skip) => { const c = new Map(); docs.forEach(d => { if (passes(d, F, skip)) c.set(key(d), (c.get(key(d)) || 0) + 1); }); return c; };
  const cOrg = count(d => d.organo, { org: 1 }), cTip = count(d => d.tipo, { tip: 1 }), cEst = count(d => d.estado.k, { est: 1 });

  const groups = useMemo(() => {
    if (group === 'fecha') return [{ key: 'todo', title: null, items: list }];
    if (group === 'categoria') { const m = new Map(); list.forEach(d => { const k = d.categoria || 'Sin categoría'; m.set(k, [...(m.get(k) || []), d]); }); return [...m].sort((a, b) => b[1].length - a[1].length).map(([k, items]) => ({ key: k, title: k, items })); }
    const out = []; ORG.forEach(o => TIP.forEach(t => { const items = list.filter(d => d.organo === o && d.tipo === t); if (items.length) out.push({ key: o + '|' + t, title: `${o} · ${TIPN[t]}`, items }); })); return out;
  }, [list, group]);
  const order = useMemo(() => groups.filter(g => !closed.has(g.key)).flatMap(g => g.items), [groups, closed]);
  const marcadas = list.filter(d => seleccion.tiene('norma', d.id)).length;
  const todas = list.length > 0 && marcadas === list.length;
  const alternarTodas = () => {
    if (todas) seleccion.quitar('norma', list.map(d => d.id));
    else { seleccion.agregar('norma', list.map(d => d.id)); notify(`Se agregaron ${list.length - marcadas} documentos al informe.`); }
  };

  useEffect(() => {
    const h = e => {
      if (!['j', 'k'].includes(e.key) || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
      const i = order.findIndex(d => d.id === ui.sel); const n = order[Math.max(0, Math.min(order.length - 1, i + (e.key === 'j' ? 1 : -1)))];
      if (n) { onOpen(n.id); document.querySelector(`[data-id="${n.id}"]`)?.scrollIntoView({ block: 'nearest' }); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [order, ui.sel, onOpen]);

  const active = [];
  if (F.q) active.push([`Búsqueda “${F.q}”`, () => set({ q: '' })]);
  F.cat.forEach(c => active.push([c.split('|')[1], () => set({ cat: F.cat.filter(x => x !== c) })]));
  F.org.forEach(o => active.push([o, () => set({ org: F.org.filter(x => x !== o) })]));
  F.tip.forEach(t => active.push([TIPN[t], () => set({ tip: F.tip.filter(x => x !== t) })]));
  F.est.forEach(e => active.push([ESTADOS[e], () => set({ est: F.est.filter(x => x !== e) })]));
  if (F.y0 || F.y1) active.push([`Años: ${F.y0 || '…'} a ${F.y1 || '…'}`, () => set({ y0: '', y1: '' })]);
  const catOpts = [...new Set(docs.filter(d => !anexoSel || d.anexo === anexoSel).map(d => d.anexo + '|' + d.categoria))].filter(k => k.split('|')[1])
    .map(k => ({ value: k, label: (anexoSel ? '' : k.split('|')[0].replace('Anexo ', 'A') + ' · ') + k.split('|')[1], count: docs.filter(d => d.anexo + '|' + d.categoria === k && passes(d, F, { cat: 1 })).length })).filter(o => o.count || F.cat.includes(o.value)).sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="dhead">
        <div className="grow">
          <h1>{anexoSel ? NOMBRE_ANEXO[anexoSel] || 'Descartados' : 'Todos los documentos'}</h1>
          <p className="meta" aria-live="polite"><b>{list.length}</b> {list.length === 1 ? 'documento' : 'documentos'}{F.q ? ` para “${F.q}”` : ''}{marcadas > 0 && <> · <b>{marcadas}</b> en el informe</>}</p>
        </div>
      </div>
      {anexoSel && ANEXO_USO[anexoSel] && <p className="axnote" style={{ '--ax': AXVAR[anexoSel] }}>{ANEXO_USO[anexoSel]}</p>}
      <div className="toolbar" role="group" aria-label="Filtros">
        <Menu label="Categoría" options={catOpts} value={F.cat} onChange={cat => set({ cat })} wide />
        <Menu label="Órgano emisor" options={ORG.map(o => ({ value: o, label: o, count: cOrg.get(o) || 0 })).filter(o => o.count || F.org.includes(o.value))} value={F.org} onChange={org => set({ org })} />
        <Menu label="Tipo" options={TIP.map(t => ({ value: t, label: TIPN[t], count: cTip.get(t) || 0 })).filter(o => o.count || F.tip.includes(o.value))} value={F.tip} onChange={tip => set({ tip })} />
        <Menu label="Estado" options={Object.entries(ESTADOS).map(([k, l]) => ({ value: k, label: l, count: cEst.get(k) || 0 }))} value={F.est} onChange={est => set({ est })} />
        <Popover label={F.y0 || F.y1 ? `Años ${F.y0 || '...'} a ${F.y1 || '...'}` : 'Años'} active={!!(F.y0 || F.y1)}>
          <div className="inline"><label className="fld" style={{ margin: 0 }}>Desde<select value={F.y0} onChange={e => set({ y0: e.target.value })}><option value="">Sin límite</option>{years.map(y => <option key={y}>{y}</option>)}</select></label>
            <label className="fld" style={{ margin: 0 }}>Hasta<select value={F.y1} onChange={e => set({ y1: e.target.value })}><option value="">Sin límite</option>{years.map(y => <option key={y}>{y}</option>)}</select></label></div>
        </Popover>
        <span className="grow" />
        <Menu label="Agrupar por" single right prefix="Agrupar: " value={group} onChange={setGroup} options={[{ value: 'organo', label: 'Órgano y tipo' }, { value: 'fecha', label: 'Fecha' }, { value: 'categoria', label: 'Categoría' }]} />
        <Menu label="Mostrar" single right value={F.mode} onChange={mode => set({ mode, ax: F.ax.includes('Descartar') && mode !== 'todo' ? [] : F.ax })} options={Object.entries(MODE_LABEL).filter(([value]) => value !== 'todo' || docs.some(x => x.relevancia === 'nula')).map(([value, label]) => ({ value, label }))} />
        <button className="iconbtn" onClick={() => exportCsv(list, `normativa-isi${anexoSel ? '-' + anexoSel.toLowerCase().replace(/\s+/g, '') : ''}.csv`)} disabled={!list.length} aria-label="Exportar esta lista a una planilla (CSV)" title="Exportar esta lista a una planilla (CSV)"><Icon n="download" /></button>
      </div>
      {active.length > 0 && <div className="pills">{active.map(([t, off], i) => <span className="pill" key={i}><b>{t}</b><button aria-label={`Quitar filtro: ${t}`} onClick={off}><Icon n="close" /></button></span>)}
        <button className="btn quiet sm" onClick={() => setF(f => ({ ...emptyFilters(), mode: f.mode, ax: f.ax }))}>Quitar todos</button></div>}

      {!list.length && (
        <div className="empty"><h3>No encontramos documentos con estos filtros</h3>
          <p>{F.q ? 'Probá con otras palabras o con parte del número (por ejemplo “51-2018”).' : 'Probá quitando algún filtro.'}{F.mode === 'directo' ? ' También podés incluir lo que tiene relación indirecta con la carrera.' : ''}</p>
          <div className="acts">{active.length > 0 && <button className="btn" onClick={() => setF(f => ({ ...emptyFilters(), mode: f.mode }))}>Quitar los filtros</button>}{F.mode === 'directo' && <button className="btn" onClick={() => set({ mode: 'indirecto' })}>Incluir lo indirecto</button>}</div></div>
      )}
      {list.length > 0 && (
        <table className="reg sel" style={{ marginTop: active.length ? 10 : 0 }}>
          <colgroup><col style={{ width: '3.4rem' }} /><col style={{ width: '9.2rem' }} /><col style={{ width: '6.6rem' }} /><col /><col style={{ width: '7.6rem' }} /></colgroup>
          <thead><tr>
            <th scope="col" className="chk"><SelBox checked={todas} onChange={alternarTodas} label={todas ? 'Quitar de la selección todos los documentos de la lista' : 'Agregar al informe todos los documentos de la lista'} /></th>
            {[['numero', 'Número', ''], ['fecha', 'Fecha', ''], ['asunto', 'Asunto', ''], ['estado', 'Estado', '']].map(([k, t]) => (
              <th key={k} scope="col" aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                <button onClick={() => setSort(s => (s.k === k ? { k, dir: -s.dir } : { k, dir: 1 }))}>{t}{sort.k === k && <span style={{ transform: sort.dir === 1 ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}><Icon n="chevron" /></span>}</button>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {groups.map(g => (
              <React.Fragment key={g.key}>
                {g.title && <tr className="grp"><td colSpan={5}><button aria-expanded={!closed.has(g.key)} onClick={() => setClosed(s => { const n = new Set(s); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n; })}><Icon n="chevron" />{g.title}<span className="cnt">{g.items.length}</span></button></td></tr>}
                {!closed.has(g.key) && g.items.map(d => <Row key={d.id} d={d} sel={ui.sel === d.id} onOpen={onOpen} marcado={seleccion.tiene('norma', d.id)} onMarcar={() => seleccion.alternar('norma', d.id)} />)}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
