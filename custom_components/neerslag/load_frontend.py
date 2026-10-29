from homeassistant.core import HomeAssistant
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from aiohttp import web
import hashlib
import logging
import os
from .const import FRONTEND_SCRIPT_URL, DATA_EXTRA_MODULE_URL
import time

_LOGGER = logging.getLogger(__name__)


def _file_hash(path: str) -> str:
    """Short content hash of the card bundle, used to bust the browser cache."""
    with open(path, "rb") as file:
        return hashlib.sha1(file.read()).hexdigest()[:10]


async def setup_view(hass: HomeAssistant):
    dir_path = os.path.dirname(os.path.realpath(__file__))
    path_to_file = os.path.join(
        dir_path,
        "home-assistant-neerslag-card",
        "neerslag-card.js",
    )

    should_cache = False

    _LOGGER.debug(
        "Neerslag frontend: registering static path %s -> %s",
        FRONTEND_SCRIPT_URL,
        path_to_file,
    )

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                FRONTEND_SCRIPT_URL,
                path_to_file,
                should_cache,
            )
        ]
    )

    # The module URL carries the hash of the bundle: a changed card file gets a
    # new URL, so browsers never keep using an old cached copy (which causes
    # "Custom element doesn't exist: neerslag-card").
    try:
        version = await hass.async_add_executor_job(_file_hash, path_to_file)
    except OSError:
        _LOGGER.warning("Neerslag frontend: could not read %s", path_to_file)
        version = None
    module_url = f"{FRONTEND_SCRIPT_URL}?v={version}" if version else FRONTEND_SCRIPT_URL

    add_extra_js_url(hass, module_url, es5=False)

    _LOGGER.debug(
        "Neerslag frontend: registered extra JS module URL %s",
        module_url,
    )
