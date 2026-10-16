import React, { useState } from 'react';
import { api, setToken } from './api.js';

export default function LoginDialog({ onClose, onOk }) {
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await api.login(pw); setToken(r.token); onOk(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="modal sm" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="login-t">
        <h2 id="login-t">Ingresar como administrador</h2>
        <p className="lead">Solo hace falta para subir, editar o eliminar documentos. Para consultar no necesitás ingresar.</p>
        <label className="fld" style={{ marginTop: 18 }}>Contraseña
          <input type="password" autoFocus value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" aria-invalid={!!err} aria-describedby={err ? 'login-err' : undefined} /></label>
        {err && <div className="alert" id="login-err" role="alert">{err}</div>}
        <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy || !pw}>{busy ? 'Ingresando…' : 'Ingresar'}</button></div>
      </form>
    </div>
  );
}
