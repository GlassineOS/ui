/* c-api.c: a separate program on the installed library (pkg-config glassine-ui):
 * the voice table, the fallback, a box and a text measured and drawn.
 * SPDX-License-Identifier: GPL-2.0-or-later */
#include <stdio.h>
#include <string.h>
#include <glassine-ui.h>

static int fails;
#define OK(c, what) do { int c_ = (c); printf("%s %s\n", c_ ? "ok  " : "FAIL", what); fails += !c_; } while (0)

int main(void)
{
    OK(GLASSINE_UI_API == 1, "C API 1");
    OK(ui_nvoices == 3, "three voices");
    OK(!strcmp(ui_voices[0]->name, "white") && !strcmp(ui_voices[1]->name, "editorial") &&
       !strcmp(ui_voices[2]->name, "stationery"), "in order");
    OK(ui_voice_find("stationery") == ui_voices[2], "by name");
    OK(ui_voice_find("nope") == ui_voices[0] && ui_voice_find(NULL) == ui_voices[0], "unknown -> White");
    OK(!strcmp(ui_voice_find("editorial")->title, "Editorial"), "title");
    OK(UI_RULE == 0xffbbbbbbu && UI_DIM == 0xffb4b4b4u, "scheme rule, dim");

    ui_draw_init();
    cairo_surface_t *s = cairo_image_surface_create(CAIRO_FORMAT_ARGB32, 200, 100);
    cairo_t *cr = cairo_create(s);
    const UiVoice *v = ui_voice_find("white");
    UiGc g = { cr, 1, v };
    ui_fill_rect(&g, 0, 0, 200, 100, v->screenBg);
    ui_box(&g, 10, 10, 80, 40, &v->card);
    double h = 0, w = ui_text_w(&g, &v->nameFont, "Sample", &h);
    OK(w > 10 && h > 10, "text measured");
    UiGc lay = { cr, 0, v };
    OK(ui_text(&lay, &v->nameFont, "Sample", 0, 0, 0, 0, v->ink, NULL) == w, "layout pass measures the same");
    /* a zero-width border (several voice borders are 0), dashed: nothing drawn,
     * and the context still draws */
    ui_stroke_rrect(&g, 120, 10, 60, 40, 4, 0, v->ink, 1);
    ui_stroke_rrect(&g, 120, 10, 60, 40, 4, -1, v->ink, 1);
    OK(cairo_status(cr) == CAIRO_STATUS_SUCCESS, "a dashed stroke 0 wide leaves the context usable");
    ui_fill_rect(&g, 150, 70, 10, 10, v->ink);
    cairo_surface_flush(s);
    unsigned char *d = cairo_image_surface_get_data(s);
    int st = cairo_image_surface_get_stride(s);
    unsigned edge = *(unsigned *)(d + 30 * st + 10 * 4), inside = *(unsigned *)(d + 30 * st + 40 * 4);
    OK(edge == 0xff111111u && inside == 0xffffffffu, "the card: an ink edge, a paper inside");
    OK(*(unsigned *)(d + 75 * st + 155 * 4) == 0xff111111u, "and a draw after it lands");
    cairo_destroy(cr);
    cairo_surface_destroy(s);
    printf("c-api: %s\n", fails ? "FAILED" : "all passed");
    return fails != 0;
}
