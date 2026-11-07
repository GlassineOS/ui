# Feature Specification: Interleaf

**Feature Branch**: `spec-ui-interleaf`
**Created**: 2026-11-07
**Status**: Draft
**Input**: The Interleaf design system, and this repository as its source.

## Context

Interleaf is the design system of GlassineOS: three voices (White, Editorial, Stationery), each in several
schemes (Paper, Night, E-ink) and with three pens, plus components and the rules for using them. Everything
that looks like GlassineOS builds on it: the programs that draw themselves (spec 001), the documentation site,
the hub and the design boards (spec 003). Design work is done in pull requests, by people and by agents, so the
system, its checks and its reference all live in this repository.

## User scenarios

### Scenario 1 – A token changes once (Priority: P1)

**Given** a designer changes Stationery Night's soft ink,
**When** the change is released and the consumers are rebuilt,
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

## Requirements

**Source**
- **FR-001**: The whole design system is defined in this repository and only here: the tokens for every voice,
  scheme and pen (structure, colour, type, space, radius, edges, strokes, layout), the components, and the
  guidelines.
- **FR-002**: The scheme tokens of spec 001's voices are generated from these tokens' E-ink schemes. Everything
  else in the voice data is maintained in this repository as voice data: the drawn programs' own surfaces
  (shell, settings card, setup), the values the designs write in their component code, the per-form overrides
  (each with its reason), and the look of the programs that do not draw with this repository.
- **FR-003**: Token names and their meaning are a versioned contract. Removing or renaming a token, or changing
  what it means, is a breaking change.

**Forms**
- **FR-010**: A web form of the system (variables for every theme, and the component styles) lets a page choose
  voice, scheme and pen. The documentation site, the hub and the design boards use it by a pinned version.
- **FR-011**: Every form is generated from the tokens; a form that is out of date with them fails the checks.

**Checks**
- **FR-020**: A contrast check covers every voice × scheme × pen combination (27), at desktop and phone width,
  every component, and the states the guidelines name: hover and focus in every pen, the current navigation
  item, opened details, text over patterns and highlighter bands (against the worst colour beneath), and text
  that the styles generate themselves. Targets are the guidelines' (WCAG 2.2 AA). In the E-ink schemes contrast
  is measured on the token values; how the display engine turns them into panel levels is not part of this
  check.
- **FR-021**: In the E-ink schemes every colour is exactly one of the 16 ladder greys (`#000000`, `#111111` …
  `#ffffff`), and no style uses a gradient or a blur.
- **FR-022**: Each component's preview is rendered in every combination and compared with a stored reference;
  a difference produces an image an agent and a reviewer can look at.
- **FR-023**: All checks run without a display and give results an agent can read (pass or fail per case, the
  measured value, the image of a difference).

**Reference**
- **FR-030**: A browsable reference is built from this repository: guidelines, tokens, components with live
  previews, and a voice, scheme and pen picker.
- **FR-031**: The reference opens locally with one command and is published from the main branch.

## Contracts

| Contract | Owned / consumed | Version | Spec location |
|---|---|---|---|
| Interleaf tokens (names, meaning, values) | owned | 1 | this spec |
| Web form (variables, component styles, how voice/scheme/pen are chosen) | owned | 1 | this spec |
| Voice data | owned | 1 | spec 001 |

## Device scope and risk

Device-neutral. No device risk: nothing flashes or touches boot, recovery or user data.

## Acceptance

- Host: the checks regenerate every form and fail on a difference; the contrast check runs over all 27
  combinations and states; the previews are compared with their references. They run in CI.
- Host: a set of known contrast failures (cream navigation on paper in the Stationery drawer, Night details
  summaries, focus rings on leather and on cream, the footer credit, Night code comments), each put into the
  tokens or styles on its own, fails the contrast check.
- Host: the voices of spec 001 render as their references (their render tests stay green), apart from the
  ladder corrections FR-021 requires, listed with the updated references.
- By eye (the user, on the device, supervised): the ladder-corrected greys in each voice.

## Out of scope

- The design boards and their preview (spec 003).
- The designer persona and how the hub shows a browser (hub).
- How the documentation site and the hub apply the web form (their repositories).

## Success criteria

- **SC-001**: Each Interleaf value is written by hand in exactly one place in the organization's sources: this
  repository. Every other form of it, here or in a consumer, is generated from that place and checked against
  it.
- **SC-002**: Every known contrast failure of the acceptance set is caught by the checks.
- **SC-003**: A token change reaches the desktop programs, the documentation site and the hub with no edit in
  their repositories other than the pinned version and the forms regenerated from it.
