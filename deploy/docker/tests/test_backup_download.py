"""Exercise the shell downloader with fake network responses, no real database."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


@unittest.skipUnless(shutil.which("sh") and shutil.which("sha256sum"), "requires POSIX shell and sha256sum")
class BackupDownloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.backup_dir = self.root / "backups"
        self.backup_dir.mkdir()
        self.backup = self.backup_dir / "QMAH.bak"
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.payload = b"public demonstration fixture, not a database"
        source = self.root / "source"
        source.write_bytes(self.payload)
        curl = self.bin / "curl"
        curl.write_text("""#!/bin/sh
set -eu
touch "$CURL_CALLED"
while [ "$#" -gt 0 ]; do
    if [ "$1" = '--output' ]; then output=$2; shift; fi
    shift
done
cp "$CURL_SOURCE" "$output"
exit "${CURL_EXIT:-0}"
""", newline="\n")
        curl.chmod(0o755)
        self.env = dict(os.environ,
                        QMAH_BACKUP_SHA256=hashlib.sha256(self.payload).hexdigest(),
                        CURL_SOURCE=source.name, CURL_CALLED="called")
        self.script = Path(__file__).resolve().parents[1] / "download-backup.sh"

    def run_download(self):
        return subprocess.run(["sh", "-c", 'PATH="$PWD/bin:$PATH"; export PATH; exec sh "$1" backups',
                               "qmah-download-test", self.script.as_posix()],
                              cwd=self.root, env=self.env, capture_output=True, text=True)

    def test_valid_cached_backup_does_not_use_network(self):
        self.backup.write_bytes(self.payload)
        result = self.run_download()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.root / "called").exists())

    def test_incorrect_cache_is_replaced_only_after_verification(self):
        self.backup.write_bytes(b"incomplete previous download")
        result = self.run_download()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.backup.read_bytes(), self.payload)
        preserved = list(self.backup_dir.glob("QMAH.bak.unverified.*"))
        self.assertEqual(len(preserved), 1)
        self.assertEqual(preserved[0].read_bytes(), b"incomplete previous download")

    def test_checksum_mismatch_preserves_existing_backup_and_removes_partial(self):
        self.backup.write_bytes(b"old backup")
        self.env["QMAH_BACKUP_SHA256"] = "0" * 64
        result = self.run_download()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SHA-256 mismatch", result.stderr)
        self.assertTrue((self.root / "called").exists())
        self.assertEqual(self.backup.read_bytes(), b"old backup")
        self.assertEqual(list(self.backup_dir.glob("*.part.*")), [])

    def test_network_failure_leaves_no_backup_or_partial_file(self):
        self.env["CURL_EXIT"] = "22"
        result = self.run_download()
        self.assertEqual(result.returncode, 22, result.stderr)
        self.assertTrue((self.root / "called").exists())
        self.assertFalse(self.backup.exists())
        self.assertEqual(list(self.backup_dir.glob("*.part.*")), [])
