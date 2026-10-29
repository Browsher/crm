import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from motores import carregar_motor, travar_motor, travar_execucao, travar_geocodificacao, geocodificar_com_cache

class MotoresTest(unittest.TestCase):
    def test_motor_fora_do_registro_nao_chega_ao_http(self):
        with self.assertRaises(ValueError):
            carregar_motor('04')
        for motor, porta in [('01',8087),('02',8088),('03',8089)]:
            self.assertEqual(carregar_motor(motor)['origem'], 'http://127.0.0.1:'+str(porta))

    def test_tres_processos_entram_em_motores_diferentes_mas_mesmo_motor_e_execucao_bloqueiam(self):
        codigo = """
import pathlib,sys,time
from motores import carregar_motor,travar_motor,travar_execucao
pasta=pathlib.Path(sys.argv[2])
try:
 with travar_motor(carregar_motor(sys.argv[1]),pasta):
  with travar_execucao(pasta/sys.argv[4]):
   (pasta/(sys.argv[1]+'.pronto')).write_text('ok')
   limite=time.monotonic()+8
   while not (pasta/'liberar').exists() and time.monotonic()<limite:time.sleep(.02)
except RuntimeError:
 sys.exit(9)
"""
        with tempfile.TemporaryDirectory() as temp:
            pasta=Path(temp)
            env=dict(os.environ,PYTHONPATH=str(Path(__file__).parent),PYTHONDONTWRITEBYTECODE='1')
            processos=[]
            try:
                for motor in ['01','02','03']:
                    processos.append(subprocess.Popen([sys.executable,'-B','-c',codigo,motor,temp,'ignorado','execucao-'+motor],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE))
                limite=time.monotonic()+5
                while len(list(pasta.glob('*.pronto')))<3 and time.monotonic()<limite:time.sleep(.02)
                self.assertEqual(len(list(pasta.glob('*.pronto'))),3)
                repetido=subprocess.run([sys.executable,'-B','-c',codigo,'02',temp,'ignorado','outra-execucao'],env=env,capture_output=True,timeout=3)
                self.assertEqual(repetido.returncode,9,repetido.stderr)
                with self.assertRaises(RuntimeError):
                    with travar_execucao(pasta/'execucao-01'):pass
                (pasta/'liberar').write_text('ok')
                for processo in processos:self.assertEqual(processo.wait(timeout=3),0)
                with travar_motor(carregar_motor('02'),pasta):pass
            finally:
                for processo in processos:
                    if processo.poll() is None:processo.terminate();processo.wait(timeout=3)
                    if processo.stderr:processo.stderr.close()

    def test_geocodificacao_espera_outro_processo_sem_liberar_coleta_duplicada(self):
        with tempfile.TemporaryDirectory() as temp:
            pasta=Path(temp)
            codigo="from motores import travar_geocodificacao; from pathlib import Path; import sys; p=Path(sys.argv[1]);(p/'tentou').write_text('ok');\nwith travar_geocodificacao(p): (p/'entrou').write_text('ok')"
            env=dict(os.environ,PYTHONPATH=str(Path(__file__).parent),PYTHONDONTWRITEBYTECODE='1')
            with travar_geocodificacao(pasta):
                filho=subprocess.Popen([sys.executable,'-B','-c',codigo,temp],env=env)
                try:
                    limite=time.monotonic()+3
                    while not (pasta/'tentou').exists() and time.monotonic()<limite:time.sleep(.01)
                    self.assertTrue((pasta/'tentou').exists())
                    self.assertFalse((pasta/'entrou').exists())
                    self.assertIsNone(filho.poll())
                except BaseException:
                    filho.terminate();filho.wait(timeout=3);raise
            self.assertEqual(filho.wait(timeout=3),0)
            self.assertTrue((pasta/'entrou').exists())

    def test_cache_reutiliza_regiao_e_espaca_consultas_novas(self):
        with tempfile.TemporaryDirectory() as temp:
            pasta=Path(temp)
            tempo=[100.0]
            chamadas=[]
            def consultar(regiao):
                chamadas.append((regiao,tempo[0]))
                return ('-23.5','-46.6')
            def esperar(segundos):tempo[0]+=segundos
            self.assertEqual(geocodificar_com_cache('Brás, São Paulo',consultar,pasta,lambda:tempo[0],esperar),('-23.5','-46.6'))
            self.assertEqual(geocodificar_com_cache('brás, são paulo',consultar,pasta,lambda:tempo[0],esperar),('-23.5','-46.6'))
            geocodificar_com_cache('Sé, São Paulo',consultar,pasta,lambda:tempo[0],esperar)
            self.assertEqual(len(chamadas),2)
            self.assertGreaterEqual(chamadas[1][1]-chamadas[0][1],16)

if __name__=='__main__':unittest.main()