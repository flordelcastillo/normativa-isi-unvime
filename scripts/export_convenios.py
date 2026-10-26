#!/usr/bin/env python3
"""Arma la parte pública de los convenios de Citrino (frontend/public/data/convenios.json y los PDF).

Entradas (en la carpeta del relevamiento, fuera del repositorio):
  convenios_plano.json   metadatos tomados de la API pública de Citrino
  cls/out_*.json         clasificación y resumen de cada convenio (categoría, relevancia, resumen, aporte)
  pdfs/<ruta>.pdf        PDF escaneados de cada convenio

Criterios de publicación:
  * no se publican los nombres de quienes firman por la otra parte ni teléfonos o correos;
  * solo se aloja el PDF de los convenios con relevancia alta o media (comprimido);
    los de relevancia baja quedan con sus datos básicos y sin PDF.

Uso:
  python3 scripts/export_convenios.py --citrino ../../citrino --out frontend/public --relevado 26/10/2026
"""
import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path

CATEGORIAS = [
    ("Prácticas profesionales y pasantías", "Convenios para que estudiantes realicen PPS, pasantías o residencias."),
    ("Empresas y entidades del sector productivo y tecnológico", "Empresas, consultoras, cámaras y asociaciones empresarias."),
    ("Universidades y redes académicas", "Cooperación con otras universidades e instituciones de educación superior."),
    ("Investigación, desarrollo y transferencia", "Proyectos científico-tecnológicos, servicios a terceros y laboratorios."),
    ("Gobierno y organismos públicos", "Provincia, municipios, ministerios y programas estatales."),
    ("Escuelas y articulación con el nivel medio", "Colegios, ingreso y orientación vocacional."),
    ("Otras instituciones", "Salud, deportes, cultura, gremios y otras organizaciones."),
]
NOMBRES_CAT = {n for n, _ in CATEGORIAS}
OBS_UTIL = re.compile(r"marco|específico|especifico|complementario|renov|prórroga|prorroga|addenda|vigencia", re.I)
DNI = re.compile(r"\bD\.?N\.?I\.?\b[^,;.]{0,20}\d[\d.]{6,}|\b\d{1,2}\.\d{3}\.\d{3}\b", re.I)


def fecha(iso):
    return f"{iso[8:10]}/{iso[5:7]}/{iso[0:4]}" if iso and len(iso) >= 10 else ""


def comprimir(origen: Path, destino: Path):
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(".tmp.pdf")
    try:
        subprocess.run(["gs", "-q", "-dNOPAUSE", "-dBATCH", "-dSAFER", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", "-dPDFSETTINGS=/ebook",
                        "-dColorImageResolution=130", "-dGrayImageResolution=130", "-dMonoImageResolution=220", "-dDetectDuplicateImages=true",
                        f"-sOutputFile={tmp}", str(origen)], check=True, capture_output=True, timeout=240)
        if tmp.exists() and 1000 < tmp.stat().st_size < origen.stat().st_size:
            tmp.replace(destino)
            return
    except (subprocess.SubprocessError, OSError):
        pass
    tmp.unlink(missing_ok=True)
    shutil.copy2(origen, destino)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--citrino", required=True, help="carpeta del relevamiento de Citrino")
    ap.add_argument("--out", required=True, help="carpeta public del frontend")
    ap.add_argument("--relevado", required=True, help="fecha del relevamiento, dd/mm/aaaa")
    ap.add_argument("--solo-datos", action="store_true", help="regenera el JSON sin procesar los PDF")
    a = ap.parse_args()
    base, out = Path(a.citrino), Path(a.out)

    plano = {f"c{c['id']}": c for c in json.loads((base / "convenios_plano.json").read_text(encoding="utf-8"))}
    cls = {}
    for f in sorted((base / "cls").glob("out_*.json")):
        for x in json.loads(f.read_text(encoding="utf-8")):
            cls[x["id"]] = x
    faltan = sorted(set(plano) - set(cls))
    if faltan:
        raise SystemExit(f"Sin clasificación: {faltan[:10]} ({len(faltan)})")

    convenios = []
    for cid, c in plano.items():
        k = cls[cid]
        assert k["categoria"] in NOMBRES_CAT, (cid, k["categoria"])
        assert k["relevancia"] in ("alta", "media", "baja"), (cid, k["relevancia"])
        iso = c["firma"] or ""
        vence = c["vence"] or ""
        estado = "Vencido" if c["estado"] == "Vencido" else "Vigente"
        con_pdf = bool(c["ruta"]) and k["relevancia"] != "baja"
        obs = c["obs"] if c["obs"] and OBS_UTIL.search(c["obs"]) and not re.search(r"firm", c["obs"], re.I) else ""
        convenios.append({
            "id": cid, "numero": c["resolucion"].strip() if c["resolucion"] and re.search(r"\d", c["resolucion"]) else f"Sin número ({fecha(iso) or 's/f'})",
            "partes": [{"nombre": n, "tipo": t} for n, t in c["contrapartes"]],
            "tipo": c["tipo"], "estado": estado, "objeto": c["objeto"] or "", "responsable": c["responsable"] or "", "firmante": c["firmante"] or "",
            "firma": fecha(iso), "iso": iso, "anio": int(iso[:4]) if iso else None, "vence": fecha(vence), "vence_iso": vence,
            "renovacion": c["renov_modo"] or "", "renov_tipo": c["renov_tipo"] or "", "expediente": c["expediente"] or "", "obs": DNI.sub("", obs).strip(),
            "categoria": k["categoria"], "relevancia": k["relevancia"], "menciona_isi": bool(k.get("menciona_isi")),
            "resumen": DNI.sub("", k.get("resumen", "")).strip(), "aporte": DNI.sub("", k.get("aporte", "")).strip(), "calidad": k.get("calidad", ""),
            "pdf": f"pdfs/convenios/{cid}.pdf" if con_pdf else "", "_ruta": c["ruta"] if con_pdf else "",
        })
    convenios.sort(key=lambda x: (x["iso"] or "0000"), reverse=True)

    (out / "data").mkdir(parents=True, exist_ok=True)
    publico = [{k: v for k, v in c.items() if k != "_ruta"} for c in convenios]
    (out / "data" / "convenios.json").write_text(json.dumps({
        "fuente": "http://citrino.unvime.edu.ar/citrino/#/convenios", "relevado": a.relevado,
        "categorias": [{"nombre": n, "desc": d} for n, d in CATEGORIAS], "convenios": publico}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    cnt = {r: sum(1 for c in convenios if c["relevancia"] == r) for r in ("alta", "media", "baja")}
    print(f"Convenios: {len(convenios)} (alta {cnt['alta']}, media {cnt['media']}, baja {cnt['baja']}); con PDF alojado: {sum(1 for c in convenios if c['pdf'])}")
    if a.solo_datos:
        return
    antes = despues = 0
    for c in convenios:
        if not c["pdf"]:
            continue
        o, d = base / "pdfs" / c["_ruta"], out / c["pdf"].replace("pdfs/", "pdfs/", 1)
        if not o.exists():
            print("falta el PDF de", c["id"])
            continue
        comprimir(o, d)
        antes += o.stat().st_size
        despues += d.stat().st_size
    print(f"PDF de convenios: {antes / 1e6:.0f} MB -> {despues / 1e6:.0f} MB")


if __name__ == "__main__":
    main()
