"""Checks persistent deduplication, selection limits and safe queue advancement."""
import csv
import json
import subprocess
import sys
import tempfile
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path
from test_suporte import coletor, SCRIPT


class CampaignFlow(unittest.TestCase):
    def test_sewing_tools_and_charity_bazaars_need_review(self):
        self.assertGreaterEqual(coletor.profile({"title":"Armarinho de Aviamentos","category":"Loja de aviamentos"},{"texto":"utensilios"})[2],8)
        self.assertGreaterEqual(coletor.profile({"title":"Bazar da Igreja","category":"Bazar"},{})[2],8)
        self.assertGreaterEqual(coletor.profile({"title":"Supermercado A","category":"Loja de Brinquedos"},{})[2],8)

    def test_new_companies_from_all_returned_neighborhoods_keep_limit_and_history(self):
        with tempfile.TemporaryDirectory(dir=SCRIPT.parent, prefix="_teste_") as temp:
            root = Path(temp)
            self.assertTrue(root.resolve().is_relative_to(SCRIPT.parent.resolve()))
            rows = []
            for number, borough in [(1,"Brás"),(2,"Brás"),(3,"Pari"),(4,"Brás")]:
                rows.append(dict(input_id="q1",place_id=f"id{number}",cid=f"12345678901234567{number}",title=f"Utilidades {number}",category="Loja de utilidades domésticas",address=f"Rua Teste, {number}",complete_address=json.dumps(dict(borough=borough,city="São Paulo",postal_code="03000-000")),link=f"https://maps.google.com/?cid={number}",website="",phone="",emails=""))
            rows.append(rows[0].copy())
            fixture = root / "raw.csv"
            with fixture.open("w",encoding="utf-8",newline="") as stream:
                writer=csv.DictWriter(stream,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
            mapping=root/"queries.json";mapping.write_text(json.dumps({"q1":"utilidades Brás São Paulo SP"}),encoding="utf-8")
            state=root/"history.json"
            def run(destination):
                result=subprocess.run([sys.executable,str(SCRIPT),"--processar",str(fixture),"--mapa",str(mapping),"--bairro","Brás","--estado",str(state),"--saida",str(destination),"--limite","2"],capture_output=True,text=True,encoding="utf-8")
                self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                with (destination/"empresas_novas.csv").open(encoding="utf-8-sig",newline="") as stream:
                    return list(csv.DictReader(stream))
            first=run(root/"first")
            self.assertEqual(len(first),2)
            self.assertEqual(len({r["place_id"] for r in first}),2)
            self.assertTrue(all(r["bairro"]=="Brás" for r in first))
            self.assertEqual(first[0]["cid"],"123456789012345671")
            second=run(root/"second")
            self.assertEqual([row["place_id"] for row in second],["id3","id4"])
            self.assertEqual(second[0]["bairro"],"Pari")
            self.assertEqual(second[0]["endereco"],"Rua Teste, 3")
            self.assertEqual(run(root/"third"),[])
            saved=json.loads(state.read_text(encoding="utf-8"))
            self.assertEqual(len({entry["nome"] for entry in saved["vistos"].values()}),4)
            self.assertEqual(saved["proximo_indice"],3)
            # A company already selected through another neighborhood must not be selected again.
            result=subprocess.run([sys.executable,str(SCRIPT),"--processar",str(fixture),"--mapa",str(mapping),"--bairro","Pari","--estado",str(state),"--saida",str(root/"pari")],capture_output=True,text=True,encoding="utf-8")
            self.assertEqual(result.returncode,0,result.stderr)
            with (root/"pari/empresas_novas.csv").open(encoding="utf-8-sig",newline="") as stream:
                self.assertEqual(list(csv.DictReader(stream)),[])

    def test_unknown_source_term_does_not_advance_history(self):
        with tempfile.TemporaryDirectory(dir=SCRIPT.parent, prefix="_teste_") as temp:
            root=Path(temp)
            self.assertTrue(root.resolve().is_relative_to(SCRIPT.parent.resolve()))
            raw=root/"raw.csv"
            raw.write_text('input_id,place_id,title,category,complete_address\nunknown,id1,Utilidades,Loja de utilidades,{}\n',encoding="utf-8")
            mapping=root/"queries.json";mapping.write_text('{}',encoding="utf-8")
            state=root/"history.json"
            result=subprocess.run([sys.executable,str(SCRIPT),"--processar",str(raw),"--mapa",str(mapping),"--bairro","Brás","--estado",str(state),"--saida",str(root/"output")],capture_output=True,text=True,encoding="utf-8")
            self.assertNotEqual(result.returncode,0)
            self.assertIn("termo não identificado",result.stderr.lower())
            self.assertFalse(state.exists())

    def test_resume_downloads_existing_job_without_creating_another(self):
        with tempfile.TemporaryDirectory(dir=SCRIPT.parent,prefix="_teste_") as temp:
            root=Path(temp)
            self.assertTrue(root.resolve().is_relative_to(SCRIPT.parent.resolve()))
            keywords=[f"{term} no bairro Brás São Paulo SP" for term in coletor.CONFIG["termos"]]
            coletor.save_json(root/"job.json",{"id":"existing-job","request":{"keywords":keywords},"started_at":"2026-10-15T12:00:00+00:00"})
            calls=[]
            def request(method,path,*args):
                calls.append((method,path))
                if path.endswith("/download"):
                    return 200,b"input_id,title\nq1,Loja\n"
                if method=="GET" and path=="/api/v1/jobs/existing-job":
                    return 200,b'{"Status":"ok"}'
                raise AssertionError("Unexpected request: "+method+" "+path)
            with patch.object(coletor,"load_kit",return_value=SimpleNamespace(req=request)),patch.object(coletor.subprocess,"run",return_value=SimpleNamespace(returncode=0,stdout="",stderr="")):
                raw,_=coletor.collect(root,"Brás")
            self.assertTrue(raw.exists())
            self.assertFalse(any(method=="POST" for method,_ in calls))


_LOCK_PROCESS = """
import runpy
import sys
from pathlib import Path

module = runpy.run_path(sys.argv[1])
state, ready, mode = Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4]
try:
    with module["campaign_lock"](state):
        if mode == "probe":
            state.write_text("third process entered", encoding="utf-8")
        else:
            signal = ready.with_suffix(".tmp")
            signal.write_text("locked", encoding="utf-8")
            signal.replace(ready)
            sys.stdin.readline()
            if mode == "exception":
                raise ValueError("deliberate owner failure")
except RuntimeError as error:
    print(str(error), file=sys.stderr)
    sys.exit(23)
"""


class CampaignLockProcesses(unittest.TestCase):
    def check_release(self, mode):
        with tempfile.TemporaryDirectory(dir=SCRIPT.parent, prefix="_lock_") as temp:
            root = Path(temp)
            state = root / "nested" / "history.json"
            state.parent.mkdir()
            original = b'{"historico":"preservado"}'
            state.write_bytes(original)
            ready = root / "ready"
            command = [sys.executable, "-B", "-c", _LOCK_PROCESS, str(SCRIPT), str(state), str(ready)]
            owner = subprocess.Popen(command + [mode], stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                     text=True, encoding="utf-8")
            try:
                deadline = time.monotonic() + 10
                while not ready.exists() and owner.poll() is None and time.monotonic() < deadline:
                    time.sleep(0.01)
                if not ready.exists():
                    if owner.poll() is None:
                        owner.kill()
                    stdout, stderr = owner.communicate(timeout=10)
                    self.fail("Owner did not acquire the lock: " + stdout + stderr)
                self.assertEqual(ready.read_text(encoding="utf-8"), "locked")
                self.assertIsNone(owner.poll())
                lock = state.with_suffix(".lock")
                self.assertTrue(lock.is_file())

                contender = subprocess.run(command + ["probe"], capture_output=True,
                                           text=True, encoding="utf-8", timeout=10)
                self.assertEqual(contender.returncode, 23, contender.stdout + contender.stderr)
                self.assertIn("Outra execução está em andamento; histórico preservado", contender.stderr)
                self.assertEqual(state.read_bytes(), original)
                self.assertIsNone(owner.poll())

                if mode == "terminated":
                    owner.terminate()
                    stdout, stderr = owner.communicate(timeout=10)
                    self.assertNotEqual(owner.returncode, 0, stdout + stderr)
                else:
                    stdout, stderr = owner.communicate(input="release\n", timeout=10)
                    self.assertEqual(owner.returncode, 1 if mode == "exception" else 0, stdout + stderr)
                    if mode == "exception":
                        self.assertIn("deliberate owner failure", stderr)
                self.assertTrue(lock.is_file(), "The persistent lock file must not be deleted")
                self.assertEqual(state.read_bytes(), original)
                third = subprocess.run(command + ["probe"], capture_output=True,
                                       text=True, encoding="utf-8", timeout=10)
                self.assertEqual(third.returncode, 0, third.stdout + third.stderr)
                self.assertEqual(state.read_text(encoding="utf-8"), "third process entered")
                self.assertTrue(lock.is_file())
            finally:
                if owner.poll() is None:
                    owner.kill()
                owner.communicate(timeout=10)

    def test_lock_excludes_concurrent_process_and_releases_after_normal_exit(self):
        self.check_release("normal")

    def test_lock_excludes_concurrent_process_and_releases_after_exception(self):
        self.check_release("exception")

    def test_lock_excludes_concurrent_process_and_releases_after_termination(self):
        self.check_release("terminated")

if __name__=="__main__":
    unittest.main()
