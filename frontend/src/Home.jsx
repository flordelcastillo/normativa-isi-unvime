import React from 'react';
import { DocLink, Icon, AXVAR } from './ui.jsx';
import { ANEXO_USO, NOMBRE_ANEXO, cmpDate, passes } from './lib.js';

const SUGERENCIAS = ['comisión de carrera', 'plan de estudios', 'práctica profesional', 'equivalencias', 'coordinador', 'RR 51-2018'];
const ANEXOS = ['Anexo 7', 'Anexo 8', 'Anexo 9', 'Anexo 10', 'Informe de seguimiento', 'Otros'];
const BLOQUES = [['comision_carrera_ISI', 'Comisión de Carrera', true], ['coordinacion_ISI', 'Coordinación de la carrera'], ['plan_estudios_ISI', 'Plan de estudios'], ['autoevaluacion_acreditacion', 'Autoevaluación y acreditación']];

function Chain({ items, onOpen, animate }) {
  return (
    <div className={`chain ${animate ? 'animate' : ''}`}>
      {items.map((d, i) => (
        <React.Fragment key={d.id}>
          {i > 0 && <span className="sep" style={{ '--i': i * 2 - 1 }} aria-hidden="true"><Icon n="arrow" /></span>}
          <DocLink id={d.id} onOpen={onOpen} style={{ '--i': i * 2 }} className={`chip-num ${d.estado.k === 'sinefecto' ? 'gone' : ''} ${i === items.length - 1 && d.estado.k !== 'sinefecto' ? 'now' : ''}`} title={`${d.numero}: ${d.evento_resumen || d.asunto}`}>
            <span className="n">{d.numero}</span><span className="d">{d.fecha || 's/f'}</span>
          </DocLink>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Home({ docs, F, go, onOpen }) {
  const chainOf = key => docs.filter(d => (d.lineas || []).includes(key) && d.relevancia === 'alta').sort(cmpDate);
  const direct = docs.filter(d => d.relevancia === 'alta');
  return (
    <div className="page">
      <section className="hero">
        <h1>Normativa de Ingeniería en Sistemas de Información</h1>
        <p className="lead">{direct.length} resoluciones y ordenanzas del digesto de la UNViMe, clasificadas por anexo de acreditación. Buscá una norma o seguí cómo fue cambiando cada instancia de la carrera.</p>
        <form className="bigsearch" role="search" onSubmit={e => { e.preventDefault(); go('documentos', {}, e.currentTarget.q.value); }}>
          <Icon n="search" />
          <label className="sr" htmlFor="home-q">Buscar en toda la normativa</label>
          <input id="home-q" name="q" className="field" type="search" placeholder="Escribí un número, un tema o un nombre…" defaultValue={F.q} autoComplete="off" />
        </form>
        <p className="try">Por ejemplo: {SUGERENCIAS.map((s, i) => <React.Fragment key={s}>{i > 0 && ', '}<button className="linkish" onClick={() => go('documentos', {}, s)}>{s}</button></React.Fragment>)}.</p>
      </section>

      <section className="sec" aria-labelledby="h-anexos">
        <h2 id="h-anexos">Índice por anexo</h2>
        <p className="sub">Cada anexo reúne los documentos que pide la acreditación; dentro de él, se agrupan por órgano emisor y tipo.</p>
        <ol className="indice">
          {ANEXOS.map(a => {
            const list = docs.filter(d => d.anexo === a && passes(d, { ...F, q: '' }, { ax: 1, cat: 1, org: 1, tip: 1, est: 1 }));
            const orgs = [...new Set(list.map(d => d.organo))].map(o => [o, list.filter(d => d.organo === o).length]).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([o, n]) => `${o} ${n}`);
            const inner = (
              <>
                <span className="tab" aria-hidden="true" />
                <span>
                  <span className="top"><span className="ititle">{NOMBRE_ANEXO[a]}</span><span className="ileader" aria-hidden="true" /><span className="icount">{list.length}</span></span>
                  <p>{ANEXO_USO[a]}</p>
                  <span className="orgs">{list.length ? orgs.join(', ') : 'El digesto no tiene documentos para este anexo; hay que buscarlos fuera del digesto.'}</span>
                </span>
              </>
            );
            return (
              <li key={a}>
                {list.length
                  ? <a href={`#t=documentos&a=${encodeURIComponent(a)}`} className="ientry" style={{ '--ax': AXVAR[a] }} onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); go('documentos', { ax: [a] }); }}>{inner}</a>
                  : <div className="ientry zero" style={{ '--ax': AXVAR[a] }}>{inner}</div>}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="sec" aria-labelledby="h-chain">
        <h2 id="h-chain">Cómo cambiaron las instancias de la carrera</h2>
        <p className="sub">Cada recuadro es una resolución, en orden cronológico. La tachada quedó sin efecto; la marcada en verde es la más reciente.</p>
        {BLOQUES.map(([k, titulo, big]) => { const it = chainOf(k); if (!it.length) return null; const ys = it.map(d => d.anio).filter(Boolean); return (
          <div className="cblock" key={k}>
            <h3>{titulo}<span>{it.length} resoluciones{ys.length > 1 ? ` entre ${Math.min(...ys)} y ${Math.max(...ys)}` : ''}</span></h3>
            <Chain items={it} onOpen={onOpen} animate={big} />
            <button className="linkish small" onClick={() => go('lineas', { line: k })}>Ver la línea de tiempo{big ? ' con los integrantes de cada etapa' : ''}</button>
          </div>); })}
      </section>
    </div>
  );
}
