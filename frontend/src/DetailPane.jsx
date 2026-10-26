import React, { useState } from 'react';
import { DocLink, Icon, StatusChip, AnexoMark } from './ui.jsx';
import { fmtFecha, relName } from './lib.js';

const VERBO = { modifica: 'la modifica', rectifica: 'la rectifica', deroga: 'la deroga', 'deja sin efecto': 'la deja sin efecto', reemplaza: 'la reemplaza', complementa: 'la complementa' };
const VERBO_CLASE = { deroga: 'bad', 'deja sin efecto': 'bad', reemplaza: 'bad', modifica: 'warn', rectifica: 'warn', complementa: 'info', reglamenta: 'info', aprueba: 'ok', ratifica: 'ok' };

/* Parte el resumen en párrafos cortos de dos oraciones para que se lea sin esfuerzo */
function paras(text) {
  const s = (text || '').split(/(?<=[.!?])(?<!\b(?:Mag|Ing|Dr|Dra|Lic|Mg|Esp|Prof|Sr|Sra|Srta|Art|Arts|Res|Exp|Inc|Ord|Nro|Cdor|Arq|Abg|Cr|Ley|Dec|Resol)\.)\s+(?=[A-ZÁÉÍÓÚÑ(“"¿¡0-9])/).filter(Boolean);
  const out = []; for (let i = 0; i < s.length; i += 2) out.push(s.slice(i, i + 2).join(' '));
  return out;
}

export default function DetailPane({ d, byId, lines, ui, setUi, onClose, onOpen, onLine, admin, onEdit, onDelete, notify, seleccion }) {
  const enInforme = seleccion.tiene('norma', d.id);
  const [copied, setCopied] = useState(false);
  const num = id => byId.get(id)?.numero || '(sin número)';
  const outs = (d.refs || []).filter(r => r.to?.length && relName(r.rel) !== 'cita');
  const cites = (d.refs || []).filter(r => !(r.to?.length && relName(r.rel) !== 'cita'));
  const by = d.estado.by;
  const copy = async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); notify('Enlace copiado.'); setTimeout(() => setCopied(false), 2000); } catch { notify('No se pudo copiar el enlace.'); } };
  const L = id => <DocLink id={id} onOpen={onOpen} className="linkish">{num(id)}</DocLink>;
  const ps = paras(d.resumen);
  const mi = (d.miembros || []).filter(Boolean);

  return (
    <div className="detail" role="region" aria-label={`Detalle de ${d.numero}`}>
      <header className="dh">
        <div className="dh-top">
          <span className="kicker" ><AnexoMark a={d.anexo} />{d.anexo === 'Descartar' ? 'Descartado' : d.anexo}{d.categoria ? <><span>›</span><span>{d.categoria}</span></> : null}</span>
          <span className="dh-actions">
            <button className="iconbtn" onClick={copy} aria-label="Copiar enlace a este documento" title="Copiar enlace"><Icon n={copied ? 'check' : 'link'} /></button>
            <button className="iconbtn" onClick={onClose} aria-label="Cerrar el detalle" title="Cerrar (Esc)"><Icon n="close" /></button>
          </span>
        </div>
        <h2 className="num">{d.numero}</h2>
        <p className="asunto">{d.asunto}</p>
        <div className="dh-meta"><StatusChip k={d.estado.k} /><span className="when-t">{fmtFecha(d)}</span></div>
        <div className="dtabs" role="tablist">
          <button role="tab" aria-selected={ui.selTab === 'resumen'} onClick={() => setUi({ selTab: 'resumen' })}>Resumen</button>
          <button role="tab" aria-selected={ui.selTab === 'pdf'} onClick={() => setUi({ selTab: 'pdf' })}>Resolución completa (PDF)</button>
        </div>
      </header>

      {ui.selTab === 'pdf' ? (
        d.externo ? (
          <div className="dbody"><section className="dsec"><h3>Este PDF no está alojado acá</h3>
            <p className="prose"><span>Para no publicar de más, el visor no guarda copia de este tipo de documento (designaciones, concursos y trámites con datos de personas). Está en el digesto oficial de la UNViMe y se descarga desde ahí.</span></p>
            <p style={{ marginTop: 16 }}><a className="btn primary" href={d.pdf} target="_blank" rel="noopener noreferrer"><Icon n="external" />Descargar del digesto oficial</a></p></section></div>
        ) : (
        <div className="dbody pdf">
          <object data={`${d.pdf}#view=FitH`} type="application/pdf" title={`PDF de ${d.numero}`}>
            <div className="noresult-pdf"><p>Tu navegador no puede mostrar el PDF dentro de la página.</p><p style={{ marginTop: 14 }}><a className="btn primary" href={d.pdf} target="_blank" rel="noopener noreferrer"><Icon n="external" />Abrir el PDF en una pestaña</a></p></div>
          </object>
        </div>
        )
      ) : (
        <div className="dbody">
          <div className="dgrid">
            <div className="dmain">
              <section className={`say s-${d.estado.k}`} aria-label="Estado de la norma">
                <b>{d.estado.k === 'vigente' ? 'Sin cambios posteriores conocidos' : d.estado.k === 'sinefecto' ? 'Esta norma quedó sin efecto' : d.estado.k === 'modificada' ? 'Esta norma fue modificada' : 'Esta norma fue complementada'}</b>
                {d.estado.k === 'vigente'
                  ? <p>Ningún documento cargado en el visor la modifica o la deroga. Puede haber actos que no estén en el digesto.</p>
                  : <p>{by.map((e, i) => <React.Fragment key={i}>{i > 0 && '; '}{L(e.from)} {VERBO[relName(e.rel)] || 'la afecta'} ({byId.get(e.from)?.fecha || 's/f'})</React.Fragment>)}.</p>}
                {d.vigencia && <p className="why"><i>El propio texto dice:</i> {d.vigencia}</p>}
              </section>

              <section className="dsec"><h3>De qué trata</h3>
                <div className="prose">{ps.length ? ps.map((p, i) => <p key={i} className={i === 0 ? 'lead' : ''}>{p}</p>) : <p className="muted">Sin resumen cargado.</p>}</div></section>

              {d.actividad?.length > 0 && <section className="dsec"><h3>Actividad curricular</h3><p className="plist act">{d.actividad.join('; ')}</p></section>}

              {outs.length > 0 && <section className="dsec"><h3>Normas sobre las que actúa</h3>
                <ul className="rels">{outs.map((r, i) => (
                  <li key={i}><span className={`verb v-${VERBO_CLASE[relName(r.rel)] || 'info'}`}>{relName(r.rel)}</span>
                    <span>{r.to.map((t, k) => <React.Fragment key={t}>{k > 0 && ', '}{L(t)}</React.Fragment>)}{r.dice && <span className="why"> {r.dice}</span>}</span></li>))}</ul></section>}

              {mi.length > 0 && <section className="dsec"><h3>Personas mencionadas <span className="muted">({mi.length})</span></h3><p className="plist">{mi.join('; ')}</p></section>}

              {cites.length > 0 && <details className="more-d"><summary>Otras normas que cita ({cites.length})</summary><ul className="rels" style={{ marginTop: 10 }}>{cites.map((r, i) => <li key={i}><span className="verb v-info">{relName(r.rel)}</span><span>{r.to?.length ? r.to.map((t, k) => <React.Fragment key={t}>{k > 0 && ', '}{L(t)}</React.Fragment>) : <b>{r.cita}</b>}{r.dice && <span className="why"> {r.dice}</span>}</span></li>)}</ul></details>}

              <details className="more-d"><summary>Cómo se clasificó</summary>
                <p className="why" style={{ marginTop: 10 }}>{d.motivo || 'Sin comentarios.'}</p>
                {d.calidad && /regular|mala|ilegible|dudos|recort/i.test(d.calidad) && <p className="note"><b>Calidad de lectura:</b> {d.calidad}</p>}
              </details>
            </div>

            <aside className="dside" aria-label="Datos del documento">
              <div className="ficha">
                <button className={`btn ${enInforme ? '' : 'primary'}`} aria-pressed={enInforme} onClick={() => seleccion.alternar('norma', d.id)}><Icon n={enInforme ? 'check' : 'plus'} />{enInforme ? 'En el informe (quitar)' : 'Agregar al informe'}</button>
                <a className="btn" href={d.pdf} target="_blank" rel="noopener noreferrer"><Icon n="external" />{d.externo ? 'Descargar del digesto' : 'Abrir el PDF'}</a>
                {admin && <div className="adm-row"><button className="btn sm" onClick={() => onEdit(d)}><Icon n="edit" />Editar</button>{d.origen === 'subido' && <button className="btn sm danger" onClick={() => onDelete(d)}><Icon n="trash" />Eliminar</button>}</div>}
                <dl className="facts">
                  <div><dt>Fecha</dt><dd>{fmtFecha(d)}</dd></div>
                  <div><dt>Órgano emisor</dt><dd>{d.organo}</dd></div>
                  <div><dt>Tipo</dt><dd>{d.tipo}</dd></div>
                  <div className="x-wide"><dt>Anexo</dt><dd><AnexoMark a={d.anexo} />{d.anexo === 'Descartar' ? 'Descartado' : d.anexo}</dd></div>
                  {d.categoria && <div className="x-wide"><dt>Categoría</dt><dd>{d.categoria}</dd></div>}
                  <div className="x-wide"><dt>Archivo</dt><dd className="fname">{d.archivo}</dd></div>
                </dl>
                {d.lineas?.length > 0 && <div className="lines-in x-wide"><h4>Línea de tiempo</h4>{d.lineas.map(k => lines.find(l => l.key === k)).filter(Boolean).map(l => <button key={l.key} className="linkish" onClick={() => onLine(l.key)}>{l.nombre}</button>)}</div>}
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
