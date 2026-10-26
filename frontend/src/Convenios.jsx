import React, { useMemo, useState } from 'react';
import { Icon, Menu, Popover, SelBox } from './ui.jsx';
import { ESTADOS_CONV, MODOS_CONV, VALOR, VALOR_AYUDA, emptyConv, exportConveniosCsv, passesConv } from './lib.js';

const partesTxt = c => (c.partes || []).map(p => p.nombre).join('; ');
const SORTS = {
  firma: (a, b) => (a.iso || '').localeCompare(b.iso || ''),
  partes: (a, b) => partesTxt(a).localeCompare(partesTxt(b), 'es'),
  vence: (a, b) => (a.vence_iso || '9999').localeCompare(b.vence_iso || '9999'),
  valor: (a, b) => ['alta', 'media', 'baja'].indexOf(a.relevancia) - ['alta', 'media', 'baja'].indexOf(b.relevancia),
};

export const Valor = ({ k }) => <span className={`valor v-${k}`} title={VALOR_AYUDA[k]}><i className="dot" aria-hidden="true" />{VALOR[k]}</span>;
const EstadoConv = ({ e }) => <span className={`status ${e === 'Vigente' ? 's-vigente' : 's-vencido'}`}><i className="dot" aria-hidden="true" />{e}</span>;

export default function Convenios({ convenios, categorias, F, CF, setCF, years, ui, onOpen, seleccion, notify }) {
  const [closed, setClosed] = useState(() => new Set());
  const [group, setGroup] = useState('categoria');
  const [sort, setSort] = useState({ k: 'firma', dir: -1 });
  const set = p => setCF(f => ({ ...f, ...p }));
  const list = useMemo(() => convenios.filter(c => passesConv(c, F, CF)).sort((a, b) => SORTS[sort.k](a, b) * sort.dir || a.numero.localeCompare(b.numero)), [convenios, F, CF, sort]);
  const count = (key, skip) => { const m = new Map(); convenios.forEach(c => { if (passesConv(c, F, CF, skip)) m.set(key(c), (m.get(key(c)) || 0) + 1); }); return m; };
  const cCat = count(c => c.categoria, { cat: 1 }), cTipo = count(c => c.tipo, { tipo: 1 }), cEst = count(c => c.estado, { estado: 1 }), cVal = count(c => c.relevancia, { valor: 1 });
  const cParte = useMemo(() => { const m = new Map(); convenios.filter(c => passesConv(c, F, CF, { parte: 1 })).forEach(c => new Set((c.partes || []).map(p => p.tipo)).forEach(t => m.set(t, (m.get(t) || 0) + 1))); return m; }, [convenios, F, CF]);

  const groups = useMemo(() => {
    if (group === 'fecha') return [{ key: 'todo', title: null, items: list }];
    const m = new Map(); list.forEach(c => m.set(c.categoria, [...(m.get(c.categoria) || []), c]));
    const orden = categorias.map(x => x.nombre);
    return [...m].sort((a, b) => orden.indexOf(a[0]) - orden.indexOf(b[0])).map(([k, items]) => ({ key: k, title: k, items }));
  }, [list, group, categorias]);

  const marcadas = list.filter(c => seleccion.tiene('convenio', c.id)).length;
  const todas = list.length > 0 && marcadas === list.length;
  const alternarTodas = () => {
    if (todas) seleccion.quitar('convenio', list.map(c => c.id));
    else { seleccion.agregar('convenio', list.map(c => c.id)); notify(`Se agregaron ${list.length - marcadas} convenios al informe.`); }
  };

  const active = [];
  if (F.q) active.push([`Búsqueda “${F.q}”`, null]);
  CF.cat.forEach(c => active.push([c, () => set({ cat: CF.cat.filter(x => x !== c) })]));
  CF.tipo.forEach(t => active.push([`Convenio ${t.toLowerCase()}`, () => set({ tipo: CF.tipo.filter(x => x !== t) })]));
  CF.estado.forEach(e => active.push([e, () => set({ estado: CF.estado.filter(x => x !== e) })]));
  CF.parte.forEach(p => active.push([`Parte ${p.toLowerCase()}`, () => set({ parte: CF.parte.filter(x => x !== p) })]));
  CF.valor.forEach(v => active.push([`Valor ${VALOR[v].toLowerCase()}`, () => set({ valor: CF.valor.filter(x => x !== v) })]));
  if (CF.y0 || CF.y1) active.push([`Años: ${CF.y0 || '...'} a ${CF.y1 || '...'}`, () => set({ y0: '', y1: '' })]);

  const ocultos = convenios.length - convenios.filter(c => passesConv(c, F, CF, { modo: 1 })).length;
  const hayBajos = CF.modo === 'sugeridos' && convenios.some(c => c.relevancia === 'baja' && passesConv(c, F, CF, { modo: 1 }));

  return (
    <>
      <div className="dhead">
        <div className="grow">
          <h1>Convenios</h1>
          <p className="meta" aria-live="polite"><b>{list.length}</b> {list.length === 1 ? 'convenio' : 'convenios'}{F.q ? ` para “${F.q}”` : ''}{marcadas > 0 && <> · <b>{marcadas}</b> en el informe</>}</p>
        </div>
      </div>
      <p className="axnote" style={{ '--ax': 'var(--a8)' }}>Convenios de la UNViMe registrados en Citrino. La columna «Valor» es una sugerencia automática según el texto de cada convenio: los docentes deciden cuáles entran al informe.</p>
      <div className="toolbar" role="group" aria-label="Filtros de convenios">
        <Menu label="Categoría" options={categorias.map(x => ({ value: x.nombre, label: x.nombre, count: cCat.get(x.nombre) || 0 })).filter(o => o.count || CF.cat.includes(o.value))} value={CF.cat} onChange={cat => set({ cat })} wide />
        <Menu label="Tipo" options={[...new Set(convenios.map(c => c.tipo))].filter(Boolean).map(t => ({ value: t, label: t, count: cTipo.get(t) || 0 })).filter(o => o.count || CF.tipo.includes(o.value))} value={CF.tipo} onChange={tipo => set({ tipo })} />
        <Menu label="Estado" options={ESTADOS_CONV.map(e => ({ value: e, label: e, count: cEst.get(e) || 0 }))} value={CF.estado} onChange={estado => set({ estado })} />
        <Menu label="Parte" options={['Pública', 'Privada', 'Externa'].map(t => ({ value: t, label: t, count: cParte.get(t) || 0 }))} value={CF.parte} onChange={parte => set({ parte })} />
        <Menu label="Valor" options={Object.entries(VALOR).map(([k, l]) => ({ value: k, label: l, count: cVal.get(k) || 0 }))} value={CF.valor} onChange={valor => set({ valor })} />
        <Popover label={CF.y0 || CF.y1 ? `Años ${CF.y0 || '...'} a ${CF.y1 || '...'}` : 'Años'} active={!!(CF.y0 || CF.y1)}>
          <div className="inline"><label className="fld" style={{ margin: 0 }}>Desde<select value={CF.y0} onChange={e => set({ y0: e.target.value })}><option value="">Sin límite</option>{years.map(y => <option key={y}>{y}</option>)}</select></label>
            <label className="fld" style={{ margin: 0 }}>Hasta<select value={CF.y1} onChange={e => set({ y1: e.target.value })}><option value="">Sin límite</option>{years.map(y => <option key={y}>{y}</option>)}</select></label></div>
        </Popover>
        <span className="grow" />
        <Menu label="Agrupar por" single right prefix="Agrupar: " value={group} onChange={setGroup} options={[{ value: 'categoria', label: 'Categoría' }, { value: 'fecha', label: 'Fecha' }]} />
        <Menu label="Mostrar" single right value={CF.modo} onChange={modo => set({ modo })} options={Object.entries(MODOS_CONV).map(([value, label]) => ({ value, label }))} />
        <button className="iconbtn" onClick={() => exportConveniosCsv(list)} disabled={!list.length} aria-label="Exportar esta lista a una planilla (CSV)" title="Exportar esta lista a una planilla (CSV)"><Icon n="download" /></button>
      </div>
      {active.length > 0 && <div className="pills">{active.map(([t, off], i) => <span className="pill" key={i}><b>{t}</b>{off && <button aria-label={`Quitar filtro: ${t}`} onClick={off}><Icon n="close" /></button>}</span>)}
        <button className="btn quiet sm" onClick={() => setCF(f => ({ ...emptyConv(), modo: f.modo }))}>Quitar los filtros</button></div>}

      {!list.length && (
        <div className="empty"><h3>No encontramos convenios con estos filtros</h3>
          <p>{F.q ? 'Probá con otras palabras o con el nombre de la institución.' : 'Probá quitando algún filtro.'}</p>
          <div className="acts">{active.length > 0 && <button className="btn" onClick={() => setCF(f => ({ ...emptyConv(), modo: f.modo }))}>Quitar los filtros</button>}{CF.modo === 'sugeridos' && <button className="btn" onClick={() => set({ modo: 'todos' })}>Ver todos los convenios</button>}</div></div>
      )}
      {list.length > 0 && (
        <table className="reg sel" style={{ marginTop: active.length ? 10 : 0 }}>
          <colgroup><col style={{ width: '3.4rem' }} /><col /><col style={{ width: '6.8rem' }} /><col style={{ width: '6.8rem' }} /><col style={{ width: '6.2rem' }} /><col style={{ width: '5.6rem' }} /></colgroup>
          <thead><tr>
            <th scope="col" className="chk"><SelBox checked={todas} onChange={alternarTodas} label={todas ? 'Quitar de la selección todos los convenios de la lista' : 'Agregar al informe todos los convenios de la lista'} /></th>
            {[['partes', 'Convenio'], ['firma', 'Firma'], ['vence', 'Vence'], ['estado', 'Estado'], ['valor', 'Valor']].map(([k, t]) => (
              <th key={k} scope="col" aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                {SORTS[k]
                  ? <button onClick={() => setSort(s => (s.k === k ? { k, dir: -s.dir } : { k, dir: k === 'firma' ? -1 : 1 }))}>{t}{sort.k === k && <span style={{ transform: sort.dir === 1 ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}><Icon n="chevron" /></span>}</button>
                  : <span className="thp">{t}</span>}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {groups.map(g => (
              <React.Fragment key={g.key}>
                {g.title && <tr className="grp"><td colSpan={6}><button aria-expanded={!closed.has(g.key)} onClick={() => setClosed(s => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}><Icon n="chevron" />{g.title}<span className="cnt">{g.items.length}</span></button></td></tr>}
                {!closed.has(g.key) && g.items.map(c => (
                  <tr key={c.id} className="doc" aria-selected={ui.sel === c.id} data-id={c.id} onClick={() => onOpen(c.id)}>
                    <td className="chk"><SelBox checked={seleccion.tiene('convenio', c.id)} onChange={() => seleccion.alternar('convenio', c.id)} label={`Agregar al informe: ${partesTxt(c)}`} /></td>
                    <td className="rt"><b>{partesTxt(c)}</b><small>{c.tipo} · {c.numero}</small></td>
                    <td className="fe" data-l="Firma">{c.firma || 's/f'}</td>
                    <td className="fe" data-l="Vence">{c.vence || (c.renovacion === 'Permanente' ? 'Permanente' : 's/f')}</td>
                    <td className="ds"><EstadoConv e={c.estado} /></td>
                    <td className="ds"><Valor k={c.relevancia} /></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
      {hayBajos && <p className="tail-note">Hay {ocultos} convenios más que no se ven relacionados con la carrera (salud, clubes, escuelas). <button className="linkish" onClick={() => set({ modo: 'todos' })}>Mostrarlos</button></p>}
    </>
  );
}

export function ConvenioDetail({ c, ui, setUi, onClose, seleccion, notify }) {
  const [copied, setCopied] = useState(false);
  const en = seleccion.tiene('convenio', c.id);
  const copy = async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); notify('Enlace copiado.'); setTimeout(() => setCopied(false), 2000); } catch { notify('No se pudo copiar el enlace.'); } };
  const ps = (c.resumen || '').split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ(“"¿¡0-9])/).filter(Boolean);
  const parrafos = []; for (let i = 0; i < ps.length; i += 2) parrafos.push(ps.slice(i, i + 2).join(' '));
  const tab = ui.selTab === 'pdf' ? 'pdf' : 'resumen';

  return (
    <div className="detail" role="region" aria-label={`Detalle del convenio ${c.numero}`}>
      <header className="dh">
        <div className="dh-top">
          <span className="kicker"><span className="sw" style={{ '--ax': 'var(--a8)' }} aria-hidden="true" />Convenio<span>›</span><span>{c.categoria}</span></span>
          <span className="dh-actions">
            <button className="iconbtn" onClick={copy} aria-label="Copiar enlace a este convenio" title="Copiar enlace"><Icon n={copied ? 'check' : 'link'} /></button>
            <button className="iconbtn" onClick={onClose} aria-label="Cerrar el detalle" title="Cerrar (Esc)"><Icon n="close" /></button>
          </span>
        </div>
        <h2 className="num cv">{partesTxt(c)}</h2>
        <p className="asunto">{c.tipo} · {c.numero}</p>
        <div className="dh-meta"><EstadoConv e={c.estado} /><Valor k={c.relevancia} /><span className="when-t">Firmado el {c.firma || 's/f'}</span></div>
        <div className="dtabs" role="tablist">
          <button role="tab" aria-selected={tab === 'resumen'} onClick={() => setUi({ selTab: 'resumen' })}>Resumen</button>
          <button role="tab" aria-selected={tab === 'pdf'} onClick={() => setUi({ selTab: 'pdf' })}>Convenio completo (PDF)</button>
        </div>
      </header>
      {tab === 'pdf' ? (
        c.pdf ? (
          <div className="dbody pdf"><object data={`${c.pdf}#view=FitH`} type="application/pdf" title={`PDF del convenio ${c.numero}`}>
            <div className="noresult-pdf"><p>Tu navegador no puede mostrar el PDF dentro de la página.</p><p style={{ marginTop: 14 }}><a className="btn primary" href={c.pdf} target="_blank" rel="noopener noreferrer"><Icon n="external" />Abrir el PDF en una pestaña</a></p></div>
          </object></div>
        ) : <div className="dbody"><section className="dsec"><h3>Sin PDF cargado</h3><p className="prose"><span>Este convenio figura en Citrino pero no tiene el documento escaneado.</span></p></section></div>
      ) : (
        <div className="dbody">
          <div className="dgrid">
            <div className="dmain">
              <section className="dsec"><h3>De qué trata</h3>
                <div className="prose">{parrafos.length ? parrafos.map((p, i) => <p key={i} className={i === 0 ? 'lead' : ''}>{p}</p>) : <p className="muted">Sin resumen: el PDF no pudo leerse.</p>}</div></section>
              {c.aporte && <section className="dsec"><h3>Posible aporte a la acreditación</h3><div className="prose"><p>{c.aporte}</p></div>
                <p className="why" style={{ marginTop: 10 }}>Es una sugerencia generada al leer el convenio. Valor {VALOR[c.relevancia].toLowerCase()}: {VALOR_AYUDA[c.relevancia].charAt(0).toLowerCase() + VALOR_AYUDA[c.relevancia].slice(1)}</p></section>}
              {c.objeto && <section className="dsec"><h3>Objeto registrado en Citrino</h3><p className="plist act">{c.objeto}</p></section>}
              {(c.partes || []).length > 0 && <section className="dsec"><h3>Partes</h3><ul className="rels">{c.partes.map((p, i) => <li key={i}><span className="verb">{p.tipo || 'Parte'}</span><span><b>{p.nombre}</b></span></li>)}</ul></section>}
              {c.obs && <section className="dsec"><h3>Observaciones del registro</h3><p className="plist">{c.obs}</p></section>}
              <details className="more-d"><summary>Cómo se obtuvo esta ficha</summary>
                <p className="why" style={{ marginTop: 10 }}>Los datos (partes, fechas, expediente) vienen del registro público de Citrino. El resumen y el aporte salen de leer el PDF escaneado con OCR, por lo que puede haber errores de lectura: el PDF es siempre la fuente.</p>
                {c.calidad && <p className="note"><b>Calidad de lectura:</b> {c.calidad}</p>}
              </details>
            </div>
            <aside className="dside" aria-label="Datos del convenio">
              <div className="ficha">
                <button className={`btn ${en ? '' : 'primary'}`} aria-pressed={en} onClick={() => seleccion.alternar('convenio', c.id)}><Icon n={en ? 'check' : 'plus'} />{en ? 'En el informe (quitar)' : 'Agregar al informe'}</button>
                {c.pdf && <a className="btn" href={c.pdf} target="_blank" rel="noopener noreferrer"><Icon n="external" />Abrir el PDF</a>}
                <dl className="facts">
                  <div><dt>Firma</dt><dd>{c.firma || 's/f'}</dd></div>
                  <div><dt>Vencimiento</dt><dd>{c.vence || (c.renovacion === 'Permanente' ? 'Permanente' : 's/f')}</dd></div>
                  {c.renovacion && <div className="x-wide"><dt>Renovación</dt><dd>{c.renovacion}{c.renov_tipo ? ` (${c.renov_tipo.toLowerCase()})` : ''}</dd></div>}
                  {c.responsable && <div className="x-wide"><dt>A cargo de</dt><dd>{c.responsable}</dd></div>}
                  {c.firmante && <div className="x-wide"><dt>Firma UNViMe</dt><dd>{c.firmante}</dd></div>}
                  {c.firmante_ext && <div className="x-wide"><dt>Firma de la otra parte</dt><dd>{c.firmante_ext}</dd></div>}
                  {c.expediente && <div className="x-wide"><dt>Expediente</dt><dd>{c.expediente}</dd></div>}
                </dl>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
