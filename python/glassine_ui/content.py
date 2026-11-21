"""glassine_ui.content: what a program's repaints are, for a panel that chooses its
refresh by it (an e-ink panel).

A program that draws itself in one GTK window answers a tap with a new picture and
never animates, so the session's GTK module can say it for the program: the repaint
that answers a tap is a page (shown once and exact), a repaint while a finger or the
pen drags is motion (shown fast; the first repaint after the drag brings the exact
picture). Importing glassine_ui asks the module for that, for this process only;
GLASSINE_CONTENT=off in the environment keeps it off. Nothing happens without the
module or on a system whose panel takes no such advice.

say(widget, kind) names the next repaint of the widget's window itself, where the
program knows better: "page", "motion", or "none" (nothing is said for it).
"""
# SPDX-License-Identifier: GPL-2.0-or-later
import os

ENV = "GLASSINE_CONTENT"
KINDS = ("none", "page", "motion")
# the style classes the module reads on a toplevel, and takes off when it has painted
CLASS = "glassine-content-"


def mark():
    """The value that asks the module to name this process's repaints."""
    return "auto:%d" % os.getpid()


def enable():
    """Ask for it (done at import). An environment that already decides stays: 'off',
    or 'auto' for every program that inherits it; a parent's own mark does not."""
    cur = os.environ.get(ENV, "")
    if cur in ("off", "auto"):
        return False
    os.environ[ENV] = mark()
    return True


def say(widget, kind):
    """Name the next repaint of widget's window: 'page', 'motion' or 'none'."""
    if kind not in KINDS:
        raise ValueError("content kind: %r" % (kind,))
    top = widget.get_toplevel()
    ctx = top.get_style_context()
    for k in KINDS:
        if k != kind and ctx.has_class(CLASS + k):
            ctx.remove_class(CLASS + k)
    ctx.add_class(CLASS + kind)
