/* glassine-ui.h: the GlassineOS voices (White, Editorial, Stationery) and the
 * drawing built on them, for cairo + pango programs. Contract: C API v1
 * (README "C API"); pkg-config name glassine-ui.
 *
 * Every value is a design value in logical px (the design canvas is 702x936; a
 * program scales its cairo context to the panel). Colours are 0xAARRGGBB,
 * 0 = transparent. The voices have hard edges only: every "shadow" of the
 * design is an unblurred ring or offset (UiRing), drawn as a flat fill.
 *
 * The voice table (glassine-ui-voices.c) is generated from voices/voices.json
 * by tools/gen-voices: change the data, not the table.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later */
#ifndef GLASSINE_UI_H
#define GLASSINE_UI_H
#include <stdint.h>
#include <cairo.h>

#ifdef __cplusplus
extern "C" {
#endif

#define GLASSINE_UI_API 1               /* the C API's contract version */

typedef uint32_t ui_col;
#define UI_RGB(x) (0xff000000u | (x))
#define UI_HALF (-1.0f)                 /* radius 50% */
/* the E-ink scheme's tokens shared by all three voices (UI_RULE, UI_DIM: disabled,
 * a pager at its end, nothing to clear), generated */
#include "glassine-ui-scheme.h"

typedef struct { float x, y, spread; ui_col c; int inset; } UiRing;
#define UI_NRING 8
typedef struct {
    ui_col bg;
    float bw; ui_col bc; int dashed;    /* border, inside the box */
    float r[4];                         /* tl tr br bl; UI_HALF = 50% */
    UiRing ring[UI_NRING]; int nring;   /* CSS order: the first is on top */
} UiBox;

enum { UI_CASE_NONE, UI_CASE_UPPER, UI_CASE_LOWER };
typedef struct {
    const char *family;
    int weight, italic;
    float px;
    int smallcaps;
    float ls;                           /* letter spacing, em */
    int tcase;
} UiFont;

/* One voice. The field names are the voice data's names (voices/voices.json,
 * section "shell", README "Voices"). */
typedef struct {
    const char *name;                   /* white | editorial | stationery */
    const char *title;                  /* White | Editorial | Stationery */
    ui_col screenBg, ink, sub;
    UiFont lbl; ui_col lblC;            /* section labels (ink-soft / ink / gold) */
    /* bar */
    ui_col barBg, barFg;
    float barBorderW; ui_col barBorderC; int barDouble;   /* bottom edge, inside */
    float barShadowH; ui_col barShadowC;                  /* below the bar */
    int stitch; ui_col stitchColor;
    UiBox plateOn, plateOff; ui_col plateOnFg;
    UiFont wsFont, titleFont, numFont;
    /* cards */
    UiBox card; int emboss;
    float sepW; ui_col sepC; int sepDashed;  /* 1 dashed, 2 dotted */
    float sepSoftW; ui_col sepSoftC;
    float headRuleW; ui_col headRuleC;
    UiFont nameFont, headFont, dateFont;
    UiBox btn, sel; ui_col selFg;
    UiBox tog, togOn; ui_col togOnFg;   /* tog: off (= btn with togR) */
    float grooveTop, grooveH, grooveR; ui_col grooveBg; UiRing grooveRing[3]; int ngrooveRing;
    float fillTop, fillH;
    float knobTop, knobML, knobW, knobH, knobR; ui_col knobBg; float knobBw; ui_col knobBc;
    UiBox tray, segOn; float segR; UiFont segFont; ui_col segOnFg;
    UiBox pwr; ui_col pwrFg;
    UiBox pad; ui_col padFg; float padStitchInset;
    UiBox folder, folderTab; UiFont folderFont;
    UiBox app; UiFont appNameFont, appCatFont;
    UiFont nTitleFont, nBodyFont; float nBodyLh;          /* notifications */
    UiFont searchFont, pageFont;
    UiBox tabOn, tabOff; UiFont tabFont;
    UiFont ratioFont, snapFont;
    int frac, roman;
    const char *qsTitle, *lTitle, *nTitle;
    const char *oTitle, *curTag;        /* the overview: its title, the current screen's tag */
    /* the keyboard's focus ring (section "inline"): focusW thick, focusOff outside the
     * control, focusR its outer radius */
    float focusW, focusOff, focusR;
    /* the drag handles between tiles (glassine-swayd): the bar (divBg, divDrag while
     * dragged; an inside edge divEdgeW in divEdgeC), grips gripW x gripH (gripRound:
     * ellipses), grips of them gripGap apart, gripLip a crescent at a round grip's
     * foot (0: none), divStitch a stitched strap in divStitchC */
    ui_col divBg, divDrag; float divEdgeW; ui_col divEdgeC;
    float gripW, gripH; ui_col gripBg, gripDrag; int gripRound, grips; float gripGap; ui_col gripLip;
    int divStitch; ui_col divStitchC;
} UiVoice;

extern const UiVoice *const ui_voices[];   /* white, editorial, stationery */
extern const int ui_nvoices;
/* the voice called name; unknown names (and NULL) give White */
const UiVoice *ui_voice_find(const char *name);

/* ---- drawing (logical px; the cairo context carries the device scale) --------
 * Every call works in two passes (UiGc.paint): the layout pass only measures
 * (text sizes) so a card knows its height before its background is drawn; the
 * paint pass draws. Nothing animates or redraws by itself. */
typedef struct {
    cairo_t *cr;
    int paint;                          /* 0: layout pass (measure only) */
    const UiVoice *t;                   /* the voice, for the caller's own use */
} UiGc;

/* the font context and the icon index: once per process, before any text or
 * icon (a text or icon call that comes first does it; later calls do nothing) */
void ui_draw_init(void);
void ui_box(UiGc *g, double x, double y, double w, double h, const UiBox *b);
void ui_box_bg(UiGc *g, double x, double y, double w, double h, const UiBox *b, ui_col bg);
void ui_fill_rect(UiGc *g, double x, double y, double w, double h, ui_col c);
void ui_rrect(UiGc *g, double x, double y, double w, double h, double r, ui_col c);
void ui_stroke_rrect(UiGc *g, double x, double y, double w, double h, double r, double lw, ui_col c, int dashed);
/* a rule lw thick with its top at y; dashed: 0 solid, 1 dashes (3:2), 2 dots (1:1).
 * lw <= 0 draws nothing. The calls leave the context's line width and dash as they were. */
void ui_hline(UiGc *g, double x, double y, double w, double lw, ui_col c, int dashed);
/* text with its top-left at x,y (align 0 left, 1 centre, 2 right: x is that
 * edge/centre); maxw > 0 ellipsizes. Returns the width; *h the line height.
 * s == NULL is the empty string. */
double ui_text(UiGc *g, const UiFont *f, const char *s, double x, double y, int align, double maxw, ui_col c, double *h);
double ui_text_w(UiGc *g, const UiFont *f, const char *s, double *h);
/* wrapped text in a w-wide column, at most maxlines lines (the last one
 * ellipsized), line height lh x the font size (0: the font's). Returns the height. */
double ui_text_wrap(UiGc *g, const UiFont *f, const char *s, double x, double y, double w, int maxlines, double lh, ui_col c);
/* an icon of the installed themes (glassine-mono -> Adwaita -> hicolor), px square,
 * centred on cx,cy. Line-art (glassine-mono) and -symbolic icons are drawn in c;
 * others in their own colours. Returns 0 if there is no such icon or its file
 * doesn't render, in the layout pass too (which renders it once, and keeps it). */
int ui_icon(UiGc *g, const char *name, double px, double cx, double cy, ui_col c);
/* the same for an icon named as the design names it (Material Symbols:
 * "chevron_left", "star", ...): the installed icon-theme names it maps to,
 * tried in order, then the name itself; at the glyph's visual size within px
 * (glassine_ui.paint's ICONS and ISCALE). Returns 0 if none is installed. */
int ui_icon_material(UiGc *g, const char *name, double px, double cx, double cy, ui_col c);
/* parallel lines lw thick, step apart, inside the rounded rect. angle is a CSS
 * repeating-linear-gradient angle: the direction the gradient runs (0 up, clockwise), and
 * the lines stand across it. 135 runs from top left to bottom right, so its lines run from
 * bottom left to top right (/); 45 gives \ . step is measured along the gradient. */
void ui_hatch(UiGc *g, double x, double y, double w, double h, double r, double angle, double lw, double step, ui_col c);
UiFont ui_font_with(const UiFont *f, int weight);
UiFont ui_font_px(const UiFont *f, float px);

#ifdef __cplusplus
}
#endif
#endif
