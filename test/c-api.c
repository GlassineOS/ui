/* c-api.c: a separate program on the installed library (pkg-config glassine-ui):
 * the voice table, the fallback, a box and a text measured and drawn.
 * SPDX-License-Identifier: GPL-2.0-or-later */
#include <math.h>
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
    OK(UI_RULE == 0xffbbbbbbu && UI_DIM == 0xffbbbbbbu, "scheme rule, dim");

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
    /* ui_text_wrap: one line, wrapped lines, at most maxlines */
    const char *para = "Sample text that is long enough to wrap in a narrow column of the card";
    double h1 = ui_text_wrap(&lay, &v->nameFont, "Sample", 0, 0, 180, 3, 0, v->ink);
    double h3 = ui_text_wrap(&lay, &v->nameFont, para, 0, 0, 120, 3, 0, v->ink);
    double h2 = ui_text_wrap(&lay, &v->nameFont, para, 0, 0, 120, 2, 0, v->ink);
    double h9 = ui_text_wrap(&lay, &v->nameFont, para, 0, 0, 120, 9, 0, v->ink);
    OK(h1 > 10 && h2 > 1.8 * h1 && h3 > h2 && h9 > h3, "wrap: more lines are taller, up to maxlines");
    OK(ui_text_wrap(&lay, &v->nameFont, para, 0, 0, 120, 2, 1.6, v->ink) > h2, "wrap: a line height above the font's is taller");

    /* the rules: solid, dashes (3:2), dots (1:1) along one row */
    cairo_surface_t *rs = cairo_image_surface_create(CAIRO_FORMAT_ARGB32, 200, 30);
    cairo_t *rcr = cairo_create(rs);
    UiGc rg = { rcr, 1, v };
    ui_fill_rect(&rg, 0, 0, 200, 30, UI_RGB(0xffffff));
    ui_hline(&rg, 0, 4, 200, 2, v->ink, 0);
    ui_hline(&rg, 0, 14, 200, 2, v->ink, 1);
    ui_hline(&rg, 0, 24, 200, 2, v->ink, 2);
    cairo_surface_flush(rs);
    int inked[3] = { 0, 0, 0 };
    for (int r = 0; r < 3; r++)
        for (int x = 0; x < 200; x++)
            inked[r] += *(unsigned *)(cairo_image_surface_get_data(rs) + (5 + 10 * r) * cairo_image_surface_get_stride(rs) + x * 4) == v->ink;
    OK(inked[0] == 200, "a solid rule: every pixel");
    OK(inked[1] >= 112 && inked[1] <= 128, "a dashed rule: 3 of every 5 pixels");
    OK(inked[2] >= 92 && inked[2] <= 108, "a dotted rule: 1 of every 2 pixels");
    cairo_destroy(rcr);
    cairo_surface_destroy(rs);

    /* the interface size from the installed library */
    OK(UI_MM_PER_PX == 0.224 && ui_nsize_steps == 4 && ui_size_steps[0] == 80 && ui_size_steps[3] == 120 &&
       ui_size_step_ok(90) && !ui_size_step_ok(110) && ui_text_size_ok(125) && !ui_text_size_ok(112), "the unit, the steps, the text sizes");
    int src = -1;
    double dens = ui_density(1404, 1872, 157, 209, 0, &src);
    OK(src == UI_DENSITY_REPORTED && ui_factor(dens, 100) == 2 && fabs(ui_factor(dens, 80) - 1.6024) < 1e-3 &&
       ui_density(1920, 1080, 16, 9, 0, &src) == UI_FALLBACK_DENSITY && src == UI_DENSITY_FALLBACK &&
       ui_factor(UI_FALLBACK_DENSITY, 100) == 1, "density and factor: a reported size, a refused one, the fallback");
    OK(v->bodyPx == 17 && v->rowPx == 16 && v->subPx == 13.5f && ui_voice_find("stationery")->bodyPx == 20, "the voices' body, row and secondary sizes");
    /* the text size: every text call draws grown text; cleared, the same measure as before */
    double wt0 = ui_text_w(&g, &v->nameFont, "Sample", NULL), ht0 = 0;
    ui_text(&lay, &v->nameFont, "Sample", 0, 0, 0, 0, v->ink, &ht0);
    OK(ui_text_px(&v->nameFont) == v->nameFont.px && ui_min_tap() == 0 && ui_grow(44, &v->nameFont, 1, 1.3) == 44, "no metrics: the design's sizes");
    ui_metrics_voice(v, ui_mm_per_px(2, dens), 1.0);
    OK(ui_text_px(&v->nameFont) == v->nameFont.px && ui_text_px(&v->lbl) == v->lbl.px &&
       ui_text_w(&g, &v->nameFont, "Sample", NULL) == wt0, "Default at 8.943 px/mm, text 100 %: nothing changes");
    OK(fabs(ui_min_tap() * ui_mm_per_px(2, dens) - UI_TAP_MM) < 1e-9, "the tap minimum is 7 mm");
    ui_metrics_voice(v, 0, 1.5);
    double ht1 = 0, wt1 = ui_text(&lay, &v->nameFont, "Sample", 0, 0, 0, 0, v->ink, &ht1);
    OK(ui_text_px(&v->nameFont) == 25.5f && ui_text_px(&v->lbl) == 15.75f && fabs(wt1 / wt0 - 1.5) < .04 && fabs(ht1 / ht0 - 1.5) < .04,
       "text at 150 %: the body size drawn half as large again, measured so");
    UiFont head = ui_font_px(&v->nameFont, 34);
    OK(ui_text_px(&head) == 42.5f && fabs(ui_grow(44, &v->nameFont, 1, 1.3) - (44 + 1.3 * 8.5)) < 1e-9 &&
       ui_text_wrap(&lay, &v->nameFont, para, 0, 0, 120, 2, 0, v->ink) > 1.4 * h2, "a heading twice the body grows by half of it; a box grows with its text; wrapped text too");
    ui_metrics_voice(v, 0.1792, 1.0);
    OK(fabs(ui_text_px(&v->lbl) - 2.0 / 0.1792) < 1e-4 && ui_text_px(&v->nameFont) == 17, "Smaller: a 10.5 px label drawn at 2.0 mm, the body as it is");
    ui_metrics_set(0, 1, 0, 0);
    OK(ui_text_w(&g, &v->nameFont, "Sample", NULL) == wt0, "the metrics cleared: the same measure as before");

    /* whole device pixels at a fractional scale; a whole scale draws the values as given */
    cairo_surface_t *fs = cairo_image_surface_create(CAIRO_FORMAT_ARGB32, 320, 200);
    cairo_t *fcr = cairo_create(fs);
    UiGc fg = { fcr, 1, v };
    ui_fill_rect(&fg, 0, 0, 320, 200, UI_RGB(0xffffff));
    cairo_scale(fcr, 1.6, 1.6);
    UiBox sq = { .bg = UI_RGB(0xeeeeee), .bw = 1.5, .bc = v->ink, .ring = { { 0, 2, 0, UI_RGB(0xbbbbbb), 0 }, { 0, 0, 1, UI_RGB(0x888888), 1 } }, .nring = 2 };
    ui_box(&fg, 10.3, 10.3, 60.3, 20.3, &sq);
    ui_fill_rect(&fg, 10.3, 40.3, 50.3, 10.3, v->ink);
    ui_hline(&fg, 10.3, 60.3, 80.3, 0.5, v->ink, 0);
    ui_hline(&fg, 10.3, 70.3, 80.3, 1, v->ink, 2);
    ui_stroke_rrect(&fg, 10.3, 80.3, 60.3, 20.3, 0, 1.5, v->ink, 0);
    ui_rrect(&fg, 100.3, 10.3, 20.3, 20.3, 0, v->ink);
    cairo_surface_flush(fs);
    int between = 0, thin = 0;
    for (int y = 0; y < 200; y++)
        for (int x = 0; x < 320; x++) {
            unsigned p = *(unsigned *)(cairo_image_surface_get_data(fs) + y * cairo_image_surface_get_stride(fs) + x * 4);
            between += p != 0xffffffffu && p != v->ink && p != 0xffeeeeeeu && p != 0xffbbbbbbu && p != 0xff888888u;
            thin += y == 96 && p == v->ink;     /* round(60.3 x 1.6): the half-pixel rule's one row */
        }
    OK(between == 0, "scale 1.6: box, fill, rules and strokes are whole device pixels (no grey between)");
    OK(thin >= 128, "scale 1.6: a rule of half a design pixel is one device pixel thick");
    OK(fabs(ui_dev_scale(fcr) - 1.6) < 1e-12 && fabs(ui_snap_x(fcr, 10.3) * 1.6 - 16) < 1e-9 && fabs(ui_snap_y(fcr, 10.9) * 1.6 - 17) < 1e-9 &&
       fabs(ui_snap_len(fcr, 1.5) * 1.6 - 2) < 1e-9 && fabs(ui_snap_len(fcr, 0.2) * 1.6 - 1) < 1e-9 && ui_snap_len(fcr, 0) == 0 &&
       fabs(ui_snap_len(fcr, -1) * 1.6 + 2) < 1e-9, "ui_dev_scale, ui_snap_x, ui_snap_y, ui_snap_len");
    OK(ui_device_px(702, 1.6) == 1123 && ui_device_px(702, 2) == 1404, "a logical length in device pixels");
    cairo_rotate(fcr, .3);
    OK(ui_snap_x(fcr, 10.3) == 10.3 && ui_snap_len(fcr, 1.5) == 1.5, "a turned context: the snaps give the values back");
    cairo_destroy(fcr);
    cairo_surface_destroy(fs);
    char key[64];
    ui_output_key("", "Unknown", NULL, "HDMI-A-1", key, sizeof key);
    OK(!strcmp(key, "HDMI-A-1"), "the output key: the connector name when make, model and serial are unknown");

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
    UiGc lay2 = { cr, 0, v };
    OK(ui_icon_material(&lay2, "chevron_left", 24, 12, 12, v->ink) == ui_icon(&lay2, "go-previous-symbolic", 24, 12, 12, v->ink),
       "a Material name: its icon-theme name");
    OK(!ui_icon_material(&lay2, "no-such-icon-anywhere", 24, 12, 12, v->ink), "an unknown name: none");
    ui_fill_rect(&g, 100, 0, 100, 100, v->screenBg);
    ui_hatch(&g, 100, 0, 100, 100, 0, 135, 1, 7, v->ink);
    cairo_surface_flush(s);
    int hatched = 0;
    for (int y = 0; y < 100; y++)
        for (int x = 100; x < 200; x++)
            hatched += (*(unsigned *)(d + y * st + x * 4) & 0xff) < 0x80;
    OK(hatched > 500 && hatched < 4000, "a hatch: lines, not a fill");
    /* 135 is a CSS angle: the stripes run bottom left to top right (/), across the gradient that runs
     * top left to bottom right. In this 100 px square (centre 150,50) a stripe is x + y = 198, 9.9
     * further for the next (step 7 along the gradient is 7 * sqrt(2) in x + y). Along the stripe every
     * pixel is dark; the mirror image of those pixels, on a \ line, is not. */
    int xs[] = { 128, 135, 143, 150, 158, 165, 172 }, on = 0, mirrored = 0;
    for (int i = 0; i < 7; i++) {
        on += (*(unsigned *)(d + (198 - xs[i]) * st + xs[i] * 4) & 0xff) < 0x80;
        mirrored += (*(unsigned *)(d + (198 - xs[i]) * st + (299 - xs[i]) * 4) & 0xff) < 0x80;
    }
    OK(on == 7, "a hatch at 135: the stripe runs bottom left to top right (/)");
    OK(mirrored < 4, "and not top left to bottom right (\\)");
    unsigned outside = *(unsigned *)(d + 5 * st + 95 * 4);
    OK(outside == 0xffffffffu, "a hatch stays inside its rect");
    cairo_destroy(cr);
    cairo_surface_destroy(s);
    printf("c-api: %s\n", fails ? "FAILED" : "all passed");
    return fails != 0;
}
