"""Fixtures partagées aux tests.

Réinitialise le compteur de rate-limit de login (état module en mémoire) avant
chaque test, sinon l'accumulation entre tests provoque des 429 parasites.
"""
import pytest


@pytest.fixture(autouse=True)
def _reset_login_rate_limit():
    from app.api import auth

    auth._login_hits.clear()
    yield
    auth._login_hits.clear()
