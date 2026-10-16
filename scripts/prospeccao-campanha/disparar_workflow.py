"""Send one authenticated publication signal, or reconcile a verified result.

Only the private configuration chooses the HTTP destination. Publication receipts
keep their existing shape; workflow_automatico is durably recorded before POST.
An interrupted/uncertain attempt requires --reconciliar, never another POST.
The persistent .lock file is locked by the OS and is deliberately never deleted.
"""
import argparse
import http.client
import json
import os
import re
import sys
import tempfile
import threading
import time
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

if os.name == "nt":
    import msvcrt
else:
    import fcntl

UFS = frozenset("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split())
MAX_RESPOSTA = 65536


def _inteiro(value):
    return type(value) is int and 0 <= value <= 9007199254740991


def _id(value):
    return isinstance(value, str) and re.fullmatch(r"[a-zA-Z0-9_-]+", value) is not None


def _hash(value):
    return isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value) is not None


def _texto(value):
    if not isinstance(value, str) or not value or value != value.strip():
        return False
    try:
        value.encode("utf-8")
    except UnicodeError:
        return False
    return not re.search(r"[\x00-\x1f\x7f]", value)


def _nome_csv(value):
    return _texto(value) and value.endswith(".csv") and not re.search(r'[<>:"/\\|?*]', value)


def _dia(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        return False
    try:
        return date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def _config_valida(config):
    if not isinstance(config, dict) or type(config.get("versao")) is not int or config["versao"] != 1:
        return False
    if config.get("header") != "X-CRM-Token" or not _texto(config.get("token")):
        return False
    # Header values are ASCII. Reject CR/LF and Unicode before touching HTTP.
    if any(ord(char) < 33 or ord(char) > 126 for char in config["token"]):
        return False
    if type(config.get("timeoutSegundos")) is not int or config["timeoutSegundos"] != 120:
        return False
    if not _id(config.get("planilhaId")) or not _inteiro(config.get("origemId")):
        return False
    url = config.get("url")
    if (not _texto(url) or len(url) > 2048 or any(ord(char) <= 32 or ord(char) > 126 for char in url)
            or any(char in url for char in "\\?#")):
        return False
    try:
        parsed = urlsplit(url)
        return (parsed.scheme == "https" and bool(parsed.hostname) and parsed.username is None
                and parsed.password is None and parsed.query == "" and parsed.fragment == ""
                and parsed.path.startswith("/webhook/") and len(parsed.path) > len("/webhook/")
                and (parsed.port is None or 1 <= parsed.port <= 65535))
    except ValueError:
        return False


def _sinal(publicacao, config):
    """Return only the signal contract, after checking the real receipt layout."""
    if not isinstance(publicacao, dict) or publicacao.get("estado") != "publicado_conferido":
        return None
    leitura = publicacao.get("leitura_retorno")
    if not isinstance(leitura, dict) or any(value is not True for value in (
            publicacao.get("origem_publicada"), publicacao.get("arquivo_drive_confirmado"),
            leitura.get("conferida"), leitura.get("publicacao_nova_conferida"))):
        return None
    if (publicacao.get("spreadsheetId") != config["planilhaId"]
            or not _inteiro(publicacao.get("sheetId")) or publicacao["sheetId"] != config["origemId"]
            or not _hash(publicacao.get("sha256_matriz"))):
        return None
    manifesto = publicacao.get("manifesto")
    if not isinstance(manifesto, dict):
        return None
    if (type(manifesto.get("versao")) is not int or manifesto["versao"] != 1
            or manifesto.get("tipo") != "origem" or manifesto.get("estado") != "salvo"
            or not all(_id(manifesto.get(key)) for key in ("raizId", "pastaId", "arquivoId"))
            or not all(_texto(manifesto.get(key)) for key in ("lote", "bairro", "cidade"))
            or manifesto.get("uf") not in UFS or not _dia(manifesto.get("dataColeta"))
            or not _nome_csv(manifesto.get("nome")) or not _hash(manifesto.get("csvSha256"))
            or not _inteiro(manifesto.get("linhas")) or not _inteiro(publicacao.get("quantidade"))):
        return None
    for key, source in (("lote", "lote"), ("bairro", "bairro"), ("cidade", "cidade"),
                        ("uf", "uf"), ("data_coleta", "dataColeta"), ("quantidade", "linhas")):
        if publicacao.get(key) != manifesto[source]:
            return None
    for key in ("raizId", "pastaId", "arquivoId", "csvSha256"):
        if key in publicacao and publicacao[key] != manifesto[key]:
            return None
    if "sha256_matriz" in leitura and leitura["sha256_matriz"] != publicacao["sha256_matriz"]:
        return None
    return {"versao": 1, "lote": manifesto["lote"], "origemCsvSha256": manifesto["csvSha256"],
            "planilhaId": config["planilhaId"], "origemId": config["origemId"],
            "pastaId": manifesto["pastaId"], "arquivoOriginalId": manifesto["arquivoId"]}


def _contem_segredo(value, token):
    # Compare decoded strings: JSON escaping changes quotes/backslashes and
    # must not let a secret through to stdout or the persisted control.
    if isinstance(value, str):
        return token in value
    if isinstance(value, dict):
        return any(_contem_segredo(item, token) for item in value.values())
    if isinstance(value, (list, tuple)):
        return any(_contem_segredo(item, token) for item in value)
    return False


def _resultado_verificado(value, signal, token):
    """Select typed contract fields; never copy unknown server fields or errors."""
    if not isinstance(value, dict):
        return None
    if (type(value.get("versao")) is not int or value["versao"] != 1
            or value.get("estado") not in ("concluido", "ja_concluido")
            or value.get("lote") != signal["lote"]
            or value.get("origemCsvSha256") != signal["origemCsvSha256"]
            or not _texto(value.get("execucaoId"))):
        return None
    counts = ("empresasLidas", "empresasExportadas", "validos", "invalidos", "pendencias", "mensagensEnviadas")
    if not all(_inteiro(value.get(key)) for key in counts) or value["mensagensEnviadas"] != 0:
        return None
    if any(value[key] > value["empresasLidas"] for key in counts[1:]):
        return None
    arquivo = value.get("arquivoDrive")
    if (not isinstance(arquivo, dict) or not _id(arquivo.get("id"))
            or arquivo.get("pastaId") != signal["pastaId"]
            or arquivo.get("link") != "https://drive.google.com/file/d/" + arquivo["id"] + "/view"
            or not _nome_csv(arquivo.get("nome")) or not _hash(arquivo.get("csvSha256"))):
        return None
    result = {key: value[key] for key in ("versao", "estado", "lote", "origemCsvSha256", "execucaoId", *counts)}
    result["arquivoDrive"] = {key: arquivo[key] for key in ("id", "pastaId", "link", "nome", "csvSha256")}
    if _contem_segredo(result, token):
        return None
    return result


def _ler_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def _gravar_atomico(path, value):
    # Same filesystem, close before replace (Windows), flush before any POST.
    content = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", dir=path.parent, prefix=path.name + ".",
                                         suffix=".tmp", delete=False) as output:
            temporary = Path(output.name)
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


class _Ocupado(Exception):
    pass


@contextmanager
def _lock(config_path):
    # A persistent inode avoids unlink/recreate races. Kernel locks are released
    # on exit/crash; no PID age heuristics or deletion of another process's lock.
    path = Path(str(config_path) + ".lock")
    if path.is_symlink() or path.is_junction():
        raise OSError("lock_invalido")
    descriptor = os.open(path, os.O_RDWR | os.O_CREAT, 0o600)
    with os.fdopen(descriptor, "r+b", buffering=0) as output:
        if os.fstat(output.fileno()).st_size == 0:
            output.write(b"0")
        output.seek(0)
        try:
            if os.name == "nt":
                msvcrt.locking(output.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                fcntl.flock(output.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise _Ocupado() from None
        try:
            yield
        finally:
            output.seek(0)
            if os.name == "nt":
                msvcrt.locking(output.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(output.fileno(), fcntl.LOCK_UN)


def _postar(config, signal):
    """One direct HTTPS request, no redirects, retries or environment proxies."""
    parsed = urlsplit(config["url"])
    limit = config["timeoutSegundos"]
    deadline = time.monotonic() + limit
    connection = http.client.HTTPSConnection(parsed.hostname, port=parsed.port, timeout=limit)

    def restante():
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("tempo_esgotado")
        if connection.sock is not None:
            connection.sock.settimeout(remaining)

    try:
        connection.connect()
        restante()
        connection.request("POST", parsed.path, body=json.dumps(signal, ensure_ascii=False).encode("utf-8"),
                           headers={config["header"]: config["token"], "Content-Type": "application/json",
                                    "Accept": "application/json"})
        restante()
        response = connection.getresponse()
        if response.status != 200:
            # Do not read sensitive error bodies, including redirect locations.
            raise ValueError("resposta_http_nao_confirmada")
        chunks = []
        size = 0
        while True:
            restante()
            chunk = response.read1(min(8192, MAX_RESPOSTA + 1 - size))
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
            if size > MAX_RESPOSTA:
                raise ValueError("resposta_grande")
        restante()
        try:
            return json.loads(b"".join(chunks).decode("utf-8"))
        except (ValueError, UnicodeError):
            raise ValueError("resposta_json_invalida") from None
    finally:
        connection.close()


def _falha(motivo, estado="bloqueado"):
    return {"ok": False, "estado": estado, "motivo": motivo}


def _postar_com_prazo(config, signal):
    # Socket timeouts alone do not bound DNS/header trickling. The CLI waits for
    # one transport operation for at most the configured total time. A daemon
    # cannot keep the CLI alive after an uncertain result. It never writes the
    # receipt or retries, and a late response cannot change the persisted state.
    completed = threading.Event()
    received = []
    deadline = time.monotonic() + config["timeoutSegundos"]

    def request():
        try:
            if time.monotonic() < deadline:
                received.append(_postar(config, signal))
        except Exception:
            pass
        finally:
            completed.set()

    threading.Thread(target=request, daemon=True).start()
    if not completed.wait(max(0, deadline - time.monotonic())):
        raise TimeoutError("tempo_esgotado")
    if not received:
        raise ValueError("resposta_nao_confirmada")
    return received[0]


def _controle(signal, estado, resultado=None):
    control = {"versao": 1, "estado": estado, "sinal": signal,
               "atualizadoEm": datetime.now(timezone.utc).isoformat()}
    if resultado is not None:
        control["resultado"] = resultado
    return control


def _executar(publicacao_path, config_path, reconciliar):
    config_path = Path(config_path).resolve()
    config = _ler_json(config_path)
    if not _config_valida(config):
        return _falha("configuracao_invalida")
    publicacao_path = Path(publicacao_path).absolute()
    if publicacao_path.is_symlink() or publicacao_path.is_junction():
        return _falha("comprovante_invalido")
    with _lock(config_path):
        publicacao = _ler_json(publicacao_path)
        signal = _sinal(publicacao, config)
        if signal is None or _contem_segredo(signal, config["token"]):
            return _falha("publicacao_nao_conferida")
        control = publicacao.get("workflow_automatico")
        if "workflow_automatico" in publicacao:
            if (not isinstance(control, dict) or type(control.get("versao")) is not int
                    or control["versao"] != 1 or control.get("sinal") != signal):
                return _falha("controle_divergente_requer_intervencao")
            if control.get("estado") not in ("iniciado", "incerto", "concluido"):
                return _falha("controle_divergente_requer_intervencao")
        if reconciliar is not None:
            result = _resultado_verificado(_ler_json(reconciliar), signal, config["token"])
            if result is None:
                return _falha("reconciliacao_invalida")
            publicacao["workflow_automatico"] = _controle(signal, "concluido", result)
            _gravar_atomico(publicacao_path, publicacao)
            return {"ok": True, "estado": "concluido", "resultado": result}
        if control is not None:
            if control["estado"] != "concluido":
                return _falha("reconciliacao_necessaria", control["estado"])
            result = _resultado_verificado(control.get("resultado"), signal, config["token"])
            if result is None:
                return _falha("resultado_salvo_invalido")
            return {"ok": True, "estado": "concluido", "resultado": result}
        publicacao["workflow_automatico"] = _controle(signal, "iniciado")
        _gravar_atomico(publicacao_path, publicacao)
        try:
            result = _resultado_verificado(_postar_com_prazo(config, signal), signal, config["token"])
        except Exception:
            # No exception text, headers or arbitrary response body leaves here.
            result = None
        if result is None:
            publicacao["workflow_automatico"] = _controle(signal, "incerto")
            try:
                _gravar_atomico(publicacao_path, publicacao)
            except (OSError, ValueError):
                pass  # Durable 'iniciado' already blocks another POST.
            return _falha("resposta_nao_confirmada_reconciliar", "incerto")
        publicacao["workflow_automatico"] = _controle(signal, "concluido", result)
        try:
            _gravar_atomico(publicacao_path, publicacao)
        except (OSError, ValueError):
            return _falha("resultado_nao_persistido_reconciliar", "incerto")
        return {"ok": True, "estado": "concluido", "resultado": result}


class _Argumentos(argparse.ArgumentParser):
    def error(self, message):
        raise ValueError("argumentos_invalidos")


def main(argv=None):
    parser = _Argumentos(description="Dispara publicação conferida uma vez, ou reconcilia sem enviar POST.")
    parser.add_argument("--publicacao", required=True, help="Comprovante publicacao_sheets.json")
    parser.add_argument("--config", required=True, help="Configuração privada .workflow-prospeccao.local.json")
    parser.add_argument("--reconciliar", help="Resultado JSON conferido em Sheets e Drive; não envia POST")
    try:
        args = parser.parse_args(argv)
    except ValueError:
        result = _falha("argumentos_invalidos")
    else:
        try:
            result = _executar(args.publicacao, args.config, args.reconciliar)
        except _Ocupado:
            result = _falha("cliente_em_uso")
        except (ValueError, UnicodeError, TypeError):
            result = _falha("arquivo_ou_configuracao_invalida")
        except (OSError, RuntimeError):
            result = _falha("falha_arquivo_local_preservar_e_reconciliar")
    sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
