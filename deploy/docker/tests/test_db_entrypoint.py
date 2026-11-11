"""Verify bootstrap failure/secret handling with fake SQL executables."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


@unittest.skipUnless(shutil.which("bash"), "requires bash")
class DatabaseEntrypointTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        scripts = {
            "sqlservr": '#!/bin/sh\nexec /usr/bin/sleep "${SERVER_DELAY:-30}"\n',
            "sleep": "#!/bin/sh\nexit 0\n",
            "sqlcmd": """#!/bin/sh
set -eu
[ "$SQLCMDPASSWORD" = "$EXPECTED_PASSWORD" ] || exit 99
for argument in "$@"; do [ "$argument" != '-P' ] || exit 98; done
case "$*" in
  *'SELECT 1'*) exit "${PROBE_EXIT:-0}" ;;
  *'RESTORE DATABASE'*) touch restore-attempted; exit "${RESTORE_EXIT:-0}" ;;
esac
exit 97
""",
        }
        for name, source in scripts.items():
            path = self.bin / name
            path.write_text(source, newline="\n")
            path.chmod(0o755)
        self.env = dict(os.environ, MSSQL_SA_PASSWORD="synthetic password with spaces",
                        EXPECTED_PASSWORD="synthetic password with spaces")
        self.script = Path(__file__).resolve().parents[1] / "db-entrypoint.sh"

    def run_entrypoint(self):
        return subprocess.run([shutil.which("bash"), "-c", 'PATH="$PWD/bin:$PATH"; export PATH; source "$1"',
                               "qmah-entrypoint-test", self.script.as_posix()],
                              cwd=self.root, env=self.env, capture_output=True, text=True, timeout=10)

    def test_password_with_spaces_is_passed_by_environment_and_restore_succeeds(self):
        self.env["SERVER_DELAY"] = "0.5"
        result = self.run_entrypoint()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.root / "restore-attempted").exists())

    def test_unready_database_exits_without_trying_to_restore(self):
        self.env["PROBE_EXIT"] = "1"
        result = self.run_entrypoint()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("did not become ready", result.stderr)
        self.assertFalse((self.root / "restore-attempted").exists())

    def test_restore_failure_is_not_hidden_by_waiting_for_the_server(self):
        self.env["RESTORE_EXIT"] = "17"
        result = self.run_entrypoint()
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assertTrue((self.root / "restore-attempted").exists())
