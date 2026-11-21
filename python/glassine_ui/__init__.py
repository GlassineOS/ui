"""glassine_ui: the GlassineOS voices (White, Editorial, Stationery) and the
drawing built on them, for Python/cairo programs (Python API v1, README "Python API").

    from glassine_ui import voices, paint
    from glassine_ui import size      # the interface size (python3 alone)
"""
# SPDX-License-Identifier: GPL-2.0-or-later
API = 1

from . import content as _content  # noqa: E402

# a program drawn with this package answers taps with pages and never animates: the
# session's GTK module may say so for it (glassine_ui.content)
_content.enable()
