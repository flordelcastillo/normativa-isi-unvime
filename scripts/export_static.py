#!/usr/bin/env python3
"""Genera la versión pública (de solo lectura) del visor a partir del relevamiento completo.

El relevamiento completo vive fuera del repositorio porque incluye documentos con datos de personas.
Este script arma lo que sí se publica:

  * deja afuera los documentos descartados (sin relación con ISI);
  * deja afuera los trámites individuales de alumnos (equivalencias y expedición de títulos);
  * quita los números de DNI de todos los textos;
  * aloja el PDF solo de los anexos 7, 8, 9 y del informe de seguimiento (comprimido);
  * para el resto (designaciones, concursos y actividades) enlaza al PDF del digesto oficial.

Uso:
  python3 scripts/export_static.py --source ../visor-isi/data.js --pdfs ../visor-isi/pdfs --out frontend/public
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app import config  # noqa: E402

# --- criterios de publicación (ajustar acá) ---
EXCLUIR_RELEVANCIA = {"nula"}
EXCLUIR_CATEGORIAS = {"Equivalencias individuales", "Expedición de títulos"}
ANEXOS_CON_PDF = {"Anexo 1", "Anexo 2", "Anexo 4", "Anexo 5", "Anexo 6", "Anexo 7", "Anexo 8", "Anexo 9", "Anexo 10", "Informe de seguimiento"}
DIGESTO = "https://digesto.unvime.edu.ar/digesto/index.php?view=desktop&task=download&format=raw&uuid={id}&id=1"

DNI = re.compile(r"\(?\s*\bD\.?\s?N\.?\s?I\.?\s*(?:N[º°o]\.?|:)?\s*\d[\d.\s]{5,11}\d\s*\)?", re.I)
DNI_SUELTO = re.compile(r"(?<=DNI )\d[\d.]{6,10}\d|(?<=DNI: )\d[\d.]{6,10}\d", re.I)


# Números con puntos de 8 cifras (10.000.000 a 99.999.999): en estos textos son DNI. Los importes llevan "$" delante y se respetan.
NUM_DNI = re.compile(r"(?<![\d.])[1-9]\d\.\d{3}\.\d{3}(?!\d|\.\d)")


def _sin_dni(m):
    previo = m.string[max(0, m.start() - 3):m.start()]
    return m.group(0) if "$" in previo else ""


def limpiar(txt):
    if not isinstance(txt, str):
        return txt
    txt = re.sub(r"\s*—\s*", ", ", txt).replace("–", "-")   # sin guiones largos en los textos publicados
    txt = DNI.sub("", txt)
    txt = DNI_SUELTO.sub("", txt)
    txt = NUM_DNI.sub(_sin_dni, txt)
    txt = re.sub(r"\(\s*\)", "", txt)           # paréntesis vacíos que quedan
    txt = re.sub(r"\s+([,.;:])", r"\1", txt)    # espacios antes de signos
    txt = re.sub(r"\s{2,}", " ", txt)
    return txt.strip(" -–,;")


def comprimir(origen: Path, destino: Path):
    """Ghostscript a 130 dpi; si el resultado no es más chico, se copia el original."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(".tmp.pdf")
    try:
        subprocess.run(["gs", "-q", "-dNOPAUSE", "-dBATCH", "-dSAFER", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", "-dPDFSETTINGS=/ebook",
                        "-dColorImageResolution=130", "-dGrayImageResolution=130", "-dMonoImageResolution=220", "-dDetectDuplicateImages=true",
                        f"-sOutputFile={tmp}", str(origen)], check=True, capture_output=True, timeout=180)
        if tmp.exists() and 1000 < tmp.stat().st_size < origen.stat().st_size:
            tmp.replace(destino)
            return
    except (subprocess.SubprocessError, OSError):
        pass
    tmp.unlink(missing_ok=True)
    shutil.copy2(origen, destino)


def buscar_pdf(doc_id, carpetas):
    """Busca el PDF en las carpetas dadas; si no está, lo baja del digesto a la última."""
    for c in carpetas:
        p = c / f"{doc_id}.pdf"
        if p.exists() and p.stat().st_size > 1000:
            return p
    destino = carpetas[-1] / f"{doc_id}.pdf"
    for _ in range(3):
        try:
            datos = urllib.request.urlopen(DIGESTO.format(id=doc_id), timeout=120).read()
            if datos[:4] == b"%PDF":
                destino.write_bytes(datos)
                return destino
        except OSError:
            time.sleep(2)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, help="relevamiento completo: data.js o un .json con {\"docs\": [...]}")
    ap.add_argument("--pdfs", required=True, help="carpetas con los PDF originales (<id>.pdf), separadas por coma; los que falten se bajan del digesto a la última")
    ap.add_argument("--rehacer", action="store_true", help="vuelve a comprimir los PDF que ya están en la carpeta de salida")
    ap.add_argument("--out", required=True, help="carpeta public del frontend")
    ap.add_argument("--solo-datos", action="store_true", help="regenera los JSON sin volver a procesar los PDF")
    a = ap.parse_args()
    crudo = Path(a.source).read_text(encoding="utf-8")
    docs = json.loads(crudo if crudo.lstrip().startswith(("{", "[")) else crudo[crudo.index("=") + 1:].strip().rstrip(";"))
    docs = docs["docs"] if isinstance(docs, dict) else docs

    publicos = [d for d in docs if d["relevancia"] not in EXCLUIR_RELEVANCIA and d["categoria"] not in EXCLUIR_CATEGORIAS]
    ids = {d["id"] for d in publicos}
    out = Path(a.out)
    (out / "data").mkdir(parents=True, exist_ok=True)

    final, entrantes = [], {}
    for d in publicos:
        d = dict(d)
        for k in ("asunto", "resumen", "vigencia", "evento_resumen", "motivo", "calidad"):
            d[k] = limpiar(d.get(k, ""))
        d["miembros"] = [m for m in (limpiar(m) for m in d.get("miembros", [])) if m]
        d["refs"] = [{"cita": limpiar(r["cita"]), "rel": r["rel"], "dice": limpiar(r.get("dice", "")), "to": [t for t in r.get("to", []) if t in ids]} for r in d.get("refs", [])]
        d["archivo"] = ""                                   # los nombres de archivo del digesto pueden incluir nombres de personas
        d["extra"] = [e for e in d.get("extra", []) if e.get("anexo")]
        d["externo"] = not ({d["anexo"]} | {e["anexo"] for e in d["extra"]}) & ANEXOS_CON_PDF
        d["pdf"] = DIGESTO.format(id=d["id"]) if d["externo"] else f"pdfs/{d['id']}.pdf"
        d.pop("inn", None)
        final.append(d)
        for r in d["refs"]:
            for t in r["to"]:
                entrantes.setdefault(t, []).append({"from": d["id"], "rel": r["rel"]})
    for d in final:
        d["inn"] = entrantes.get(d["id"], [])

    (out / "data" / "docs.json").write_text(json.dumps(final, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    meta = {"lines": [{"key": k, "nombre": n, "desc": d} for k, n, d in config.LINES], "anexos": config.ANEXOS, "organos": config.ORGANOS,
            "tipos": config.TIPOS, "categorias": config.CATEGORIAS, "relevancias": config.RELEVANCIAS, "soloLectura": True}
    (out / "data" / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    con_pdf = [d for d in final if not d["externo"]]
    if a.solo_datos:
        con_pdf_proc = []
    else:
        con_pdf_proc = con_pdf
    carpetas = [Path(c) for c in a.pdfs.split(",")]
    antes = despues = 0
    for i, d in enumerate(con_pdf_proc, 1):
        dst = out / "pdfs" / f"{d['id']}.pdf"
        if dst.exists() and not a.rehacer:
            continue
        o = buscar_pdf(d["id"], carpetas)
        if o is None:
            print("falta el PDF de", d["numero"], file=sys.stderr)
            continue
        comprimir(o, dst)
        antes += o.stat().st_size
        despues += dst.stat().st_size
        if i % 50 == 0:
            print(f"  {i}/{len(con_pdf)} PDF procesados", flush=True)
    print(f"Documentos publicados: {len(final)} de {len(docs)} ({len(con_pdf)} con PDF alojado, {len(final) - len(con_pdf)} con enlace al digesto)")
    if not a.solo_datos:
        print(f"PDF: {antes / 1e6:.0f} MB -> {despues / 1e6:.0f} MB")


if __name__ == "__main__":
    main()
