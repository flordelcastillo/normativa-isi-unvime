import React, { useEffect, useRef } from 'react';
import { Icon } from './ui.jsx';

export default function HelpDialog({ onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const item = (_icon, t, body) => <div><h3>{t}</h3><p className="muted">{body}</p></div>;
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="help-t">
        <h2 id="help-t" tabIndex={-1} ref={ref}>Cómo usar este visor</h2>
        <p className="lead">Reúne las resoluciones y ordenanzas de la UNViMe que corresponden a Ingeniería en Sistemas de Información.</p>
        <div className="helpgrid">
          {item('search', 'Buscar una norma', 'Escribí un número (“51-2018”), un tema (“práctica profesional”) o un nombre en la barra de arriba. Se busca en el resumen y en las personas mencionadas.')}
          {item('file', 'Ver por anexo', 'En Documentos, las pestañas separan los anexos de la acreditación. Dentro de cada uno, la lista se agrupa por órgano emisor y tipo de documento.')}
          {item('arrow', 'Seguir cómo cambió algo', 'En Líneas de tiempo ves, en orden, todas las resoluciones de una instancia (por ejemplo, la Comisión de Carrera) y quiénes entran y salen en cada etapa.')}
          {item('check', 'Qué significa cada estado', '“Sin cambios posteriores” quiere decir que ningún documento cargado en el visor la modifica; no garantiza que siga vigente. “Modificada” y “Derogada” indican qué norma posterior actuó sobre ella.')}
          {item('download', 'Leer y llevarse la resolución', 'Al elegir un documento se abre su resumen; la pestaña “Resolución completa” muestra el PDF. Con “Exportar lista” bajás lo que estás viendo en una planilla.')}
        </div>
        <p className="muted small" style={{ marginTop: 18 }}>Atajos: <kbd>/</kbd> buscar · <kbd>j</kbd> <kbd>k</kbd> documento siguiente o anterior · <kbd>Esc</kbd> cerrar el detalle</p>
        <div className="actions"><button className="btn primary" onClick={onClose}>Entendido</button></div>
      </div>
    </div>
  );
}
