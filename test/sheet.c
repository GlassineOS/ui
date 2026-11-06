/* sheet.c VOICE OUT.png CELLS.txt: the sample sheet in C, every element of the
 * voice in its own cell (the same cells as sheet.py, compared by compare.py).
 * Cells: 4 columns of 170 x 90 logical px, drawn at scale 2, element at (20, 20).
 * SPDX-License-Identifier: GPL-2.0-or-later */
#include <stdio.h>
#include <string.h>
#include "glassine-ui.h"

#define CW 170
#define CH 90
#define COLS 4
#define NCELL 40
static FILE *names;
static int n;
static UiGc g;

static void cell(const char *name, double *x, double *y)
{
    *x = (n % COLS) * CW + 20;
    *y = (n / COLS) * CH + 20;
    fprintf(names, "%s\n", name);
    n++;
}

static void B(const char *name, const UiBox *b, double w, double h)
{
    double x, y;
    cell(name, &x, &y);
    ui_box(&g, x, y, w, h, b);
}

static void R(const char *name, double lw, ui_col c, int dashed)
{
    double x, y;
    cell(name, &x, &y);
    ui_hline(&g, x, y + 20, 120, lw, c, dashed);
}

static void T(const char *name, const UiFont *f)
{
    double x, y;
    cell(name, &x, &y);
    ui_text(&g, f, "Sample 0123", x, y, 0, 0, g.t->ink, NULL);
}

int main(int argc, char **argv)
{
    if (argc < 4) return 2;
    const UiVoice *t = ui_voice_find(argv[1]);
    names = fopen(argv[3], "w");
    ui_draw_init();
    cairo_surface_t *s = cairo_image_surface_create(CAIRO_FORMAT_ARGB32, CW * COLS * 2, CH * (NCELL / COLS) * 2);
    cairo_t *cr = cairo_create(s);
    cairo_scale(cr, 2, 2);
    g = (UiGc){ cr, 1, t };
    ui_fill_rect(&g, 0, 0, CW * COLS, CH * (NCELL / COLS), UI_RGB(0xffffff));
    B("card", &t->card, 120, 50);
    B("btn", &t->btn, 120, 44);
    B("sel", &t->sel, 120, 44);
    B("tog", &t->tog, 64, 36);
    B("togOn", &t->togOn, 64, 36);
    B("tray", &t->tray, 120, 44);
    B("segOn", &t->segOn, 60, 40);
    B("pwr", &t->pwr, 120, 42);
    B("pad", &t->pad, 120, 50);
    B("folder", &t->folder, 120, 50);
    B("folderTab", &t->folderTab, 60, 20);
    B("app", &t->app, 120, 50);
    B("tabOn", &t->tabOn, 60, 40);
    B("tabOff", &t->tabOff, 60, 40);
    B("plateOn", &t->plateOn, 60, 30);
    B("plateOff", &t->plateOff, 60, 30);
    R("sep", t->sepW, t->sepC, t->sepDashed);
    R("sepSoft", t->sepSoftW, t->sepSoftC, 0);
    R("headRule", t->headRuleW, t->headRuleC, 0);
    T("text-lbl", &t->lbl);
    T("text-name", &t->nameFont);
    T("text-head", &t->headFont);
    T("text-date", &t->dateFont);
    T("text-seg", &t->segFont);
    T("text-appName", &t->appNameFont);
    T("text-tab", &t->tabFont);
    T("text-search", &t->searchFont);
    double x, y;
    cell("icon", &x, &y);
    ui_icon(&g, "go-next-symbolic", 20, x + 20, y + 20, t->ink);
    cairo_destroy(cr);
    cairo_surface_write_to_png(s, argv[2]);
    cairo_surface_destroy(s);
    fclose(names);
    return 0;
}
