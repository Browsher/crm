"""Read final CSVs independently and reconcile them with original full downloads."""
import csv
import hashlib
import io
import json
import sys
import unicodedata
from pathlib import Path

def normal(value):
    return " ".join(unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower().split())

folder=Path(sys.argv[1]).resolve()
data=json.loads((folder/'dados_preparados.json').read_text(encoding='utf-8'))
job=json.loads((folder/'job.json').read_text(encoding='utf-8'))
report=json.loads((folder/'resumo.json').read_text(encoding='utf-8'))
sources=json.loads((folder/'fontes_sites.json').read_text(encoding='utf-8'))
payload=(folder/'bruto_original_full.csv').read_bytes()
assert hashlib.sha256(payload).hexdigest()==job['sha256'],'Download original alterado'
original=list(csv.DictReader(io.StringIO(payload.decode('utf-8-sig'))))
counts={}
parsed={}
for filename,expected,fields in [('empresas_novas.csv',data['selected'],data['fields']),('empresas_sinalizadas.csv',data['all'],data['fields']),('bruto_completo.csv',data['raw_rows'],data['raw_fields'])]:
    raw=(folder/filename).read_bytes()
    assert raw.startswith(b'\xef\xbb\xbf'),'UTF-8 BOM ausente'
    text=raw.decode('utf-8-sig')
    assert '\ufffd' not in text,'Caractere substituído'
    actual=list(csv.DictReader(io.StringIO(text)))
    assert len(actual)==len(expected)
    assert all(all(row[field]==str(source.get(field,'')) for field in fields) for row,source in zip(actual,expected)),'Exportação divergiu das fontes'
    counts[filename]={'registros':len(actual),'sha256':hashlib.sha256(raw).hexdigest()}
    parsed[filename]=actual
raw_rows=parsed['bruto_completo.csv']
assert len(original)==len(raw_rows)==report['registros_brutos']
for raw,augmented in zip(original,raw_rows):
    assert all(augmented[field]==value for field,value in raw.items()),'Campo bruto alterado'
chosen=parsed['empresas_novas.csv']
all_rows=parsed['empresas_sinalizadas.csv']
identity=lambda row:row['place_id'] or row['cid'] or row['data_id'] or (row['nome_empresa'],row['endereco'])
assert len({identity(row) for row in all_rows})==len(all_rows)
assert sum(int(row['ocorrencias_brutas']) for row in all_rows)==len(original)
assert len(chosen)<=report['meta'] and len(chosen)==report['novas_selecionadas']
for row in chosen:
    assert row['bairro']==report['bairro'] and normal(row['cidade'])==normal(report.get('cidade','São Paulo'))
    assert row['perfil'] not in {'A conferir','Fora do perfil'}
    assert row['situacao_empresa']!='Fechamento sinalizado no Maps'
    assert row['termo_pesquisado'] and row['data_coleta']==report['data']
    if row['email']:
        source=next(s for s in sources.values() if s['url']==row['fonte_email'])
        assert all(email in source['emails'] for email in row['email'].split('; '))
result={'resultado':'Conferência aprovada','bairro':report['bairro'],'empresas_selecionadas':len(chosen),'com_telefone':sum(bool(r['telefone']) for r in chosen),'com_email':sum(bool(r['email']) for r in chosen),'arquivos':counts,'checks':['Download original por SHA-256','Todos os campos brutos reconciliados','CSV UTF-8 com BOM','IDs e coordenadas preservados','Deduplicação e ocorrências reconciliadas','Bairro exato, perfil e limite','Fontes dos e-mails']}
(folder/'verificacao.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
