"""Consultas geográficas determinísticas; nenhum acesso externo ao importar."""
import math
from urllib.parse import quote

AREAS = (
    ((0, 0), (1, 0), (0, 1), (-1, 0)),
    ((0, -1), (1, 1), (-1, 1), (-1, -1)),
    ((1, -1), (2, 0), (0, 2), (-2, 0)),
)


def opcao_booleana(config, chave, padrao):
    valor = config.get(chave, padrao)
    if type(valor) is not bool:
        raise ValueError('Opção operacional precisa ser booleana: ' + chave)
    return valor


def areas_ativas(pedido, config):
    if pedido.get('contrato') != 2:
        return False
    return opcao_booleana(config, 'coleta_por_areas', False) and not pedido.get('bairro', '').strip()


def gerar_consultas(termo, coordenadas, raio, rodada):
    if type(rodada) is not int or rodada not in (1, 2, 3):
        raise ValueError('Rodada fora do orçamento.')
    if type(raio) not in (int, float) or not math.isfinite(raio) or not 0 < raio <= 500000:
        raise ValueError('Raio operacional inválido.')
    try:
        lat, lon = (float(v) for v in coordenadas[:2])
    except (ValueError, TypeError):
        raise ValueError('Coordenadas inválidas.') from None
    if not math.isfinite(lat) or not math.isfinite(lon) or not -85 <= lat <= 85 or not -180 <= lon <= 180:
        raise ValueError('Coordenadas inválidas.')
    passo = min(raio / 3, 3000)
    urls = []
    for norte, leste in AREAS[rodada - 1]:
        centro_lat = lat + norte * passo / 111320
        centro_lon = lon + leste * passo / (111320 * math.cos(math.radians(lat)))
        if not -85 <= centro_lat <= 85 or not -180 <= centro_lon <= 180:
            raise ValueError('Área fora dos limites de coordenadas.')
        urls.append('https://www.google.com/maps/search/' + quote(termo, safe='') + '/@%.6f,%.6f,15z' % (centro_lat, centro_lon))
    if len(set(urls)) != 4:
        raise ValueError('Raio insuficiente para distinguir as áreas.')
    return urls


def conferir_consultas(pedido, termo, meta):
    request = meta.get('request')
    if not isinstance(request, dict):
        raise RuntimeError('Request salvo divergente. Preserve a intenção.')
    versao = meta.get('consulta_versao')
    if versao is None and request.get('keywords') == [termo]:
        return
    try:
        if type(versao) is not int or versao != 1 or pedido.get('contrato') != 2 or pedido.get('bairro', '').strip() or request.get('zoom') != 15:
            raise ValueError()
        esperado = gerar_consultas(termo, (request['lat'], request['lon']), request['radius'], pedido.get('rodada', 1))
        if request.get('keywords') != esperado:
            raise ValueError()
    except (ValueError, TypeError, KeyError):
        raise RuntimeError('Consultas salvas divergentes. Preserve a intenção e o job.') from None
