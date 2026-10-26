import json
import re
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import auth, config, db, ocr

app = FastAPI(title="Visor de normativa ISI, UNViMe", version="1.0")
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.on_event("startup")
def _startup():
    db.init()


class Ref(BaseModel):
    cita: str = ""
    rel: str = "cita"
    dice: str = ""
    to: list[str] = []


class DocIn(BaseModel):
    numero: str = Field(default="", max_length=80)
    fecha: str = Field(default="", pattern=r"^(\d{2}/\d{2}/\d{4})?$")
    organo: Literal[tuple(config.ORGANOS)]  # type: ignore
    tipo: Literal[tuple(config.TIPOS)]  # type: ignore
    anexo: Literal[tuple(config.ANEXOS)]  # type: ignore
    categoria: str = Field(default="", max_length=200)
    relevancia: Literal[tuple(config.RELEVANCIAS)] = "alta"  # type: ignore
    actividad: list[str] = []
    lineas: list[str] = []
    evento_tipo: str = Field(default="", max_length=40)
    evento_resumen: str = Field(default="", max_length=300)
    asunto: str = Field(default="", max_length=400)
    resumen: str = Field(default="", max_length=6000)
    miembros: list[str] = []
    vigencia: str = Field(default="", max_length=800)
    refs: list[Ref] = []
    archivo: str = Field(default="", max_length=250)
    motivo: str = Field(default="", max_length=300)


def _normalize(m: DocIn) -> dict:
    d = m.model_dump()
    d["lineas"] = [k for k in d["lineas"] if k in config.LINE_KEYS]
    d["iso"] = db.iso_from_fecha(d["fecha"])
    if d["relevancia"] == "nula":
        d["anexo"] = "Descartar"
    if d["anexo"] == "Anexo 8" and not d["actividad"]:
        raise HTTPException(422, "El Anexo 8 requiere indicar la actividad curricular.")
    return d


class Login(BaseModel):
    password: str


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/meta")
def meta():
    return {"lines": [{"key": k, "nombre": n, "desc": d} for k, n, d in config.LINES], "anexos": config.ANEXOS, "organos": config.ORGANOS,
            "tipos": config.TIPOS, "categorias": config.CATEGORIAS, "relevancias": config.RELEVANCIAS, "soloLectura": not config.ADMIN_PASSWORD}


@app.post("/api/login")
def login(body: Login, request: Request):
    if not config.ADMIN_PASSWORD:
        raise HTTPException(403, "Modo solo lectura: falta ADMIN_PASSWORD en el servidor.")
    if not auth.check_password(request, body.password):
        raise HTTPException(401, "Contraseña incorrecta.")
    return {"token": auth.make_token(), "expira_en": config.TOKEN_TTL_SECONDS}


@app.get("/api/docs")
def list_docs():
    return db.all_docs()


@app.get("/api/docs/{doc_id}")
def one_doc(doc_id: str):
    d = db.get_doc(doc_id)
    if not d:
        raise HTTPException(404, "No existe ese documento.")
    return d


def _pdf_path(doc_id: str) -> Path:
    if not re.fullmatch(r"[0-9a-fA-F-]{8,40}", doc_id):
        raise HTTPException(404)
    return config.PDF_DIR / f"{doc_id}.pdf"


@app.get("/api/docs/{doc_id}/pdf")
def pdf(doc_id: str):
    p = _pdf_path(doc_id)
    if not p.exists():
        raise HTTPException(404, "El PDF no está en el servidor.")
    return FileResponse(p, media_type="application/pdf", headers={"Content-Disposition": "inline", "Cache-Control": "private, max-age=3600"})


# Convenios de Citrino: solo lectura. Los carga seed.py en DATA_DIR/convenios/.
def _convenios() -> dict:
    p = config.CONVENIOS_DIR / "convenios.json"
    if not p.exists():
        return {"convenios": [], "categorias": []}
    data = json.loads(p.read_text(encoding="utf-8"))
    for c in data["convenios"]:
        c["pdf"] = f"/api/convenios/{c['id']}/pdf" if c.get("pdf") else ""
    return data


@app.get("/api/convenios")
def list_convenios():
    return _convenios()


@app.get("/api/convenios/{conv_id}/pdf")
def convenio_pdf(conv_id: str):
    if not re.fullmatch(r"c\d{1,6}", conv_id):
        raise HTTPException(404)
    p = config.CONVENIOS_DIR / "pdfs" / f"{conv_id}.pdf"
    if not p.exists():
        raise HTTPException(404, "El PDF de este convenio no está en el servidor.")
    return FileResponse(p, media_type="application/pdf", headers={"Content-Disposition": "inline", "Cache-Control": "private, max-age=3600"})


async def _save_pdf(file: UploadFile, dest: Path):
    head = await file.read(5)
    if head[:4] != b"%PDF":
        raise HTTPException(415, "El archivo no es un PDF válido.")
    limit = config.MAX_UPLOAD_MB * 1024 * 1024
    size = len(head)
    tmp = dest.with_suffix(".part")
    with open(tmp, "wb") as f:
        f.write(head)
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                f.close(); tmp.unlink(missing_ok=True)
                raise HTTPException(413, f"El PDF supera {config.MAX_UPLOAD_MB} MB.")
            f.write(chunk)
    tmp.replace(dest)


@app.post("/api/ocr-preview", dependencies=[Depends(auth.require_admin)])
async def ocr_preview(file: UploadFile = File(...)):
    with tempfile.TemporaryDirectory() as t:
        p = Path(t) / "in.pdf"
        await _save_pdf(file, p)
        text = ocr.extract_text(p)
    return {"texto": text[:1800], "sugerencias": ocr.suggest(text)}


@app.post("/api/docs", dependencies=[Depends(auth.require_admin)], status_code=201)
async def create_doc(meta: str = Form(...), file: UploadFile = File(...)):
    try:
        m = DocIn.model_validate(json.loads(meta))
    except Exception as e:
        raise HTTPException(422, f"Metadatos inválidos: {e}")
    d = _normalize(m)
    doc_id = str(uuid.uuid4())
    await _save_pdf(file, config.PDF_DIR / f"{doc_id}.pdf")
    d.update(id=doc_id, origen="subido", creado=db.now(), archivo=d["archivo"] or (file.filename or ""), calidad="", )
    db.upsert(d)
    return db.get_doc(doc_id)


@app.put("/api/docs/{doc_id}", dependencies=[Depends(auth.require_admin)])
def update_doc(doc_id: str, m: DocIn):
    cur = db.get_doc(doc_id)
    if not cur:
        raise HTTPException(404, "No existe ese documento.")
    d = _normalize(m)
    d.update(id=doc_id, origen=cur["origen"], creado=cur["creado"], calidad=cur["calidad"], externo=int(cur["externo"]), pdf_url=cur.get("pdf_url", ""))
    db.upsert(d)
    return db.get_doc(doc_id)


@app.delete("/api/docs/{doc_id}", dependencies=[Depends(auth.require_admin)])
def delete_doc(doc_id: str):
    cur = db.get_doc(doc_id)
    if not cur:
        raise HTTPException(404, "No existe ese documento.")
    if cur["origen"] != "subido":
        raise HTTPException(409, "Los documentos del digesto no se borran; marcalos como relevancia «nula» (descartar).")
    db.delete(doc_id)
    _pdf_path(doc_id).unlink(missing_ok=True)
    return {"ok": True}


# ---- frontend compilado ----
class _Assets(StaticFiles):
    """Archivos con hash en el nombre: se pueden guardar un año sin riesgo de quedar viejos."""
    async def get_response(self, path, scope):
        r = await super().get_response(path, scope)
        if r.status_code == 200:
            r.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return r


if config.STATIC_DIR.exists():
    app.mount("/assets", _Assets(directory=config.STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404)
        f = (config.STATIC_DIR / full_path).resolve()
        if full_path and f.is_file() and str(f).startswith(str(config.STATIC_DIR.resolve())):
            return FileResponse(f)
        # index.html siempre se revalida: así nunca apunta a archivos de una versión anterior
        return FileResponse(config.STATIC_DIR / "index.html", headers={"Cache-Control": "no-cache"})
