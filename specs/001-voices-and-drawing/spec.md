# Feature Specification: Voices and drawing

**Feature Branch**: `spec-ui-voices`
**Created**: 2026-11-06
**Status**: Draft
**Input**: The "Glassine OS Shell" design canvas (its three voices: White, Editorial, Stationery) and the
shell, settings, setup and Home programs that draw them.

## Context

Every GlassineOS screen that draws itself (the shell's bar and panels, Settings, the first-run setup, Home)
uses the same three voices: fonts, greys, edges, radii, rules and the shapes built from them. Today the voices
exist three times (once hand-written for the shell, twice generated for Settings and setup), and setup draws
with Settings' painting code, so neither can live without the other. This repository holds the voices once and
the drawing built on them, for every program that draws.

## User scenarios

### Scenario 1 – One voice everywhere (Priority: P1)

**Given** the Editorial voice is chosen,
**When** I open the bar, Settings, setup and Home,
**Then** every heading, row, card, button and focus ring has the same font, weight, grey, edge and radius in
all four.

### Scenario 2 – A voice changes once (Priority: P1)

**Given** a designer changes the Stationery card edge,
**When** the voice data is updated in this repository and the programs are rebuilt,
**Then** all four programs show the new edge, and no program's own sources change.

### Scenario 3 – Programs stand alone (Priority: P2)

**When** setup is installed without Settings (or Home without the shell),
**Then** it still draws, because it needs only this repository.

## Requirements

**Voices**
- **FR-001**: The three voices (White, Editorial, Stationery) are defined once, as data, in this repository.
  Every value comes from the design's E-ink scheme (the 16-grey ladder; hard edges only, no blur).
- **FR-002**: The voice data covers what every current consumer uses: fonts (family, weight, size, line height,
  case, letter spacing), greys by role (paper, sheet, ink, soft ink, rule, shade, highlight, dim, accent and the
  Stationery extras), card, button, pill and keycap shapes (radius, edge, ring, offset), rules, header height,
  focus ring (2 px, 2 px offset).
- **FR-003**: Programs written in C and in Python read the same voices; neither keeps its own copy. A check fails
  when a generated form is out of date with the data.
- **FR-004**: A voice is chosen by name; unknown names fall back to White.

**Drawing**
- **FR-010**: A C drawing library provides what the shell draws with today: boxes with per-corner radii, rings and
  offsets; filled, rounded, stroked and dashed shapes and rules; text measured, placed, aligned, elided and
  wrapped; icons by name from the icon themes at a pixel size (one-colour recolour, cached).
- **FR-011**: A Python drawing module provides what Settings and setup draw with today (their shared painting
  code), on the same voices.
- **FR-012**: Drawing the same element with the same voice in C and in Python gives the same pixels within one
  grey step (host render test).
- **FR-013**: The drawing code never animates and never redraws by itself; it draws what it is asked once.

**Packaging**
- **FR-020**: The repository builds and installs on its own: a shared C library with headers and a
  pkg-config file, a Python package, and the voice data.
- **FR-021**: Moving the shell, Settings and setup onto this repository changes no pixels of their current
  renders (their host render tests stay green), apart from differences this spec lists.

## Contracts

| Contract | Owned / consumed | Version | Spec location |
|---|---|---|---|
| Voice data (names, roles, values) | owned | 1 | this spec, README "Voices" |
| C drawing API (header, pkg-config name) | owned | 1 | this spec, README "C API" |
| Python drawing API (package and functions) | owned | 1 | this spec, README "Python API" |

## Device scope and risk

Device-neutral. No device risk: nothing flashes or touches boot, recovery or user data.

## Acceptance

- Host: `make check` regenerates the voice forms and fails on a difference; builds the C library; renders a
  sample sheet of every element in the three voices from C and from Python and compares them (FR-012).
- Host: the shell's, Settings' and setup's render tests pass against this repository (FR-021).
- Hardware (supervised): the bar, Settings and setup on the device in each voice.

## Out of scope

- Home's own widgets and layout (`GlassineOS/home`).
- New voices or design changes.

## Success criteria

- **SC-001**: Each voice value exists in exactly one place in the organization's sources.
- **SC-002**: Setup runs with Settings removed.
