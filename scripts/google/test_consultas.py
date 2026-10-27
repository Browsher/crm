import math
import unittest
from urllib.parse import urlparse, unquote
from consultas import gerar_consultas, conferir_consultas, areas_ativas

class ConsultasTest(unittest.TestCase):
    def test_grade_e_deterministica_limitada_ao_raio_e_literal(self):
        termo='Loja & bazar / $() São Paulo SP'
        urls=[]
        for rodada in (1,2,3):
            atual=gerar_consultas(termo,(-23.55,-46.63),2500,rodada)
            self.assertEqual(atual,gerar_consultas(termo,(-23.55,-46.63),2500,rodada))
            for u in atual:
                p=urlparse(u)
                self.assertEqual(p.scheme,'https');self.assertEqual(p.netloc,'www.google.com')
                self.assertEqual(unquote(p.path.split('/@')[0]),'/maps/search/'+termo)
                lat,lon,_=p.path.split('/@')[1].split(',')
                norte=(float(lat)+23.55)*111320
                leste=(float(lon)+46.63)*111320*math.cos(math.radians(-23.55))
                self.assertLessEqual(math.hypot(norte,leste),2501)
            urls.extend(atual)
        self.assertEqual(len(set(urls)),12)

    def test_recusa_parametros_invalidos(self):
        for raio in (0,-1,True,float('inf'),500001):
            with self.assertRaises(ValueError):gerar_consultas('Loja',(0,0),raio,1)
        for rodada in (0,4,True,'1'):
            with self.assertRaises(ValueError):gerar_consultas('Loja',(0,0),2500,rodada)
        for coords in ((91,0),(0,181),(float('nan'),0)):
            with self.assertRaises(ValueError):gerar_consultas('Loja',coords,2500,1)

    def test_v1_ignora_optin_e_default_nao_expande(self):
        self.assertFalse(areas_ativas({'contrato':1,'bairro':''},{'coleta_por_areas':True}))
        self.assertFalse(areas_ativas({'contrato':2,'bairro':''},{}))
        self.assertFalse(areas_ativas({'contrato':2,'bairro':'Brás'},{'coleta_por_areas':True}))

    def test_versao_corpo_ou_area_divergente_recusados(self):
        p={'contrato':2,'bairro':'','rodada':1}
        body={'keywords':gerar_consultas('Loja SP',(-23.5,-46.6),2500,1),'lat':'-23.5','lon':'-46.6','radius':2500,'zoom':15}
        conferir_consultas(p,'Loja SP',{'request':body,'consulta_versao':1})
        for meta in ({'request':body},{'request':body,'consulta_versao':True},{'request':dict(body,keywords=body['keywords'][:1]),'consulta_versao':1}):
            with self.assertRaises(RuntimeError):conferir_consultas(p,'Loja SP',meta)
