#!/usr/bin/env python3
"""Suma la clasificación de los anexos de la unidad académica (1, 2, 4, 5 y 6) al relevamiento de la carrera.

Un documento puede servir a más de un anexo: el principal queda en `anexo`/`categoria` y los demás en `extra`.
Entradas (en la carpeta del relevamiento, fuera del repositorio):
  visor-isi/data.js      relevamiento de la carrera (anexos 7 a 10, seguimiento, otros)
  cls_ua/out_*.json      clasificación de cada candidato según los anexos 1, 2, 4, 5 y 6
  index2.json            índice del digesto (uuid, nombre, carpeta, fecha de alta)
Salida:
  relevamiento_completo.json   {"docs": [...]} listo para scripts/export_static.py

Uso:
  python3 scripts/merge_anexos_ua.py --base ../../ --out ../../relevamiento_completo.json
"""
import argparse
import json
import re
from pathlib import Path

CARRERA = {"Anexo 7", "Anexo 8", "Anexo 9", "Anexo 10", "Informe de seguimiento"}
ORDEN_REL = {"nula": 0, "media": 1, "alta": 2}
ORGANOS = {"Rectoral", "Consejo Superior", "Consejo Académico", "Consejo Directivo", "Consejo Departamental", "Decanal", "Otra"}
TIPOS = {"Ordenanza", "Resolución", "Acta", "Disposición", "Informe de autoevaluación", "Plan de mejora", "Otra"}
DIGESTO = "https://digesto.unvime.edu.ar/digesto/index.php?view=desktop&task=download&format=raw&uuid={id}&id=1"
CLAVE = re.compile(r"([A-ZÑ]+(?:\s[A-ZÑ]+)?)\s*(?:N[º°o.]*)?\s*(\d{1,4})\s*[-/]\s*(\d{4})")


def clave(txt):
    m = CLAVE.search((txt or "").upper().replace(".", " "))
    return f"{m.group(1).replace(' ', '')}{int(m.group(2))}-{m.group(3)}" if m else None


def iso(fecha):
    m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", fecha or "")
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="carpeta del relevamiento (digesto-unvime)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    base = Path(a.base)
    crudo = (base / "visor-isi" / "data.js").read_text(encoding="utf-8")
    docs = {d["id"]: d for d in json.loads(crudo[crudo.index("=") + 1:].strip().rstrip(";"))["docs"]}
    indice = {x["uuid"]: x for x in json.loads((base / "index2.json").read_text(encoding="utf-8"))}
    ua = {}
    for f in sorted((base / "cls_ua").glob("out_*.json")):
        for x in json.loads(f.read_text(encoding="utf-8")):
            ua[x["id"]] = x

    nuevos = mejorados = 0
    for u, x in ua.items():
        if not x.get("anexo_ua") or x.get("relevancia_ua") == "nula":
            continue
        principal = {"anexo": x["anexo_ua"], "categoria": x.get("categoria_ua", "")}
        extras = [{"anexo": e, "categoria": ""} for e in x.get("anexos_ua_extra", []) if e != x["anexo_ua"]]
        d = docs.get(u)
        if d is None:
            if not x.get("numero"):
                continue  # sin datos para armar la ficha
            nombre = indice.get(u, {}).get("name", "")
            d = {
                "id": u, "numero": x["numero"], "fecha": x.get("fecha", ""), "iso": iso(x.get("fecha", "")),
                "organo": x["organo"] if x.get("organo") in ORGANOS else "Otra", "tipo": x["tipo"] if x.get("tipo") in TIPOS else "Otra",
                "anexo": principal["anexo"], "categoria": principal["categoria"], "relevancia": x["relevancia_ua"],
                "actividad": [], "lineas": [], "evento_tipo": "", "evento_resumen": "", "asunto": x.get("asunto", ""), "resumen": x.get("resumen", ""),
                "miembros": [], "vigencia": x.get("vigencia", ""), "refs": [{"cita": r.get("cita", ""), "rel": r.get("rel", "cita"), "dice": r.get("dice", ""), "to": []} for r in x.get("refs", [])],
                "archivo": nombre, "calidad": x.get("calidad", ""), "motivo": x.get("motivo", ""), "extra": extras,
            }
            docs[u] = d
            nuevos += 1
        else:
            mejorados += 1
            carrera_ok = d["relevancia"] != "nula" and d["anexo"] in CARRERA
            if carrera_ok:
                d["extra"] = [principal] + extras
            else:
                # no era de la carrera (o estaba en "Otros"): el anexo de la unidad académica pasa a ser el principal
                d["anexo"], d["categoria"], d["extra"] = principal["anexo"], principal["categoria"], extras
            if ORDEN_REL[x["relevancia_ua"]] > ORDEN_REL[d["relevancia"]]:
                d["relevancia"] = x["relevancia_ua"]

    # referencias entre normas: se resuelven por la clave sigla+número-año
    por_clave = {}
    for d in docs.values():
        k = clave(d["numero"])
        if k and d["relevancia"] != "nula":
            por_clave.setdefault(k, d["id"])
    resueltas = 0
    for d in docs.values():
        for r in d.get("refs", []):
            if not r.get("to"):
                t = por_clave.get(clave(r.get("cita", "")))
                if t and t != d["id"]:
                    r["to"] = [t]
                    resueltas += 1
    salida = [d for d in docs.values()]
    Path(a.out).write_text(json.dumps({"docs": salida}, ensure_ascii=False), encoding="utf-8")
    print(f"documentos: {len(salida)} (nuevos {nuevos}, ya relevados que suman anexo {mejorados}); referencias resueltas {resueltas}")


if __name__ == "__main__":
    main()
