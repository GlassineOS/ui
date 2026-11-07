# Feature Specification: Interleaf, kept here

**Feature Branch**: `spec-ui-interleaf`
**Created**: 2026-11-07
**Status**: Draft
**Input**: The Interleaf design system (claude.ai design system "Interleaf", as published on 2026-11-07) and
the decision that this repository, not claude.ai, is its source from now on.

## Context

Interleaf is the design system of GlassineOS: three voices (White, Editorial, Stationery), each in several
schemes (Paper, Night, E-ink) and with three pens, plus components and the rules for using them. Today it lives
on claude.ai, and every place that uses it keeps a copy: the design system itself, an embedded copy in each of
the two design canvases (the shell and the hub), the documentation site's own token file, the hub's hand-written
styles (White voice only), and this repository's voices, which hold the E-ink scheme only and are imported from
the design canvas's component code.

Design work now happens in repositories, done by agents (a designer persona in the hub) and reviewed in pull
requests. So the whole design system moves here, every consumer reads it from here, and the claude.ai copies
become something this repository publishes to, never reads from. Spec 001 (voices and drawing) is the part of
this already done for the programs that draw themselves; this spec extends it to the whole system and to the web.

## User scenarios

### Scenario 1 – A token changes once (Priority: P1)

**Given** a designer changes Stationery Night's soft ink,
**When** the change is merged and the consumers are rebuilt,
**Then** the desktop programs, the documentation site, the hub and the design boards all show the new colour,
and none of their own sources changed apart from the version they pin.

### Scenario 2 – The checks catch an inaccessible change (Priority: P1)

**Given** a designer proposes a hover colour on leather that reaches only 2:1 against it,
**When** the checks run on the pull request,
**Then** they fail, naming the voice, scheme, pen, component, state and the measured ratio.

### Scenario 3 – Browsing the system (Priority: P2)

**When** the user or an agent opens the system's reference,
**Then** they see the guidelines, every token and every component with a live preview, and can switch voice,
scheme and pen, locally with one command and on a published page.

### Scenario 4 – Publishing to claude.ai (Priority: P3)

**Given** a merged change,
**When** the maintainer asks for it,
**Then** the claude.ai design system and the copies embedded in the design canvases are replaced with this
repository's version, and nothing is read back from them.

## Requirements

**Source**
- **FR-001**: The whole design system is defined once, in this repository: the tokens for every voice, scheme and
  pen (structure, colour, type, space, radius, edges, strokes, layout), the components, and the guidelines.
- **FR-002**: The starting content is the claude.ai design system as published on 2026-11-07, imported once
  and recorded with the version it came from. After the import no claude.ai copy is read as a source.
- **FR-003**: The voices of spec 001 are derived from these tokens for the E-ink scheme. The values that exist
  only for the drawn programs' own surfaces (shell, settings card, setup) stay voice data here and are edited
  here; importing them from the design canvas's code ends.
- **FR-004**: Token names and their meaning are a versioned contract. Removing or renaming a token, or changing
  what it means, is a breaking change.

**Forms**
- **FR-010**: A web form of the system (variables for every theme, and the component styles) lets a page choose
  voice, scheme and pen, and is usable by the documentation site, the hub and the design boards without copying.
- **FR-011**: Every form generated from the tokens is checked: a form that is out of date with the tokens fails
  the checks (as spec 001 FR-003 does for the voices).
- **FR-012**: Each consumer outside this repository (documentation site, hub) takes the web form by a pinned
  version. Their own token copies go away in their repositories, by their own changes.

**Checks**
- **FR-020**: A contrast check covers every voice × scheme × pen combination (27), at desktop and phone width,
  every component, and the states the guidelines name: hover and focus in every pen, the current navigation
  item, opened details, text over patterns and highlighter bands (against the worst colour beneath), and text
  that the styles generate themselves. Targets are the guidelines' (WCAG 2.2 AA).
- **FR-021**: In the E-ink schemes every colour is one of the 16 greys and no style uses a gradient or a blur.
- **FR-022**: Each component's preview is rendered in every combination and compared with a stored reference;
  a difference produces an image an agent and a reviewer can look at.
- **FR-023**: All checks run without a display and give results an agent can read (pass or fail per case, the
  measured value, the image of a difference).

**Reference**
- **FR-030**: A browsable reference is built from this repository: guidelines, tokens, components with live
  previews, and a voice, scheme and pen picker.
- **FR-031**: The reference opens locally with one command and is published from the main branch.

**Publishing to claude.ai**
- **FR-040**: On request, the system is published to the claude.ai design system and into the embedded copies
  of the design canvases, replacing what is there. This is one-way and never automatic.

## Contracts

| Contract | Owned / consumed | Version | Spec location |
|---|---|---|---|
| Interleaf tokens (names, meaning, values) | owned (was consumed) | 1 | this spec, README "Interleaf" |
| Web form (variables, component styles, how voice/scheme/pen are chosen) | owned | 1 | this spec, README "Web" |
| Voice data | owned | 1 (unchanged) | spec 001 |
| Interleaf on claude.ai | published to | n/a | FR-040 |

The repository principles change with this spec: Interleaf moves from consumed to owned.

## Device scope and risk

Device-neutral. No device risk: nothing flashes or touches boot, recovery or user data.

## Acceptance

- Host: the checks regenerate every form and fail on a difference; the contrast check runs over all 27
  combinations and states; the previews are compared with their references. They run in CI.
- Host: the 2026-10-31 audit's failures (Stationery drawer, Night details, focus on leather and cream, footer
  credit, Night code comments), put back one at a time, each fail the contrast check.
- Host: the voices of spec 001 are unchanged by moving their source (their render tests stay green).
- Product level: none in this repository; the documentation site and the hub look unchanged after they move
  onto the web form (checked in their repositories).

## Out of scope

- The design boards of the shell and the hub, and their preview (spec 003).
- The designer persona and how the hub shows a browser (hub).
- Moving the documentation site and the hub onto the web form (their repositories).
- New voices, schemes or design changes; bringing the GTK themes' off-ladder greys onto the scheme.

## Success criteria

- **SC-001**: Once the consumers have moved, each Interleaf value exists in exactly one place in the
  organization's sources.
- **SC-002**: Every failure of the 2026-10-31 audit, reintroduced, is caught by the checks.
- **SC-003**: A token change reaches the desktop programs, the documentation site and the hub with no edit in
  their repositories other than the pinned version.
