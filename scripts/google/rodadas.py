"""Seleção de lotes finitos; nenhuma coleta ou validação ao importar."""
import argparse
import json
import re
import uuid
import math
import unicodedata
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


def priorizar(candidatas, criterios):
    def texto(v):
        return ''.join(c for c in unicodedata.normalize('NFKD', str(v).casefold()) if not unicodedata.combining(c))
    prioridades = texto(criterios.get('prioridades', ''))
    palavras = set(re.findall(r'\w{4,}', prioridades)) - {'mais', 'maior', 'menos', 'priorizar', 'empresas'}
    def numero(v):
        try:
            n = float(v)
            return n if math.isfinite(n) else -1
        except (ValueError, TypeError):
            return -1
    def pontuacao(e):
        bruto = e.get('dados_brutos', {})
        publicado = texto(' '.join(str(e.get(k, '')) for k in ('nome_fantasia','categoria','endereco','site')) + ' ' + str(bruto.get('descriptions', '')))
        return (
            int(criterios.get('situacao') == 'priorizar_funcionamento' and str(e.get('situacao_google', '')).lower() in ('open','operational','em funcionamento')),
            int(criterios.get('atendimento') == 'priorizar_fisica' and bool(e.get('endereco'))),
            numero(bruto.get('review_count')) if 'avaliac' in prioridades else 0,
            numero(bruto.get('review_rating')) if 'nota' in prioridades else 0,
            sum(p in publicado for p in palavras),
        )
    return sorted(candidatas, key=pontuacao, reverse=True)


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


def resumir_pool(candidatas, vistas, inicio_ultima):
    if not isinstance(candidatas, list) or not all(isinstance(e, dict) for e in candidatas) or not isinstance(vistas, (list, set, tuple)) or not all(isinstance(v, str) for v in vistas) or type(inicio_ultima) is not int or not 0 <= inicio_ultima <= len(candidatas):
        raise ValueError('Resumo do pool inválido.')
    conhecidas = set()
    for e in candidatas[:inicio_ultima]:
        conhecidas.update(identidades(e))
    novas = 0
    for e in candidatas[inicio_ultima:]:
        ids = identidades(e)
        if ids and not ids.intersection(conhecidas):
            novas += 1
        conhecidas.update(ids)
    return {'disponiveis': len(selecionar_lote(candidatas, vistas, 150)), 'novas': novas}


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
    parser.add_argument('acao', choices=('selecionar', 'decidir', 'resumo'))
    parser.add_argument('--candidatas')
    parser.add_argument('--vistas')
    parser.add_argument('--restante', type=int)
    parser.add_argument('--saida')
    parser.add_argument('--inicio-ultima', type=int)
    for campo in ('entregues', 'analisadas', 'lotes', 'novidades'):
        parser.add_argument('--' + campo, type=int)
    args = parser.parse_args()
    if args.acao == 'decidir':
        print(decidir_continuacao(args.entregues, args.analisadas, args.lotes, args.novidades))
        return
    if args.acao == 'resumo':
        if not args.candidatas or not args.vistas:
            parser.error('resumo exige --candidatas e --vistas')
        dados = json.loads(Path(args.candidatas).read_text(encoding='utf-8-sig'))
        vistas = json.loads(Path(args.vistas).read_text(encoding='utf-8-sig'))
        print(json.dumps(resumir_pool(dados['all'], vistas, args.inicio_ultima if args.inicio_ultima is not None else dados.get('inicio_ultima', 0))))
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
