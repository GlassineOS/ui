# Designs

One folder per project (`designs/<project>/`): the project's boards, its `canvas.json`, and any fonts its
boards load beyond Interleaf's (named by `references.json`). Boards use this repository's Interleaf and
renderer, never a copy.

**A board is a proposal.** It can differ from the program it describes. An accepted board reaches a program
through ordinary work in that program's repository, not by anything here changing on its own. No rendered
images are stored: `make designs-check` renders every board, and a pull request that changes a design has
images of the changed boards with its checks.

Every design is on the published site, rendered in the browser: https://glassineos.github.io/ui/designs.html
(each folder at `designs/<project>/`). A pull request of this repository that changes a design is there too,
at `designs/pr-<number>/`, linked from a comment on the pull request (README.md, "Published boards").

From a checkout of this repository (`tools/in-alpine` provides Chromium and node; see `README.md`,
"Boards"):

```
tools/boards preview designs/<project>                             # http://127.0.0.1:4790/_boards/, live reload
tools/in-alpine tools/boards shot designs/<project>/Board.dc.html  # one board as an image and its errors, as JSON
tools/in-alpine tools/boards shot FILE --voice stationery --scheme eink --pen 2 --size 390x760 --click '#open'
tools/in-alpine tools/boards check designs/<project>               # every board of the folder
tools/in-alpine make designs-check                                 # every folder
```

The shell's boards use an icon font, cut down to the icons they name (`designs/shell/fonts/`). After naming
a new icon: `tools/in-alpine make designs-icons` writes the font, `designs-icons-check` fails when a board names
an icon it lacks.

A session that has changed a board runs `shot` and looks at the image; the `errors` list holds what the
board raised, including features outside the supported subset and requests to other sites.
