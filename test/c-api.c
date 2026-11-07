/* c-api.c: a separate program on the installed library (pkg-config glassine-ui):
 * the voice table, the fallback, a box and a text measured and drawn.
 * SPDX-License-Identifier: GPL-2.0-or-later */
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <glassine-ui.h>

static int fails;
#define OK(c, what) do { int c_ = (c); printf("%s %s\n", c_ ? "ok  " : "FAIL", what); fails += !c_; } while (0)

static int write_file(const char *path, const char *text)
{
    FILE *f = fopen(path, "w");
    if (!f) return 0;
    fputs(text, f);
    return fclose(f) == 0;
}

int main(int argc, char **argv)
{
    const char *tmp = argc > 1 ? argv[1] : ".";
    OK(GLASSINE_UI_API == 1, "C API 1");
    OK(ui_nvoices == 3, "three voices");
    OK(!strcmp(ui_voices[0]->name, "white") && !strcmp(ui_voices[1]->name, "editorial") &&
       !strcmp(ui_voices[2]->name, "stationery"), "in order");
    OK(ui_voice_find("stationery") == ui_voices[2], "by name");
    OK(ui_voice_find("nope") == ui_voices[0] && ui_voice_find(NULL) == ui_voices[0], "unknown -> White");
    OK(!strcmp(ui_voice_find("editorial")->title, "Editorial"), "title");
    OK(UI_RULE == 0xffbbbbbbu && UI_DIM == 0xffb4b4b4u, "scheme rule, dim");

    cairo_surface_t *s = cairo_image_surface_create(CAIRO_FORMAT_ARGB32, 200, 100);
    cairo_t *cr = cairo_create(s);
    const UiVoice *v = ui_voice_find("white");
    UiGc g = { cr, 1, v };
    /* without ui_draw_init: the first text call does it; then a second init changes nothing */
    double w0 = ui_text_w(&g, &v->nameFont, "Sample", NULL);
    OK(w0 > 10, "text measured before ui_draw_init");
    ui_draw_init();
    ui_draw_init();
    OK(ui_text_w(&g, &v->nameFont, "Sample", NULL) == w0, "ui_draw_init twice: the same measure");
    double hn = -1;
    OK(ui_text_w(&g, &v->nameFont, NULL, NULL) == 0 && ui_text(&g, &v->nameFont, NULL, 0, 0, 0, 0, v->ink, &hn) == 0
       && hn >= 0 && ui_text_wrap(&g, &v->nameFont, NULL, 0, 0, 100, 2, 0, v->ink) >= 0, "NULL text: the empty string");
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
    /* the caller's line width and dash stay */
    double dash[1] = { 5 };
    cairo_set_line_width(cr, 7);
    cairo_set_dash(cr, dash, 1, 0);
    ui_hline(&g, 0, 95, 200, 1, v->ink, 1);
    ui_hline(&g, 0, 95, 200, 1, v->ink, 2);
    ui_stroke_rrect(&g, 120, 10, 60, 40, 4, 2, v->ink, 1);
    ui_stroke_rrect(&g, 120, 10, 60, 40, 4, 2, v->ink, 0);
    UiBox db = v->card; db.bw = 2; db.bc = v->ink; db.dashed = 1;
    ui_box(&g, 120, 10, 60, 40, &db);
    OK(cairo_get_line_width(cr) == 7 && cairo_get_dash_count(cr) == 1, "the caller's line width and dash stay");
    cairo_set_line_width(cr, 2);
    cairo_set_dash(cr, NULL, 0, 0);

    /* ui_icon: both passes agree on a file that renders, one that is missing, one that doesn't render */
    char ok_svg[512], bad_svg[512], none_svg[512];
    snprintf(ok_svg, sizeof ok_svg, "%s/c-api-icon-symbolic.svg", tmp);
    snprintf(bad_svg, sizeof bad_svg, "%s/c-api-broken.svg", tmp);
    snprintf(none_svg, sizeof none_svg, "%s/c-api-nonexistent.svg", tmp);
    unlink(none_svg);
    OK(write_file(ok_svg, "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'>"
                          "<rect width='16' height='16' fill='#000'/></svg>") &&
       write_file(bad_svg, "not an svg"), "icon files written");
    cairo_surface_t *is = cairo_image_surface_create(CAIRO_FORMAT_ARGB32, 40, 40);
    cairo_t *icr = cairo_create(is);
    UiGc ilay = { icr, 0, v }, ipaint = { icr, 1, v };
    OK(ui_icon(&ilay, ok_svg, 20, 20, 20, v->ink) == 1 && ui_icon(&ipaint, ok_svg, 20, 20, 20, v->ink) == 1,
       "an icon that renders: 1 in both passes");
    cairo_surface_flush(is);
    OK(*(unsigned *)(cairo_image_surface_get_data(is) + 20 * cairo_image_surface_get_stride(is) + 20 * 4) == v->ink,
       "and drawn in the colour asked (a -symbolic icon)");
    OK(ui_icon(&ilay, none_svg, 20, 20, 20, v->ink) == 0 && ui_icon(&ipaint, none_svg, 20, 20, 20, v->ink) == 0,
       "a missing file: 0 in both passes");
    OK(ui_icon(&ilay, bad_svg, 20, 20, 20, v->ink) == 0 && ui_icon(&ipaint, bad_svg, 20, 20, 20, v->ink) == 0,
       "a file that doesn't render: 0 in both passes");
    OK(ui_icon(&ilay, "no-such-icon-anywhere", 20, 20, 20, v->ink) == 0, "an unknown name: 0");
    cairo_destroy(icr);
    cairo_surface_destroy(is);

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
