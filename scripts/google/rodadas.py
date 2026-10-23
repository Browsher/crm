"""Seleção de lotes finitos; nenhuma coleta ou validação ao importar."""
import argparse
import json
import re
import uuid
from pathlib import Path


def identidades(empresa):
    chaves = set()
    place = empresa.get('google_place_id') or empresa.get('place_id')
    if isinstance(place, str) and 0 < len(place.strip()) <= 255:
        chaves.add(place.strip())
    cnpj = empresa.get('cnpj')
    if isinstance(cnpj, str) and re.fullmatch(r'[0-9A-Z]{14}', cnpj):
        chaves.add('cnpj:' + cnpj)
    return chaves


def selecionar_lote(candidatas, vistas, restante):
    if type(restante) is not int or not 0 <= restante <= 150:
        raise ValueError('Orçamento restante inválido.')
    selecionadas = []
    conhecidas = set(vistas)
    for empresa in candidatas:
        if len(selecionadas) >= min(50, restante):
            break
        ids = identidades(empresa)
        if not ids or ids.intersection(conhecidas):
            continue
        selecionadas.append(empresa)
        conhecidas.update(ids)
    return selecionadas


def decidir_continuacao(entregues, analisadas, lotes, novidades):
    if any(type(n) is not int or n < 0 for n in (entregues, analisadas, lotes, novidades)) or entregues > 50 or analisadas > 150 or lotes > 3:
        raise ValueError('Contadores inválidos. Reconcilie a execução com o CRM.')
    if entregues >= 50:
        return 'meta_atingida'
    if analisadas >= 150 or lotes >= 3:
        return 'limite_lotes'
    if novidades == 0:
        return 'sem_resultados' if not lotes else 'sem_novidades'
    return 'continuar'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('acao', choices=('selecionar', 'decidir'))
    parser.add_argument('--candidatas')
    parser.add_argument('--vistas')
    parser.add_argument('--restante', type=int)
    parser.add_argument('--saida')
    for campo in ('entregues', 'analisadas', 'lotes', 'novidades'):
        parser.add_argument('--' + campo, type=int)
    args = parser.parse_args()
    if args.acao == 'decidir':
        print(decidir_continuacao(args.entregues, args.analisadas, args.lotes, args.novidades))
        return
    if not args.candidatas or not args.saida or args.restante is None:
        parser.error('selecionar exige --candidatas, --restante e --saida')
    dados = json.loads(Path(args.candidatas).read_text(encoding='utf-8-sig'))
    vistas = json.loads(Path(args.vistas).read_text(encoding='utf-8-sig')) if args.vistas else []
    lote = selecionar_lote(dados['all'] if isinstance(dados, dict) else dados, vistas, args.restante)
    if not lote:
        print(json.dumps({'novidades': 0}))
        return
    saida = Path(args.saida)
    if saida.exists():
        anterior = json.loads(saida.read_text(encoding='utf-8-sig'))
        if anterior.get('candidatas') != lote:
            raise ValueError('Lote existente diverge. Preserve a reserva e os arquivos.')
    else:
        temporario = saida.with_suffix(saida.suffix + '.tmp')
        temporario.write_text(json.dumps({'lote_id': str(uuid.uuid4()), 'candidatas': lote}, ensure_ascii=False, indent=2), encoding='utf-8')
        temporario.replace(saida)
    print(str(saida))


if __name__ == '__main__':
    main()
