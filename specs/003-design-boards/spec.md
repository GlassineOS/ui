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
  scheme and pen picker.
- **FR-011**: One command renders every board, without a display, at its declared sizes. The designs store
  no rendered images. This repository's sample boards are compared with stored references,
  which guards the renderer; differences produce images.
- **FR-012**: The checks report, per board, render errors and unsupported features (FR-003), in a form an agent
  can read.
- **FR-013**: The preview can be served to the hub, so a session's boards can be shown to the user there.
- **FR-014**: One command renders a single board, without a display, in a chosen voice, scheme, pen and size,
  optionally after a series of clicks, and gives an image file and the errors the board raised, in a form an agent
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
  repository and ships nothing of claude.ai. Publishing reads a proposal's design files as data and runs only
  this repository's main-line tools; proposals from forks are not published, since their boards would run on the
  site.

**Designs**
- **FR-020**: Each project has one folder of boards with its canvas description and any fonts its boards load
  beyond Interleaf's. The boards use this repository's Interleaf and renderer, never a copy.
- **FR-021**: Every design is checked with every change to this repository; a board that raises an error fails
  the change.
- **FR-022**: The folder of designs states that boards are proposals and can differ from the programs.

## Contracts

| Contract | Owned / consumed | Version | Spec location |
|---|---|---|---|
| Design-component format (boards, canvas description) | consumed (claude.ai, unversioned there); the supported subset is owned | 1 (the subset) | this spec, FR-005 |
| Preview, check and single-board commands, their output | owned | 1 | this spec |
| Static export and the published designs (addresses: `designs/PROJECT/`, `designs/pr-N/PROJECT/`) | owned | 1 | this spec, FR-016, FR-017 |
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
- By eye (the user): the boards of each design in the preview.

## Out of scope

- The designer persona and the hub's browser view (hub).
- Editing boards in a visual editor; the boards are edited as files.
- Noticing when claude.ai changes the meaning of a format feature the subset already supports.
- Implementing the designed screens in the programs.

## Success criteria

- **SC-001**: All boards of the shell's and the hub's designs render in the preview and the user accepts them
  by eye.
- **SC-002**: A designer agent can change a board and see the result, in any voice, scheme, pen and size and after
  clicks, as an image without a display and without claude.ai.
- **SC-003**: No file of claude.ai's runtime is in any organization repository.
- **SC-004**: A reviewer opens a proposed design from the link on its proposal and looks at its boards in the
  browser before it is accepted.
