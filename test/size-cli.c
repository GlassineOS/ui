/* size-cli.c: the C library's interface-size calls, one command per line on stdin
 * (fields separated by tabs), one answer per command on stdout, for test_size.py:
 * the same vectors (test/size-vectors.json) go through C and Python.
 * SPDX-License-Identifier: GPL-2.0-or-later */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "glassine-ui.h"

#define NF 64
static const char *path(const char *s) { return strcmp(s, "-") ? s : NULL; }

int main(void)
{
    static char line[65536];
    while (fgets(line, sizeof line, stdin)) {
        line[strcspn(line, "\n")] = 0;
        char *f[NF] = { 0 };
        int n = 0;
        for (char *p = line; n < NF; p++) {
            f[n++] = p;
            p = strchr(p, '\t');
            if (!p) break;
            *p = 0;
        }
        const char *c = f[0];
#define D(i) strtod(f[i], NULL)
#define I(i) atoi(f[i])
        if (!strcmp(c, "step") && n == 2) printf("%d\n", ui_size_step_ok(I(1)));
        else if (!strcmp(c, "textok") && n == 2) printf("%d\n", ui_text_size_ok(I(1)));
        else if (!strcmp(c, "plausible") && n == 5) printf("%d\n", ui_size_plausible(I(1), I(2), D(3), D(4)));
        else if (!strcmp(c, "density") && n == 6) {
            int src;
            double d = ui_density(I(1), I(2), D(3), D(4), D(5), &src);
            printf("%.17g %s\n", d, ui_density_source_name(src));
        } else if (!strcmp(c, "factor") && n == 3) printf("%.17g\n", ui_factor(D(1), I(2)));
        else if (!strcmp(c, "mm") && n == 3) printf("%.17g\n", ui_mm_per_px(D(1), D(2)));
        else if (!strcmp(c, "devpx") && n == 3) printf("%d\n", ui_device_px(D(1), D(2)));
        else if (!strcmp(c, "key") && n == 5) {
            char k[256];
            ui_output_key(f[1], f[2], f[3], f[4], k, sizeof k);
            printf("%s\n", k);
        } else if (!strcmp(c, "textpx") && n == 6) printf("%.17g\n", ui_text_px_at(D(1), D(2), D(3), D(4), D(5)));
        else if (!strcmp(c, "state") && n == 6) {
            /* state MM T BODY ROW PX: the process's metrics, then what a font of PX gets */
            ui_metrics_set(D(1), D(2), D(3), D(4));
            UiFont font = { "sans", 400, 0, (float)D(5), 0, 0, 0 };
            double mm, t, b, r;
            ui_metrics_get(&mm, &t, &b, &r);
            printf("%.17g %.17g %.17g %.17g %.17g %.17g %.17g %.17g\n", mm, t, b, r, ui_grown_px(D(5)),
                   (double)ui_text_px(&font), ui_grow(40, &font, 2, 1.5), ui_min_tap());
        } else if (!strcmp(c, "voice") && n == 2) {
            const UiVoice *v = ui_voice_find(f[1]);
            ui_metrics_voice(v, 0.2, 1.25);
            double b, r;
            ui_metrics_get(NULL, NULL, &b, &r);
            printf("%.17g %.17g %.17g %.17g %.17g\n", (double)v->bodyPx, (double)v->rowPx, (double)v->subPx, b, r);
            ui_metrics_set(0, 1, 0, 0);
        } else if (!strcmp(c, "paths") && n == 1) {
            char p[4][512];
            int ok[4] = { ui_size_file(p[0], sizeof p[0]), ui_text_size_file(p[1], sizeof p[1]),
                          ui_output_density_file(p[2], sizeof p[2]), ui_output_scale_file(p[3], sizeof p[3]) };
            printf("%s\t%s\t%s\t%s\n", ok[0] ? p[0] : "-", ok[1] ? p[1] : "-", ok[2] ? p[2] : "-", ok[3] ? p[3] : "-");
        } else if (!strcmp(c, "size-read") && n == 3) printf("%d\n", ui_size_read(path(f[1]), f[2]));
        else if (!strcmp(c, "size-write") && n == 4) printf("%d\n", ui_size_write(path(f[1]), f[2], I(3)));
        else if (!strcmp(c, "text-read") && n == 2) printf("%d\n", ui_text_size_read(path(f[1])));
        else if (!strcmp(c, "text-write") && n == 3) printf("%d\n", ui_text_size_write(path(f[1]), I(2)));
        else if (!strcmp(c, "density-read") && n == 3) printf("%.17g\n", ui_output_density_read(path(f[1]), f[2]));
        else if (!strcmp(c, "scale-read") && n == 2) {
            /* every output on the one answer line: FACTOR|DENSITY|SOURCE|KEY, tab-separated */
            UiOutputScale o[16];
            int m = ui_output_scale_read(path(f[1]), o, 16);
            printf("%d", m);
            for (int i = 0; i < m && i < 16; i++)
                printf("\t%.17g|%.17g|%s|%s", o[i].factor, o[i].density, ui_density_source_name(o[i].source), o[i].key);
            printf("\n");
        } else if (!strcmp(c, "scale-find") && n == 3) {
            UiOutputScale o;
            if (ui_output_scale_find(path(f[1]), f[2], &o))
                printf("%.17g|%.17g|%s|%s\n", o.factor, o.density, ui_density_source_name(o.source), o.key);
            else printf("-\n");
        } else if (!strcmp(c, "scale-write") && n >= 2 && (n - 2) % 4 == 0) {
            /* scale-write PATH (FACTOR DENSITY SOURCE KEY)... */
            UiOutputScale o[16];
            int m = (n - 2) / 4;
            for (int i = 0; i < m && i < 16; i++) {
                o[i].factor = D(2 + 4 * i);
                o[i].density = D(3 + 4 * i);
                o[i].source = !strcmp(f[4 + 4 * i], "reported") ? UI_DENSITY_REPORTED :
                              !strcmp(f[4 + 4 * i], "measured") ? UI_DENSITY_MEASURED : UI_DENSITY_FALLBACK;
                snprintf(o[i].key, sizeof o[i].key, "%s", f[5 + 4 * i]);
            }
            printf("%d\n", ui_output_scale_write(path(f[1]), o, m));
        } else printf("?\n");
        fflush(stdout);
    }
    return 0;
}
