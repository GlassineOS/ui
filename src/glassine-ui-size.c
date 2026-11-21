/* glassine-ui-size.c: the size of the interface (glassine-ui.h, README "Interface
 * size"): the design pixel's length, an output's density and factor, the kept
 * settings and the session's runtime file, and the text size with its minimums.
 * No drawing here: the drawing calls read the metrics through ui_text_px().
 *
 * Numbers in the files are written and read with a dot, whatever the locale.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later */
#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <glib.h>
#include <glib/gstdio.h>
#include "glassine-ui.h"

const int ui_size_steps[] = { 80, 90, 100, 120 };
const int ui_nsize_steps = 4;

int ui_size_step_ok(int percent)
{
    for (int i = 0; i < ui_nsize_steps; i++)
        if (ui_size_steps[i] == percent) return 1;
    return 0;
}

int ui_text_size_ok(int percent)
{
    return percent >= 100 && percent <= 150 && percent % 5 == 0;
}

/* ---- density and factor --------------------------------------------------------- */

int ui_size_plausible(int w_px, int h_px, double w_mm, double h_mm)
{
    if (w_px <= 0 || h_px <= 0 || !(w_mm > 0) || !(h_mm > 0) || !isfinite(w_mm) || !isfinite(h_mm)) return 0;
    double dw = w_px / w_mm, dh = h_px / h_mm;
    if (dw < 1 || dw > 100 || dh < 1 || dh > 100) return 0;
    /* the aspect ratio in centimetres, as some displays report it, either way up */
    static const double ratio[][2] = { { 16, 9 }, { 16, 10 }, { 160, 90 }, { 160, 100 } };
    for (unsigned i = 0; i < sizeof ratio / sizeof *ratio; i++)
        if ((w_mm == ratio[i][0] && h_mm == ratio[i][1]) || (w_mm == ratio[i][1] && h_mm == ratio[i][0])) return 0;
    return 1;
}

double ui_density(int w_px, int h_px, double w_mm, double h_mm, double kept, int *source)
{
    int src = UI_DENSITY_FALLBACK;
    double d = UI_FALLBACK_DENSITY;
    if (ui_size_plausible(w_px, h_px, w_mm, h_mm)) {
        src = UI_DENSITY_REPORTED;
        d = w_px / w_mm;
    } else if (isfinite(kept) && kept >= 1 && kept <= 100) {
        src = UI_DENSITY_MEASURED;
        d = kept;
    }
    if (source) *source = src;
    return d;
}

double ui_factor(double density, int percent)
{
    if (!(density > 0) || !isfinite(density)) density = UI_FALLBACK_DENSITY;
    if (!ui_size_step_ok(percent)) percent = 100;
    double f = density * UI_MM_PER_PX * percent / 100.0;
    double r = round(f);
    if (r >= 1 && fabs(f - r) <= UI_FACTOR_SNAP * r) return r;
    return f;
}

double ui_mm_per_px(double factor, double density)
{
    return factor > 0 && density > 0 ? factor / density : 0;
}

static const char *const SOURCES[] = { "reported", "measured", "fallback" };

const char *ui_density_source_name(int source)
{
    return source >= 0 && source < 3 ? SOURCES[source] : SOURCES[UI_DENSITY_FALLBACK];
}

int ui_device_px(double logical, double factor)
{
    return (int)lround(logical * factor);
}

/* ---- the output key (GlassineOS/shell spec 011) ---------------------------------- */

static int known(const char *s) { return s && *s && strcmp(s, "Unknown"); }
static const char *part(const char *s) { return s && *s ? s : "Unknown"; }

void ui_output_key(const char *make, const char *model, const char *serial, const char *name, char *buf, size_t len)
{
    if (!known(make) && !known(model) && !known(serial)) snprintf(buf, len, "%s", name ? name : "");
    else snprintf(buf, len, "%s %s %s", part(make), part(model), part(serial));
}

/* ---- the files -------------------------------------------------------------------- */

static int config_file(const char *name, char *buf, size_t len)
{
    const char *x = getenv("XDG_CONFIG_HOME"), *h = getenv("HOME");
    if (x && *x == '/') return snprintf(buf, len, "%s/glassine/%s", x, name) < (int)len;
    if (!h || !*h) { if (len) *buf = 0; return 0; }
    return snprintf(buf, len, "%s/.config/glassine/%s", h, name) < (int)len;
}

int ui_size_file(char *buf, size_t len) { return config_file("ui-size", buf, len); }
int ui_text_size_file(char *buf, size_t len) { return config_file("text-size", buf, len); }
int ui_output_density_file(char *buf, size_t len) { return config_file("output-density", buf, len); }

int ui_output_scale_file(char *buf, size_t len)
{
    const char *x = getenv("XDG_RUNTIME_DIR");
    if (!x || *x != '/') { if (len) *buf = 0; return 0; }
    return snprintf(buf, len, "%s/glassine/output-scale", x) < (int)len;
}

/* path, or the default file of fn when path is NULL; NULL when there is none */
static const char *path_or(const char *path, int (*fn)(char *, size_t), char *buf, size_t len)
{
    if (path) return path;
    return fn(buf, len) ? buf : NULL;
}

/* the file's lines (without their ends), NULL when it can't be read */
static char **read_lines(const char *path)
{
    char *text = NULL;
    if (!path || !g_file_get_contents(path, &text, NULL, NULL)) return NULL;
    char **lines = g_strsplit(text, "\n", -1);
    g_free(text);
    for (char **l = lines; *l; l++) {
        size_t n = strlen(*l);
        if (n && (*l)[n - 1] == '\r') (*l)[n - 1] = 0;
    }
    /* the text after the last line end is not a line */
    guint n = g_strv_length(lines);
    if (n && !*lines[n - 1]) { g_free(lines[n - 1]); lines[n - 1] = NULL; }
    return lines;
}

/* a line "VALUE KEY": the value (in a copy the caller frees) and the key, both without
 * the blanks around them; 0 for a comment, a blank line or a line without a key */
static int split(const char *line, char **value, const char **key)
{
    while (*line == ' ' || *line == '\t') line++;
    if (!*line || *line == '#') return 0;
    const char *sp = strchr(line, ' ');
    if (!sp) return 0;
    const char *k = sp;
    while (*k == ' ' || *k == '\t') k++;
    if (!*k) return 0;
    *value = g_strndup(line, sp - line);
    *key = k;
    return 1;
}

static int key_is(const char *k, const char *key)
{
    size_t n = strlen(k);
    while (n && (k[n - 1] == ' ' || k[n - 1] == '\t')) n--;
    return strlen(key) == n && !strncmp(k, key, n);
}

/* digits only -> the number, else -1 */
static int whole(const char *s)
{
    if (!*s || strlen(s) > 6) return -1;
    for (const char *p = s; *p; p++)
        if (*p < '0' || *p > '9') return -1;
    return atoi(s);
}

/* digits with at most one dot -> the number, else -1 */
static double decimal(const char *s)
{
    int dots = 0, digits = 0;
    for (const char *p = s; *p; p++) {
        if (*p == '.') dots++;
        else if (*p >= '0' && *p <= '9') digits++;
        else return -1;
    }
    if (dots > 1 || !digits) return -1;
    return g_ascii_strtod(s, NULL);
}

/* v with at most six decimals and no trailing zeros */
static void fmt(double v, char *buf, size_t len)
{
    g_ascii_formatd(buf, len, "%.6f", v);
    char *e = buf + strlen(buf);
    while (e > buf && e[-1] == '0') *--e = 0;
    if (e > buf && e[-1] == '.') *--e = 0;
}

/* text written beside path, then renamed over it; the directory is made when missing */
static int replace_file(const char *path, const char *text)
{
    char *dir = g_path_get_dirname(path), *tmp = g_strconcat(path, ".tmp", NULL);
    int ok = g_mkdir_with_parents(dir, 0700) == 0;
    if (ok) {
        FILE *f = fopen(tmp, "w");
        ok = f != NULL;
        if (f) {
            ok = fputs(text, f) >= 0;
            ok = fclose(f) == 0 && ok;
        }
        if (ok) ok = rename(tmp, path) == 0;
        if (!ok) unlink(tmp);
    }
    g_free(dir);
    g_free(tmp);
    return ok ? 0 : -1;
}

int ui_size_read(const char *path, const char *key)
{
    char def[1024];
    char **lines = read_lines(path_or(path, ui_size_file, def, sizeof def));
    int found = 100;
    for (char **l = lines; key && l && *l; l++) {
        char *v;
        const char *k;
        if (!split(*l, &v, &k)) continue;
        int p = whole(v);
        if (ui_size_step_ok(p) && key_is(k, key)) found = p;
        g_free(v);
    }
    g_strfreev(lines);
    return found;
}

int ui_size_write(const char *path, const char *key, int percent)
{
    char def[1024];
    path = path_or(path, ui_size_file, def, sizeof def);
    if (!path || !key || !*key || !ui_size_step_ok(percent)) return -1;
    char **lines = read_lines(path);
    GString *out = g_string_new(NULL);
    int placed = percent == 100;        /* Default has no line */
    for (char **l = lines; l && *l; l++) {
        char *v;
        const char *k;
        if (split(*l, &v, &k)) {
            int mine = key_is(k, key);
            g_free(v);
            if (mine) {
                if (!placed) g_string_append_printf(out, "%d %s\n", percent, key);
                placed = 1;
                continue;
            }
        }
        g_string_append(out, *l);
        g_string_append_c(out, '\n');
    }
    if (!placed) g_string_append_printf(out, "%d %s\n", percent, key);
    g_strfreev(lines);
    int r = replace_file(path, out->str);
    g_string_free(out, TRUE);
    return r;
}

int ui_text_size_read(const char *path)
{
    char def[1024];
    path = path_or(path, ui_text_size_file, def, sizeof def);
    char *text = NULL;
    if (!path || !g_file_get_contents(path, &text, NULL, NULL)) return 100;
    int p = whole(g_strstrip(text));
    g_free(text);
    return ui_text_size_ok(p) ? p : 100;
}

int ui_text_size_write(const char *path, int percent)
{
    char def[1024], text[16];
    path = path_or(path, ui_text_size_file, def, sizeof def);
    if (!path || !ui_text_size_ok(percent)) return -1;
    snprintf(text, sizeof text, "%d\n", percent);
    return replace_file(path, text);
}

double ui_output_density_read(const char *path, const char *key)
{
    char def[1024];
    char **lines = read_lines(path_or(path, ui_output_density_file, def, sizeof def));
    double found = 0;
    for (char **l = lines; key && l && *l; l++) {
        char *v;
        const char *k;
        if (!split(*l, &v, &k)) continue;
        double d = decimal(v);
        if (d >= 1 && d <= 100 && key_is(k, key)) found = d;
        g_free(v);
    }
    g_strfreev(lines);
    return found;
}

/* "FACTOR DENSITY SOURCE KEY" */
static int scale_line(const char *line, UiOutputScale *o)
{
    while (*line == ' ' || *line == '\t') line++;
    if (!*line || *line == '#') return 0;
    char **p = g_strsplit(line, " ", 4);
    int ok = 0;
    if (g_strv_length(p) == 4) {
        double f = decimal(p[0]), d = decimal(p[1]);
        int src = -1;
        for (int i = 0; i < 3; i++)
            if (!strcmp(p[2], SOURCES[i])) src = i;
        char *k = g_strstrip(p[3]);
        if (f > 0 && d > 0 && src >= 0 && *k && strlen(k) < sizeof o->key) {
            o->factor = f;
            o->density = d;
            o->source = src;
            strcpy(o->key, k);
            ok = 1;
        }
    }
    g_strfreev(p);
    return ok;
}

int ui_output_scale_read(const char *path, UiOutputScale *out, int max)
{
    char def[1024];
    char **lines = read_lines(path_or(path, ui_output_scale_file, def, sizeof def));
    int n = 0;
    for (char **l = lines; l && *l; l++) {
        UiOutputScale o;
        if (!scale_line(*l, &o)) continue;
        int at = n;
        for (int i = 0; i < n && i < max; i++)
            if (!strcmp(out[i].key, o.key)) at = i;     /* of two lines for one key the later counts */
        if (at == n) n++;
        if (at < max) out[at] = o;
    }
    g_strfreev(lines);
    return n;
}

int ui_output_scale_find(const char *path, const char *key, UiOutputScale *out)
{
    char def[1024];
    char **lines = read_lines(path_or(path, ui_output_scale_file, def, sizeof def));
    int found = 0;
    for (char **l = lines; key && l && *l; l++) {
        UiOutputScale o;
        if (!scale_line(*l, &o) || strcmp(o.key, key)) continue;
        if (out) *out = o;
        found = 1;
    }
    g_strfreev(lines);
    return found;
}

int ui_output_scale_write(const char *path, const UiOutputScale *v, int n)
{
    char def[1024];
    path = path_or(path, ui_output_scale_file, def, sizeof def);
    if (!path) return -1;
    GString *out = g_string_new(NULL);
    for (int i = 0; i < n; i++) {
        char f[40], d[40];
        if (!(v[i].factor > 0) || !(v[i].density > 0) || !*v[i].key || strchr(v[i].key, '\n')) {
            g_string_free(out, TRUE);
            return -1;
        }
        fmt(v[i].factor, f, sizeof f);
        fmt(v[i].density, d, sizeof d);
        g_string_append_printf(out, "%s %s %s %s\n", f, d, ui_density_source_name(v[i].source), v[i].key);
    }
    int r = replace_file(path, out->str);
    g_string_free(out, TRUE);
    return r;
}

/* ---- the text size and the minimums ------------------------------------------------ */

static struct { double mm, t, body, row; } M = { 0, 1, 0, 0 };

void ui_metrics_set(double mm_per_px, double text_factor, double body_px, double row_px)
{
    M.mm = mm_per_px > 0 && isfinite(mm_per_px) ? mm_per_px : 0;
    M.t = text_factor >= 1 && isfinite(text_factor) ? (text_factor > 1.5 ? 1.5 : text_factor) : 1;
    M.body = body_px > 0 ? body_px : 0;
    M.row = row_px > 0 ? row_px : 0;
}

void ui_metrics_voice(const UiVoice *v, double mm_per_px, double text_factor)
{
    ui_metrics_set(mm_per_px, text_factor, v ? v->bodyPx : 0, v ? v->rowPx : 0);
}

void ui_metrics_get(double *mm_per_px, double *text_factor, double *body_px, double *row_px)
{
    if (mm_per_px) *mm_per_px = M.mm;
    if (text_factor) *text_factor = M.t;
    if (body_px) *body_px = M.body;
    if (row_px) *row_px = M.row;
}

double ui_text_px_at(double px, double text_factor, double body_px, double row_px, double mm_per_px)
{
    if (!(px > 0)) return px;
    double g = px;
    if (text_factor != 1) {
        double share = body_px > 0 && body_px < px ? body_px / px : 1;
        g = px * (1 + (text_factor - 1) * share);
    }
    if (mm_per_px > 0) {
        double min = (row_px > 0 && px >= row_px ? UI_TEXT_MM_ROW : UI_TEXT_MM_MIN) / mm_per_px;
        if (g < min) g = min;
    }
    return g;
}

double ui_grown_px(double px)
{
    return ui_text_px_at(px, M.t, M.body, M.row, M.mm);
}

float ui_text_px(const UiFont *f)
{
    double g = ui_grown_px(f->px);
    return g == (double)f->px ? f->px : (float)g;
}

double ui_grow(double h, const UiFont *f, double lines, double lh)
{
    return h + (lines > 0 ? lines : 1) * (lh > 0 ? lh : 1) * ((double)ui_text_px(f) - (double)f->px);
}

double ui_min_tap(void)
{
    return M.mm > 0 ? UI_TAP_MM / M.mm : 0;
}
