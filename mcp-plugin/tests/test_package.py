import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class PackageTests(unittest.TestCase):
    def test_declared_paths_exist(self):
        package = json.loads((ROOT/'plugin.json').read_text())
        extension = package['extensions']['com.openai']
        for name in ['composerIcon','logo']:
            path = extension['interface'][name]
            self.assertTrue(path.startswith('./'))
            self.assertTrue((ROOT/path).is_file())
        self.assertTrue((ROOT/'skills'/'vt-audit-tool-call'/'SKILL.md').is_file())
        server=json.loads((ROOT/'mcp.json').read_text())['mcpServers']['vt-auditor']
        self.assertEqual(server['type'],'stdio')
        self.assertTrue((ROOT/'server.py').is_file())
    def test_no_automatic_install_or_secret_headers(self):
        text=(ROOT/'mcp.json').read_text()
        self.assertNotIn('headers',text)
        self.assertNotIn('pip install',text)
        self.assertFalse((ROOT/'hooks').exists())

if __name__ == '__main__': unittest.main()
