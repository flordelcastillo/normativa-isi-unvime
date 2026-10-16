import React, { useMemo, useState } from 'react';
import { api } from './api.js';
import { EVENTOS, RELACIONES } from './lib.js';
import { Icon } from './ui.jsx';

const SIGLAS = { 'Rectoral|Resolución': 'RR', 'Rectoral|Ordenanza': 'OR', 'Consejo Superior|Resolución': 'RCS', 'Consejo Superior|Ordenanza': 'OCS', 'Consejo Directivo|Resolución': 'RCEICA', 'Consejo Directivo|Ordenanza': 'OCEICA' };
const sigla = (o, t) => SIGLAS[`${o}|${t}`] || (t === 'Ordenanza' ? 'ORD' : 'RES');
const EVT = { crea: 'Crea', conforma: 'Conforma', designa: 'Designa', acepta_renuncia: 'Acepta una renuncia', modifica: 'Modifica', rectifica: 'Rectifica', deroga: 'Deroga', deja_sin_efecto: 'Deja sin efecto', aprueba: 'Aprueba', reglamenta: 'Reglamenta', prorroga: 'Prorroga', convoca: 'Convoca', otro: 'Otro' };
const blank = { numero: '', fecha: '', organo: 'Rectoral', tipo: 'Resolución', anexo: 'Anexo 7', categoria: '', relevancia: 'alta', actividad: '', lineas: [], evento_tipo: '', evento_resumen: '', asunto: '', resumen: '', miembros: '', vigencia: '', motivo: '', refs: [] };
const fromDoc = (d, byId) => ({ ...blank, ...d, actividad: (d.actividad || []).join('; '), miembros: (d.miembros || []).join('\n'), refs: (d.refs || []).map(r => ({ rel: r.rel, texto: r.to?.length ? byId.get(r.to[0])?.numero || r.cita : r.cita, dice: r.dice || '', to: r.to || [] })) });

export default function DocForm({ meta, docs, byId, initial, onClose, onSaved, notify }) {
  const editing = !!initial;
  const [f, setF] = useState(() => (editing ? fromDoc(initial, byId) : blank));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false); const [ocrBusy, setOcrBusy] = useState(false);
  const [err, setErr] = useState(''); const [fe, setFe] = useState({});
  const byNumero = useMemo(() => { const m = new Map(); docs.forEach(d => { const k = d.numero.trim().toLowerCase(); m.set(k, [...(m.get(k) || []), d.id]); }); return m; }, [docs]);
  const set = p => { setF(x => ({ ...x, ...p })); setFe({}); };
  const cats = meta.categorias[f.anexo] || [];
  const descartar = f.relevancia === 'nula';

  const readPdf = async () => {
    if (!file) return;
    setOcrBusy(true); setErr('');
    try {
      const r = await api.ocr(file); const s = r.sugerencias || {};
      const organo = s.organo || f.organo, tipo = s.tipo || f.tipo;
      set({ organo, tipo, fecha: s.fecha || f.fecha, numero: s.numero_sugerido ? `${sigla(organo, tipo)} Nº ${s.numero_sugerido}` : f.numero });
      notify('Completamos lo que pudimos leer del PDF. Revisá los datos antes de guardar.');
    } catch (e) { setErr(`No pudimos leer el PDF: ${e.message}`); } finally { setOcrBusy(false); }
  };

  const submit = async e => {
    e.preventDefault(); setErr('');
    const errs = {};
    if (!editing && !file) errs.file = 'Elegí el archivo PDF de la resolución.';
    if (!f.numero.trim()) errs.numero = 'Escribí el número, por ejemplo “RR Nº 30-2018”.';
    if (f.fecha.trim() && !/^\d{2}\/\d{2}\/\d{4}$/.test(f.fecha.trim())) errs.fecha = 'Usá el formato dd/mm/aaaa, por ejemplo 21/02/2018.';
    if (!descartar && f.anexo === 'Anexo 8' && !f.actividad.trim()) errs.actividad = 'El Anexo 8 necesita el nombre de la actividad curricular.';
    if (Object.keys(errs).length) { setFe(errs); setErr(Object.values(errs)[0]); document.querySelector('[aria-invalid="true"]')?.focus(); return; }
    const body = {
      numero: f.numero.trim(), fecha: f.fecha.trim(), organo: f.organo, tipo: f.tipo, anexo: descartar ? 'Descartar' : f.anexo, categoria: f.categoria.trim(), relevancia: f.relevancia,
      actividad: f.actividad.split(/[;\n]/).map(s => s.trim()).filter(Boolean), lineas: f.lineas, evento_tipo: f.evento_tipo, evento_resumen: f.evento_resumen.trim(),
      asunto: f.asunto.trim(), resumen: f.resumen.trim(), miembros: f.miembros.split('\n').map(s => s.trim()).filter(Boolean), vigencia: f.vigencia.trim(), motivo: f.motivo.trim(),
      archivo: editing ? initial.archivo : (file?.name || ''),
      refs: f.refs.filter(r => r.texto.trim()).map(r => { const ids = byNumero.get(r.texto.trim().toLowerCase()) || []; return { cita: r.texto.trim(), rel: r.rel, dice: r.dice.trim(), to: ids.filter(id => id !== initial?.id) }; }),
    };
    setBusy(true);
    try { const d = editing ? await api.update(initial.id, body) : await api.create(body, file); onSaved(d); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const inv = k => ({ 'aria-invalid': !!fe[k], 'aria-describedby': fe[k] ? `err-${k}` : undefined });
  const Err = ({ k }) => (fe[k] ? <span id={`err-${k}`} className="hint" style={{ color: 'var(--bad)' }}>{fe[k]}</span> : null);

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="form-t">
        <h2 id="form-t">{editing ? `Editar ${initial.numero}` : 'Subir un documento'}</h2>
        <p className="lead">{editing ? 'Cambiá la clasificación o los datos. El PDF no se modifica.' : 'Elegí el PDF y completá los datos. Lo que subas aparece enseguida para todos.'}</p>

        {!editing && <>
          <h3 className="fsec">Archivo</h3>
          <div className="fld"><label htmlFor="f-file">PDF de la resolución</label>
            <div className="inline"><input id="f-file" type="file" accept="application/pdf" onChange={e => { setFile(e.target.files[0] || null); setFe({}); }} {...inv('file')} />
              <button type="button" className="btn sm" disabled={!file || ocrBusy} onClick={readPdf}>{ocrBusy ? 'Leyendo el PDF…' : 'Completar datos desde el PDF'}</button></div>
            <span className="hint">Si es un escaneo, la lectura puede tardar unos segundos. Siempre revisá lo que complete.</span><Err k="file" /></div>
        </>}

        <h3 className="fsec">Datos del documento</h3>
        <div className="cols">
          <label className="fld">Número<input value={f.numero} onChange={e => set({ numero: e.target.value })} placeholder="RR Nº 30-2018" {...inv('numero')} /><Err k="numero" /></label>
          <label className="fld">Fecha<input value={f.fecha} onChange={e => set({ fecha: e.target.value })} placeholder="21/02/2018" inputMode="numeric" {...inv('fecha')} /><Err k="fecha" /></label>
          <label className="fld">Órgano emisor<select value={f.organo} onChange={e => set({ organo: e.target.value })}>{meta.organos.map(o => <option key={o}>{o}</option>)}</select></label>
          <label className="fld">Tipo de documento<select value={f.tipo} onChange={e => set({ tipo: e.target.value })}>{meta.tipos.map(o => <option key={o}>{o}</option>)}</select></label>
        </div>
        <label className="fld">Asunto <span className="hint">Una línea que diga de qué se trata.</span><input value={f.asunto} onChange={e => set({ asunto: e.target.value })} placeholder="Conformación de la Comisión de Carrera de ISI" /></label>
        <label className="fld">De qué trata <span className="hint">Dos o tres oraciones: qué dispone y a quién afecta.</span><textarea rows={4} value={f.resumen} onChange={e => set({ resumen: e.target.value })} /></label>
        <label className="fld">Personas mencionadas <span className="hint">Una por línea, con su rol. Sirve para ver quién entra y sale en las líneas de tiempo.</span><textarea rows={3} value={f.miembros} onChange={e => set({ miembros: e.target.value })} placeholder={'Francisco Bavera - titular\nAlberto Ledesma - titular'} /></label>
        <label className="fld">Vigencia según el texto <span className="hint">Opcional. Por ejemplo: “Deja sin efecto la RR 744/2017”.</span><input value={f.vigencia} onChange={e => set({ vigencia: e.target.value })} /></label>

        <h3 className="fsec">Clasificación</h3>
        <div className="cols">
          <label className="fld wide">¿Corresponde a Ingeniería en Sistemas de Información?
            <select value={f.relevancia} onChange={e => set({ relevancia: e.target.value })}><option value="alta">Sí, directa o claramente</option><option value="media">Tiene relación indirecta</option><option value="nula">No corresponde (se descarta)</option></select></label>
          {!descartar && <>
            <label className="fld">Anexo<select value={f.anexo} onChange={e => set({ anexo: e.target.value })}>{meta.anexos.filter(a => a !== 'Descartar').map(o => <option key={o}>{o}</option>)}</select></label>
            <label className="fld">Categoría<input list="cats" value={f.categoria} onChange={e => set({ categoria: e.target.value })} placeholder="Elegí una o escribí otra" /><datalist id="cats">{cats.map(c => <option key={c} value={c} />)}</datalist></label>
          </>}
        </div>
        {!descartar && f.anexo === 'Anexo 8' && <label className="fld">Actividad curricular <span className="hint">Obligatoria en el Anexo 8. Si son varias, separalas con punto y coma.</span><input value={f.actividad} onChange={e => set({ actividad: e.target.value })} placeholder="Práctica Profesional Supervisada" {...inv('actividad')} /><Err k="actividad" /></label>}

        <h3 className="fsec">Líneas de tiempo</h3>
        <div className="fld"><span className="hint">Marcá las instancias a las que pertenece. Aparecerá como un paso más en su recorrido.</span>
          <div className="checks">{meta.lines.map(l => <label key={l.key}><input type="checkbox" checked={f.lineas.includes(l.key)} onChange={() => set({ lineas: f.lineas.includes(l.key) ? f.lineas.filter(x => x !== l.key) : [...f.lineas, l.key] })} />{l.nombre}</label>)}</div></div>
        {f.lineas.length > 0 && <div className="cols">
          <label className="fld">¿Qué hace esta resolución?<select value={f.evento_tipo} onChange={e => set({ evento_tipo: e.target.value })}>{EVENTOS.map(x => <option key={x} value={x}>{x ? EVT[x] : 'Elegí una opción'}</option>)}</select></label>
          <label className="fld wide">Texto que se muestra en la línea de tiempo <span className="hint">Hasta 140 caracteres.</span><input maxLength={140} value={f.evento_resumen} onChange={e => set({ evento_resumen: e.target.value })} placeholder="Conforma la Comisión: Bavera (coord.), Novillo, Pizarro…" /></label>
        </div>}

        <h3 className="fsec">Relación con otras normas</h3>
        <p className="hint">Si esta resolución modifica, deroga o rectifica a otra, indicá cuál. Si el número ya está en el visor, la otra norma se marca sola como modificada o derogada.</p>
        <datalist id="nums">{docs.map(d => <option key={d.id} value={d.numero} />)}</datalist>
        <div style={{ marginTop: 10 }}>
          {f.refs.map((r, i) => (
            <div key={i} className="refrow">
              <select aria-label="Qué hace" value={r.rel} onChange={e => set({ refs: f.refs.map((x, k) => k === i ? { ...x, rel: e.target.value } : x) })}>{RELACIONES.map(x => <option key={x}>{x}</option>)}</select>
              <input aria-label="Número de la otra norma" list="nums" placeholder="Número de la otra norma" value={r.texto} onChange={e => set({ refs: f.refs.map((x, k) => k === i ? { ...x, texto: e.target.value } : x) })} />
              <input aria-label="Qué cambia" placeholder="Qué cambia (opcional)" value={r.dice} onChange={e => set({ refs: f.refs.map((x, k) => k === i ? { ...x, dice: e.target.value } : x) })} />
              <button type="button" className="iconbtn" aria-label="Quitar esta relación" onClick={() => set({ refs: f.refs.filter((_, k) => k !== i) })}><Icon n="close" /></button>
            </div>
          ))}
          <button type="button" className="btn sm" onClick={() => set({ refs: [...f.refs, { rel: 'modifica', texto: '', dice: '', to: [] }] })}><Icon n="plus" />Agregar relación</button>
        </div>

        {err && <div className="alert" role="alert">{err}</div>}
        <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Subir documento'}</button></div>
      </form>
    </div>
  );
}
