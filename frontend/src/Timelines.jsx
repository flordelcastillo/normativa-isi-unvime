import React from 'react';
import { DocLink, Icon, StatusChip } from './ui.jsx';
import { GRUPOS_LINEAS, MEMLINES, MODIF, SUPER, cmpDate, diffMembers, person, relName, titleCase } from './lib.js';

const VERBO = { modifica: 'Modifica a', rectifica: 'Rectifica a', deroga: 'Deroga a', 'deja sin efecto': 'Deja sin efecto a', reemplaza: 'Reemplaza a', complementa: 'Complementa a', reglamenta: 'Reglamenta a' };

export default function Timelines({ docs, byId, lines, ui, setUi, onOpen }) {
  const key = ui.line || 'comision_carrera_ISI';
  const line = lines.find(l => l.key === key) || lines[0];
  const rels = ui.lineMedia ? ['alta', 'media'] : ['alta'];
  const inLine = k => docs.filter(d => (d.lineas || []).includes(k) && rels.includes(d.relevancia));
  const all = inLine(line.key).sort(cmpDate);
  const useM = MEMLINES.has(line.key);
  const last = all[all.length - 1];
  const years = all.map(d => d.anio).filter(Boolean);

  let prevM = null, lastY = null;
  const principales = GRUPOS_LINEAS[0].keys.map(k => lines.find(l => l.key === k)).filter(l => l && inLine(l.key).length);
  return (
    <div className="tlmain">
      <div className="tlhead">
        <div style={{ flex: 1, minWidth: 260 }}><h1>{line.nombre}</h1><p className="desc">{line.desc}</p></div>
        <label className="tlpick">Cambiar de línea
          <select value={line.key} onChange={e => setUi({ line: e.target.value })}>
            {GRUPOS_LINEAS.map(g => <optgroup key={g.t} label={g.t}>{g.keys.map(k => lines.find(l => l.key === k)).filter(l => l && (inLine(l.key).length || l.key === line.key)).map(l => <option key={l.key} value={l.key}>{l.nombre} ({inLine(l.key).length})</option>)}</optgroup>)}
          </select></label>
      </div>
      <div className="linechips" role="group" aria-label="Líneas de gestión de la carrera">{principales.map(l => <button key={l.key} className="lchip" aria-current={l.key === line.key} onClick={() => setUi({ line: l.key })}>{l.nombre}</button>)}</div>
      <div>
        {all.length === 0 && <div className="empty"><h3>Esta línea no tiene documentos</h3><p>Probá incluyendo los de relación indirecta.</p></div>}
        {all.length > 0 && <>
          <p className="tlsum"><b>{all.length} {all.length === 1 ? 'documento' : 'documentos'}</b>{years.length > 1 ? ` entre ${Math.min(...years)} y ${Math.max(...years)}` : ''}. El último es <DocLink id={last.id} onOpen={onOpen} className="linkish">{last.numero}</DocLink> ({last.fecha || 's/f'}){last.estado.k === 'sinefecto' ? ', que quedó sin efecto' : ''}.</p>
          <div className="chain" aria-label="Recorrido">
            {all.map((d, i) => <React.Fragment key={d.id}>{i > 0 && <span className="sep" aria-hidden="true"><Icon n="arrow" /></span>}
              <DocLink id={d.id} onOpen={onOpen} className={`chip-num ${d.estado.k === 'sinefecto' ? 'gone' : ''} ${d === last && d.estado.k !== 'sinefecto' ? 'now' : ''}`}><span className="n">{d.numero}</span><span className="d">{d.fecha || 's/f'}</span></DocLink></React.Fragment>)}
          </div>
          <label className="opts" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={ui.lineMedia} onChange={e => setUi({ lineMedia: e.target.checked })} /> Incluir documentos con relación indirecta</label>
          <ol className="events">
            {all.map(d => {
              const mem = (d.miembros || []).filter(x => x && x.length > 3);
              let changes = null;
              if (useM && mem.length) {
                if (prevM) { const df = diffMembers(mem, prevM); changes = (
                  <div className="changes">
                    <div><span className="lab">Ingresan:</span>{df.ins.length ? df.ins.slice(0, 9).map((p, i) => <span key={i} className="person in">{p}</span>) : <span className="muted">nadie</span>}</div>
                    <div><span className="lab">Salen:</span>{df.outs.length ? df.outs.slice(0, 9).map((p, i) => <span key={i} className="person out">{p}</span>) : <span className="muted">nadie</span>}</div>
                    <p className="muted small">Comparado con la integración anterior. Es automático y puede equivocarse por errores de lectura; el PDF es la fuente.</p>
                  </div>); }
                else changes = <div className="changes"><div><span className="lab">Integran:</span>{mem.slice(0, 10).map((m, i) => <span key={i} className="person same">{titleCase(person(m).label)}</span>)}</div></div>;
                prevM = mem;
              }
              const acts = (d.refs || []).filter(r => r.to?.length && (SUPER.has(relName(r.rel)) || MODIF.has(relName(r.rel)) || ['complementa', 'reglamenta'].includes(relName(r.rel)))).slice(0, 3);
              const showYear = d.anio && d.anio !== lastY; if (showYear) lastY = d.anio;
              return (
                <React.Fragment key={d.id}>
                  {showYear && <li className="yearmark" aria-hidden="true">{d.anio}</li>}
                  <li className={`event st-${d.estado.k} ${ui.sel === d.id ? 'sel' : ''}`}>
                    <div className="when"><b>{d.fecha || 's/f'}</b>{d.organo}</div><span className="mark" aria-hidden="true" />
                    <div className="card">
                      <div className="top"><DocLink id={d.id} onOpen={onOpen} className="tnum">{d.numero}</DocLink>{d.evento_tipo && <span className="evt">{relName(d.evento_tipo)}</span>}<StatusChip k={d.estado.k} />{d === last && d.estado.k !== 'sinefecto' && <span className="cur">Es el más reciente</span>}</div>
                      <p className="what">{d.evento_resumen || d.asunto}</p>
                      {changes}
                      {(acts.length > 0 || d.estado.by.length > 0) && <div className="links">
                        {acts.map((r, i) => <span key={i}>{VERBO[relName(r.rel)] || 'Actúa sobre'} <DocLink id={r.to[0]} onOpen={onOpen} className="linkish">{byId.get(r.to[0])?.numero}</DocLink></span>)}
                        {d.estado.by.length > 0 && <span>{d.estado.t === 'Derogada' ? 'Quedó sin efecto por' : d.estado.t === 'Modificada' ? 'Fue modificada por' : 'Complementada por'} {d.estado.by.map((e, i) => <React.Fragment key={i}>{i > 0 && ', '}<DocLink id={e.from} onOpen={onOpen} className="linkish">{byId.get(e.from)?.numero}</DocLink></React.Fragment>)}</span>}
                      </div>}
                    </div>
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        </>}
      </div>
    </div>
  );
}
