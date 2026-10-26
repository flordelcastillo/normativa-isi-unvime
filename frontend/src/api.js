const KEY = 'visor_token';
export const getToken = () => sessionStorage.getItem(KEY) || '';
export const setToken = t => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));

async function call(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const t = getToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  const r = await fetch(path, { ...opts, headers });
  if (!r.ok) {
    let msg = r.statusText;
    try { const j = await r.json(); msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail); } catch { /* sin cuerpo */ }
    if (r.status === 401) setToken('');
    const e = new Error(msg); e.status = r.status; throw e;
  }
  return r.json();
}

// En la versión publicada (GitHub Pages) no hay servidor: los datos son archivos JSON junto a la página.
export const ESTATICO = import.meta.env.VITE_STATIC === '1';
const leer = async ruta => { const r = await fetch(ruta); if (!r.ok) throw new Error(`No se pudo leer ${ruta} (${r.status})`); return r.json(); };

export const api = {
  meta: () => (ESTATICO ? leer('data/meta.json') : call('/api/meta')),
  docs: () => (ESTATICO ? leer('data/docs.json') : call('/api/docs')),
  convenios: () => (ESTATICO ? leer('data/convenios.json') : call('/api/convenios')),
  login: password => call('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) }),
  ocr: file => { const f = new FormData(); f.append('file', file); return call('/api/ocr-preview', { method: 'POST', body: f }); },
  create: (meta, file) => { const f = new FormData(); f.append('meta', JSON.stringify(meta)); f.append('file', file); return call('/api/docs', { method: 'POST', body: f }); },
  update: (id, meta) => call('/api/docs/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(meta) }),
  remove: id => call('/api/docs/' + id, { method: 'DELETE' }),
};
