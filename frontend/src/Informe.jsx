import React, { useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import { Valor } from './Convenios.jsx';

const TITULO_BASE = 'Documentación para la acreditación de Ingeniería en Sistemas de Información';
const LIMITE_ADJUNTOS = 60;

export default function Informe({ seleccion, byId, convById, onOpen, go, notify }) {
  const { sel } = seleccion;
  const [trabajando, setTrabajando] = useState('');
  const [adjuntar, setAdjuntar] = useState(false);
  const [aviso, setAviso] = useState('');
  const archivo = useRef(null);

  const resueltos = sel.items.map(i => ({ ...i, d: i.tipo === 'convenio' ? convById.get(i.id) : byId.get(i.id) }));
  const validos = resueltos.filter(i => i.d);
  const perdidos = resueltos.length - validos.length;
  const convenios = validos.filter(i => i.tipo === 'convenio');
  const normas = validos.filter(i => i.tipo === 'norma');
  const adjuntables = validos.filter(i => !i.d.externo && i.d.pdf).length;
  const titulo = sel.titulo.trim() || TITULO_BASE;

  const generar = async () => {
    setAviso(''); setTrabajando('Preparando el informe...');
    try {
      const { generarInforme, descargar } = await import('./informe-pdf.js');
      const r = await generarInforme({ titulo, autores: sel.autores.trim(), items: validos, adjuntar, onProgreso: setTrabajando });
      descargar(r.bytes, `informe-isi-${new Date().toISOString().slice(0, 10)}.pdf`);
      const mb = (r.bytes.length / 1048576).toFixed(1);
      setAviso(`Listo: el informe tiene ${r.paginas} páginas (${mb} MB) y se descargó en tu equipo.${r.faltan.length ? ` No se pudieron adjuntar: ${r.faltan.join(', ')}.` : ''}`);
    } catch (e) {
      setAviso(`No se pudo generar el informe: ${e.message || 'error desconocido'}. Probá de nuevo sin adjuntar los PDF originales.`);
    } finally { setTrabajando(''); }
  };

  const guardar = () => {
    const data = { version: 1, titulo: sel.titulo, autores: sel.autores, items: sel.items };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = `seleccion-isi-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  const cargar = async e => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.items) || data.items.some(i => !['convenio', 'norma'].includes(i.tipo) || typeof i.id !== 'string')) throw new Error('formato');
      if (sel.items.length && !window.confirm('Esto reemplaza la selección actual por la del archivo. ¿Seguimos?')) return;
      seleccion.reemplazar(data); notify(`Se cargó la selección: ${data.items.length} elementos.`);
    } catch { notify('Ese archivo no es una selección guardada desde este visor.'); }
  };

  const fila = i => (
    <li key={i.tipo + i.id} className="sel-item">
      <div className="si-head">
        <div className="si-t">
          <button className="linkish si-num" onClick={() => onOpen(i.tipo, i.id)}>{i.d.numero}</button>
          <span className="si-name">{i.tipo === 'convenio' ? i.d.partes.map(p => p.nombre).join('; ') : i.d.asunto}</span>
          <small>{i.tipo === 'convenio' ? `${i.d.tipo} · firmado ${i.d.firma || 's/f'} · ${i.d.estado}` : `${i.d.anexo} · ${i.d.organo} · ${i.d.fecha || 's/f'}`}</small>
        </div>
        {i.tipo === 'convenio' && <Valor k={i.d.relevancia} />}
        <button className="iconbtn" onClick={() => seleccion.quitar(i.tipo, [i.id])} aria-label={`Quitar del informe: ${i.d.numero}`} title="Quitar del informe"><Icon n="trash" /></button>
      </div>
      <label className="si-nota"><span>Nota para el informe (opcional)</span>
        <textarea rows={2} value={i.nota} onChange={e => seleccion.nota(i.tipo, i.id, e.target.value)} placeholder="Por ejemplo: sirve como evidencia del convenio de PPS con empresas locales." /></label>
    </li>
  );

  if (!sel.items.length) {
    return (
      <div className="page">
        <h1 className="ph1">Informe para la acreditación</h1>
        <div className="empty left">
          <h3>Todavía no elegiste nada</h3>
          <p>Marcá con la casilla los convenios y las normas que quieras incluir. Después volvé acá para ordenar la selección, escribir notas y descargar el informe en PDF.</p>
          <div className="acts">
            <button className="btn primary" onClick={() => go('convenios')}>Elegir convenios</button>
            <button className="btn" onClick={() => go('documentos')}>Elegir normas</button>
            <button className="btn" onClick={() => archivo.current?.click()}><Icon n="download" />Cargar una selección guardada</button>
          </div>
          <input ref={archivo} type="file" accept="application/json,.json" className="sr" onChange={cargar} tabIndex={-1} aria-label="Cargar una selección guardada" />
        </div>
      </div>
    );
  }

  return (
    <div className="page informe">
      <h1 className="ph1">Informe para la acreditación</h1>
      <p className="lead-p">Revisá lo que elegiste, agregá notas si hace falta y descargá el informe en PDF. La selección queda guardada en este navegador; para compartirla con otros docentes, guardala en un archivo.</p>

      <section className="inf-box" aria-labelledby="inf-datos">
        <h2 id="inf-datos">Datos del informe</h2>
        <div className="inf-grid">
          <label className="fld">Título<input className="field" value={sel.titulo} onChange={e => seleccion.campo('titulo', e.target.value)} placeholder={TITULO_BASE} /></label>
          <label className="fld">Selección realizada por<input className="field" value={sel.autores} onChange={e => seleccion.campo('autores', e.target.value)} placeholder="Nombres de los docentes (opcional)" /></label>
        </div>
        <label className="chk-line"><input type="checkbox" checked={adjuntar} onChange={e => setAdjuntar(e.target.checked)} disabled={!adjuntables} />
          <span><b>Adjuntar al final los PDF originales</b><small>{adjuntables ? `${adjuntables} de los elegidos están alojados en este sitio y se agregan completos.${adjuntables > LIMITE_ADJUNTOS ? ' Son muchos: el archivo puede ser pesado y tardar en generarse.' : ''} Los demás se citan con el enlace al digesto.` : 'Ninguno de los elegidos tiene PDF alojado en este sitio.'}</small></span></label>
        <div className="inf-acts">
          <button className="btn primary" onClick={generar} disabled={!!trabajando || !validos.length}><Icon n="report" />{trabajando || `Generar informe PDF (${validos.length})`}</button>
          <button className="btn" onClick={guardar}><Icon n="download" />Guardar selección</button>
          <button className="btn" onClick={() => archivo.current?.click()}>Cargar selección</button>
          <button className="btn quiet" onClick={() => { if (window.confirm(`¿Vaciar la selección de ${sel.items.length} elementos?`)) seleccion.vaciar(); }}>Vaciar</button>
          <input ref={archivo} type="file" accept="application/json,.json" className="sr" onChange={cargar} tabIndex={-1} aria-label="Cargar una selección guardada" />
        </div>
        <p className="inf-status" role="status" aria-live="polite">{aviso}</p>
        {perdidos > 0 && <p className="note">{perdidos} {perdidos === 1 ? 'elemento de la selección ya no existe' : 'elementos de la selección ya no existen'} en el visor y {perdidos === 1 ? 'no se incluye' : 'no se incluyen'}.</p>}
      </section>

      {convenios.length > 0 && <section className="inf-sec"><h2>Convenios <span className="muted">({convenios.length})</span></h2><ul className="sel-list">{convenios.map(fila)}</ul></section>}
      {normas.length > 0 && <section className="inf-sec"><h2>Normativa del digesto <span className="muted">({normas.length})</span></h2><ul className="sel-list">{normas.map(fila)}</ul></section>}
    </div>
  );
}
