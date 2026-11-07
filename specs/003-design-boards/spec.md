# Feature Specification: Design boards

**Feature Branch**: `spec-ui-interleaf`
**Created**: 2026-11-07
**Status**: Draft
**Input**: The two design canvases on claude.ai ("Glassine OS Shell" and the hub's "Project Command Center"),
and the decision that repositories are their source from now on.

## Context

The shell's and the hub's designs are canvases of boards on claude.ai: screens, states and small interactive
prototypes, built on Interleaf. A board is a file in claude.ai's design-component format, which only claude.ai
renders today. To design in repositories, the boards need to render, be clicked through, be screenshotted and
be compared without claude.ai, by people and by agents. The boards themselves move to the repositories they
describe (the shell's to the shell, the hub's to the hub); this repository provides what renders and checks
them, on Interleaf (spec 002).

## User scenarios

### Scenario 1 – A board opens in a browser (Priority: P1)

**Given** a repository with design boards,
**When** the designer starts the preview,
**Then** each board renders in a browser as it did on claude.ai, nested boards included, in the voice, scheme
and pen chosen, and edits to a board show on save.

### Scenario 2 – An agent checks its own change (Priority: P1)

**Given** an agent has changed a board,
**When** it runs the board checks,
**Then** it gets a screenshot of every board at its sizes, an image of every difference from the stored
references, and any error a board raised, all without a display.

### Scenario 3 – Clicking through a prototype (Priority: P2)

**Given** a board marked interactive,
**When** the user clicks its controls and links in the preview,
**Then** it reacts as on claude.ai: state changes, branches and links between boards.

### Scenario 4 – A new prototype beside the old (Priority: P2)

**When** a designer starts a new prototype next to existing boards,
**Then** it appears in the preview's canvas next to them, can be compared side by side, and is kept or dropped
in review.

## Requirements

**Rendering**
- **FR-001**: Boards in claude.ai's design-component format, as documented by claude.ai on 2026-11-07, render
  outside claude.ai: templated text and attributes, conditions, repetition, nested boards, events, state and the
  component logic, and the head content a board declares.
- **FR-002**: The renderer is written here from the format's description. No part of claude.ai's own editor or
  runtime is copied into the organization's sources.
- **FR-003**: Format features the renderer does not support fail visibly, naming the board and the feature;
  they never render silently wrong.
- **FR-004**: The canvas layout (board positions, pages, notes, which boards are interactive) is read from the
  canvas description that comes with the boards, and the preview shows it as a canvas.

**Preview and checks**
- **FR-010**: One command starts a local preview of a repository's boards, with live reload and a voice,
  scheme and pen picker.
- **FR-011**: One command renders every board, without a display, at its declared sizes and in the
  combinations the repository lists, and compares each with a stored reference; differences produce images.
- **FR-012**: The checks report, per board, render errors, unsupported features (FR-003) and differences, in a
  form an agent can read.
- **FR-013**: The preview can be served to the hub, so a session's boards can be shown to the user there.

**Use from other repositories**
- **FR-020**: Repositories with boards use this repository's renderer, preview, checks and Interleaf by a pinned
  version, never by a copy.
- **FR-021**: A one-time import brings a claude.ai canvas's boards, canvas description and sample data into a
  repository, leaving out claude.ai's own files and the canvas's embedded copy of Interleaf.

**Publishing to claude.ai**
- **FR-030**: On request, a repository's boards can be published back to their claude.ai canvas, one-way, with
  the Interleaf copy of spec 002 FR-040.

## Contracts

| Contract | Owned / consumed | Version | Spec location |
|---|---|---|---|
| Design-component format (boards, canvas description) | consumed (claude.ai, as of 2026-11-07); the supported subset is owned | 1 | this spec, README "Boards" |
| Preview and check commands, their output | owned | 1 | this spec, README "Boards" |
| Interleaf web form | consumed (spec 002) | 1 | spec 002 |

## Device scope and risk

Device-neutral. No device risk: nothing flashes or touches boot, recovery or user data.

## Acceptance

- Host: every board of both canvases, as imported on 2026-11-07, renders with no error and no unsupported
  feature.
- Host: the interactive boards react to scripted clicks (state, branches, links) as their logic says.
- Host: the checks run in CI for the sample boards here; a changed board produces a difference image.
- By eye (the user, once per canvas): each board's preview against its claude.ai rendering.

## Out of scope

- Moving the canvases into the shell and hub repositories (their changes, using FR-021).
- The designer persona and the hub's browser view (hub).
- Editing boards in a visual editor; the boards are edited as files.
- Implementing the designed screens in the programs.

## Success criteria

- **SC-001**: All boards of both canvases render in the preview, and the user accepts them by eye against
  claude.ai.
- **SC-002**: A designer agent can change a board and see the result as images without a display and without
  claude.ai.
- **SC-003**: No file of claude.ai's runtime is in any organization repository.
