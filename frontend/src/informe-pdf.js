/* Arma el informe en PDF dentro del navegador (no necesita servidor).
   pdf-lib se carga recién cuando se genera el informe, para no pesar en la primera visita. */

const A4 = [595.28, 841.89];
const M = { l: 58, r: 58, t: 66, b: 66 };
const ANCHO = A4[0] - M.l - M.r;
const GRIS = [0.36, 0.38, 0.42];
const TINTA = [0.12, 0.23, 0.41];
const NEGRO = [0.1, 0.1, 0.12];
const LINEA = [0.82, 0.83, 0.86];

const REEMPLAZOS = [[/[–—−]/g, '-'], [/→/g, 'a'], [/[   ]/g, ' '], [/\t/g, ' '], [/№/g, 'Nº'], [/[​-‍﻿]/g, '']];

export async function generarInforme({ titulo, autores, items, adjuntar, onProgreso }) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle(titulo);
  doc.setAuthor(autores || 'Carrera de Ingeniería en Sistemas de Información, UNViMe');
  doc.setCreator('Normativa ISI UNViMe');

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifB = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifI = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansB = await doc.embedFont(StandardFonts.HelveticaBold);
  const soportados = new Set(serif.getCharacterSet());
  const limpio = t => {
    let s = String(t ?? '');
    REEMPLAZOS.forEach(([re, to]) => { s = s.replace(re, to); });
    return [...s].map(c => (c === '\n' || soportados.has(c.codePointAt(0)) ? c : '')).join('');
  };
  const col = c => rgb(...c);

  const envolver = (texto, font, size, ancho) => {
    const out = [];
    limpio(texto).split('\n').forEach(par => {
      if (!par.trim()) { out.push(''); return; }
      let linea = '';
      par.split(/\s+/).filter(Boolean).forEach(pal => {
        const prueba = linea ? `${linea} ${pal}` : pal;
        if (font.widthOfTextAtSize(prueba, size) <= ancho) { linea = prueba; return; }
        if (linea) out.push(linea);
        // las palabras más largas que la línea (enlaces) se cortan por caracteres
        let resto = pal;
        while (font.widthOfTextAtSize(resto, size) > ancho) {
          let n = resto.length; while (n > 1 && font.widthOfTextAtSize(resto.slice(0, n), size) > ancho) n -= 1;
          out.push(resto.slice(0, n)); resto = resto.slice(n);
        }
        linea = resto;
      });
      if (linea) out.push(linea);
    });
    return out;
  };

  // ---- cursor de escritura ----
  let page = null; let y = 0;
  const paginasInforme = [];
  const nueva = () => { page = doc.addPage(A4); paginasInforme.push(page); y = A4[1] - M.t; return page; };
  const asegurar = alto => { if (y - alto < M.b) nueva(); };
  const texto = (t, { font = serif, size = 10.5, color = NEGRO, lead = size * 1.38, x = M.l, ancho = ANCHO, despues = 0 } = {}) => {
    envolver(t, font, size, ancho).forEach(l => {
      asegurar(lead);
      if (l) page.drawText(l, { x, y: y - size, size, font, color: col(color) });
      y -= lead;
    });
    y -= despues;
  };
  const regla = (color = LINEA, grosor = 0.6) => { page.drawLine({ start: { x: M.l, y }, end: { x: A4[0] - M.r, y }, thickness: grosor, color: col(color) }); };

  // ---- portada ----
  const total = items.length;
  const nConv = items.filter(i => i.tipo === 'convenio').length;
  const nNorm = total - nConv;
  nueva();
  y = A4[1] - 200;
  page.drawRectangle({ x: M.l, y: y + 8, width: 46, height: 3, color: col(TINTA) });
  y -= 22;
  texto('Universidad Nacional de Villa Mercedes', { font: sans, size: 11, color: GRIS, despues: 2 });
  texto('Ingeniería en Sistemas de Información', { font: sans, size: 11, color: GRIS, despues: 26 });
  texto(titulo, { font: serifB, size: 27, lead: 32, color: TINTA, despues: 22 });
  const partes = [];
  if (nConv) partes.push(`${nConv} ${nConv === 1 ? 'convenio' : 'convenios'}`);
  if (nNorm) partes.push(`${nNorm} ${nNorm === 1 ? 'norma' : 'normas'} del digesto`);
  texto(`Documentación seleccionada para la acreditación: ${partes.join(' y ')}.`, { font: serif, size: 13, lead: 18, despues: 6 });
  if (autores) texto(`Selección realizada por: ${autores}`, { font: serif, size: 12, color: GRIS, despues: 4 });
  texto(`Generado el ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })} desde el visor de normativa de ISI.`, { font: serif, size: 11, color: GRIS });

  // ---- índice reservado (se completa al final, cuando se conocen las páginas) ----
  const secciones = [
    { titulo: 'Convenios', lista: items.filter(i => i.tipo === 'convenio') },
    { titulo: 'Normativa del digesto', lista: items.filter(i => i.tipo === 'norma') },
  ].filter(s => s.lista.length);
  const filasIndice = secciones.reduce((n, s) => n + s.lista.length + 1, 0) + (adjuntar ? items.length + 1 : 0);
  const paginasIndice = Math.max(1, Math.ceil(filasIndice / 38));
  const reservadas = [];
  for (let i = 0; i < paginasIndice; i += 1) reservadas.push(nueva());

  // ---- cuerpo ----
  const registro = []; // { nivel, etiqueta, pagina }
  const pagActual = () => paginasInforme.indexOf(page) + 1;
  const dato = (k, v) => (v ? `${k}: ${v}` : null);

  const bloque = i => {
    const d = i.d;
    asegurar(120);
    registro.push({ nivel: 1, etiqueta: i.tipo === 'convenio' ? `${d.numero}  ${d.partes.map(p => p.nombre).join('; ')}` : `${d.numero}  ${d.asunto}`, pagina: pagActual() });
    texto(d.numero, { font: serifB, size: 13.5, lead: 17, color: TINTA });
    if (i.tipo === 'convenio') {
      texto(d.partes.map(p => p.nombre).join('; '), { font: serifB, size: 11, lead: 14.5, despues: 2 });
      texto([dato('Tipo', d.tipo), dato('Estado', d.estado), dato('Firma', d.firma), dato('Vencimiento', d.vence || (d.renovacion === 'Permanente' ? 'permanente' : '')), dato('Expediente', d.expediente), dato('A cargo de', d.responsable)].filter(Boolean).join('   |   '),
        { font: sans, size: 8.6, color: GRIS, lead: 12, despues: 6 });
      if (d.objeto) texto(`Objeto registrado: ${d.objeto}`, { font: serifI, size: 10.2, color: GRIS, despues: 5 });
    } else {
      texto(d.asunto, { font: serifB, size: 11, lead: 14.5, despues: 2 });
      texto([dato('Anexo', d.anexo), dato('Categoría', d.categoria), dato('Órgano', d.organo), dato('Tipo', d.tipo), dato('Fecha', d.fecha), dato('Estado', d.estado?.t)].filter(Boolean).join('   |   '),
        { font: sans, size: 8.6, color: GRIS, lead: 12, despues: 6 });
    }
    if (d.resumen) texto(d.resumen, { despues: 5 });
    if (i.tipo === 'convenio' && d.aporte) {
      texto('Posible aporte a la acreditación', { font: sansB, size: 8.6, color: TINTA, lead: 12 });
      texto(d.aporte, { despues: 5 });
    }
    if (i.tipo === 'norma' && d.actividad?.length) texto(`Actividad curricular: ${d.actividad.join('; ')}`, { font: serifI, size: 10.2, color: GRIS, despues: 5 });
    if (i.nota?.trim()) {
      const lineas = envolver(i.nota, serifI, 10.3, ANCHO - 16);
      asegurar(Math.min(lineas.length, 3) * 14 + 22);
      const p0 = page; const y0 = y;
      texto('Nota de los docentes', { font: sansB, size: 8.6, color: TINTA, lead: 12, x: M.l + 10, ancho: ANCHO - 10 });
      texto(i.nota, { font: serifI, size: 10.3, lead: 14, x: M.l + 10, ancho: ANCHO - 16, despues: 3 });
      // la barra lateral solo se dibuja si la nota quedó entera en una página
      if (p0 === page) page.drawLine({ start: { x: M.l + 2, y: y0 - 1 }, end: { x: M.l + 2, y: y + 3 }, thickness: 1.6, color: col(TINTA) });
    }
    if (d.externo) texto(`Documento disponible en el digesto oficial: ${d.pdf}`, { font: sans, size: 7.8, color: GRIS, lead: 11, despues: 2 });
    y -= 6; asegurar(10); regla(); y -= 14;
  };

  let n = 0;
  for (const s of secciones) {
    nueva();
    registro.push({ nivel: 0, etiqueta: s.titulo, pagina: pagActual() });
    texto(s.titulo, { font: serifB, size: 20, lead: 26, color: TINTA, despues: 2 });
    texto(`${s.lista.length} ${s.lista.length === 1 ? 'documento seleccionado' : 'documentos seleccionados'}`, { font: sans, size: 9.5, color: GRIS, despues: 10 });
    regla(TINTA, 1); y -= 16;
    for (const i of s.lista) { bloque(i); n += 1; onProgreso?.(`Armando el informe (${n} de ${total})`); }
  }

  // ---- PDF originales: van después del informe, así los números de página del índice son definitivos ----
  const paginasDelInforme = paginasInforme.length;
  const adjuntos = []; const faltan = [];
  if (adjuntar) {
    let k = 0;
    for (const i of items) {
      k += 1;
      if (i.d.externo || !i.d.pdf) continue;
      onProgreso?.(`Adjuntando los PDF originales (${k} de ${total})`);
      try {
        const r = await fetch(i.d.pdf);
        if (!r.ok) throw new Error(String(r.status));
        const origen = await PDFDocument.load(await r.arrayBuffer(), { ignoreEncryption: true });
        const inicio = doc.getPageCount() + 1;
        const copiadas = await doc.copyPages(origen, origen.getPageIndices());
        copiadas.forEach(p => doc.addPage(p));
        adjuntos.push({ etiqueta: i.d.numero, pagina: inicio });
      } catch { faltan.push(i.d.numero); }
    }
  }

  // ---- índice ----
  let pi = 0; let yi = 0; let paginaI = null;
  const nuevaIndice = () => { paginaI = reservadas[Math.min(pi, reservadas.length - 1)]; pi += 1; yi = A4[1] - M.t; };
  const lineaIndice = (etiqueta, pagina, nivel) => {
    if (!paginaI || yi < M.b + 14) nuevaIndice();
    const font = nivel === 0 ? serifB : serif; const size = nivel === 0 ? 11.5 : 9.6; const sangria = nivel === 0 ? 0 : 12;
    if (nivel === 0) yi -= 8;
    const completo = limpio(etiqueta); let et = completo;
    const maxAncho = ANCHO - sangria - 34;
    while (font.widthOfTextAtSize(et, size) > maxAncho && et.length > 4) et = et.slice(0, -2);
    if (et !== completo) et = `${et.trimEnd()}...`;
    paginaI.drawText(et, { x: M.l + sangria, y: yi - size, size, font, color: col(NEGRO) });
    const num = String(pagina); const w = font.widthOfTextAtSize(num, size);
    paginaI.drawText(num, { x: A4[0] - M.r - w, y: yi - size, size, font, color: col(NEGRO) });
    const x0 = M.l + sangria + font.widthOfTextAtSize(et, size) + 6; const x1 = A4[0] - M.r - w - 6;
    if (x1 > x0) paginaI.drawLine({ start: { x: x0, y: yi - size + 2 }, end: { x: x1, y: yi - size + 2 }, thickness: 0.5, color: col(LINEA), dashArray: [1, 2.5] });
    yi -= nivel === 0 ? size + 7 : size + 5.6;
  };
  nuevaIndice();
  paginaI.drawText('Índice', { x: M.l, y: yi - 20, size: 20, font: serifB, color: col(TINTA) }); yi -= 40;
  registro.forEach(r => lineaIndice(r.etiqueta, r.pagina, r.nivel));
  if (adjuntos.length) { lineaIndice('PDF originales adjuntos', adjuntos[0].pagina, 0); adjuntos.forEach(a => lineaIndice(a.etiqueta, a.pagina, 1)); }

  // ---- pie de página (solo en las páginas del informe) ----
  const totalPaginas = doc.getPageCount();
  const pie = limpio(titulo); let pt = pie; while (sans.widthOfTextAtSize(pt, 8) > ANCHO - 70 && pt.length > 4) pt = pt.slice(0, -2);
  paginasInforme.forEach((p, idx) => {
    if (idx === 0) return;
    p.drawLine({ start: { x: M.l, y: M.b - 14 }, end: { x: A4[0] - M.r, y: M.b - 14 }, thickness: 0.4, color: col(LINEA) });
    p.drawText(pt === pie ? pt : `${pt}...`, { x: M.l, y: M.b - 27, size: 8, font: sans, color: col(GRIS) });
    const num = `${idx + 1} de ${totalPaginas}`;
    p.drawText(num, { x: A4[0] - M.r - sans.widthOfTextAtSize(num, 8), y: M.b - 27, size: 8, font: sans, color: col(GRIS) });
  });

  return { bytes: await doc.save(), faltan, paginas: totalPaginas, paginasInforme: paginasDelInforme };
}

export function descargar(bytes, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
