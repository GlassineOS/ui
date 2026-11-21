/* glassine-ui-content.c: what a program says its next frame is, for a panel that
 * chooses its refresh by it (glassine-ui.h, UiContent). No drawing, no display: the
 * rule only; the program sends the answer with its own surface.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later */
#include "glassine-ui.h"

void ui_content_page(UiContent *c)
{
    c->next = UI_CONTENT_PAGE;
}

void ui_content_step(UiContent *c)
{
    if (c->next != UI_CONTENT_PAGE)
        c->next = UI_CONTENT_MOTION;
}

void ui_content_end(UiContent *c)
{
    if (c->next == UI_CONTENT_MOTION)
        c->next = UI_CONTENT_NONE;
}

int ui_content_frame(UiContent *c, int sent)
{
    int k = sent ? c->next : UI_CONTENT_NONE;
    c->next = UI_CONTENT_NONE;
    return k;
}
