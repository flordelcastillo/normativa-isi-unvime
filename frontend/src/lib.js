export const AX = ['Anexo 7', 'Anexo 8', 'Anexo 9', 'Anexo 10', 'Informe de seguimiento', 'Otros', 'Descartar'];
export const AXC = { 'Anexo 7': 'var(--a7)', 'Anexo 8': 'var(--a8)', 'Anexo 9': 'var(--a9)', 'Anexo 10': 'var(--a10)', 'Informe de seguimiento': 'var(--seg)', 'Otros': 'var(--otros)', 'Descartar': 'var(--desc)' };
export const AXN = {
  'Anexo 7': 'Anexo 7 · Normativa relacionada con la carrera',
  'Anexo 8': 'Anexo 8 · Programas, TP, informes de PPS, trabajos finales, exámenes',
  'Anexo 9': 'Anexo 9 · Respaldo de planes y estrategias de mejora',
  'Anexo 10': 'Anexo 10 · Análisis de resultados e informes de seguimiento',
  'Informe de seguimiento': 'Informe de seguimiento de compromisos',
  'Otros': 'Otros',
  'Descartar': 'Descartados (sin relación con ISI)',
};
export const ORG = ['Rectoral', 'Consejo Superior', 'Consejo Académico', 'Consejo Directivo', 'Consejo Departamental', 'Decanal', 'Otra'];
export const TIP = ['Ordenanza', 'Resolución', 'Acta', 'Disposición', 'Informe de autoevaluación', 'Plan de mejora', 'Otra'];
export const TIPN = { Ordenanza: 'Ordenanzas', Resolución: 'Resoluciones', Acta: 'Actas', Disposición: 'Disposiciones', 'Informe de autoevaluación': 'Informes de autoevaluación', 'Plan de mejora': 'Planes de mejora', Otra: 'Otros' };
export const REL = { alta: 'Relación directa / clara', media: 'Relación indirecta', nula: 'Sin relación (descartados)' };
export const SUPER = new Set(['deroga', 'deja sin efecto', 'reemplaza']);
export const MODIF = new Set(['modifica', 'rectifica']);
export const RELACIONES = ['modifica', 'rectifica', 'deroga', 'deja sin efecto', 'reemplaza', 'complementa', 'reglamenta', 'aprueba', 'ratifica', 'cita'];
export const EVENTOS = ['', 'crea', 'conforma', 'designa', 'acepta_renuncia', 'modifica', 'rectifica', 'deroga', 'deja_sin_efecto', 'aprueba', 'reglamenta', 'prorroga', 'convoca', 'otro'];

export const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const relName = r => (r || '').replace(/_/g, ' ');
export const fmtFecha = d => d.fecha || 's/f';
export const cmpDate = (a, b) => (a.iso || '9').localeCompare(b.iso || '9') || a.numero.localeCompare(b.numero);

export function preprocess(raw) {
  return raw.map(d => {
    const inn = d.inn || [];
    const s = inn.filter(e => SUPER.has(relName(e.rel))), m = inn.filter(e => MODIF.has(relName(e.rel))), c = inn.filter(e => relName(e.rel) === 'complementa');
    let estado = { k: 'vigente', t: 'Sin cambios posteriores', by: [] };
    if (s.length) estado = { k: 'sinefecto', t: 'Derogada', by: s };
    else if (m.length) estado = { k: 'modificada', t: 'Modificada', by: m };
    else if (c.length) estado = { k: 'complementada', t: 'Complementada', by: c };
    const hay = norm([d.numero, d.asunto, d.resumen, (d.miembros || []).join(' '), d.categoria, (d.actividad || []).join(' '), d.archivo, d.evento_resumen].join(' '));
    return { ...d, estado, hay };
  });
}

export const MODES = { directo: ['alta'], indirecto: ['alta', 'media'], todo: ['alta', 'media', 'nula'] };
export const MODE_LABEL = { directo: 'Solo lo que corresponde a ISI', indirecto: 'Incluir lo indirecto', todo: 'Todo, también lo descartado' };
export const ESTADOS = { vigente: 'Sin cambios posteriores', modificada: 'Modificada', sinefecto: 'Derogada', complementada: 'Complementada' };
export const ESTADO_AYUDA = {
  vigente: 'Ningún documento cargado en el visor la modifica ni la deroga. No garantiza que siga vigente: puede haber actos que no estén en el digesto.',
  modificada: 'Otro documento la modifica o la rectifica.',
  sinefecto: 'Otro documento la deroga, la reemplaza o la deja sin efecto.',
  complementada: 'Otro documento la complementa.',
};
export const emptyFilters = () => ({ q: '', mode: 'directo', ax: [], cat: [], org: [], tip: [], est: [], y0: '', y1: '' });

export function passes(d, F, skip = {}) {
  if (!skip.rel && !MODES[F.mode].includes(d.relevancia)) return false;
  if (!skip.ax && F.ax.length && !F.ax.includes(d.anexo)) return false;
  if (!skip.cat && F.cat.length && !F.cat.includes(d.anexo + '|' + d.categoria)) return false;
  if (!skip.org && F.org.length && !F.org.includes(d.organo)) return false;
  if (!skip.tip && F.tip.length && !F.tip.includes(d.tipo)) return false;
  if (F.y0 && (!d.anio || d.anio < +F.y0)) return false;
  if (F.y1 && (!d.anio || d.anio > +F.y1)) return false;
  if (!skip.est && F.est.length && !F.est.includes(d.estado.k)) return false;
  if (F.q) { const t = norm(F.q).split(/\s+/).filter(Boolean); if (!t.every(x => d.hay.includes(x))) return false; }
  return true;
}

// ---- diferencias de integrantes entre composiciones ----
const TITLES = /\b(dr|dra|lic|ing|mg|mag|esp|prof|sr|sra|srta|cr|cdor|cont|arq|abog|mgtr|phd|mba|tec)\b\.?/g;
const COMMON = new Set(['alejandro', 'marcelo', 'francisco', 'silvia', 'vanesa', 'daniel', 'carlos', 'alberto', 'hugo', 'gabriel', 'luis', 'jorge', 'mario', 'maria', 'juan', 'pedro', 'david', 'walter', 'reinaldo', 'nicolas', 'federico', 'emanuel', 'rodrigo', 'claudio', 'melanie', 'ramon', 'jose']);
export const titleCase = s => s.replace(/\b[a-z]/g, c => c.toUpperCase());
export function person(m) {
  const s = norm((m || '').split(/\s[-–—]\s|:\s/)[0].replace(/\([^)]*\)/g, ' ')).replace(TITLES, ' ').replace(/[^a-z\s]/g, ' ');
  const toks = s.split(/\s+/).filter(t => t.length > 2);
  return { toks: new Set(toks), label: s.replace(/\s+/g, ' ').trim() };
}
const same = (a, b) => { const sh = [...a.toks].filter(t => b.toks.has(t)); return sh.length >= 2 || (sh.length === 1 && sh[0].length >= 5 && !COMMON.has(sh[0])); };
export function diffMembers(cur, prev) {
  const A = cur.map(person), B = prev.map(person);
  return { ins: A.filter(a => !B.some(b => same(a, b))).map(a => titleCase(a.label)), outs: B.filter(b => !A.some(a => same(a, b))).map(b => titleCase(b.label)) };
}
export const MEMLINES = new Set(['comision_carrera_ISI', 'comision_carrera_analista', 'coordinacion_ISI', 'coordinacion_analista', 'autoevaluacion_acreditacion', 'comisiones_asesoras_EICA']);

export const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const GRUPOS_LINEAS = [
  { t: 'Gestión de la carrera', keys: ['comision_carrera_ISI', 'comision_carrera_analista', 'normativa_comisiones_carrera', 'coordinacion_ISI', 'coordinacion_analista', 'autoevaluacion_acreditacion'] },
  { t: 'Plan de estudios y régimen académico', keys: ['plan_estudios_ISI', 'plan_estudios_analista', 'equivalencias', 'pps', 'trabajo_final', 'regimen_academico', 'mejora_curricular'] },
  { t: 'Escuela, Departamentos y universidad', keys: ['comisiones_asesoras_EICA', 'estructura_EICA', 'regimen_concursos_docentes', 'extension', 'investigacion', 'educacion_distancia'] },
];
export const ANEXO_USO = {
  'Anexo 7': 'Estructura de gestión, plan de estudios y su seguimiento, creación de la carrera, PPS, regularidad, admisión, apoyo académico y demás normativa de la carrera.',
  'Anexo 8': 'Programas analíticos, guías de trabajos prácticos, informes de PPS, trabajos finales y exámenes del último año. Cada archivo debe nombrar su actividad curricular.',
  'Anexo 9': 'Documentación que respalda planes y estrategias de mejora.',
  'Anexo 10': 'Análisis de resultados e informes de seguimiento del plan de estudios, los alumnos y los graduados.',
  'Informe de seguimiento': 'Seguimiento de los compromisos asumidos en una acreditación anterior.',
  'Otros': 'Designaciones y concursos docentes, equivalencias y títulos individuales, actividades de la Escuela.',
};
export const NOMBRE_ANEXO = { 'Anexo 7': 'Anexo 7 · Normativa de la carrera', 'Anexo 8': 'Anexo 8 · Programas, TP, PPS y trabajos finales', 'Anexo 9': 'Anexo 9 · Planes de mejora', 'Anexo 10': 'Anexo 10 · Resultados y seguimiento', 'Informe de seguimiento': 'Informe de seguimiento', 'Otros': 'Otros documentos de ISI' };
export const TAB_ANEXO = { 'Anexo 7': 'Anexo 7', 'Anexo 8': 'Anexo 8', 'Anexo 9': 'Anexo 9', 'Anexo 10': 'Anexo 10', 'Informe de seguimiento': 'Seguimiento', 'Otros': 'Otros' };

export function exportCsv(list, name = 'documentos-isi.csv') {
  const cols = [['Anexo', d => d.anexo], ['Categoría', d => d.categoria], ['Órgano', d => d.organo], ['Tipo', d => d.tipo], ['Número', d => d.numero], ['Fecha', d => d.fecha],
    ['Asunto', d => d.asunto], ['Estado', d => d.estado.t], ['Actividad curricular', d => (d.actividad || []).join('; ')], ['Resumen', d => d.resumen]];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = '\ufeff' + [cols.map(c => q(c[0])).join(','), ...list.map(d => cols.map(c => q(c[1](d))).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

/* ---- convenios (Citrino) ---- */
export const VALOR = { alta: 'Alto', media: 'Medio', baja: 'Bajo' };
export const VALOR_AYUDA = {
  alta: 'Se relaciona de forma directa con la carrera: prácticas, empresas del sector, investigación o articulación académica en informática.',
  media: 'Puede servir como evidencia general de vinculación (cooperación institucional, extensión, ingreso).',
  baja: 'No se ve relación con la carrera. Solo se muestra si elegís ver todos los convenios.',
};
export const MODOS_CONV = { sugeridos: 'Con posible valor para ISI', todos: 'Todos los convenios' };
export const ESTADOS_CONV = ['Vigente', 'Vencido'];

export function preprocessConvenios(lista) {
  return lista.map(c => ({ ...c, hay: norm([c.numero, (c.partes || []).map(p => p.nombre).join(' '), c.objeto, c.resumen, c.aporte, c.categoria, c.expediente, c.tipo, c.firmante_ext].join(' ')) }));
}
export const emptyConv = () => ({ modo: 'sugeridos', cat: [], tipo: [], estado: [], parte: [], valor: [], y0: '', y1: '' });
export function passesConv(c, F, CF, skip = {}) {
  if (!skip.modo && CF.modo === 'sugeridos' && c.relevancia === 'baja') return false;
  if (!skip.cat && CF.cat.length && !CF.cat.includes(c.categoria)) return false;
  if (!skip.tipo && CF.tipo.length && !CF.tipo.includes(c.tipo)) return false;
  if (!skip.estado && CF.estado.length && !CF.estado.includes(c.estado)) return false;
  if (!skip.parte && CF.parte.length && !(c.partes || []).some(p => CF.parte.includes(p.tipo))) return false;
  if (!skip.valor && CF.valor.length && !CF.valor.includes(c.relevancia)) return false;
  if (CF.y0 && (!c.anio || c.anio < +CF.y0)) return false;
  if (CF.y1 && (!c.anio || c.anio > +CF.y1)) return false;
  if (F.q) { const t = norm(F.q).split(/\s+/).filter(Boolean); if (!t.every(x => c.hay.includes(x))) return false; }
  return true;
}
export function exportConveniosCsv(list, name = 'convenios-isi.csv') {
  const cols = [['Número', c => c.numero], ['Partes', c => (c.partes || []).map(p => p.nombre).join('; ')], ['Tipo', c => c.tipo], ['Estado', c => c.estado], ['Firma', c => c.firma], ['Vencimiento', c => c.vence],
    ['Categoría', c => c.categoria], ['Valor sugerido para ISI', c => VALOR[c.relevancia]], ['Objeto', c => c.objeto], ['Resumen', c => c.resumen], ['Posible aporte a la acreditación', c => c.aporte], ['Expediente', c => c.expediente]];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = '﻿' + [cols.map(c => q(c[0])).join(','), ...list.map(c => cols.map(k => q(k[1](c))).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export const SIDE_NAME ={ 'Anexo 7': 'Anexo 7 · Normativa', 'Anexo 8': 'Anexo 8 · Programas y PPS', 'Anexo 9': 'Anexo 9 · Planes de mejora', 'Anexo 10': 'Anexo 10 · Resultados', 'Informe de seguimiento': 'Informe de seguimiento', 'Otros': 'Otros documentos' };
