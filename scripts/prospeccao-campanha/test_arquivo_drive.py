"""Synthetic CLI contract checks; no campaign config, history or network is loaded."""
import codecs
import csv
import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("arquivo_drive.py")
FOLDER = "2026-10-16 - Brás - São Paulo-SP"
NAME = "planilha original scraping - 2026-10-16_09-05-07 - lote-job%2D001.csv"


class ArquivoDrive(unittest.TestCase):
    def setUp(self):
        self.stage = tempfile.TemporaryDirectory(prefix="arquivo_drive_teste_")
        self.addCleanup(self.stage.cleanup)
        self.root = Path(self.stage.name).resolve()
        self.matrix = self.root / "matriz.json"
        self.output = self.root / "saida"

    def run_cli(self, matrix, **changes):
        self.matrix.write_text(json.dumps(matrix, ensure_ascii=False), encoding="utf-8")
        options = {
            "matriz": str(self.matrix), "bairro": "Brás", "cidade": "São Paulo",
            "uf": "SP", "data-coleta": "2026-10-16", "horario": "09:05:07",
            "lote": "job-001", "saida": str(self.output),
        }
        options.update(changes)
        arguments = [sys.executable, "-B", str(SCRIPT)]
        for key, value in options.items():
            if value is not None:
                arguments.extend(["--" + key, value])
        result = subprocess.run(arguments, capture_output=True, text=True, encoding="utf-8",
                                env={**os.environ, "PYTHONUTF8": "1"})
        return result

    def success(self, result):
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(result.stderr, "")
        response = json.loads(result.stdout)
        self.assertTrue(response["ok"])
        return response["comprovante"]

    def invalid(self, result, *terms):
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertEqual(result.stdout, "")
        response = json.loads(result.stderr)
        self.assertFalse(response["ok"])
        for term in terms:
            self.assertIn(term, response["motivo"].lower())
        return response["motivo"]

    def test_csv_preserves_exact_strings_escapes_bom_and_final_crlf(self):
        matrix = [
            ["telefone", "nome", "ddd", "extra"],
            ["01123456789", 'Loja, "São João"', "011", "linha 1\nlinha 2"],
            ["1134567890", "Ação", "", "=" + '"001"'],
        ]
        receipt = self.success(self.run_cli(matrix))
        expected = codecs.BOM_UTF8 + (
            '"telefone","nome","ddd","extra"\r\n'
            '"01123456789","Loja, ""São João""","011","linha 1\nlinha 2"\r\n'
            '"1134567890","Ação","","=""001"""\r\n'
        ).encode("utf-8")
        path = self.output / FOLDER / NAME
        self.assertEqual(path.read_bytes(), expected)
        self.assertEqual(list(csv.reader(io.StringIO(expected.decode("utf-8-sig"), newline=""))), matrix)
        self.assertEqual(receipt, {
            "nomePasta": FOLDER, "nome": NAME,
            "csvSha256": hashlib.sha256(expected).hexdigest(),
            "tamanhoBytes": len(expected), "linhas": 2,
            "bairro": "Brás", "cidade": "São Paulo", "uf": "SP",
            "dataColeta": "2026-10-16", "lote": "job-001",
            "caminho": str(path), "caminhoComprovante": str(path.with_suffix(".json")),
        })
        self.assertEqual(json.loads(path.with_suffix(".json").read_text(encoding="utf-8")), receipt)
        self.assertFalse(path.with_suffix(".json").read_bytes().startswith(codecs.BOM_UTF8))
        self.assertEqual(self.matrix.read_text(encoding="utf-8"), json.dumps(matrix, ensure_ascii=False))

    def test_header_only_is_archived_with_zero_data_rows(self):
        receipt = self.success(self.run_cli([["telefone", "nome", "extra"]]))
        self.assertEqual(receipt["linhas"], 0)
        self.assertEqual(Path(receipt["caminho"]).read_bytes(),
                         codecs.BOM_UTF8 + b'"telefone","nome","extra"\r\n')

    def test_invalid_matrix_is_rejected_before_creating_output(self):
        cases = [
            ({"segredo-nao-publicar": "valor"}, ("matriz",)),
            ([], ("cabeçalho",)),
            ([[]], ("cabeçalho",)),
            (["telefone"], ("linha", "1")),
            ([["telefone", "nome"], ["011"]], ("linha", "2")),
            ([["telefone"], {"segredo-nao-publicar": "valor"}], ("linha", "2")),
            ([["telefone"], [None]], ("linha", "2", "coluna", "1")),
            ([["telefone"], [123]], ("string",)),
            ([["telefone"], [False]], ("string",)),
            ([[1]], ("linha", "1", "coluna", "1")),
            ([["telefone", " "]], ("cabeçalho", "vazio")),
            ([["telefone", "telefone"]], ("cabeçalho", "duplicado")),
            ([["Telefone", " telefone "]], ("cabeçalho", "duplicado")),
        ]
        for matrix, terms in cases:
            with self.subTest(matrix=matrix):
                message = self.invalid(self.run_cli(matrix), *terms)
                self.assertNotIn("segredo-nao-publicar", message)
                self.assertFalse(self.output.exists())

    def test_region_collection_date_batch_and_time_must_be_explicit_and_valid(self):
        cases = [
            ({"bairro": " "}, ("bairro",)),
            ({"cidade": ""}, ("cidade",)),
            ({"uf": "XX"}, ("uf",)),
            ({"uf": "sp"}, ("uf",)),
            ({"lote": " "}, ("lote",)),
            ({"data-coleta": "2026-02-30"}, ("data",)),
            ({"data-coleta": "2026-2-03"}, ("data",)),
            ({"data-coleta": "2026-10-16T09:05:07"}, ("data",)),
            ({"horario": "24:00:00"}, ("horário",)),
            ({"horario": "9:05:07"}, ("horário",)),
            ({"horario": "09:05:60"}, ("horário",)),
            ({"data-coleta": None}, ("argumentos",)),
            ({"horario": None}, ("argumentos",)),
            ({"bairro": None}, ("argumentos",)),
        ]
        for options, terms in cases:
            with self.subTest(options=options):
                self.invalid(self.run_cli([["telefone"]], **options), *terms)
                self.assertFalse(self.output.exists())

    def test_invalid_json_diagnostic_does_not_expose_input(self):
        self.matrix.write_text('{"segredo-nao-publicar":', encoding="utf-8")
        result = subprocess.run([
            sys.executable, "-B", str(SCRIPT), "--matriz", str(self.matrix),
            "--bairro", "Brás", "--cidade", "São Paulo", "--uf", "SP",
            "--data-coleta", "2026-10-16", "--horario", "09:05:07",
            "--lote", "job-001", "--saida", str(self.output),
        ], capture_output=True, text=True, encoding="utf-8",
           env={**os.environ, "PYTHONUTF8": "1"})
        self.assertNotIn("segredo-nao-publicar", self.invalid(result, "json"))
        self.assertFalse(self.output.exists())

    def test_names_escape_separators_controls_and_literal_percent_without_collisions(self):
        first = self.success(self.run_cli([["telefone"]], bairro="Brás/Pari\\A\n",
                                         cidade="São Paulo\x7f", lote="../job%2F\x1b"))
        self.assertEqual(first["nomePasta"], "2026-10-16 - Brás%2FPari%5CA%0A - São Paulo%7F-SP")
        self.assertEqual(first["nome"],
                         "planilha original scraping - 2026-10-16_09-05-07 - lote-..%2Fjob%252F%1B.csv")
        self.assertTrue(Path(first["caminho"]).resolve().is_relative_to(self.output.resolve()))
        other = self.success(self.run_cli([["telefone"]], bairro="Brás%2FPari\\A\n",
                                         cidade="São Paulo\x7f", lote="../job%2F\x1b"))
        self.assertNotEqual(first["nomePasta"], other["nomePasta"])
        self.assertNotEqual(first["caminho"], other["caminho"])

    def test_different_cities_never_share_the_same_folder(self):
        first = self.success(self.run_cli([["telefone"]], bairro="Centro"))
        other = self.success(self.run_cli([["telefone"]], bairro="Centro", cidade="Guarulhos"))
        self.assertEqual(other["nomePasta"], "2026-10-16 - Centro - Guarulhos-SP")
        self.assertNotEqual(first["nomePasta"], other["nomePasta"])

    def test_region_delimiter_cannot_collide_with_folder_component_boundaries(self):
        first = self.success(self.run_cli([["telefone"]], bairro="A - B", cidade="C"))
        other = self.success(self.run_cli([["telefone"]], bairro="A", cidade="B - C", lote="job-002"))
        self.assertNotEqual(first["nomePasta"], other["nomePasta"])
        self.assertEqual(first["nomePasta"], "2026-10-16 - A %2D B - C-SP")
        self.assertEqual(other["nomePasta"], "2026-10-16 - A - B %2D C-SP")
        literal = self.success(self.run_cli([["telefone"]], bairro="A %2D B", cidade="C", lote="job-003"))
        self.assertEqual(literal["nomePasta"], "2026-10-16 - A %252D B - C-SP")
        self.assertNotEqual(first["nomePasta"], literal["nomePasta"])
        plain = self.success(self.run_cli([["telefone"]], bairro="Vila-Nova", cidade="São-José", lote="job-004"))
        self.assertEqual(plain["nomePasta"], "2026-10-16 - Vila%2DNova - São%2DJosé-SP")
        self.assertEqual(plain["nome"], "planilha original scraping - 2026-10-16_09-05-07 - lote-job%2D004.csv")

    def test_component_edge_hyphens_cannot_create_folder_boundary_collisions(self):
        first = self.success(self.run_cli([["telefone"]], bairro="A -", cidade="B"))
        other = self.success(self.run_cli([["telefone"]], bairro="A", cidade="- B", lote="job-002"))
        self.assertNotEqual(first["nomePasta"], other["nomePasta"])
        self.assertEqual(first["nomePasta"], "2026-10-16 - A %2D - B-SP")
        self.assertEqual(other["nomePasta"], "2026-10-16 - A - %2D B-SP")
        literal = self.success(self.run_cli([["telefone"]], bairro="A %2D", cidade="B", lote="job-003"))
        self.assertEqual(literal["nomePasta"], "2026-10-16 - A %252D - B-SP")
        self.assertNotEqual(first["nomePasta"], literal["nomePasta"])

    def test_same_timestamp_different_batch_ids_keep_separate_files(self):
        first = self.success(self.run_cli([["telefone"], ["011"]]))
        other = self.success(self.run_cli([["telefone"], ["012"]], lote="job-002"))
        self.assertNotEqual(first["caminho"], other["caminho"])
        self.assertTrue(Path(first["caminho"]).exists())

    def test_identical_resume_keeps_both_files_unchanged(self):
        receipt = self.success(self.run_cli([["telefone"], ["011"]]))
        paths = [Path(receipt["caminho"]), Path(receipt["caminhoComprovante"])]
        before = [(path.read_bytes(), path.stat().st_mtime_ns) for path in paths]
        repeated = self.success(self.run_cli([["telefone"], ["011"]]))
        self.assertEqual(repeated, receipt)
        self.assertEqual([(path.read_bytes(), path.stat().st_mtime_ns) for path in paths], before)

    def test_divergent_csv_is_not_replaced_and_missing_receipt_is_not_created(self):
        folder = self.output / FOLDER
        folder.mkdir(parents=True)
        path = folder / NAME
        path.write_bytes(b"dados anteriores que nao podem ser perdidos")
        self.invalid(self.run_cli([["telefone"], ["011"]]), "csv", "divergente")
        self.assertEqual(path.read_bytes(), b"dados anteriores que nao podem ser perdidos")
        self.assertFalse(path.with_suffix(".json").exists())

    def test_divergent_receipt_blocks_csv_creation(self):
        folder = self.output / FOLDER
        folder.mkdir(parents=True)
        receipt = (folder / NAME).with_suffix(".json")
        receipt.write_bytes(b'{"lote":"anterior"}')
        self.invalid(self.run_cli([["telefone"], ["011"]]), "comprovante", "divergente")
        self.assertEqual(receipt.read_bytes(), b'{"lote":"anterior"}')
        self.assertFalse((folder / NAME).exists())

    def test_missing_receipt_is_recovered_without_rewriting_identical_csv(self):
        receipt = self.success(self.run_cli([["telefone"], ["011"]]))
        csv_path = Path(receipt["caminho"])
        before = csv_path.stat().st_mtime_ns
        Path(receipt["caminhoComprovante"]).unlink()
        self.assertEqual(self.success(self.run_cli([["telefone"], ["011"]])), receipt)
        self.assertEqual(csv_path.stat().st_mtime_ns, before)
        self.assertTrue(Path(receipt["caminhoComprovante"]).exists())

    def test_output_folder_link_cannot_escape_the_output_root(self):
        self.output.mkdir()
        outside = self.root / "fora"
        outside.mkdir()
        try:
            (self.output / FOLDER).symlink_to(outside, target_is_directory=True)
        except OSError:
            if sys.platform != "win32":
                raise
            created = subprocess.run(["cmd", "/c", "mklink", "/J", str(self.output / FOLDER), str(outside)],
                                     capture_output=True)
            self.assertEqual(created.returncode, 0, created.stderr)
        self.invalid(self.run_cli([["telefone"]]), "saída")
        self.assertEqual(list(outside.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
