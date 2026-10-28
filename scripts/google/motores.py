"""Registro confiável e locks de processo para os motores locais."""
from contextlib import contextmanager
import json
import os
import time
from pathlib import Path

REGISTRO = Path(__file__).with_name('motores.json')
RAIZ_ESTADO = Path(__file__).resolve().parents[2]/'.google-agente'
IMAGEM = 'gosom/google-maps-scraper@sha256:e205c02913c5a69c16fc2094b8e5b194a2f655166d2c1126d50548d216e6b1b2'
PADROES = [('01','gmaps-mooca-prospeccao',8087,'.google-agente','mooca-prospeccao_gmaps_data'),
    ('02','gmaps-crm-motor-02',8088,'.google-agente/slots/02','crm_google_motor02_data'),
    ('03','gmaps-crm-motor-03',8089,'.google-agente/slots/03','crm_google_motor03_data')]

def carregar_motor(motor_id='01'):
    r = json.loads(REGISTRO.read_text(encoding='utf-8'))
    if r.get('versao') != 1 or r.get('imagem') != IMAGEM or r.get('volumeCache') != 'mooca-prospeccao_gmaps_cache' or r.get('recursos') != {'memoriaMiB':2048,'swapTotalMiB':2560,'cpus':2,'pids':512,'shmMiB':64} or not isinstance(r.get('motores'),list) or len(r['motores']) != 3:
        raise ValueError('Registro de motores divergente.')
    for m, (identidade,container,porta,pasta,volume) in zip(r['motores'],PADROES):
        if any(m.get(k) != v for k,v in {'id':identidade,'container':container,'origem':'http://127.0.0.1:'+str(porta),'pastaEstado':pasta,'volumeDados':volume}.items()):
            raise ValueError('Motor fora da configuração revisada.')
    for m in r['motores']:
        if m['id'] == motor_id:
            return dict(m)
    raise ValueError('Motor fora do registro.')

@contextmanager
def _travar(caminho,esperar=False):
    caminho=Path(caminho)
    caminho.parent.mkdir(parents=True,exist_ok=True)
    with caminho.open('a+b') as arquivo:
        if arquivo.seek(0,2) == 0:
            arquivo.write(b'0');arquivo.flush()
        arquivo.seek(0)
        limite=time.monotonic()+90
        while True:
            try:
                if os.name == 'nt':
                    import msvcrt
                    msvcrt.locking(arquivo.fileno(),msvcrt.LK_NBLCK,1)
                else:
                    import fcntl
                    fcntl.flock(arquivo.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
                break
            except OSError as erro:
                if not esperar or time.monotonic()>=limite:
                    raise RuntimeError('Motor, execução ou geocodificador em uso. Preserve a identidade.') from erro
                time.sleep(.1)
        try:
            yield
        finally:
            arquivo.seek(0)
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(arquivo.fileno(),msvcrt.LK_UNLCK,1)
            else:
                import fcntl
                fcntl.flock(arquivo.fileno(),fcntl.LOCK_UN)
def travar_motor(motor,pasta_estado=RAIZ_ESTADO):
    identidade=motor.get('id')
    if identidade not in ('01','02','03'):
        raise ValueError('Identidade de motor inválida.')
    return _travar(Path(pasta_estado)/'locks'/('motor-'+identidade+'.lock'))

def travar_execucao(pasta):
    return _travar(Path(pasta)/'coleta.lock')
def travar_geocodificacao(pasta_estado=RAIZ_ESTADO):
    return _travar(Path(pasta_estado)/'locks'/'geocodificacao.lock',esperar=True)

def geocodificar_com_cache(regiao,consultar,pasta_estado=RAIZ_ESTADO,agora=time.time,esperar=time.sleep):
    chave=' '.join(regiao.split()).casefold()
    with travar_geocodificacao(pasta_estado):
        arquivo=Path(pasta_estado)/'geocodificacao.json'
        cache=json.loads(arquivo.read_text(encoding='utf-8')) if arquivo.exists() else {'versao':1,'ultima_consulta':0,'coordenadas':{}}
        if cache.get('versao') != 1 or type(cache.get('ultima_consulta')) not in (int,float) or not isinstance(cache.get('coordenadas'),dict):
            raise RuntimeError('Cache de localização divergente. Preserve-o para conferência.')
        if chave in cache['coordenadas']:
            return tuple(cache['coordenadas'][chave])
        instante=agora()
        if cache['ultima_consulta']>instante:
            raise RuntimeError('Relógio anterior à última consulta. Confira antes de continuar.')
        intervalo=16-(instante-cache['ultima_consulta'])
        if cache['ultima_consulta'] and intervalo>0:
            esperar(intervalo)
        def salvar():
            temporario=arquivo.with_suffix('.json.tmp')
            temporario.write_text(json.dumps(cache,ensure_ascii=False),encoding='utf-8')
            temporario.replace(arquivo)
        cache['ultima_consulta']=agora()
        salvar()
        coordenadas=consultar(regiao)
        if coordenadas:
            cache['coordenadas'][chave]=list(coordenadas)
            salvar()
            return tuple(coordenadas)
        return None