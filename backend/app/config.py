import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", "./data")).resolve()
PDF_DIR = DATA_DIR / "pdfs"
DB_PATH = DATA_DIR / "visor.db"
STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).resolve().parent.parent / "static"))
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")          # vacío = modo solo lectura
SECRET_KEY = os.environ.get("SECRET_KEY", "") or os.urandom(32).hex()
TOKEN_TTL_SECONDS = int(os.environ.get("TOKEN_TTL_SECONDS", 8 * 3600))
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", 60))
TESSDATA_LANG = os.environ.get("OCR_LANG", "spa")

ANEXOS = ["Anexo 7", "Anexo 8", "Anexo 9", "Anexo 10", "Informe de seguimiento", "Otros", "Descartar"]
ORGANOS = ["Rectoral", "Consejo Superior", "Consejo Académico", "Consejo Directivo", "Consejo Departamental", "Decanal", "Otra"]
TIPOS = ["Ordenanza", "Resolución", "Acta", "Disposición", "Informe de autoevaluación", "Plan de mejora", "Otra"]
RELEVANCIAS = ["alta", "media", "nula"]

CATEGORIAS = {
    "Anexo 7": ["Estructura de gestión", "Instancias de diseño y seguimiento del plan de estudios", "Normativa de creación de la carrera",
                "Resoluciones ministeriales / reconocimiento y validez del título", "Plan de estudios y sus modificaciones",
                "Actividades curriculares optativas", "Modalidad y requisitos de la PPS", "Condiciones de regularidad",
                "Requisitos de admisión / ingreso", "Seguimiento y apoyo académico", "Equivalencias y reconocimiento",
                "Docentes: concursos, carrera docente y evaluación", "Extensión, investigación y vinculación", "Otra normativa general"],
    "Anexo 8": ["Programas analíticos", "Guías de trabajos prácticos", "Práctica Profesional Supervisada", "Proyecto Final / Trabajo Final", "Exámenes", "Cursos y actividades curriculares"],
    "Anexo 9": ["Reforma e innovación curricular", "Tutorías y apoyo al estudiante", "Educación a distancia", "Fortalecimiento y financiamiento", "Formación docente y capacitación", "Otras estrategias de mejora"],
    "Anexo 10": ["Análisis de resultados", "Seguimiento del plan de estudios", "Seguimiento de alumnos", "Seguimiento de graduados", "Otros informes"],
    "Informe de seguimiento": ["Compromisos asumidos ante CONEAU"],
    "Otros": ["Designaciones docentes", "Concursos y convocatorias docentes", "Equivalencias individuales", "Expedición de títulos", "Actividades de la Escuela", "Otras actuaciones"],
    "Descartar": [],
}

LINES = [
    ("comision_carrera_ISI", "Comisión de Carrera de ISI", "Conformaciones, cambios de integrantes y bajas de la Comisión de Carrera de Ingeniería en Sistemas de Información"),
    ("comision_carrera_analista", "Comisión de Carrera de Analista en Sistemas", "Comisión de la carrera Analista en Sistemas de Información (título intermedio)"),
    ("normativa_comisiones_carrera", "Marco de las Comisiones de Carrera", "Reglamentos generales que fijan funcionamiento e integración de las Comisiones de Carrera"),
    ("coordinacion_ISI", "Coordinación de ISI", "Designaciones, renuncias y prórrogas del coordinador de la carrera ISI"),
    ("coordinacion_analista", "Coordinación de Analista en Sistemas", "Designaciones y renuncias del coordinador de Analista en Sistemas de Información"),
    ("autoevaluacion_acreditacion", "Autoevaluación y acreditación", "Comisión de autoevaluación, oficina de evaluación y acreditación, CONEAU"),
    ("plan_estudios_ISI", "Plan de estudios de ISI", "Creación, modificaciones y rectificaciones del plan de estudios de ISI"),
    ("plan_estudios_analista", "Plan de estudios de Analista", "Creación y modificaciones del plan de Analista en Sistemas de Información"),
    ("equivalencias", "Equivalencias", "Regímenes de equivalencias (generales y entre Analista e ISI)"),
    ("pps", "Práctica Profesional Supervisada", "Reglamentos de PPS"),
    ("trabajo_final", "Proyecto / Trabajo Final", "Reglamentos de Proyecto o Trabajo Final"),
    ("regimen_concursos_docentes", "Concursos y carrera docente", "Regímenes de concursos docentes y cobertura de cargos"),
    ("comisiones_asesoras_EICA", "Consejo de Escuela EICA", "Comisiones asesoras y composición del Consejo de la Escuela de Ingeniería"),
    ("estructura_EICA", "Estructura de la Escuela y Departamentos", "Creación y autoridades de la Escuela de Ingeniería y de los Departamentos"),
    ("regimen_academico", "Régimen académico", "Ingreso, regularidad, exámenes y correlatividades"),
    ("mejora_curricular", "Mejora curricular", "Reforma e innovación curricular (PRIC) y estrategias de mejora"),
    ("extension", "Extensión", "Sistema de proyectos de extensión y su estructura"),
    ("investigacion", "Investigación", "Líneas y reglamentos de investigación"),
    ("educacion_distancia", "Educación a distancia", "SIED, UGEaD y normativa de educación a distancia"),
]
LINE_KEYS = {k for k, _, _ in LINES}
