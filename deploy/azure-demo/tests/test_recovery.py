import os
from pathlib import Path
import subprocess
import tempfile
import unittest

DEPLOY = Path(__file__).resolve().parents[1]

FAKE = r'''#!/usr/bin/env python3
import os, sys, subprocess, signal
from pathlib import Path
name=Path(sys.argv[0]).name
args=sys.argv[1:]
with open(os.environ['COMMAND_LOG'],'a') as f: f.write(name+' '+ ' '.join(args)+'\n')
if name=='docker':
    if args[0]=='info': sys.exit(int(os.environ.get('DAEMON_FAIL','0')))
    if args[0]=='exec': sys.exit(int(os.environ.get('SQL_FAIL','0')))
    if args[0]=='restart': sys.exit(int(os.environ.get('RESTART_FAIL','0')))
if name=='systemctl':
    if args[0]=='restart': sys.exit(int(os.environ.get('RESTART_FAIL','0')))
if name=='curl':
    url=args[-1]
    key='API_FAIL' if ':5101' in url else 'WEB_FAIL' if ':5102' in url else 'PROXY_FAIL'
    sys.exit(int(os.environ.get(key,'0')))
if name=='df': print('Avail\n99999999')
if name=='mv':
    result=subprocess.run(['/usr/bin/mv',*args])
    if result.returncode: sys.exit(result.returncode)
    if os.environ.get('FAIL_AFTER_MOVE')=='1' and args[-1].endswith('/previous/api'):
        sys.exit(1)
    if os.environ.get('SIGNAL_AFTER_MOVE')=='1' and args[-1].endswith('/previous/api'):
        os.kill(os.getppid(), signal.SIGTERM)
'''

class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.bin = self.base/'bin'; self.bin.mkdir()
        self.log = self.base/'commands'
        self.env = os.environ.copy()
        self.env.update(PATH=str(self.bin)+os.pathsep+os.environ['PATH'],
                        QMAH_RUN_DIR=str(self.base), COMMAND_LOG=str(self.log))
        for name in ['docker','systemctl','curl','logger','df','caddy','chown','mv']:
            p=self.bin/name;p.write_text(FAKE);p.chmod(0o755)

    def tearDown(self): self.tmp.cleanup()

    def run_health(self, **values):
        env=self.env|{k:str(v) for k,v in values.items()}
        result=subprocess.run(['bash',str(DEPLOY/'health-recover.sh')],env=env,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        return self.log.read_text()

    def test_healthy_services_are_not_restarted(self):
        commands=self.run_health()
        self.assertNotIn('systemctl restart',commands)
        self.assertNotIn('docker restart',commands)
        self.assertTrue((self.base/'qmah-health/last-completed').exists())

    def test_sql_failure_restarts_sql_after_three_checks(self):
        for _ in range(2): self.run_health(SQL_FAIL=1)
        self.assertNotIn('docker restart',self.log.read_text())
        commands=self.run_health(SQL_FAIL=1)
        self.assertEqual(commands.count('docker restart qmah-sql'),1)
        self.assertNotIn('systemctl restart qmah-api',commands)
        self.assertNotIn('systemctl restart qmah-web',commands)

    def test_daemon_failure_recovers_docker_instead_of_container(self):
        for _ in range(3): commands=self.run_health(DAEMON_FAIL=1)
        self.assertEqual(commands.count('systemctl restart docker'),1)
        self.assertNotIn('docker restart qmah-sql',commands)
        self.assertNotIn('docker exec',commands)

    def test_failed_restart_is_retained_and_retried_after_cooldown(self):
        for _ in range(3): self.run_health(WEB_FAIL=1,RESTART_FAIL=1)
        state=self.base/'qmah-health'
        self.assertEqual((state/'qmah-web').read_text(),'3')
        commands=self.run_health(WEB_FAIL=1,RESTART_FAIL=1)
        self.assertEqual(commands.count('systemctl restart qmah-web'),1)
        (state/'qmah-web.last-attempt').write_text('0')
        commands=self.run_health(WEB_FAIL=1)
        self.assertEqual(commands.count('systemctl restart qmah-web'),2)
        self.assertEqual((state/'qmah-web').read_text(),'0')

    def test_corrupt_counters_do_not_disable_monitoring(self):
        state=self.base/'qmah-health';state.mkdir()
        (state/'qmah-api').write_text('invalid')
        self.run_health(API_FAIL=1)
        self.assertEqual((state/'qmah-api').read_text(),'1')
        self.run_health()
        self.assertEqual((state/'qmah-api').read_text(),'0')

    def test_repeated_proxy_failures_restart_only_caddy(self):
        for _ in range(3): commands=self.run_health(PROXY_FAIL=1)
        self.assertEqual(commands.count('systemctl restart caddy'),1)
        self.assertNotIn('docker restart',commands)
        self.assertNotIn('systemctl restart qmah-api',commands)

    def check_interrupted_update(self, flag):
        root=self.base/'qmah';root.mkdir()
        etc=self.base/'etc'; (etc/'caddy').mkdir(parents=True)
        (etc/'systemd/system').mkdir(parents=True)
        for name in ['api','web','client','deploy']:
            (root/name).mkdir(); (root/name/'old').write_text('original')
        (etc/'caddy/Caddyfile').write_text('old caddy')
        for name in ['qmah-api.service','qmah-web.service','qmah-health.service','qmah-health.timer']:
            (etc/'systemd/system'/name).write_text('old '+name)
        bundle=self.base/'bundle';bundle.mkdir()
        for name in ['api','web','client','deploy']: (bundle/name).mkdir()
        for name in ['api/QMAH.Api','web/QMAH.Web','client/index.html','deploy/Caddyfile']:
            (bundle/name).write_text('new')
        archive=self.base/'bundle.tar.gz'
        subprocess.run(['tar','-czf',str(archive),'-C',str(bundle),'.'],check=True)
        script=(DEPLOY/'update.sh').read_text().replace('/opt/qmah',str(root)).replace('/etc/caddy',str(etc/'caddy')).replace('/etc/systemd/system',str(etc/'systemd/system')).replace('/var/lock/qmah-update.lock',str(self.base/'update.lock'))
        update=self.base/'update.sh';update.write_text(script)
        env=self.env|{flag:'1'}
        result=subprocess.run(['bash',str(update),str(archive),'a'*40],env=env,capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('QMAH_ROLLBACK_OK',result.stdout,result.stdout+result.stderr)
        for name in ['api','web','client','deploy']:
            self.assertEqual((root/name/'old').read_text(),'original')
        self.assertIn('systemctl start qmah-health.timer',self.log.read_text())

    def test_update_rolls_back_if_move_finished_before_error(self):
        self.check_interrupted_update('FAIL_AFTER_MOVE')

    def test_update_rolls_back_after_termination_signal(self):
        self.check_interrupted_update('SIGNAL_AFTER_MOVE')

if __name__=='__main__': unittest.main()
