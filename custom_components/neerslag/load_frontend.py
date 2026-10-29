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

    # Preferred: register the card as a Lovelace resource, exactly like a HACS
    # dashboard card. Lovelace loads its resources before it builds the cards,
    # while an extra JS module is imported without anyone waiting for it.
    if await _register_lovelace_resource(hass, module_url):
        return

    add_extra_js_url(hass, module_url, es5=False)

    _LOGGER.debug(
        "Neerslag frontend: registered extra JS module URL %s",
        module_url,
    )


async def _register_lovelace_resource(hass: HomeAssistant, module_url: str) -> bool:
    """Add or update the card in the Lovelace resources. Returns False when not possible."""
    try:
        lovelace = hass.data.get("lovelace")
        resources = (
            lovelace.get("resources")
            if isinstance(lovelace, dict)
            else getattr(lovelace, "resources", None)
        )
        if resources is None or not hasattr(resources, "async_create_item"):
            # YAML mode (or Lovelace not available): resources cannot be edited.
            return False

        if not getattr(resources, "loaded", True):
            await resources.async_load()
            resources.loaded = True

        existing = [
            item
            for item in resources.async_items()
            if str(item.get("url", "")).split("?")[0] == FRONTEND_SCRIPT_URL
        ]
        if existing:
            item = existing[0]
            if item.get("url") != module_url or item.get("type") != "module":
                await resources.async_update_item(
                    item["id"], {"res_type": "module", "url": module_url}
                )
            for duplicate in existing[1:]:
                await resources.async_delete_item(duplicate["id"])
        else:
            await resources.async_create_item({"res_type": "module", "url": module_url})
    except Exception:  # noqa: BLE001 - never block the integration on this
        _LOGGER.warning(
            "Neerslag frontend: could not register the Lovelace resource, falling back to an extra JS module",
            exc_info=True,
        )
        return False

    _LOGGER.debug("Neerslag frontend: registered Lovelace resource %s", module_url)
    return True
