"""Compatibility with the current Google bridge, public fixtures and no installed kit."""
import importlib.util
import json
import os
import shutil
import sys
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parent
GOOGLE = SOURCE.parent / "google"


class IntegracaoCRM(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="prospeccao_crm_")
        self.addCleanup(temporary.cleanup)
        self.campaign = Path(temporary.name).resolve()
        for source, target in (("coletor.py", "coletor.py"),
                               ("campanha.exemplo.json", "campanha.json")):
            shutil.copyfile(SOURCE / source, self.campaign / target)
        self.guard = ExitStack()
        self.addCleanup(self.guard.close)
        self.guard.enter_context(patch.dict(os.environ, {"PROSPECCAO_CAMPANHA_DIR": str(self.campaign)}))
        self.guard.enter_context(patch.object(sys, "path", [str(GOOGLE), *sys.path]))
        for boundary in ("subprocess.run", "subprocess.Popen", "urllib.request.urlopen",
                         "socket.create_connection"):
            self.guard.enter_context(patch(boundary, side_effect=AssertionError("External operation forbidden: " + boundary)))
        real_spec = importlib.util.spec_from_file_location
        allowed = {(GOOGLE / "coletar.py").resolve(), self.campaign / "coletor.py"}

        def public_spec(name, location, *args, **kwargs):
            if Path(location).resolve() not in allowed:
                raise AssertionError("Import outside the public fixture: " + str(location))
            return real_spec(name, location, *args, **kwargs)

        self.guard.enter_context(patch.object(importlib.util, "spec_from_file_location", side_effect=public_spec))
        spec = importlib.util.spec_from_file_location("ponte_campanha_teste", GOOGLE / "coletar.py")
        self.bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.bridge)
        self.guard.enter_context(patch.object(self.bridge, "carregar_motor", return_value={
            "id": "03", "origem": "http://127.0.0.1:8089"}))
        self.collector = self.bridge.carregar_coletor(self.campaign, "03")

    def test_real_loader_keeps_campaign_history_interface_and_motor_isolated(self):
        module = self.collector
        self.assertEqual(Path(module.__file__).resolve(), self.campaign / "coletor.py")
        self.assertEqual(module.HERE, self.campaign)
        self.assertEqual(module.ROOT, self.campaign.parent)
        self.assertEqual(module.HISTORY, self.campaign / "historico.json")
        self.assertEqual(module.CONFIG["base_url"], "http://127.0.0.1:8089")
        original_config = json.loads((self.campaign / "campanha.json").read_text(encoding="utf-8"))
        self.assertEqual(original_config["base_url"], "http://127.0.0.1:8087")
        for name in ("campaign_lock", "read_json", "save_json", "load_kit", "collect", "process", "profile"):
            self.assertTrue(callable(getattr(module, name)), name)
        self.assertCountEqual([file.name for file in self.campaign.iterdir()], ["coletor.py", "campanha.json"],
                              "Import must not collect, create history or produce output")
        with module.campaign_lock(module.HISTORY):
            module.save_json(module.HISTORY, {"fixture": "isolada"})
        self.assertEqual(module.read_json(module.HISTORY), {"fixture": "isolada"})
        self.assertTrue(module.HISTORY.with_suffix(".lock").is_file())

    def test_v2_keeps_neutral_candidate_address_and_raw_csv_without_legacy_profile(self):
        raw = self.campaign / "bruto_original_full.csv"
        raw.write_text("place_id,title,phone,address,website,status,emails,review_rating,review_count\n"
                       "A,Loja sem telefone,,Endereço real,,permanently_closed,[],4.5,10\n", encoding="utf-8")
        before = raw.read_bytes()
        for name in ("process", "profile", "collect", "load_kit"):
            self.guard.enter_context(patch.object(self.collector, name,
                side_effect=AssertionError("Legacy campaign boundary forbidden: " + name)))
        pedido = {"id": "00000000-0000-4000-8000-000000000001", "nicho": "Pet shop $()",
                  "bairro": "Brás", "cidade": "São Paulo", "uf": "SP", "estado": "coletando", "contrato": 2}
        self.bridge.processar_resultados(self.collector, raw, {}, pedido, self.campaign)
        dados = json.loads((self.campaign / "dados_preparados.json").read_text(encoding="utf-8"))
        self.assertEqual(len(dados["all"]), 1)
        candidate = dados["all"][0]
        self.assertEqual(candidate["google_place_id"], "A")
        self.assertIsNone(candidate["telefone"])
        self.assertEqual(candidate["endereco"], "Endereço real")
        self.assertNotIn("validado", candidate)
        self.assertEqual(raw.read_bytes(), before)
        self.assertEqual((self.campaign / "bruto_completo.csv").read_bytes(), before)
        self.assertFalse(self.collector.HISTORY.exists())


if __name__ == "__main__":
    unittest.main()
