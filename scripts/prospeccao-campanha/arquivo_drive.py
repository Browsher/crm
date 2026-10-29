"""Archive the exact verified Sheets matrix locally, without network or campaign state.

CLI success writes {ok: true, comprovante: {...}} to stdout. Validation/conflict
errors write {ok: false, motivo: ...} to stderr (exit 2); I/O errors use exit 1.
The receipt beside the CSV is local metadata, before any Drive publication.
"""
import argparse
import codecs
import csv
import hashlib
import io
import json
import re
import sys
import unicodedata
from datetime import date, time
from pathlib import Path

UFS = frozenset("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split())


def _erro_matriz(matriz):
    if not isinstance(matriz, list):
        return "Matriz deve ser uma lista de linhas."
    if not matriz:
        return "Matriz deve conter um cabeçalho."
    if not isinstance(matriz[0], list):
        return "Linha 1 da matriz deve ser uma lista."
    if not matriz[0]:
        return "Cabeçalho vazio."
    largura = len(matriz[0])
    for numero, linha in enumerate(matriz, start=1):
        if not isinstance(linha, list):
            return f"Linha {numero} da matriz deve ser uma lista."
        if len(linha) != largura:
            return f"Linha {numero} da matriz tem largura diferente do cabeçalho."
        for coluna, valor in enumerate(linha, start=1):
            if not isinstance(valor, str):
                return f"Linha {numero}, coluna {coluna}: valor deve ser string."
            try:
                valor.encode("utf-8")
            except UnicodeEncodeError:
                return f"Linha {numero}, coluna {coluna}: texto Unicode inválido."
    cabecalhos = set()
    for coluna, valor in enumerate(matriz[0], start=1):
        normalizado = valor.strip().casefold()
        if not normalizado:
            return f"Cabeçalho vazio na coluna {coluna}."
        if normalizado in cabecalhos:
            return f"Cabeçalho duplicado na coluna {coluna}."
        cabecalhos.add(normalizado)
    return None


def _erro_contexto(bairro, cidade, uf, data_coleta, horario, lote):
    for campo, valor in (("Bairro", bairro), ("Cidade", cidade), ("Lote", lote)):
        if not isinstance(valor, str) or not valor.strip():
            return f"{campo} deve ser informado explicitamente."
        try:
            valor.encode("utf-8")
        except UnicodeEncodeError:
            return f"{campo} contém texto Unicode inválido."
    if uf not in UFS:
        return "UF deve ser uma sigla brasileira válida em maiúsculas."
    if not isinstance(data_coleta, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", data_coleta):
        return "Data da coleta deve ser explícita no formato AAAA-MM-DD."
    try:
        date.fromisoformat(data_coleta)
    except ValueError:
        return "Data da coleta deve ser uma data válida."
    if not isinstance(horario, str) or not re.fullmatch(r"[0-9]{2}:[0-9]{2}:[0-9]{2}", horario):
        return "Horário da coleta deve ser explícito no formato HH:MM:SS."
    try:
        time(*(int(part) for part in horario.split(":")))
    except ValueError:
        return "Horário da coleta deve ser válido."
    return None


def _nome_seguro(valor):
    # Escape '%' too: literal '%2F' must never collide with an escaped slash.
    # Escape every component hyphen, including edges: folder boundaries belong
    # only to the template, never to a dynamic neighborhood, city or batch ID.
    partes = []
    for caractere in valor:
        if caractere in '%-<>:"/\\|?*' or unicodedata.category(caractere) in ("Cc", "Cf", "Zl", "Zp"):
            partes.extend(f"%{byte:02X}" for byte in caractere.encode("utf-8"))
        else:
            partes.append(caractere)
    return "".join(partes)


def _erro_destino(caminho, conteudo, descricao, raiz):
    if not caminho.resolve().is_relative_to(raiz):
        return "Destino deve permanecer dentro da pasta de saída."
    if caminho.is_symlink() or caminho.is_junction():
        return f"{descricao} existente é um link; saída recusada."
    if caminho.exists():
        if not caminho.is_file() or caminho.read_bytes() != conteudo:
            return f"{descricao} existente divergente; nenhum arquivo foi substituído."
    return None


def gerar_arquivo(matriz, *, bairro, cidade, uf, data_coleta, horario, lote, saida):
    """Return an explicit result; invalid data never creates output directories.

    Strings and columns are already checked by the calling agent. This helper
    validates structure only: it never maps leads, normalizes phones or drops
    extra columns. I/O exceptions are infrastructure failures handled by the CLI.
    """
    erro = _erro_matriz(matriz) or _erro_contexto(bairro, cidade, uf, data_coleta, horario, lote)
    if erro:
        return {"ok": False, "motivo": erro}

    texto = io.StringIO(newline="")
    csv.writer(texto, delimiter=",", quoting=csv.QUOTE_ALL, lineterminator="\r\n").writerows(matriz)
    conteudo = codecs.BOM_UTF8 + texto.getvalue().encode("utf-8")
    nome_pasta = f"{data_coleta} - {_nome_seguro(bairro)} - {_nome_seguro(cidade)}-{uf}"
    nome = f"planilha original scraping - {data_coleta}_{horario.replace(':', '-')} - lote-{_nome_seguro(lote)}.csv"
    raiz = Path(saida).resolve()
    pasta = raiz / nome_pasta
    if not pasta.resolve().is_relative_to(raiz):
        return {"ok": False, "motivo": "Destino deve permanecer dentro da pasta de saída."}
    if pasta.is_symlink() or pasta.is_junction():
        return {"ok": False, "motivo": "Pasta de saída da coleta não pode ser um link."}
    caminho = pasta / nome
    caminho_comprovante = caminho.with_suffix(".json")
    comprovante = {
        "nomePasta": nome_pasta,
        "nome": nome,
        "csvSha256": hashlib.sha256(conteudo).hexdigest(),
        "tamanhoBytes": len(conteudo),
        "linhas": len(matriz) - 1,
        "bairro": bairro,
        "cidade": cidade,
        "uf": uf,
        "dataColeta": data_coleta,
        "lote": lote,
        "caminho": str(caminho),
        "caminhoComprovante": str(caminho_comprovante),
    }
    conteudo_comprovante = (json.dumps(comprovante, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    arquivos = ((caminho, conteudo, "CSV"),
                (caminho_comprovante, conteudo_comprovante, "Comprovante"))

    # Check both artifacts before creating either: a divergent receipt also blocks
    # a missing CSV. An interrupted pair can later resume from identical bytes.
    for destino, dados, descricao in arquivos:
        erro = _erro_destino(destino, dados, descricao, raiz)
        if erro:
            return {"ok": False, "motivo": erro}
    pasta.mkdir(parents=True, exist_ok=True)
    for destino, dados, descricao in arquivos:
        erro = _erro_destino(destino, dados, descricao, raiz)
        if erro:
            return {"ok": False, "motivo": erro}
        try:
            with destino.open("xb") as arquivo:
                arquivo.write(dados)
        except FileExistsError:
            erro = _erro_destino(destino, dados, descricao, raiz)
            if erro:
                return {"ok": False, "motivo": erro}
    return {"ok": True, "comprovante": comprovante}


class _Argumentos(argparse.ArgumentParser):
    def error(self, message):
        # argparse's message can contain arbitrary argv values. Keep diagnostics
        # independent from data, paths or possible secrets passed by mistake.
        sys.stderr.write(json.dumps({"ok": False, "motivo": "Argumentos inválidos ou obrigatórios ausentes; consulte --help."}, ensure_ascii=False) + "\n")
        raise SystemExit(2)


def main(argv=None):
    parser = _Argumentos(description="Gera CSV e comprovante locais da matriz já conferida; não acessa a rede.")
    parser.add_argument("--matriz", required=True, help="JSON contendo a matriz retangular de strings, incluindo o cabeçalho")
    parser.add_argument("--bairro", required=True)
    parser.add_argument("--cidade", required=True)
    parser.add_argument("--uf", required=True)
    parser.add_argument("--data-coleta", required=True, help="Data da coleta em São Paulo: AAAA-MM-DD")
    parser.add_argument("--horario", required=True, help="Horário explícito da coleta em São Paulo: HH:MM:SS")
    parser.add_argument("--lote", required=True, help="Identificador estável da coleta; reutilizar na retomada")
    parser.add_argument("--saida", required=True, help="Pasta local sob a qual serão criados os dois artefatos")
    args = parser.parse_args(argv)
    try:
        matriz = json.loads(Path(args.matriz).read_text(encoding="utf-8-sig"))
    except (json.JSONDecodeError, UnicodeError):
        resultado = {"ok": False, "motivo": "Arquivo da matriz deve conter JSON válido em UTF-8."}
        codigo = 2
    except OSError:
        resultado = {"ok": False, "motivo": "Não foi possível ler o arquivo JSON da matriz."}
        codigo = 1
    else:
        try:
            resultado = gerar_arquivo(matriz, bairro=args.bairro, cidade=args.cidade, uf=args.uf,
                                      data_coleta=args.data_coleta, horario=args.horario,
                                      lote=args.lote, saida=args.saida)
            codigo = 0 if resultado["ok"] else 2
        except (OSError, RuntimeError):
            resultado = {"ok": False, "motivo": "Não foi possível conferir ou gravar os arquivos locais; preserve a saída e retome após corrigir o acesso."}
            codigo = 1
    destino = sys.stdout if resultado["ok"] else sys.stderr
    destino.write(json.dumps(resultado, ensure_ascii=False) + "\n")
    return codigo


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
