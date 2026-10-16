import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from .config import DATA_DIR, DB_PATH, PDF_DIR

JSON_COLS = ("actividad", "lineas", "miembros", "refs")
COLS = ["id", "numero", "fecha", "iso", "organo", "tipo", "anexo", "categoria", "relevancia", "actividad", "lineas", "evento_tipo",
        "evento_resumen", "asunto", "resumen", "miembros", "vigencia", "refs", "archivo", "calidad", "motivo", "origen", "creado", "externo", "pdf_url"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY, numero TEXT NOT NULL DEFAULT '', fecha TEXT NOT NULL DEFAULT '', iso TEXT NOT NULL DEFAULT '',
  organo TEXT NOT NULL, tipo TEXT NOT NULL, anexo TEXT NOT NULL, categoria TEXT NOT NULL DEFAULT '', relevancia TEXT NOT NULL,
  actividad TEXT NOT NULL DEFAULT '[]', lineas TEXT NOT NULL DEFAULT '[]', evento_tipo TEXT NOT NULL DEFAULT '', evento_resumen TEXT NOT NULL DEFAULT '',
  asunto TEXT NOT NULL DEFAULT '', resumen TEXT NOT NULL DEFAULT '', miembros TEXT NOT NULL DEFAULT '[]', vigencia TEXT NOT NULL DEFAULT '',
  refs TEXT NOT NULL DEFAULT '[]', archivo TEXT NOT NULL DEFAULT '', calidad TEXT NOT NULL DEFAULT '', motivo TEXT NOT NULL DEFAULT '',
  origen TEXT NOT NULL DEFAULT 'digesto', creado TEXT NOT NULL DEFAULT '',
  externo INTEGER NOT NULL DEFAULT 0, pdf_url TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_docs_anexo ON docs(anexo);
CREATE INDEX IF NOT EXISTS idx_docs_iso ON docs(iso);
"""


def init():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.executescript(SCHEMA)
        # bases creadas antes de existir las columnas de documentos externos
        cols = {r["name"] for r in c.execute("PRAGMA table_info(docs)")}
        for nombre, ddl in (("externo", "INTEGER NOT NULL DEFAULT 0"), ("pdf_url", "TEXT NOT NULL DEFAULT ''")):
            if nombre not in cols:
                c.execute(f"ALTER TABLE docs ADD COLUMN {nombre} {ddl}")


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def iso_from_fecha(fecha: str) -> str:
    try:
        d, m, y = fecha.split("/")
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    except Exception:
        return ""


def row_to_doc(r) -> dict:
    d = {k: r[k] for k in r.keys()}
    for k in JSON_COLS:
        d[k] = json.loads(d[k] or "[]")
    d["anio"] = int(d["iso"][:4]) if d["iso"] else 0
    d["externo"] = bool(d["externo"])
    # los documentos externos no tienen PDF en este servidor: se enlaza al digesto oficial
    d["pdf"] = d["pdf_url"] if d["externo"] else f"/api/docs/{d['id']}/pdf"
    return d


def all_docs() -> list[dict]:
    with connect() as c:
        docs = [row_to_doc(r) for r in c.execute("SELECT * FROM docs ORDER BY iso, numero")]
    inn: dict[str, list] = {}
    for d in docs:
        for ref in d["refs"]:
            for t in ref.get("to", []):
                inn.setdefault(t, []).append({"from": d["id"], "rel": ref.get("rel", "cita")})
    for d in docs:
        d["inn"] = inn.get(d["id"], [])
    return docs


def get_doc(doc_id: str) -> dict | None:
    for d in all_docs():
        if d["id"] == doc_id:
            return d
    return None


def upsert(doc: dict):
    row = {k: doc.get(k, "") for k in COLS}
    for k in JSON_COLS:
        row[k] = json.dumps(doc.get(k, []), ensure_ascii=False)
    with connect() as c:
        c.execute(f"INSERT OR REPLACE INTO docs ({','.join(COLS)}) VALUES ({','.join('?' * len(COLS))})", [row[k] for k in COLS])


def delete(doc_id: str) -> bool:
    with connect() as c:
        return c.execute("DELETE FROM docs WHERE id=?", (doc_id,)).rowcount > 0
