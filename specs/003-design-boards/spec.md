# Feature Specification: Design boards

**Feature Branch**: `spec-ui-interleaf`
**Created**: 2026-11-07
**Status**: Draft
**Input**: The design boards of the shell and the hub, kept in this repository and built on Interleaf.

## Context

The designs of the shell and the hub are canvases of boards: screens, states and small interactive prototypes,
built on Interleaf (spec 002). The boards live in this repository, one folder per project, next to Interleaf and
to what renders and checks them, so a design session works in one place. They are written in claude.ai's
design-component format and are rendered, clicked through and screenshotted by people and by agents, without
claude.ai. A board is a proposal: it can differ from the program it describes, and an accepted board reaches the
program through ordinary work in that program's repository.

## User scenarios

### Scenario 1 – A board opens in a browser (Priority: P1)

**Given** a project's design boards,
**When** the designer starts the preview,
**Then** each board renders in a browser, nested boards included, in the voice, scheme and pen chosen, and
edits to a board show on save.

### Scenario 2 – An agent checks its own change (Priority: P1)

**Given** an agent has changed a board,
**When** it asks for that board in a voice, scheme, pen and size, after any clicks it names,
**Then** it gets an image it can look at and every error the board raised, without a display, and can repeat this
after each edit.

**When** it runs the board checks,
**Then** it gets every error any board of the design raised.

### Scenario 3 – Clicking through a prototype (Priority: P2)

**Given** a board marked interactive,
**When** the user clicks its controls and links in the preview,
**Then** it reacts as its logic says: state changes, branches and links between boards.

### Scenario 4 – A new prototype beside the old (Priority: P2)

**When** a designer starts a new prototype next to existing boards,
**Then** it appears in the preview's canvas next to them, can be compared side by side, and is kept or dropped
in review.

### Scenario 5 – Reviewing a design change (Priority: P2)

**Given** a proposed change to a design,
**When** the reviewer opens it,
**Then** images of the boards it changes are available with its checks, and none of them enter the repository.

### Scenario 6 – Looking at a design in the browser (Priority: P2)

**Given** the published site of this repository,
**When** anyone opens its designs page,
**Then** every design on the main line opens there as its canvas, and each board in the same view as the
preview's, with the voice, scheme and pen picker, without installing anything.

**Given** an open proposed change to a design, made in this repository,
**When** the reviewer follows the link the proposal carries,
**Then** its boards open the same way at an address of their own, as of the proposal's latest revision, before
it is accepted; once it is closed, that copy is gone.

### Scenario 7 – Reviewing a proposal board by board (Priority: P1)

**Given** the published copy of an open proposed change to a design,
**When** the reviewer opens it,
**Then** they see which boards it adds, changes and removes, and for each one the board before and after in the
same voice, scheme, pen and state, next to each other or one over the other, with what differs marked.

**When** they mark the boards they have looked at and come back later,
**Then** the boards they marked stay marked, except those that changed since, and they continue with the next one
not yet looked at.

### Scenario 8 – One board in every voice and scheme (Priority: P2)

**When** the user asks to see one board across the voices, schemes, pens or its states,
**Then** every combination of the two chosen is shown side by side, the ones with an error marked, and any one of
them can be looked at closely.

### Scenario 9 – A board's states (Priority: P2)

**Given** a board that has several states,
**When** it names them,
**Then** every view that shows the board offers them, without the board drawing its own way to switch between
them, and the checks and the single-board image reach each state by its name.

### Scenario 10 – Finding a board and its place (Priority: P3)

**When** the user looks for a board by name, or a state of one, across the designs,
**Then** they reach it in a few keys.

**When** they ask how a screen is reached and where it leads,
**Then** the boards of a page are shown as a map of the links and state changes between them, and the boards
nothing leads to are listed.

## Requirements

**Rendering**
- **FR-001**: Boards in claude.ai's design-component format render: templated text and attributes, conditions,
  repetition, nested boards, events, state and the component logic, and the head content a board declares.
- **FR-002**: The renderer is the organization's own, written from the format reference that claude.ai serves
  with every design canvas. Neither that reference nor any part of claude.ai's editor or runtime is in the
  organization's sources.
- **FR-005**: The supported subset of the format is versioned here. A board that uses anything outside it fails
  as in FR-003, which is how a change of the format on claude.ai's side shows.
- **FR-003**: Format features the renderer does not support fail visibly, naming the board and the feature;
  they never render silently wrong.
- **FR-004**: The canvas layout (board positions, pages, notes, which boards are interactive) is read from the
  canvas description kept with the boards, and the preview shows it as a canvas.

**Preview and checks**
- **FR-010**: One command starts a local preview of a project's boards, with live reload and a voice,
  scheme and pen picker. On its canvas the live boards can be used in place, and the canvas pans and
  zooms with the pointer as other canvases do, fits a page or shows boards at their own size, and shows
  where the visible part lies on the page. The boards of a page are also listed by name, and a board
  chosen on the canvas shows its size, states, props, links to and from other boards, errors, and the
  single-board command (FR-014) that renders it as shown.
- **FR-011**: One command renders every board, without a display, at its declared sizes and in each of its
  named states (FR-050). The designs store no rendered images. This repository's sample boards are compared
  with stored references, which guards the renderer; differences produce images.
- **FR-012**: The checks report, per board, render errors and unsupported features (FR-003), in a form an agent
  can read.
- **FR-013**: The preview can be shown in another program, such as the hub, as a live picture with the board's
  pixels unchanged, that takes that program's pointer, touch and keys and can be told which board to show in
  which voice, scheme, pen and size; it reaches no network but the preview.
- **FR-014**: One command renders a single board, without a display, in a chosen voice, scheme, pen, size and
  named state (FR-050), optionally after a series of clicks, and gives an image file and the errors the board
  raised, in a form an agent
  can read. A click that finds no target is an error.
- **FR-015**: The checks of a proposed change to a design render the boards it changes and keep the images with
  the run, outside the repository.
- **FR-016**: One command writes a design folder as static files that give the preview's pages and behaviour
  without a server (canvas, board view, voice, scheme and pen picker, the board's own props, links between boards;
  no live reload), from any sub-path of a static host. Every design on the main line is published on this
  repository's site, in the same publication as the Interleaf reference, with a page that lists the designs.
- **FR-017**: Each open proposed change from this repository that changes a design also has its designs published
  on that site, at an address of its own that stays the same for the life of the proposal, with the boards of its
  latest revision. The proposal carries a link to that address, kept current with each publication. The copy of a
  closed proposal is gone from the next publication.
- **FR-018**: The boards are rendered in the viewer's browser; publishing stores no rendered image in the
  repository and ships nothing of claude.ai. A published board makes the viewer's browser contact no other site:
  the fonts it asks for come from the vendored faces (FR-020), as in the checks. Publishing reads a proposal's design files as data and runs only
  this repository's main-line tools; proposals from forks are not published, since their boards would run on the
  site.

**States**
- **FR-050**: A board can name its states. A state has a name and an identifier and is a set of values of the
  board's own props; it can name the state it is reached from and the words of that step. Named states are part of
  the supported subset (FR-005). A state that names a prop the board does not declare, a value outside a prop's
  options, or an identifier used twice, is an error (FR-003). A board that names no states works as before.
- **FR-051**: Every view that shows a board with named states offers them, shows which one is shown, and can be
  told one by its address (FR-052).

**Viewing and reviewing**
- **FR-052**: Every view of the preview and of the published designs has an address that brings it back as it is:
  the design, the view, the board, its state, the voice, scheme and pen, and, in a review, the board and the way of
  comparing. Voice, scheme and pen apply to every board shown, chosen by a picture of each, and one board can
  differ.
- **FR-053**: The boards of every design can be found by name, and states by their names, from any view, with the
  keyboard alone.
- **FR-054**: One view shows a single board in every combination of two chosen of: voice, scheme, pen, its named
  states. A combination in which the board raised an error is marked on it. One combination is shown large.
- **FR-055**: The published copy of a proposal (FR-017) has a review: the boards the proposal adds, removes, and
  changes (its own file, a board it imports, or a file it loads differs from the main line), each with its errors. For a board, the main line's and the
  proposal's renderings in the same voice, scheme, pen and state are shown next to each other, as one with a
  movable divider, as one faded over the other, or as the proposal's with the regions that differ marked and
  counted. A board that is new, or removed, shows that it is absent on the other side.
- **FR-056**: The reviewer can mark a board as looked at. The marks are kept for that reviewer in their own
  browser only: never sent anywhere, never published, and gone when the reviewer clears the site's data. A board
  that changes after it was marked (as in FR-055) loses the mark and is shown as changed since. The review shows how many
  boards are marked and moves to the next one not marked.
- **FR-057**: Comments on a proposal are made on the proposal itself. The review links to it, and gives each board
  an address (FR-052) to quote there. The viewer has no accounts and keeps nothing on a server (FR-018).
- **FR-058**: One view shows the boards of a page as a map: an arrow for each link from a board to another and for
  each named state reached from another (FR-050), labelled with the link's words or the step's, and the boards no
  arrow reaches listed apart. The map can be followed step by step from a chosen board.
- **FR-059**: One board can be shown in a frame of the device it is drawn for, in the E-ink scheme.
- **FR-060**: The published site's designs page lists the open proposals that change a design first, each with the
  number of boards it changes and the result of its checks, then the designs of the main line.
- **FR-061**: The viewer is drawn with Interleaf (spec 002) in the White voice, paper or night, whatever voice the
  boards are shown in. Every mark it draws (interactive, changed, added, removed, error, looked at) differs in shape
  or words, never in colour alone, and every action has a key.

**Designs**
- **FR-020**: Each project has one folder of boards with its canvas description and any fonts its boards load
  beyond Interleaf's. The boards use this repository's Interleaf and renderer, never a copy.
- **FR-021**: Every design is checked with every change to this repository; a board that raises an error fails
  the change.
- **FR-022**: The folder of designs states that boards are proposals and can differ from the programs.

## Contracts

| Contract | Owned / consumed | Version | Spec location |
|---|---|---|---|
| Design-component format (boards, canvas description) | consumed (claude.ai, unversioned there); the supported subset is owned | 2 (the subset; 2 adds named states) | this spec, FR-005, FR-050 |
| Preview, check and single-board commands, their output | owned | 2 (2: states in the checks and the single-board command) | this spec |
| Static export and the published designs (addresses: `designs/PROJECT/`, `designs/pr-N/PROJECT/`, and the address of every view in them) | owned | 2 (2: view addresses, the review) | this spec, FR-016, FR-017, FR-052, FR-055 |
| Live picture: its commands and events | owned | 1 | this spec |
| Interleaf web form | consumed (spec 002) | 1 | spec 002 |

## Device scope and risk

Device-neutral. No device risk: nothing flashes or touches boot, recovery or user data.

## Acceptance

- Host: every board of the shell's and the hub's designs renders with no error and no unsupported feature.
- Host: the interactive boards react to scripted clicks (state, branches, links) as their logic says.
- Host: a single board rendered in two voices gives two different images; a click changes the image; a click on a
  missing target and a board that raises an error are both reported.
- Host: the checks run in CI for the sample boards here; a changed sample board produces a difference image.
- Host: the static export of the sample boards, served by a plain static server under a sub-path, renders every
  board without an error, and its canvas, board view, picker and links work; the shell's and the hub's exports
  render the same way.
- Site: the designs page lists every design on the main line and every open design proposal of this repository;
  a proposal's link opens its boards; a closed proposal's copy is gone after the next publication.
- Host: a board with named states renders each state in the checks and by name in the single-board image; a state
  with an unknown prop, an unknown value or a repeated identifier is reported; a board without states renders as
  before.
- Host: an address of each view, opened afresh, shows the same board, state, voice, scheme, pen and comparison.
- Host: the export of a proposal that adds, changes and removes boards lists exactly those, and for a changed board
  the marked regions cover every pixel that differs and no region is empty.
- Host: a board marked as looked at keeps its mark across a reload, and loses it when it or a file it loads
  changes; nothing
  about the marks leaves the browser.
- Host: the map of the sample boards has an arrow for every link and every state reached from another, and lists
  the boards none reaches.
- Site: the designs page lists open proposals before the designs; a proposal's review opens from it.
- By eye (the user): the boards of each design in the preview; a review of a real proposal, board by board.

## Out of scope

- The designer persona and the hub's browser view (hub).
- Editing boards in a visual editor; the boards are edited as files.
- Noticing when claude.ai changes the meaning of a format feature the subset already supports.
- Implementing the designed screens in the programs.
- Showing a board at the physical size of the device, which needs the viewer's screen density.
- Named flows across a page (an order of boards to walk), beyond following the map from a chosen board.
- Review marks shared between reviewers, and comments kept by the viewer.

## Success criteria

- **SC-001**: All boards of the shell's and the hub's designs render in the preview and the user accepts them
  by eye.
- **SC-002**: A designer agent can change a board and see the result, in any voice, scheme, pen and size and after
  clicks, as an image without a display and without claude.ai.
- **SC-003**: No file of claude.ai's runtime is in any organization repository.
- **SC-004**: A reviewer opens a proposed design from the link on its proposal and looks at its boards in the
  browser before it is accepted.
- **SC-005**: A reviewer goes through every board a proposal changes, before and after, from the proposal's link
  alone, and comes back later to the boards they have not looked at yet.
- **SC-006**: No board of the shell's or the hub's designs needs to draw its own way to switch between its states.
