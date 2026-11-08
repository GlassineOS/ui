# Feature Specification: Design boards

**Feature Branch**: `spec-ui-interleaf`
**Created**: 2026-11-07
**Status**: Draft
**Input**: The design boards of the shell and the hub, kept in their repositories and built on Interleaf.

## Context

The designs of the shell and the hub are canvases of boards: screens, states and small interactive prototypes,
built on Interleaf (spec 002). The boards live in the repository whose program they describe and are written in
claude.ai's design-component format. They are rendered, clicked through and screenshotted by people and by agents,
without claude.ai. This repository provides what renders and checks them.

## User scenarios

### Scenario 1 – A board opens in a browser (Priority: P1)

**Given** a repository with design boards,
**When** the designer starts the preview,
**Then** each board renders in a browser, nested boards included, in the voice, scheme and pen chosen, and
edits to a board show on save.

### Scenario 2 – An agent checks its own change (Priority: P1)

**Given** an agent has changed a board,
**When** it runs the board checks,
**Then** it gets a screenshot of every board at its sizes and any error a board raised, all without a display.

### Scenario 3 – Clicking through a prototype (Priority: P2)

**Given** a board marked interactive,
**When** the user clicks its controls and links in the preview,
**Then** it reacts as its logic says: state changes, branches and links between boards.

### Scenario 4 – A new prototype beside the old (Priority: P2)

**When** a designer starts a new prototype next to existing boards,
**Then** it appears in the preview's canvas next to them, can be compared side by side, and is kept or dropped
in review.

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
- **FR-010**: One command starts a local preview of a repository's boards, with live reload and a voice,
  scheme and pen picker.
- **FR-011**: One command renders every board, without a display, at its declared sizes. Repositories with
  boards store no rendered images of them. This repository's sample boards are compared with stored references,
  which guards the renderer; differences produce images.
- **FR-012**: The checks report, per board, render errors and unsupported features (FR-003), in a form an agent
  can read.
- **FR-013**: The preview can be served to the hub, so a session's boards can be shown to the user there.

**Use from other repositories**
- **FR-020**: Repositories with boards use this repository's renderer, preview, checks and Interleaf by a pinned
  version, never by a copy.

## Contracts

| Contract | Owned / consumed | Version | Spec location |
|---|---|---|---|
| Design-component format (boards, canvas description) | consumed (claude.ai, unversioned there); the supported subset is owned | 1 (the subset) | this spec, FR-005 |
| Preview and check commands, their output | owned | 1 | this spec |
| Interleaf web form | consumed (spec 002) | 1 | spec 002 |

## Device scope and risk

Device-neutral. No device risk: nothing flashes or touches boot, recovery or user data.

## Acceptance

- Host: every board of the shell's and the hub's designs renders with no error and no unsupported feature.
- Host: the interactive boards react to scripted clicks (state, branches, links) as their logic says.
- Host: the checks run in CI for the sample boards here; a changed sample board produces a difference image.
- By eye (the user): the boards of each design in the preview.

## Out of scope

- The designer persona and the hub's browser view (hub).
- Editing boards in a visual editor; the boards are edited as files.
- Noticing when claude.ai changes the meaning of a format feature the subset already supports.
- Implementing the designed screens in the programs.

## Success criteria

- **SC-001**: All boards of the shell's and the hub's designs render in the preview and the user accepts them
  by eye.
- **SC-002**: A designer agent can change a board and see the result as images without a display and without
  claude.ai.
- **SC-003**: No file of claude.ai's runtime is in any organization repository.
