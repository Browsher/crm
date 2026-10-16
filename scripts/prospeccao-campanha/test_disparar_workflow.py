"""Synthetic receipts and HTTP doubles only; never load campaign data or credentials."""
import copy
import importlib
import io
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parent
SCRIPT = SOURCE / "disparar_workflow.py"
TOKEN = "segredo-sintetico-nao-publicar-0123456789"
SIGNAL = {
    "versao": 1, "lote": "lote-teste-001", "origemCsvSha256": "a" * 64,
    "planilhaId": "planilha-teste", "origemId": 10151001,
    "pastaId": "pasta-teste", "arquivoOriginalId": "original-teste",
}
RESULT = {
    "versao": 1, "estado": "concluido", "lote": "lote-teste-001",
    "origemCsvSha256": "a" * 64, "execucaoId": "690",
    "empresasLidas": 10, "empresasExportadas": 5, "validos": 5,
    "invalidos": 3, "pendencias": 2, "mensagensEnviadas": 0,
    "arquivoDrive": {"id": "final-teste", "pastaId": "pasta-teste",
                     "link": "https://drive.google.com/file/d/final-teste/view",
                     "nome": "planilha final.csv", "csvSha256": "b" * 64},
}


def publication():
    return {
        "spreadsheetId": "planilha-teste", "sheetId": 10151001,
        "bairro": "Brás", "cidade": "São Paulo", "uf": "SP",
        "data_coleta": "2026-10-16", "lote": "lote-teste-001",
        "quantidade": 10, "sha256_matriz": "c" * 64,
        "estado": "publicado_conferido", "origem_publicada": True,
        "arquivo_drive_confirmado": True,
        "leitura_retorno": {"conferida": True, "publicacao_nova_conferida": True},
        "manifesto": {"versao": 1, "tipo": "origem", "raizId": "raiz-teste",
                      "pastaId": "pasta-teste", "arquivoId": "original-teste",
                      "bairro": "Brás", "cidade": "São Paulo", "uf": "SP",
                      "dataColeta": "2026-10-16", "lote": "lote-teste-001",
                      "nome": "planilha original.csv", "csvSha256": "a" * 64,
                      "linhas": 10, "estado": "salvo"},
        "campo_anterior": {"preservar": True},
    }


class DispatchWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if str(SOURCE) not in sys.path:
            sys.path.insert(0, str(SOURCE))
        cls.client = importlib.import_module("disparar_workflow") if SCRIPT.exists() else None

    def setUp(self):
        self.assertIsNotNone(self.client, "Cliente de disparo ainda não implementado")
        self.stage = tempfile.TemporaryDirectory(prefix="disparo_workflow_teste_", dir=SOURCE)
        self.addCleanup(self.stage.cleanup)
        self.root = Path(self.stage.name)
        self.receipt = self.root / "publicacao_sheets.json"
        self.config = self.root / ".workflow-prospeccao.local.json"
        self.pub = publication()
        self.cfg = {"versao": 1, "url": "https://n8n.example.test/webhook/crm-teste",
                    "header": "X-CRM-Token", "token": TOKEN, "timeoutSegundos": 120,
                    "planilhaId": "planilha-teste", "origemId": 10151001}
        self.write(self.receipt, self.pub)
        self.write(self.config, self.cfg)
        self.posts = []
        self.addCleanup(patch.stopall)
        patch.object(self.client, "_postar", side_effect=self.post).start()

    def write(self, path, value):
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def read(self):
        return json.loads(self.receipt.read_text(encoding="utf-8"))

    def post(self, config, signal):
        self.posts.append((config, signal))
        persisted = self.read()["workflow_automatico"]
        self.assertEqual(persisted["estado"], "iniciado")
        self.assertEqual(persisted["sinal"], SIGNAL)
        return copy.deepcopy(RESULT)

    def run_client(self, reconcile=None):
        args = ["--publicacao", str(self.receipt), "--config", str(self.config)]
        if reconcile is not None:
            args += ["--reconciliar", str(reconcile)]
        output, error = io.StringIO(), io.StringIO()
        with redirect_stdout(output), redirect_stderr(error):
            code = self.client.main(args)
        self.assertEqual(error.getvalue(), "")
        self.assertNotIn(TOKEN, output.getvalue())
        return code, json.loads(output.getvalue())

    def test_success_persists_before_exact_post_and_preserves_publication(self):
        code, response = self.run_client()
        self.assertEqual(code, 0)
        self.assertTrue(response["ok"])
        self.assertEqual(response["resultado"], RESULT)
        self.assertEqual(len(self.posts), 1)
        self.assertEqual(self.posts[0][1], SIGNAL)
        self.assertEqual(self.read()["workflow_automatico"]["estado"], "concluido")
        self.assertEqual({k: v for k, v in self.read().items() if k != "workflow_automatico"}, self.pub)
        self.assertNotIn(TOKEN, self.receipt.read_text(encoding="utf-8"))

    def test_all_four_flags_must_be_explicit_true_before_any_post(self):
        for parent, key in [(None, "origem_publicada"), (None, "arquivo_drive_confirmado"),
                            ("leitura_retorno", "conferida"), ("leitura_retorno", "publicacao_nova_conferida")]:
            for value in [False, None, "true", 1]:
                with self.subTest(key=key, value=value):
                    pub = publication()
                    (pub if parent is None else pub[parent])[key] = value
                    self.write(self.receipt, pub)
                    self.assertNotEqual(self.run_client()[0], 0)
                    self.assertNotIn("workflow_automatico", self.read())
        self.assertEqual(self.posts, [])

    def test_publication_state_and_manifest_identity_are_required(self):
        changes = [("estado", "pendente"), ("lote", "outro"), ("quantidade", 9),
                   ("bairro", "outro"), ("cidade", "outra"), ("uf", "RJ"),
                   ("data_coleta", "2026-10-15"), ("spreadsheetId", "outra"),
                   ("sheetId", 3), ("sheetId", True), ("manifesto", None)]
        for key, value in changes:
            with self.subTest(key=key):
                pub = publication()
                pub[key] = value
                self.write(self.receipt, pub)
                self.assertNotEqual(self.run_client()[0], 0)
        for key, value in [("estado", "pendente"), ("versao", True), ("tipo", "exportacao"),
                           ("csvSha256", "A" * 64), ("pastaId", "../fora"),
                           ("arquivoId", None), ("dataColeta", "2026-02-30")]:
            with self.subTest(manifesto=key):
                pub = publication()
                pub["manifesto"][key] = value
                self.write(self.receipt, pub)
                self.assertNotEqual(self.run_client()[0], 0)
        self.assertEqual(self.posts, [])

    def test_optional_duplicate_fields_cannot_disagree_with_manifest(self):
        for key, value in [("csvSha256", "f" * 64), ("pastaId", "outra"),
                           ("arquivoId", "outro"), ("raizId", "outra")]:
            with self.subTest(key=key):
                pub = publication()
                pub[key] = value
                self.write(self.receipt, pub)
                self.assertNotEqual(self.run_client()[0], 0)
        self.assertEqual(self.posts, [])

    def test_invalid_config_never_posts_or_echoes_values(self):
        for key, value in [("url", "http://n8n.example.test/webhook/x"),
                           ("url", "https://user:secret@n8n.example.test/webhook/x"),
                           ("url", "https://n8n.example.test/webhook-test/x"),
                           ("url", "https://n8n.example.test/webhook/x?token=secret"),
                           ("url", "https://n8n.example.test/webhook/x#fragment"),
                           ("url", "https://n8n.example.test/webhook/x y"),
                           ("url", "https://n8n.example.test/webhook/x\\y"),
                           ("url", "https://n8n.example.test/webhook/x?"),
                           ("url", "https://n8n.example.test/webhook/x#"),
                           ("header", "Other-Header"), ("token", ""),
                           ("token", "a\r\ninjetado"), ("timeoutSegundos", 121),
                           ("timeoutSegundos", True), ("versao", True),
                           ("origemId", True), ("planilhaId", "../outra")]:
            with self.subTest(key=key, value=value):
                self.write(self.receipt, publication())
                cfg = dict(self.cfg)
                cfg[key] = value
                self.write(self.config, cfg)
                code, response = self.run_client()
                self.assertNotEqual(code, 0)
                self.assertFalse(response["ok"])
        self.assertEqual(self.posts, [])

    def test_receipt_cannot_override_configured_endpoint_or_headers(self):
        self.pub["url"] = "https://outro.example.test/webhook/roubo"
        self.pub["token"] = "nao-usar"
        self.write(self.receipt, self.pub)
        self.assertEqual(self.run_client()[0], 0)
        self.assertEqual(self.posts[0][0], self.cfg)

    def test_repeated_success_returns_saved_result_without_post(self):
        self.assertEqual(self.run_client()[0], 0)
        before = self.receipt.read_bytes()
        self.assertEqual(self.run_client()[1]["resultado"], RESULT)
        self.assertEqual(len(self.posts), 1)
        self.assertEqual(self.receipt.read_bytes(), before)

    def test_started_uncertain_or_unknown_control_never_retries(self):
        for state in ["iniciado", "incerto", "desconhecido"]:
            with self.subTest(state=state):
                pub = publication()
                pub["workflow_automatico"] = {"versao": 1, "estado": state, "sinal": SIGNAL}
                self.write(self.receipt, pub)
                self.assertNotEqual(self.run_client()[0], 0)
        self.assertEqual(self.posts, [])

    def test_changed_signature_does_not_reuse_success_or_send_again(self):
        self.assertEqual(self.run_client()[0], 0)
        pub = self.read()
        pub["manifesto"]["csvSha256"] = "d" * 64
        self.write(self.receipt, pub)
        self.assertNotEqual(self.run_client()[0], 0)
        self.assertEqual(len(self.posts), 1)

    def test_invalid_server_result_becomes_uncertain_without_retry(self):
        mutations = [None, [], {"estado": "concluido"}]
        for key, value in [("lote", "outro"), ("origemCsvSha256", "d" * 64),
                           ("versao", True), ("execucaoId", ""), ("empresasLidas", -1),
                           ("empresasExportadas", 11), ("validos", True),
                           ("invalidos", 1.5), ("pendencias", "2"),
                           ("mensagensEnviadas", 1), ("estado", "pendente")]:
            result = copy.deepcopy(RESULT)
            result[key] = value
            mutations.append(result)
        for key, value in [("pastaId", "outra"), ("id", "../arquivo"),
                           ("link", "https://evil.test/final-teste"),
                           ("link", "https://drive.google.com/file/d/outro/view"),
                           ("nome", "retorno " + TOKEN + ".csv"), ("csvSha256", "bad")]:
            result = copy.deepcopy(RESULT)
            result["arquivoDrive"][key] = value
            mutations.append(result)
        for index, result in enumerate(mutations):
            with self.subTest(index=index):
                self.write(self.receipt, publication())
                with patch.object(self.client, "_postar", return_value=result) as post:
                    self.assertNotEqual(self.run_client()[0], 0)
                    self.assertEqual(self.read()["workflow_automatico"]["estado"], "incerto")
                    self.assertNotEqual(self.run_client()[0], 0)
                    self.assertEqual(post.call_count, 1)

    def test_extra_response_fields_are_not_printed_or_persisted(self):
        result = copy.deepcopy(RESULT)
        result["headers"] = {"secret": TOKEN}
        result["arquivoDrive"]["serverExtra"] = "nao-copiar"
        with patch.object(self.client, "_postar", return_value=result):
            code, response = self.run_client()
        self.assertEqual(code, 0)
        self.assertEqual(response["resultado"], RESULT)
        self.assertNotIn("headers", self.read()["workflow_automatico"]["resultado"])

    def test_tokens_with_json_escaping_in_response_values_are_not_returned_or_saved(self):
        for token in ['sintetico"teste', "sintetico\\teste"]:
            with self.subTest(token=token):
                self.write(self.receipt, publication())
                self.write(self.config, {**self.cfg, "token": token})
                result = {**copy.deepcopy(RESULT), "execucaoId": "prefixo-" + token + "-sufixo"}
                with patch.object(self.client, "_postar", return_value=result):
                    code, response = self.run_client()
                self.assertNotEqual(code, 0)
                self.assertNotIn("resultado", response)
                control = self.read()["workflow_automatico"]
                self.assertEqual(control["estado"], "incerto")
                self.assertNotIn("resultado", control)

    def test_tokens_with_json_escaping_in_signal_block_before_persistence_and_post(self):
        for token in ['sintetico"teste', "sintetico\\teste"]:
            with self.subTest(token=token):
                pub = publication()
                pub["lote"] = "prefixo-" + token + "-sufixo"
                pub["manifesto"]["lote"] = pub["lote"]
                self.write(self.receipt, pub)
                self.write(self.config, {**self.cfg, "token": token})
                before = self.receipt.read_bytes()
                with patch.object(self.client, "_postar", return_value=RESULT) as post:
                    code, response = self.run_client()
                    post.assert_not_called()
                self.assertNotEqual(code, 0)
                self.assertEqual(response["estado"], "bloqueado")
                self.assertEqual(self.receipt.read_bytes(), before)

    def test_timeout_connection_and_secret_exception_are_uncertain(self):
        for failure in [TimeoutError(TOKEN), OSError(TOKEN), ValueError(TOKEN)]:
            with self.subTest(kind=type(failure).__name__):
                self.write(self.receipt, publication())
                with patch.object(self.client, "_postar", side_effect=failure) as post:
                    code, response = self.run_client()
                    self.assertNotEqual(code, 0)
                    self.assertFalse(response["ok"])
                    self.assertEqual(self.read()["workflow_automatico"]["estado"], "incerto")
                    self.assertNotIn(TOKEN, self.receipt.read_text(encoding="utf-8"))
                    self.assertNotEqual(self.run_client()[0], 0)
                    self.assertEqual(post.call_count, 1)

    def test_total_timeout_is_uncertain_and_blocks_another_post(self):
        with patch.object(self.client, "_postar_com_prazo", side_effect=TimeoutError(TOKEN)) as post:
            self.assertNotEqual(self.run_client()[0], 0)
            self.assertEqual(self.read()["workflow_automatico"]["estado"], "incerto")
            self.assertNotEqual(self.run_client()[0], 0)
            self.assertEqual(post.call_count, 1)

    def test_write_failure_before_post_never_sends(self):
        before = self.receipt.read_bytes()
        with patch.object(self.client.os, "replace", side_effect=OSError(TOKEN)):
            self.assertNotEqual(self.run_client()[0], 0)
        self.assertEqual(self.posts, [])
        self.assertEqual(self.receipt.read_bytes(), before)

    def test_fsync_failure_before_post_never_sends_or_leaves_temporary_receipt(self):
        before = self.receipt.read_bytes()
        with patch.object(self.client.os, "fsync", side_effect=OSError(TOKEN)):
            self.assertNotEqual(self.run_client()[0], 0)
        self.assertEqual(self.posts, [])
        self.assertEqual(self.receipt.read_bytes(), before)
        self.assertEqual(list(self.root.glob("publicacao_sheets.json.*.tmp")), [])

    def test_write_failure_after_post_preserves_started_and_blocks_retry(self):
        real_replace = os.replace
        writes = []

        def fail_second(source, destination):
            writes.append(destination)
            if len(writes) == 2:
                raise OSError(TOKEN)
            return real_replace(source, destination)

        with patch.object(self.client.os, "replace", side_effect=fail_second):
            self.assertNotEqual(self.run_client()[0], 0)
        self.assertEqual(self.read()["workflow_automatico"]["estado"], "iniciado")
        self.assertNotEqual(self.run_client()[0], 0)
        self.assertEqual(len(self.posts), 1)

    def test_valid_reconciliation_resolves_uncertainty_without_network(self):
        self.pub["workflow_automatico"] = {"versao": 1, "estado": "incerto", "sinal": SIGNAL}
        self.write(self.receipt, self.pub)
        reconciled = self.root / "resultado.json"
        result = {**copy.deepcopy(RESULT), "estado": "ja_concluido"}
        self.write(reconciled, result)
        self.assertEqual(self.run_client(reconciled)[0], 0)
        self.assertEqual(self.read()["workflow_automatico"]["resultado"], result)
        self.assertEqual(self.run_client()[1]["resultado"], result)
        self.assertEqual(self.posts, [])

    def test_reconciliation_can_record_already_verified_legacy_success(self):
        self.pub["resultado_workflow"] = {"sucesso_n8n": True, "execucao": "689"}
        self.write(self.receipt, self.pub)
        reconciled = self.root / "resultado.json"
        self.write(reconciled, {**RESULT, "estado": "ja_concluido"})
        self.assertEqual(self.run_client(reconciled)[0], 0)
        self.assertEqual(self.posts, [])

    def test_invalid_reconciliation_does_not_mutate_or_send(self):
        self.pub["workflow_automatico"] = {"versao": 1, "estado": "incerto", "sinal": SIGNAL}
        self.write(self.receipt, self.pub)
        before = self.receipt.read_bytes()
        path = self.root / "resultado.json"
        self.write(path, {**RESULT, "lote": "outro"})
        self.assertNotEqual(self.run_client(path)[0], 0)
        self.assertEqual(self.receipt.read_bytes(), before)
        self.assertEqual(self.posts, [])

    def test_cli_missing_or_invalid_json_is_sanitized(self):
        for arguments in [[], ["--publicacao", TOKEN, "--config", TOKEN], ["--surpresa", TOKEN]]:
            output, error = io.StringIO(), io.StringIO()
            with redirect_stdout(output), redirect_stderr(error):
                code = self.client.main(arguments)
            self.assertNotEqual(code, 0)
            self.assertEqual(error.getvalue(), "")
            self.assertFalse(json.loads(output.getvalue())["ok"])
            self.assertNotIn(TOKEN, output.getvalue())
        self.receipt.write_text('{"segredo":', encoding="utf-8")
        self.assertNotEqual(self.run_client()[0], 0)
        self.assertEqual(self.posts, [])

    def test_two_processes_one_post_and_persistent_lock_is_never_removed(self):
        marker = self.root / "posts.txt"
        release = self.root / "liberar"
        runner = r'''
import json, pathlib, sys, time
sys.path.insert(0, sys.argv[1])
import disparar_workflow as client
def post(config, signal):
    with pathlib.Path(sys.argv[4]).open('a', encoding='utf-8') as output:
        output.write('POST\n')
    deadline = time.monotonic() + 15
    while not pathlib.Path(sys.argv[5]).exists():
        if time.monotonic() > deadline:
            raise TimeoutError('teste')
        time.sleep(0.02)
    return json.loads(sys.argv[6])
client._postar = post
raise SystemExit(client.main(['--publicacao', sys.argv[2], '--config', sys.argv[3]]))
'''
        args = [sys.executable, "-B", "-c", runner, str(SOURCE), str(self.receipt),
                str(self.config), str(marker), str(release), json.dumps(RESULT)]
        first = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                 text=True, encoding="utf-8")
        self.addCleanup(lambda: first.kill() if first.poll() is None else None)
        deadline = time.monotonic() + 10
        while not marker.exists() and first.poll() is None and time.monotonic() < deadline:
            time.sleep(0.02)
        self.assertTrue(marker.exists(), "Primeiro processo não chegou ao POST simulado")
        lock = Path(str(self.config) + ".lock")
        self.assertTrue(lock.exists())
        inode = lock.stat().st_ino
        try:
            second = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", timeout=5)
            self.assertNotEqual(second.returncode, 0)
            self.assertFalse(json.loads(second.stdout)["ok"])
            self.assertEqual(second.stderr, "")
            self.assertEqual(lock.stat().st_ino, inode)
            self.assertEqual(marker.read_text(encoding="utf-8"), "POST\n")
        finally:
            release.touch()
        out, err = first.communicate(timeout=10)
        self.assertEqual(first.returncode, 0, out + err)
        self.assertEqual(json.loads(out)["resultado"], RESULT)
        self.assertEqual(lock.stat().st_ino, inode)
        repeated = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", timeout=5)
        self.assertEqual(repeated.returncode, 0, repeated.stdout + repeated.stderr)
        self.assertEqual(marker.read_text(encoding="utf-8"), "POST\n")

    def test_killed_process_leaves_started_but_os_releases_its_lock(self):
        runner = r'''
import pathlib, sys, time
sys.path.insert(0, sys.argv[1])
import disparar_workflow as client
def post(config, signal):
    pathlib.Path(sys.argv[4]).touch()
    time.sleep(20)
client._postar = post
client.main(['--publicacao', sys.argv[2], '--config', sys.argv[3]])
'''
        marker = self.root / "iniciado"
        child = subprocess.Popen([sys.executable, "-B", "-c", runner, str(SOURCE),
                                  str(self.receipt), str(self.config), str(marker)],
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            deadline = time.monotonic() + 10
            while not marker.exists() and child.poll() is None and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(marker.exists())
        finally:
            if child.poll() is None:
                child.kill()
            child.communicate(timeout=5)
        self.assertEqual(self.read()["workflow_automatico"]["estado"], "iniciado")
        self.assertNotEqual(self.run_client()[0], 0)
        path = self.root / "resultado.json"
        self.write(path, RESULT)
        self.assertEqual(self.run_client(path)[0], 0)
        self.assertEqual(self.posts, [])


class HttpContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = importlib.import_module("disparar_workflow") if SCRIPT.exists() else None

    def setUp(self):
        self.assertIsNotNone(self.client, "Cliente de disparo ainda não implementado")
        self.config = {"url": "https://n8n.example.test/webhook/crm-teste", "header": "X-CRM-Token",
                       "token": TOKEN, "timeoutSegundos": 120}

    def test_transport_posts_json_auth_and_timeout_only_to_configured_https(self):
        with patch.object(self.client.http.client, "HTTPSConnection") as connection:
            response = connection.return_value.getresponse.return_value
            response.status = 200
            response.read1.side_effect = [json.dumps(RESULT).encode(), b""]
            self.assertEqual(self.client._postar(self.config, SIGNAL), RESULT)
            connection.assert_called_once_with("n8n.example.test", port=None, timeout=120)
            args, kwargs = connection.return_value.request.call_args
            self.assertEqual(args, ("POST", "/webhook/crm-teste"))
            self.assertEqual(json.loads(kwargs["body"]), SIGNAL)
            self.assertEqual(kwargs["headers"]["X-CRM-Token"], TOKEN)
            self.assertEqual(kwargs["headers"]["Content-Type"], "application/json")
            connection.return_value.close.assert_called_once()

    def test_http_errors_and_redirects_never_follow_location_or_echo_body(self):
        for status in [301, 302, 307, 308, 401, 403, 500]:
            with self.subTest(status=status), patch.object(self.client.http.client, "HTTPSConnection") as connection:
                response = connection.return_value.getresponse.return_value
                response.status = status
                response.read1.return_value = TOKEN.encode()
                response.getheader.return_value = "https://evil.test/webhook/roubo"
                with self.assertRaises(Exception) as raised:
                    self.client._postar(self.config, SIGNAL)
                self.assertNotIn(TOKEN, str(raised.exception))
                self.assertEqual(connection.call_count, 1)
                response.read1.assert_not_called()
                connection.return_value.close.assert_called_once()

    def test_transport_caps_response_and_rejects_invalid_json(self):
        for chunks in [[b"x" * 65537], [b"nao-json", b""]]:
            with self.subTest(size=len(chunks[0])), patch.object(self.client.http.client, "HTTPSConnection") as connection:
                response = connection.return_value.getresponse.return_value
                response.status = 200
                response.read1.side_effect = chunks
                with self.assertRaises(Exception):
                    self.client._postar(self.config, SIGNAL)
                connection.return_value.close.assert_called_once()

    def test_expired_connect_does_not_send_and_total_read_deadline_is_checked(self):
        with patch.object(self.client.http.client, "HTTPSConnection") as connection:
            with patch.object(self.client.time, "monotonic", side_effect=[0, 121]):
                with self.assertRaises(TimeoutError):
                    self.client._postar(self.config, SIGNAL)
            connection.return_value.request.assert_not_called()
            connection.return_value.close.assert_called_once()
        with patch.object(self.client.http.client, "HTTPSConnection") as connection:
            response = connection.return_value.getresponse.return_value
            response.status = 200
            response.read1.return_value = b"{"
            with patch.object(self.client.time, "monotonic", side_effect=[0, 1, 2, 3, 121]):
                with self.assertRaises(TimeoutError):
                    self.client._postar(self.config, SIGNAL)
            response.read1.assert_called_once()
            connection.return_value.close.assert_called_once()

    def test_outer_deadline_bounds_stalled_transport_without_retry(self):
        release = threading.Event()
        entered = threading.Event()

        def stalled(config, signal):
            entered.set()
            release.wait(5)
            return RESULT

        config = {**self.config, "timeoutSegundos": 0.05}
        start = time.monotonic()
        try:
            with patch.object(self.client, "_postar", side_effect=stalled) as post:
                with self.assertRaises(TimeoutError):
                    self.client._postar_com_prazo(config, SIGNAL)
                self.assertTrue(entered.is_set())
                self.assertLess(time.monotonic() - start, 1)
                self.assertEqual(post.call_count, 1)
        finally:
            release.set()


if __name__ == "__main__":
    unittest.main()
