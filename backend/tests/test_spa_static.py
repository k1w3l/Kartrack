import asyncio
import tempfile
import unittest
from pathlib import Path

from starlette.exceptions import HTTPException

from app.spa_static import SPAStaticFiles


def _scope() -> dict:
    return {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 123),
        "server": ("test", 80),
    }


class SpaStaticFilesTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        (self.root / "index.html").write_text("<!doctype html><html>spa</html>", encoding="utf-8")
        (self.root / "assets").mkdir()
        (self.root / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
        self.files = SPAStaticFiles(directory=str(self.root), html=True)

    def tearDown(self):
        self._tmp.cleanup()

    def _get(self, path: str):
        return asyncio.run(self.files.get_response(path, _scope()))

    def _body(self, response) -> str:
        if getattr(response, "body", None):
            return response.body.decode("utf-8")
        return Path(response.path).read_text(encoding="utf-8")

    def test_root_serves_index(self):
        response = self._get(".")
        self.assertEqual(response.status_code, 200)
        self.assertIn("spa", self._body(response))

    def test_client_route_serves_index(self):
        response = self._get("abastecimento")
        self.assertEqual(response.status_code, 200)
        self.assertIn("spa", self._body(response))

    def test_existing_asset_is_served(self):
        response = self._get("assets/app.js")
        self.assertEqual(response.status_code, 200)
        self.assertIn("console.log", self._body(response))

    def test_unmatched_api_path_stays_404(self):
        with self.assertRaises(HTTPException) as ctx:
            self._get("api/missing")
        self.assertEqual(ctx.exception.status_code, 404)
