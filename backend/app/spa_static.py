from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles


class SPAStaticFiles(StaticFiles):
    """Serve the React build and fall back to index.html for client routes."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
            if path == "index.html" or path.startswith("api/") or path.startswith("uploads/"):
                raise
            return await super().get_response("index.html", scope)
