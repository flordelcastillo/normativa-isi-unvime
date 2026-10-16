"""Lectura rápida de un PDF subido para sugerir número, fecha, órgano y tipo (opcional; usa pdftotext / tesseract si están)."""
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from . import config

MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12}


def extract_text(pdf: Path, pages: int = 2) -> str:
    text = ""
    if shutil.which("pdftotext"):
        r = subprocess.run(["pdftotext", "-l", str(pages), "-layout", str(pdf), "-"], capture_output=True, text=True, timeout=60)
        text = r.stdout
    if len(text.strip()) >= 120:
        return text
    if shutil.which("pdftoppm") and shutil.which("tesseract"):
        with tempfile.TemporaryDirectory() as t:
            subprocess.run(["pdftoppm", "-r", "150", "-gray", "-png", "-f", "1", "-l", str(pages), str(pdf), f"{t}/p"], timeout=120)
            out = []
            for img in sorted(Path(t).glob("p*.png")):
                r = subprocess.run(["tesseract", str(img), "-", "-l", config.TESSDATA_LANG, "--psm", "6"], capture_output=True, text=True, timeout=120)
                out.append(r.stdout)
            return "\n".join(out)
    return text


def suggest(text: str) -> dict:
    s: dict = {}
    t = re.sub(r"\s+", " ", text)
    pat = r"(?:RESOLUCI[OÓ]N|Resoluci[oó]n|ORDENANZA|Ordenanza|R\.?\s?R\.?|R\.?\s?C\.?\s?S\.?|O\.?\s?C\.?\s?S\.?)[^\d]{0,30}0*(\d{1,4})\s*[/\-]\s*(\d{4})"
    cands = [(m.start(), m.group(1), m.group(2)) for m in re.finditer(pat, t)]
    own = [c for c in cands if re.search(r"Cpde|Copia|C\.?\s?p\.?d\.?e", t[max(0, c[0] - 20):c[0] + 8], re.I)]
    pick = own[-1] if own else (cands[-1] if cands else None)   # el número propio suele estar al pie; las citas, al comienzo
    if pick:
        s["numero_sugerido"] = f"{int(pick[1])}-{pick[2]}"
    m = re.search(r"(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de|del)?\s*(\d{4})", t, re.I)
    if m and m.group(2).lower() in MESES:
        s["fecha"] = f"{int(m.group(1)):02d}/{MESES[m.group(2).lower()]:02d}/{m.group(3)}"
    low = t.lower()
    s["tipo"] = "Ordenanza" if "ordenanza" in low[:600] else "Resolución"
    if "consejo superior" in low[:900]:
        s["organo"] = "Consejo Superior"
    elif "consejo de escuela" in low[:900] or "c.esc" in low[:900]:
        s["organo"] = "Consejo Directivo"
    elif "rector" in low[:1500]:
        s["organo"] = "Rectoral"
    return s
