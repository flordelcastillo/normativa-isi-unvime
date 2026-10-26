import { useCallback, useEffect, useState } from 'react';

const CLAVE = 'normativa-isi:seleccion:v1';

function leer() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (s && Array.isArray(s.items)) return s;
  } catch { /* sin almacenamiento: se trabaja en memoria */ }
  return { items: [], titulo: '', autores: '' };
}

/* Selección de documentos y convenios para el informe. Se guarda en el navegador de cada docente. */
export function useSeleccion() {
  const [sel, setSel] = useState(leer);
  useEffect(() => { try { localStorage.setItem(CLAVE, JSON.stringify(sel)); } catch { /* ignorar */ } }, [sel]);

  const tiene = useCallback((tipo, id) => sel.items.some(i => i.tipo === tipo && i.id === id), [sel.items]);
  const alternar = useCallback((tipo, id) => setSel(s => (s.items.some(i => i.tipo === tipo && i.id === id)
    ? { ...s, items: s.items.filter(i => !(i.tipo === tipo && i.id === id)) }
    : { ...s, items: [...s.items, { tipo, id, nota: '' }] })), []);
  const agregar = useCallback((tipo, ids) => setSel(s => {
    const ya = new Set(s.items.filter(i => i.tipo === tipo).map(i => i.id));
    return { ...s, items: [...s.items, ...ids.filter(id => !ya.has(id)).map(id => ({ tipo, id, nota: '' }))] };
  }), []);
  const quitar = useCallback((tipo, ids) => setSel(s => ({ ...s, items: s.items.filter(i => !(i.tipo === tipo && ids.includes(i.id))) })), []);
  const nota = useCallback((tipo, id, texto) => setSel(s => ({ ...s, items: s.items.map(i => (i.tipo === tipo && i.id === id ? { ...i, nota: texto } : i)) })), []);
  const campo = useCallback((k, v) => setSel(s => ({ ...s, [k]: v })), []);
  const vaciar = useCallback(() => setSel(s => ({ ...s, items: [] })), []);
  const reemplazar = useCallback(nueva => setSel({ items: nueva.items || [], titulo: nueva.titulo || '', autores: nueva.autores || '' }), []);
  return { sel, tiene, alternar, agregar, quitar, nota, campo, vaciar, reemplazar };
}
