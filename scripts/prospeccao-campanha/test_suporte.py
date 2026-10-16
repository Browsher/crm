"""Only synthetic campaign configuration; every write stays in a disposable stage."""
import atexit
import csv
import importlib.util
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

SOURCE = Path(__file__).resolve().parent
_STAGE = tempfile.TemporaryDirectory(prefix="prospeccao_testes_")
STAGE = Path(_STAGE.name).resolve()
atexit.register(_STAGE.cleanup)
SCRIPT = STAGE / "coletor.py"
shutil.copyfile(SOURCE / "coletor.py", SCRIPT)
shutil.copyfile(SOURCE / "campanha.exemplo.json", STAGE / "campanha.json")
os.environ["PROSPECCAO_CAMPANHA_DIR"] = str(STAGE)
os.environ["PYTHONUTF8"] = "1"
os.environ["PYTHONIOENCODING"] = "utf-8"
spec = importlib.util.spec_from_file_location("coletor", SCRIPT)
coletor = importlib.util.module_from_spec(spec)
sys.modules["coletor"] = coletor
spec.loader.exec_module(coletor)

def fixture_rows(bairro="Centro", cidade="Guarulhos", uf="SP", count=1):
    return [dict(input_id="q1", place_id=f"id{n}", cid=f"12345678901234567{n}", data_id="",
        title=f"Utilidades {n}", category="Loja de utilidades domésticas", address=f"Rua Teste, {n}",
        complete_address=json.dumps(dict(borough=bairro,city=cidade,state=uf,postal_code="00000-000")),
        link=f"https://maps.google.com/?cid={n}", website="", phone="", emails="") for n in range(1,count+1)]

def write_raw(path, rows):
    with path.open("w",encoding="utf-8",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    return path

def fixture_export(output):
    data=json.loads((output/"dados_preparados.json").read_text(encoding="utf-8"))
    for filename, rows, fields in [("empresas_novas.csv",data["selected"],data["fields"]),
        ("empresas_sinalizadas.csv",data["all"],data["fields"]),("bruto_completo.csv",data["raw_rows"],data["raw_fields"])]:
        with (output/filename).open("w",encoding="utf-8-sig",newline="") as stream:
            writer=csv.DictWriter(stream,fieldnames=fields,extrasaction="ignore");writer.writeheader();writer.writerows(rows)
