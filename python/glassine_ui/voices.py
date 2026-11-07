"""The voices as data (contract: voice data v1, README "Voices").

    NAMES                 ('white', 'editorial', 'stationery')
    voice(name)           the voice called name; unknown names give White:
                          {'name', 'title', 'scheme', 'shell', 'c', 'card', 'setup'}
    title(name)           'White' | 'Editorial' | 'Stationery'

Values are the design's CSS (colours '#rrggbb', box-shadow lists, borders,
font shorthands, radii) with every var(--il-*) resolved; glassine_ui.paint draws
them. The sections: scheme = the E-ink scheme's tokens, shell = the desktop
shell's surfaces, card = the settings card, setup = the first-run setup, c = the
few values the C table takes instead of the CSS value. The dicts are shared:
copy one before changing it.
"""
# SPDX-License-Identifier: GPL-2.0-or-later
from ._voices import CONTRACT, ORDER, VOICES

NAMES = ORDER


def voice(name):
    n = name if name in VOICES else "white"
    return dict(VOICES[n], name=n)


def title(name):
    return voice(name)["title"]


__all__ = ["CONTRACT", "NAMES", "voice", "title"]
