/* glassine-ui.h: the GlassineOS voices (White, Editorial, Stationery) and the
 * drawing built on them, for cairo + pango programs. Contract: C API v1
 * (README "C API"); pkg-config name glassine-ui.
 *
 * Every value is a design value in logical px (design pixels; a program scales
 * its cairo context by its output's factor, see "the size of the interface" below). Colours are 0xAARRGGBB,
 * 0 = transparent. The voices have hard edges only: every "shadow" of the
 * design is an unblurred ring or offset (UiRing), drawn as a flat fill.
 *
 * The voice table (glassine-ui-voices.c) is generated from voices/voices.json
 * by tools/gen-voices: change the data, not the table.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later */
#ifndef GLASSINE_UI_H
#define GLASSINE_UI_H
#include <stddef.h>
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
    /* the text sizes of the interface size (below): the voice's Interleaf body size
     * (section "type"), and the smaller of the settings card's and the setup's row
     * label and secondary text (sections "card" and "setup": row, sub) */
    float bodyPx, rowPx, subPx;
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

/* ---- whole device pixels -------------------------------------------------------
 * A context scaled by a whole number puts the design's values on whole device pixels
 * as they are. At a fractional scale (an interface factor of 1.6, 1.8, 2.4) the
 * calls above do it themselves: ui_fill_rect, ui_rrect, ui_box, ui_box_bg,
 * ui_stroke_rrect and ui_hline put their outer edges on the nearest device pixel
 * edge, and every border, ring and rule is a whole number of device pixels thick,
 * never under one; ui_hatch's lines are at least one device pixel thick. At a whole
 * scale, and under a matrix that turns or shears, they draw the values as given.
 * The scale is the context's matrix times its target's device scale.
 * For a program's own shapes: */
double ui_dev_scale(cairo_t *cr);               /* device px per logical px (x) */
double ui_snap_x(cairo_t *cr, double x);        /* the nearest x on a device pixel edge */
double ui_snap_y(cairo_t *cr, double y);
/* the nearest length that is a whole number of device pixels, at least one for
 * len > 0 (its sign kept; 0 stays 0) */
double ui_snap_len(cairo_t *cr, double len);
/* a logical length in device pixels at a factor, rounded: a buffer for a surface
 * logical px wide is ui_device_px(logical, factor) wide */
int ui_device_px(double logical, double factor);

/* ---- the size of the interface (README "Interface size") ------------------------
 * A design pixel has a length: UI_MM_PER_PX millimetres at the interface size
 * Default, times the size's percentage otherwise. An output's density (the pixels
 * of its mode, not turned, not scaled, per millimetre) turns that into its factor:
 * device pixels per design pixel, the scale the output is given. */
#define UI_MM_PER_PX 0.224
#define UI_FALLBACK_DENSITY (1 / UI_MM_PER_PX)  /* an output of unknown size: 4.464 */
#define UI_FACTOR_SNAP 0.03                     /* a factor this near a whole number is it */
#define UI_TEXT_MM_ROW 2.8                      /* running text and row labels, em size */
#define UI_TEXT_MM_MIN 2.0                      /* any other text */
#define UI_TAP_MM 7.0                           /* a control that takes a tap, both ways */
extern const int ui_size_steps[];               /* 80, 90, 100, 120 */
extern const int ui_nsize_steps;
int ui_size_step_ok(int percent);               /* one of the steps */
int ui_text_size_ok(int percent);               /* 100..150, a multiple of 5 */
/* does a reported physical size count? Both ways within 1..100 px/mm, and not the
 * aspect ratio in centimetres (16 x 9, 16 x 10, 160 x 90, 160 x 100 mm, either way up) */
int ui_size_plausible(int w_px, int h_px, double w_mm, double h_mm);
enum { UI_DENSITY_REPORTED, UI_DENSITY_MEASURED, UI_DENSITY_FALLBACK };
/* an output's density: from its reported size when plausible (w_px / w_mm), else
 * the kept one (1..100; 0: none), else UI_FALLBACK_DENSITY; *source says which */
double ui_density(int w_px, int h_px, double w_mm, double h_mm, double kept, int *source);
const char *ui_density_source_name(int source); /* reported | measured | fallback */
/* density x UI_MM_PER_PX x percent / 100; within UI_FACTOR_SNAP of a whole number
 * (1 or more) it is that number. A percent that is no step counts as 100. */
double ui_factor(double density, int percent);
/* the millimetres of a design pixel on the glass at a factor: factor / density */
double ui_mm_per_px(double factor, double density);
/* an output's key: "MAKE MODEL SERIAL" (a missing part is "Unknown"), or the
 * connector name when all three are unknown */
void ui_output_key(const char *make, const char *model, const char *serial, const char *name, char *buf, size_t len);

/* The files. A path of NULL is the file's own place; the *_file calls give it
 * (0: there is none, as without XDG_RUNTIME_DIR). A write keeps the other lines,
 * is written beside the file and renamed over it; 0 on success, -1 otherwise.
 *   $XDG_CONFIG_HOME/glassine/ui-size          PERCENT OUTPUT-KEY
 *   $XDG_CONFIG_HOME/glassine/text-size        PERCENT
 *   $XDG_CONFIG_HOME/glassine/output-density   DENSITY OUTPUT-KEY (read only here)
 *   $XDG_RUNTIME_DIR/glassine/output-scale     FACTOR DENSITY SOURCE OUTPUT-KEY */
int ui_size_file(char *buf, size_t len);
int ui_text_size_file(char *buf, size_t len);
int ui_output_density_file(char *buf, size_t len);
int ui_output_scale_file(char *buf, size_t len);
int ui_size_read(const char *path, const char *key);            /* the output's step; 100 without a line */
int ui_size_write(const char *path, const char *key, int percent);   /* 100 removes the line */
int ui_text_size_read(const char *path);                        /* 100 without a file or with other content */
int ui_text_size_write(const char *path, int percent);
double ui_output_density_read(const char *path, const char *key);    /* 0: none kept */
typedef struct {
    double factor, density;
    int source;                         /* UI_DENSITY_* */
    char key[256];
} UiOutputScale;
/* every output of the file into out[0..max); returns how many it has */
int ui_output_scale_read(const char *path, UiOutputScale *out, int max);
int ui_output_scale_find(const char *path, const char *key, UiOutputScale *out);    /* 1: found */
int ui_output_scale_write(const char *path, const UiOutputScale *v, int n);         /* the whole file */

/* The text size and the minimums: one state for the process, read by every text
 * call. mm_per_px: the millimetres of a design pixel on the glass (ui_mm_per_px;
 * 0: unknown, no minimums); text_factor: 1.0 to 1.5; body_px, row_px: the voice's
 * body size and row label size (UiVoice bodyPx, rowPx). A program that draws for
 * outputs of different factors sets it before it draws for each. Until it is set:
 * no minimums, text factor 1. */
void ui_metrics_set(double mm_per_px, double text_factor, double body_px, double row_px);
void ui_metrics_voice(const UiVoice *v, double mm_per_px, double text_factor);
void ui_metrics_get(double *mm_per_px, double *text_factor, double *body_px, double *row_px);
/* The size a type style of px design pixels is drawn at:
 *   px x (1 + (text_factor - 1) x min(1, body_px / px)), and at least its minimum:
 *   UI_TEXT_MM_ROW for px >= row_px, UI_TEXT_MM_MIN for smaller ones (and for
 *   every style while row_px is 0), in design pixels at mm_per_px.
 * ui_text, ui_text_w and ui_text_wrap draw every font at this size themselves; these
 * are for layouts. Never put the result back into a UiFont: it would grow twice. */
double ui_text_px_at(double px, double text_factor, double body_px, double row_px, double mm_per_px);
double ui_grown_px(double px);                  /* with the process's metrics */
float ui_text_px(const UiFont *f);              /* f->px itself when nothing applies */
/* the height of a box that holds lines of text in f once the text has grown:
 * h + lines x lh x (ui_text_px(f) - f->px); lh: the line height as a factor of the
 * font size (<= 0: 1); lines <= 0: one. Spacing and icons keep their size. */
double ui_grow(double h, const UiFont *f, double lines, double lh);
/* the least width and height of a control that takes a tap, in design pixels
 * (UI_TAP_MM); 0 while mm_per_px is unknown */
double ui_min_tap(void);

/* What a frame is, for a panel that chooses its refresh by it (an e-ink panel: the
 * values are those of glassine_ink_surface_v1.set_content, GlassineOS/protocols). The
 * library keeps the rule; the program tells it what happened and sends the answer
 * with the frame, on its own surface:
 *   - the answer to a tap that changes the picture (another page or view, a sheet or
 *     a popover opened or closed) is a page: shown once and exact;
 *   - a step of a movement the program drives (a drag, a list scrolled) is motion:
 *     shown fast, and the first frame after it that is no step brings the exact one;
 *   - anything else says nothing, and is shown as before.
 * Each holds for one frame; a page wins over a step. A program that knows better
 * sends another value itself. */
enum { UI_CONTENT_NONE = 0, UI_CONTENT_PAGE = 1, UI_CONTENT_MOTION = 2 };
typedef struct { int next; } UiContent;    /* zeroed: nothing said */
void ui_content_page(UiContent *c);        /* the next frame answers a tap */
void ui_content_step(UiContent *c);        /* the next frame is a step of a movement */
void ui_content_end(UiContent *c);         /* the movement ended: its result is no step */
/* a frame is made now (sent: it changes the picture and goes out): what it is.
 * Forgets it, so the frames after it say nothing until told again. */
int ui_content_frame(UiContent *c, int sent);

#ifdef __cplusplus
}
#endif
#endif
