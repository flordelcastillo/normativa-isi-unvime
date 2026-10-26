"""Carga inicial de la base: importa los documentos y enlaza sus PDF.

Acepta el JSON que genera scripts/export_static.py (docs.json) o el data.js del relevamiento completo.

  python seed.py --docs ../frontend/public/data/docs.json --pdf-dir ../frontend/public/pdfs --data-dir ./data
"""
import argparse
import json
import os
import shutil
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--docs", required=True, help="docs.json (lista) o data.js")
ap.add_argument("--pdf-dir", required=True)
ap.add_argument("--data-dir", default="./data")
ap.add_argument("--convenios", help="convenios.json (opcional)")
ap.add_argument("--convenio-pdf-dir", help="carpeta con los PDF de convenios (<id>.pdf); por defecto pdfs/convenios junto a data/")
a = ap.parse_args()
os.environ["DATA_DIR"] = a.data_dir
sys.path.insert(0, str(Path(__file__).parent))
from app import config, db  # noqa: E402

db.init()
raw = Path(a.docs).read_text(encoding="utf-8")
data = json.loads(raw if raw.lstrip().startswith(("[", "{")) else raw[raw.index("=") + 1:].strip().rstrip(";"))
docs = data["docs"] if isinstance(data, dict) else data

importados = copiados = 0
for d in docs:
    d = dict(d)
    d["origen"] = "digesto"
    d["creado"] = db.now()
    d["archivo"] = d.get("archivo") or ""
    d["externo"] = 1 if d.get("externo") else 0
    d["pdf_url"] = d.get("pdf", "") if d["externo"] else ""
    db.upsert(d)
    importados += 1
    origen = Path(a.pdf_dir) / f"{d['id']}.pdf"
    destino = config.PDF_DIR / f"{d['id']}.pdf"
    if origen.exists() and not destino.exists():
        try:
            os.link(origen, destino)
        except OSError:
            shutil.copy2(origen, destino)
        copiados += 1
print(f"Importados {importados} documentos; PDF copiados: {copiados}")

# Convenios (opcional): se guardan como archivos, no en la base, porque son de solo lectura.
if a.convenios:
    destino_conv = config.CONVENIOS_DIR
    (destino_conv / "pdfs").mkdir(parents=True, exist_ok=True)
    shutil.copy2(a.convenios, destino_conv / "convenios.json")
    n = 0
    for c in json.loads(Path(a.convenios).read_text(encoding="utf-8"))["convenios"]:
        origen = Path(a.convenio_pdf_dir or Path(a.convenios).parent.parent / "pdfs" / "convenios") / f"{c['id']}.pdf"
        destino = destino_conv / "pdfs" / f"{c['id']}.pdf"
        if origen.exists() and not destino.exists():
            try:
                os.link(origen, destino)
            except OSError:
                shutil.copy2(origen, destino)
            n += 1
    print(f"Convenios cargados; PDF copiados: {n}")
