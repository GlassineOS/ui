/* GlassineOS hub — shared mock data for every current board.
   One source of truth: screens and components read window.HUB and never define their own copies. */
window.HUB = {
  user: 'maintainer',
  layers: ['STRATEGY', 'KNOWLEDGE & RULES', 'DISTRIBUTION', 'SYSTEM', 'HARDWARE ENABLEMENT'],
  repos: [
    { name: 'hub', layer: 'STRATEGY', issues: 14, prs: 3, runs: 'pppppppppp', last: '2 h ago', release: 'unreleased', commit: 'hubd: refuse gh api --input paths', labels: [['strategic', 9], ['hub', 5]] },
    { name: 'docs', layer: 'KNOWLEDGE & RULES', issues: 19, prs: 2, runs: 'pppppppppr', last: '12 min ago', release: 'site live', commit: 'guides: EDL recovery draft', labels: [['guide', 11], ['hardware', 6], ['fix', 2]] },
    { name: 'interleaf', layer: 'KNOWLEDGE & RULES', issues: 7, prs: 1, runs: 'pppppppppp', last: 'yesterday', release: 'v1.0.0', commit: 'stationery: focus ring on leather', labels: [['a11y', 4], ['tokens', 3]] },
    { name: 'image-builder', layer: 'DISTRIBUTION', issues: 8, prs: 2, runs: 'pppppppfff', last: '41 min ago', release: 'none', commit: 'build: add binfmt setup step', labels: [['ci', 5], ['rootfs', 3]] },
    { name: 'packages', layer: 'DISTRIBUTION', issues: 6, prs: 1, runs: 'pppppppppp', last: '3 days ago', release: 'repo 2026.10', commit: 'shell: bump to 0.6.0', labels: [['packaging', 4], ['bug', 2]] },
    { name: 'shell', layer: 'SYSTEM', issues: 38, prs: 5, runs: 'ppppppfppp', last: '1 h ago', release: 'v0.6.0', commit: 'quick settings: voice picker', labels: [['ui', 17], ['bug', 13], ['voice', 8]] },
    { name: 'ink-input', layer: 'SYSTEM', issues: 14, prs: 3, runs: 'pppppppppp', last: '3 h ago', release: 'v0.3.2', commit: 'pen: predictive smoothing', labels: [['latency', 7], ['bug', 5]] },
    { name: 'reader', layer: 'SYSTEM', issues: 11, prs: 1, runs: 'pppppppppp', last: '3 weeks ago', release: 'v0.2.0', commit: 'epub: fix hyphenation', labels: [['feature', 6], ['bug', 5]] },
    { name: 'kernel', layer: 'HARDWARE ENABLEMENT', issues: 31, prs: 6, runs: 'ppfppppppr', last: '18 min ago', release: 'none', commit: 'drm/epd: add waveform LUT loader', labels: [['bug', 14], ['driver', 11], ['dts', 6]] },
    { name: 'epd', layer: 'HARDWARE ENABLEMENT', issues: 9, prs: 0, runs: 'pppppppppp', last: '4 days ago', release: 'none', commit: 'lut: header parser', labels: [['driver', 5], ['bug', 4]] },
    { name: 'firmware', layer: 'HARDWARE ENABLEMENT', issues: 6, prs: 0, runs: 'pppppppppp', last: '6 days ago', release: 'none', commit: 'readme: licence status of blobs', labels: [['licence', 3], ['waveform', 3]] }
  ],
  unplaced: ['epd-experiments'],
  totals: { issues: 163, prs: 25, failing: 'image-builder, shell', docsIndex: 'building' },

  /* Items: issues, pull requests, workflow runs, roadmap items. partOf = the “Part of …” line in the body. */
  items: {
    'hub#44': { kind: 'roadmap', title: 'EPD waveform driver', status: 1, partOf: null, linked: [['kernel', 2, 6], ['firmware', 1, 2], ['epd', 0, 2]], who: 'maintainer', target: 'Dec 2026' },
    'hub#41': { kind: 'roadmap', title: 'Mainline kernel boots to framebuffer', status: 1, linked: [['kernel', 5, 7], ['boot', 3, 3]], who: 'maintainer', target: 'Dec 2026' },
    'hub#47': { kind: 'roadmap', title: 'EDL recovery path, documented', status: 2, linked: [['boot', 4, 4], ['docs', 2, 3]], who: 'docs-edl', target: 'Dec 2026' },
    'hub#52': { kind: 'roadmap', title: 'Pen input latency under 20 ms', status: 1, linked: [['ink-input', 2, 5], ['shell', 1, 4]], who: 'maintainer', target: 'Mar 2027' },
    'hub#55': { kind: 'roadmap', title: 'Interleaf voices in the shell', status: 2, linked: [['shell', 3, 6], ['interleaf', 4, 4]], who: 'maintainer', target: 'Mar 2027' },
    'hub#60': { kind: 'roadmap', title: 'Reproducible images built in CI', status: 0, linked: [['image-builder', 0, 4], ['packages', 1, 3]], who: 'unassigned', target: 'Jun 2027' },
    'hub#63': { kind: 'roadmap', title: 'docs.glassine.org v1', status: 0, linked: [['docs', 3, 12]], who: 'unassigned', target: 'Jun 2027' },
    'hub#36': { kind: 'roadmap', title: 'Hub: first private push after review', status: 3, linked: [['hub', 6, 6]], who: 'maintainer', target: 'Nov 2026' },

    'kernel#212': { kind: 'pr', title: 'drm/epd: add waveform LUT loader', state: 'REVIEWED', icon: 'r', age: '3h', group: 'NEEDS YOU', branch: 'agent/kernel-lut → main', size: '+412 −38', partOf: 'kernel#204', author: 'maintainer via kernel-lut', threads: 3,
      body: 'Loads waveform tables from /lib/firmware and selects a mode by panel temperature.', checks: [['build · arm64', 'p', '6m 12s'], ['checkpatch', 'p', '41s'], ['dt-validate', 'p', '1m 03s'], ['boot-test · qemu', 'r', '2m so far'], ['sign-off', 'p', '1s']],
      files: [['drivers/gpu/drm/epd/epd_lut.c', 288, 0], ['drivers/gpu/drm/epd/epd_core.c', 64, 31], ['drivers/gpu/drm/epd/epd_lut.h', 41, 0], ['Documentation/devicetree/bindings/display/epd.yaml', 12, 4]] },
    'shell#301': { kind: 'pr', title: 'Voice picker in quick settings', state: 'READY', icon: 'p', age: '1d', group: 'NEEDS YOU', branch: 'feat/voice-picker → main', size: '+188 −41', partOf: 'hub#55', author: 'maintainer', body: 'Adds White, Editorial and Stationery switching with their pens.', checks: [['build', 'p', '2m 40s'], ['ui-snapshots', 'p', '1m 15s']], files: [] },
    'image-builder#40': { kind: 'pr', title: 'Add binfmt setup for aarch64 rootfs', state: 'FAILING', icon: 'f', age: '41m', group: 'NEEDS YOU', branch: 'agent/investigate-1184 → main', size: '+12 −0', partOf: 'image-builder#37', author: 'maintainer via investigate-1184', body: 'Registers qemu-aarch64 with binfmt_misc before debootstrap’s second stage.', checks: [['lint', 'p', '12s'], ['build-image', 'f', '9m 01s'], ['size-report', 'w', 'skipped']], files: [] },
    'docs#88': { kind: 'pr', title: 'Guide: recover a Note Air over EDL', state: 'DRAFT', icon: 'o', age: '12m', group: 'FROM AGENT SESSIONS', branch: 'agent/docs-edl → main', size: '+214 −3', partOf: 'hub#47', author: 'maintainer via docs-edl', body: 'Adds the EDL recovery guide.', checks: [['mkdocs build --strict', 'p', '48s']], files: [] },
    'ink-input#57': { kind: 'pr', title: 'Predictive smoothing for pen strokes', state: 'OPEN', icon: 'p', age: '2d', group: 'EVERYTHING ELSE', branch: 'pen/predict → main', size: '+96 −12', partOf: 'hub#52', author: 'input-team', body: 'Cuts perceived latency from 34 ms to 22 ms on the bench.', checks: [['build', 'p', '1m 02s']], files: [] },

    'epd#9': { kind: 'issue', title: 'LUT loader rejects version 0', state: 'OPEN', icon: 'o', age: '4d', group: 'NEEDS YOU', partOf: 'hub#44', labels: ['driver'], assignee: 'unassigned', body: 'Version 0 is reserved in hardware/epd/waveforms.md, but the header check accepts it.' },
    'epd#11': { kind: 'issue', title: 'Release the firmware buffer on every error path', state: 'OPEN', icon: 'o', age: '4d', group: 'NEEDS YOU', partOf: 'hub#44', labels: ['bug'], assignee: 'unassigned', body: 'request_firmware() succeeds but the buffer leaks when parsing fails.' },
    'firmware#18': { kind: 'issue', title: 'Waveform blobs: redistribution licence', state: 'BLOCKED', icon: 'o', age: '6d', group: 'NEEDS YOU', partOf: 'hub#44', labels: ['licence'], assignee: 'maintainer', body: 'Need a written statement before any blob enters the repository.' },
    'kernel#204': { kind: 'issue', title: 'Waveform LUT loader', state: 'OPEN', icon: 'o', age: '2w', group: 'IN SESSIONS', partOf: 'hub#44', labels: ['driver'], assignee: 'maintainer', body: 'Load and validate waveform tables.' },
    'kernel#219': { kind: 'issue', title: 'Temperature compensation for LUT selection', state: 'OPEN', icon: 'o', age: '1d', group: 'IN SESSIONS', partOf: 'hub#44', labels: ['driver'], assignee: 'unassigned', body: 'Split out of kernel#204.' },
    'docs#91': { kind: 'issue', title: 'Verify Note Air partition table', state: 'OPEN', icon: 'o', age: '1d', group: 'IN SESSIONS', partOf: 'hub#47', labels: ['hardware'], assignee: 'unassigned', body: 'Every hardware fact needs a verification date.' },
    'image-builder#37': { kind: 'issue', title: 'rootfs step fails on arm64 runners', state: 'OPEN', icon: 'o', age: '1d', group: 'IN SESSIONS', partOf: 'hub#60', labels: ['ci'], assignee: 'unassigned', body: 'debootstrap second stage: exec format error.' },
    'shell#288': { kind: 'issue', title: 'Quick settings: brightness slider skips steps', state: 'OPEN', icon: 'o', age: '3d', group: 'UNTRIAGED', partOf: null, labels: ['bug', 'ui'], assignee: 'unassigned', body: 'The slider maps 0–100 onto 16 panel steps unevenly.' },
    'reader#20': { kind: 'issue', title: 'Crash on PDFs with JBIG2 images', state: 'OPEN', icon: 'o', age: '9h', group: 'UNTRIAGED', partOf: null, labels: [], assignee: 'unassigned', body: 'Segfault in the PDF backend.' },

    'build-image #1184': { kind: 'run', title: 'image-builder · build-image', state: 'FAILED', icon: 'f', age: '41m', group: 'FAILED', repo: 'image-builder', trigger: 'push to main · a3f91c2', runner: 'ubuntu-24.04-arm', duration: '9m 01s', body: 'Step “rootfs” exited 1: exec format error.', checks: [['checkout', 'p', '3s'], ['deps', 'p', '1m 20s'], ['rootfs', 'f', '7m 32s'], ['pack', 'w', 'skipped']] },
    'ci #902': { kind: 'run', title: 'kernel · ci', state: 'RUNNING', icon: 'r', age: 'now', group: 'RUNNING', repo: 'kernel', trigger: 'pull request kernel#212', runner: 'ubuntu-24.04-arm', duration: '14m so far', body: 'Boot test running in qemu.', checks: [['build', 'p', '6m 12s'], ['qemu boot', 'r', '2m so far']] },
    'deploy #455': { kind: 'run', title: 'docs · deploy', state: 'PASSED', icon: 'p', age: '2h', group: 'RECENT', repo: 'docs', trigger: 'push to main', runner: 'ubuntu-24.04', duration: '1m 48s', body: 'Published docs.glassine.org at a41c09e.', checks: [['build', 'p', '48s'], ['publish', 'p', '22s']] }
  },

  /* Sessions: one session covers one or more items; no item is special. */
  sessions: {
    'steward': { persona: 'Steward', model: 'claude-sonnet-5-5', state: 'WAITING', covers: [], origin: 'always on', cwd: '~/src/glassine/hub', mode: 'default · hub writes ask', steward: true,
      lines: [['you', '› start a session to implement epd#9 and epd#11'], ['tool', '● hub.get_issue(epd#9) · hub.get_issue(epd#11)'], ['out', 'Same file, same error path — one session.'], ['tool', '● hub.suggest_session(action="implement", issues=["epd#9","epd#11"])'], ['ask', '◆ suggested a session — waiting for you'], ['you', '› where does hub#44 stand?'], ['tool', '● hub.search_issues("Part of GlassineOS/hub#44")'], ['out', 'kernel#212 has the loader; temperature compensation needs an issue.'], ['ask', '◆ asked to create kernel#219 — waiting for you']] },
    'kernel-lut': { persona: 'Kernel engineer', model: 'claude-opus-5-5', state: 'WAITING', covers: ['kernel#204', 'kernel#219'], prs: ['kernel#212'], origin: 'Work · kernel#212 · address review', branch: 'agent/kernel-lut', cwd: '~/hub-worktrees/kernel/agent-kernel-lut', mode: 'default · asks before edits', view: 'embedded',
      lines: [['dim', '# hub started kernel-lut · Kernel engineer · covers kernel#204, kernel#219'], ['tool', '● hub.get_pr(kernel#212) · 3 review threads'], ['tool', '● hub.search("epd waveform LUT versions") → 3 passages'], ['out', '● Fixing thread epd_lut.c:88 — reject version 0'], ['ask', '? waiting for permission to edit epd_lut.c']] },
    'review-kernel-212': { persona: 'Code reviewer', model: 'claude-opus-5-5', state: 'DONE', covers: ['kernel#212'], origin: 'Work · kernel#212 · review', cwd: '~/hub-worktrees/kernel/review-212', mode: 'plan · read-only',
      lines: [['tool', '● hub.get_pr(kernel#212)'], ['out', '● Posted 3 review threads and a summary'], ['dim', '  finished after 18 min']] },
    'docs-edl': { persona: 'Docs writer', model: 'claude-opus-5-5', state: 'WAITING', covers: ['hub#47', 'docs#91'], prs: ['docs#88'], origin: 'Work · hub#47 · draft docs', branch: 'agent/docs-edl', cwd: '~/hub-worktrees/docs/agent-docs-edl', mode: 'accept edits',
      lines: [['tool', '● hub.get_issue(hub#47)'], ['tool', '● hub.search("enter EDL mode Note Air") → 6 passages'], ['out', '● mkdocs build --strict passed'], ['ask', '? waiting for permission to git push']] },
    'investigate-1184': { persona: 'CI investigator', model: 'claude-opus-5-5', state: 'WAITING', covers: ['build-image #1184', 'image-builder#37'], prs: ['image-builder#40'], origin: 'Work · build-image #1184', branch: 'agent/investigate-1184', cwd: '~/hub-worktrees/image-builder/agent-investigate-1184', mode: 'default',
      lines: [['tool', '● hub.get_run_log(build-image #1184, failed=true)'], ['out', '● binfmt_misc has no qemu-aarch64 entry'], ['out', '● Opened image-builder#40'], ['ask', '? asks which fix to use']] },
    'audit-hub': { persona: 'Security auditor', model: 'claude-fable-5-1', state: 'DONE', covers: [], repo: 'hub', origin: 'Overview · hub · security audit', cwd: '~/hub-worktrees/hub/audit-hub', mode: 'plan · read-only', view: 'background',
      lines: [['tool', '● Read hubd/auth.py · hubd/proxy/argv.py · hubd/server.py'], ['find', '◆ HIGH · session token compared with =='], ['done', '✓ 4 drafts ready · 31 min']] },
    'arch-kernel': { persona: 'Architect', model: 'claude-opus-5-5', state: 'RUNNING', covers: [], repo: 'kernel', origin: 'Overview · kernel · architecture audit', cwd: '~/hub-worktrees/kernel/arch-kernel', mode: 'plan · read-only', view: 'background',
      lines: [['tool', '● Read decisions/ · 9 records'], ['tool', '● Glob drivers/gpu/drm/epd/** → 14 files'], ['dim', '  mapping module boundaries… 12 min']] },
    'triage-weekly': { persona: 'Triage', model: 'claude-sonnet-5-5', state: 'DONE', covers: ['shell#288', 'reader#20'], origin: 'Steward · weekly', cwd: '~/src/glassine/hub', mode: 'default',
      lines: [['tool', '● hub.list_issues(untriaged, 7 days) → 6'], ['done', '✓ 5 label changes ready']] },
    'maintainer': { plain: true, persona: 'Shell', model: '', state: 'ATTACHED', covers: [], origin: 'you', cwd: '~/src/glassine/hub',
      lines: [['you', '$ python -m pytest -q'], ['out', '133 passed, 2 skipped']] }
  },

  /* Everything waiting on you. Kinds: permission, question, suggestion, results. Count = the Sessions badge. */
  interactions: [
    { id: 'i1', kind: 'question', session: 'steward', steward: true, waited: '14 min', timeoutLeft: 'until you answer', timeoutPct: 100, header: 'SCOPE · 0.3',
      question: 'hub#60 needs the arm64 runner the kernel boot tests use. What should 0.3 include?', note: '← I’d move it: 0.3 is about the kernel path.',
      options: [{ label: 'Move hub#60 to 0.5', desc: 'Frees the runner for kernel boot tests.', rec: true }, { label: 'Keep it, add a second runner', desc: 'New self-hosted runner and its review.' }, { label: 'Split it', desc: 'CI images now, reproducibility in 0.5.' }], links: ['hub#60', 'hub#44'] },
    { id: 'i2', kind: 'permission', session: 'steward', steward: true, tool: 'hub.create_issue', waited: '3 min', timeoutLeft: '7:00', timeoutPct: 70, title: 'Create an issue in kernel',
      code: 'hub.create_issue(repo="kernel",\n  title="Temperature compensation for LUT selection",\n  body="… Part of GlassineOS/hub#44")', reason: 'kernel#212 merged without it; splitting it out keeps hub#44 honest.', alwaysLabel: 'hub.create_issue' },
    { id: 'i3', kind: 'suggestion', session: 'steward', steward: true, waited: '1 min', what: 'session', action: 'implement', covers: ['epd#9', 'epd#11'],
      title: 'Implement epd#9 + epd#11 in one session', why: 'Both are in epd_lut.c and touch the same error path. One session avoids two branches conflicting.',
      notes: 'Do epd#9 first: reject version 0 in the header check. epd#11 touches the same error path, so fix it in the same branch with its own commit. One PR that closes both.' },
    { id: 'i4', kind: 'suggestion', session: 'steward', steward: true, waited: '40 min', what: 'new work', action: 'sec', repo: 'hub',
      title: 'Security audit of hub', why: 'LAN mode (hub#74) is next, and the last audit predates the tool server.', notes: 'Assume LAN clients can reach the dashboard. Focus on token handling, TLS setup and the tool server.' },
    { id: 'i5', kind: 'permission', session: 'docs-edl', tool: 'Bash', waited: '6 min', timeoutLeft: '4:02', timeoutPct: 40, title: 'Run a command', code: 'git push -u origin agent/docs-edl', reason: 'Push the guide branch so the draft PR docs#88 updates.', alwaysLabel: 'git push' },
    { id: 'i6', kind: 'question', session: 'investigate-1184', waited: '3 min', timeoutLeft: '7:10', timeoutPct: 72, header: 'CI FIX',
      question: 'The runner image has no qemu-user-static. Which fix should image-builder#40 use?', options: [{ label: 'docker/setup-qemu-action', desc: 'Maintained action; registers binfmt for every architecture.', rec: true }, { label: 'Install qemu-user-static in the job', desc: 'One apt step; adds about 20 s per run.' }] },
    { id: 'i7', kind: 'permission', session: 'kernel-lut', tool: 'Edit', waited: '40 s', timeoutLeft: '9:20', timeoutPct: 93, title: 'Edit a file', path: 'drivers/gpu/drm/epd/epd_lut.c · line 88',
      diff: [['−', 'if (hdr->version > EPD_LUT_VERSION_MAX)'], ['+', 'if (!hdr->version || hdr->version > EPD_LUT_VERSION_MAX)'], ['', '        return -EINVAL;']], reason: 'Review thread epd_lut.c:88 — version 0 is reserved.', alwaysLabel: 'edits in this worktree' },
    { id: 'i8', kind: 'results', session: 'audit-hub', waited: '2 h', action: 'sec', repo: 'hub', title: 'Security audit of hub · 4 drafts', summary: '1 HIGH · 1 MEDIUM · 1 LOW · 1 INFO — “hubd: session token compared with ==” and 3 more.' },
    { id: 'i9', kind: 'results', session: 'triage-weekly', waited: '5 h', action: 'triage', repo: 'shell', covers: ['shell#288', 'reader#20'], title: 'Weekly triage · 5 label changes', summary: 'Adds labels to 4 issues and a “Part of hub#55” line to shell#288.' }
  ],

  /* Agent actions. result = what the Result stage shows. */
  actions: {
    review: { label: 'Review', persona: 'Code reviewer', model: 'claude-opus-5-5', mode: 'plan · read-only', result: 'comment', eta: '10–20 min', for: ['pr'], query: 'review conventions', ceiling: 'Read and comment. Never merge, close or push.' },
    address: { label: 'Address review', persona: 'Kernel engineer', model: 'claude-opus-5-5', mode: 'default · asks before edits', result: 'pr', eta: '15–30 min', for: ['pr'], query: 'review threads fixups', ceiling: 'This PR’s branch only. No merge.' },
    fix: { label: 'Fix checks', persona: 'CI fixer', model: 'claude-opus-5-5', mode: 'default', result: 'pr', eta: '10–20 min', for: ['pr'], query: 'CI setup', ceiling: 'This PR’s branch only. No merge.' },
    implement: { label: 'Implement', persona: 'Engineer', model: 'claude-opus-5-5', mode: 'default · asks before edits', result: 'pr', eta: '20–60 min', for: ['issue'], query: 'design notes conventions', ceiling: 'Own branch, draft PR. No merge, no dispatch.' },
    triage: { label: 'Triage', persona: 'Triage', model: 'claude-sonnet-5-5', mode: 'default', result: 'labels', eta: '2–5 min', for: ['issue'], query: 'labelling rules', ceiling: 'Proposes labels and Part of lines; you apply them.' },
    investigate: { label: 'Investigate', persona: 'CI investigator', model: 'claude-opus-5-5', mode: 'default', result: 'findings', eta: '10–20 min', for: ['run'], query: 'runner images caching', ceiling: 'Own branch; rerun only on ask.' },
    issue: { label: 'Issue', persona: 'Issue writer', model: 'claude-sonnet-5-5', mode: 'default · drafts only', result: 'drafts', eta: '2–5 min', for: ['new'], query: 'similar issues', ceiling: 'Writes nothing; you file the draft.' },
    sec: { label: 'Security audit', persona: 'Security auditor', model: 'claude-fable-5-1', mode: 'plan · read-only', result: 'drafts', eta: '20–40 min', for: ['new', 'repo'], query: 'hubd token verification gh proxy refusals', ceiling: 'Read-only checkout. Cannot write code, file issues or post.' },
    arch: { label: 'Architecture audit', persona: 'Architect', model: 'claude-opus-5-5', mode: 'plan · read-only', result: 'drafts', eta: '20–40 min', for: ['new', 'repo'], query: 'decision records module boundaries', ceiling: 'Read-only. Proposes, never refactors.' },
    road: { label: 'Roadmap item', persona: 'Steward', model: 'claude-sonnet-5-5', mode: 'default · drafts only', result: 'drafts', eta: '5–10 min', for: ['new', 'roadmap'], query: 'roadmap overlap', ceiling: 'Drafts the item, its child issues and board column. You file them.' },
    docs: { label: 'Docs gap sweep', persona: 'Docs writer', model: 'claude-sonnet-5-5', mode: 'plan · read-only', result: 'drafts', eta: '10–20 min', for: ['new', 'repo'], query: 'guides index coverage', ceiling: 'Read-only. Drafts issues in docs only.' },
    deps: { label: 'Dependency review', persona: 'Release steward', model: 'claude-sonnet-5-5', mode: 'plan · read-only', result: 'drafts', eta: '5–10 min', for: ['new', 'repo'], query: 'dependency policy upgrades', ceiling: 'Read-only. Upgrades are separate sessions.' }
  },
  models: [['claude-fable-5-1', 'Fable'], ['claude-opus-5-5', 'Opus'], ['claude-sonnet-5-5', 'Sonnet'], ['claude-haiku-5-5', 'Haiku']],
  plannerModels: [['claude-opus-5-5', 'Opus'], ['claude-sonnet-5-5', 'Sonnet'], ['claude-haiku-5-5', 'Haiku']],

  /* Example results per result type. */
  results: {
    drafts: {
      sec: [['HIGH', 'hubd: session token compared with == (timing leak)', 'Use hmac.compare_digest. Evidence: hubd/auth.py:57.', 'hub', 'security', 'hub#70'], ['MEDIUM', 'gh proxy: short flag -h slips past the --hostname refusal', 'Normalise short flags first. Evidence: hubd/proxy/argv.py:31.', 'hub', 'security', 'hub#70'], ['LOW', 'Unix socket is 0660 for a moment before chmod 0600', 'Create it with umask 077. Evidence: hubd/server.py:12.', 'hub', 'security', 'hub#70'], ['INFO', 'No rate limit on the tool server’s token checks', 'Loopback only today; needed before LAN mode.', 'hub', 'security, lan', 'hub#74']],
      arch: [['', 'Split github.py into REST and GraphQL clients', 'Paging and errors differ; one module mixes both.', 'hub', 'architecture', ''], ['', 'Decision record 0010: where session state lives', 'hubd owns it; app and tmux only read.', 'hub', 'decision', '']],
      issue: [['', 'ink-input: stroke latency doubles in battery saver', 'From ~22 ms to ~45 ms when battery saver lowers the poll rate. Steps to reproduce in the body.', 'ink-input', 'bug, latency', 'hub#52']],
      road: [['', 'Offline docs on the device', 'Ship a docs snapshot with each image; open it from the shell.', 'hub', 'strategic', ''], ['', 'docs: build an offline bundle in CI', 'Static export plus the search index.', 'docs', 'build', 'the new item'], ['', 'image-builder: include the docs bundle', 'Under /usr/share/glassine/docs.', 'image-builder', 'packaging', 'the new item']],
      docs: [['', 'Document the voice picker in quick settings', 'Shipped in shell 0.6.0; not in the guides.', 'docs', 'guide', 'hub#55']],
      deps: [['', 'pyyaml 6.0.1 → 6.0.2', 'Security fix, no API change.', 'hub', 'deps, security', '']]
    },
    pr: { title: 'epd: reject LUT version 0 and release the buffer on error', size: '+38 −9 · 2 commits', checks: [['build · arm64', 'p'], ['checkpatch', 'p'], ['boot-test · qemu', 'r']] },
    comment: { summary: 'The loader shape is right. Three things before merge: reject version 0, release the firmware buffer on error, update the binding example.', notes: [['epd_lut.c:88', 'Version 0 is reserved; reject it.'], ['epd_lut.c:142', 'Buffer leaks on this error path.'], ['epd.yaml:12', 'Example doesn’t exercise waveform-name.']] },
    labels: [['shell#288', 'add label', 'ui'], ['shell#288', 'add “Part of hub#55”', ''], ['reader#20', 'add label', 'bug'], ['reader#20', 'add label', 'pdf'], ['ink-input#61', 'add label', 'bug']],
    findings: { summary: 'The arm64 runner image has no qemu-user-static, so debootstrap’s second stage can’t run foreign binaries.', fix: 'Register binfmt with docker/setup-qemu-action before the rootfs step.' }
  },

  passages: {
    review: [['hardware/epd/waveforms.md', '0.84', 'the LUT format'], ['kernel/CONTRIBUTING.md#review', '0.70', 'review checklist']],
    address: [['hardware/epd/waveforms.md#versions', '0.86', 'v0 is reserved'], ['kernel/CONTRIBUTING.md#fixups', '0.72', 'fixup commits']],
    fix: [['infra/runners.md', '0.78', 'runner images']],
    implement: [['hardware/epd/waveforms.md#versions', '0.86', 'v0 is reserved'], ['decisions/0005-firmware-loading.md', '0.79', 'release rules for request_firmware']],
    triage: [['process/labels.md', '0.83', 'labelling rules'], ['process/roadmap.md#strategic', '0.77', 'which issues are strategic']],
    investigate: [['infra/runners.md', '0.79', 'ARM runner images'], ['image-builder/README.md#rootfs', '0.74', 'second stage under qemu-user']],
    issue: [['process/labels.md', '0.81', 'labelling rules']],
    sec: [['decisions/0003-rights-vs-interface.md', '0.88', 'rights live in hubd'], ['hub/security/gh-proxy.md#refusals', '0.84', 'what the proxy must refuse'], ['hub/security/tokens.md', '0.79', 'token issue and check']],
    arch: [['decisions/', '0.83', 'every decision record']],
    road: [['process/roadmap.md#strategic', '0.82', 'what makes an item strategic']],
    docs: [['style/content.md', '0.80', 'content rules']],
    deps: [['process/release.md#deps', '0.78', 'upgrade policy']]
  }
};

/* Review threads, past sessions and workspace rows (Work item, Sessions › History). */
window.HUB.threads = {
  'kernel#212': [
    { id: 't1', who: 'reviewer-a', where: 'epd_lut.c:88', text: 'Version 0 is reserved — this check lets it through.', open: true, fix: 'session kernel-lut is on it (waiting for your OK to edit)' },
    { id: 't2', who: 'reviewer-a', where: 'epd_lut.c:141', text: 'request_firmware() buffer leaks when the header parse fails.', open: true, fix: 'same root cause as epd#11' },
    { id: 't3', who: 'reviewer-b', where: 'epd.yaml:22', text: 'Binding needs an example with temperature ranges.', open: true, fix: '' },
    { id: 't4', who: 'reviewer-a', where: 'epd_core.c:40', text: 'Nit: use dev_err_probe().', open: false, fix: 'fixed in 3c1e0aa' }
  ]
};
window.HUB.history = [
  ['kernel-lut-v1', 'Kernel engineer', 'Opus', 'kernel#204', 'interrupted', 'Ended 3 days ago · host restarted', 'Halfway through the LUT version check; tests not run yet.', '86 turns', 'a41f…9c2e', 'kept'],
  ['review-kernel-212', 'Code reviewer', 'Opus', 'Work · kernel#212', 'finished', 'Finished 3 hours ago', 'Posted one summary comment and 3 inline notes on kernel#212.', '40 turns', '5d02…b1e9', 'kept'],
  ['audit-hubd', 'Security auditor', 'Fable', 'Overview · hub', 'finished', 'Finished 9 days ago', 'Wrote 3 draft findings; you filed hub#70–72.', '142 turns', '7be0…11d4', 'removed'],
  ['shell-288', 'Engineer', 'Opus', 'shell#288', 'ended', 'Ended by you 2 days ago', 'Rounding fix drafted; you stopped it to triage first.', '54 turns', 'c93a…0f71', 'kept'],
  ['triage-weekly-w44', 'Triage', 'Sonnet', 'Steward · weekly', 'finished', 'Finished 8 days ago', 'Labelled 14 issues, suggested 3 “Part of” lines.', '31 turns', '19dd…a2b8', 'none']
];
window.HUB.worktrees = [
  ['rv', '~/hub-worktrees/kernel/review-212', 'detached checkout · session review-kernel-212 finished', 'safe', 2.3, 'git -C ~/src/glassine/kernel worktree remove ~/hub-worktrees/kernel/review-212'],
  ['s288', '~/hub-worktrees/shell/agent-shell-288', 'agent/shell-288 · no commits ahead of main', 'safe', 0.64, 'git -C ~/src/glassine/shell worktree remove ~/hub-worktrees/shell/agent-shell-288\ngit -C ~/src/glassine/shell branch -d agent/shell-288'],
  ['tmux', 'tmux -L glassine-hub · 2 dead sessions', 'review-kernel-212, triage-weekly · exited', 'safe', 0, 'tmux -L glassine-hub kill-session -t review-kernel-212\ntmux -L glassine-hub kill-session -t triage-weekly'],
  ['ah', '~/hub-worktrees/hub/audit-hub', 'detached checkout · results not handled yet (Needs you)', 'review', 0.18, '# results are still waiting in Needs you — handle them first, then:\ngit -C ~/src/glassine/hub worktree remove ~/hub-worktrees/hub/audit-hub'],
  ['klv1', '~/hub-worktrees/kernel/agent-kernel-lut-v1', 'agent/kernel-lut-v1 · 2 commits not pushed', 'review', 1.9, '# 2 commits not pushed — this will fail on purpose:\ngit -C ~/src/glassine/kernel branch -d agent/kernel-lut-v1'],
  ['ci', '~/hub-worktrees/image-builder/agent-investigate-1184', 'PR image-builder#40 open', 'keep', 1.4, ''],
  ['kl', '~/hub-worktrees/kernel/agent-kernel-lut', 'session kernel-lut is running', 'inuse', 2.1, ''],
  ['edl', '~/hub-worktrees/docs/agent-docs-edl', 'session docs-edl is running', 'inuse', 0.09, '']
];

/* Knowledge: one search over docs, ingested work items and (planned) code, plus research reports. */
window.HUB.actions.research = { label: 'Research', persona: 'Researcher', model: 'claude-opus-5-5', mode: 'plan · read-only', result: 'report', eta: '5–15 min', for: ['new', 'knowledge'], query: 'knowledge', ceiling: 'Read-only. Searches every index, reads files and threads; writes only its report.' };
window.HUB.passages.research = [['guides/recovery/edl.md#enter-edl-mode', '0.86', 'the documented recovery path'], ['docs#91 · comment by reviewer-a', '0.81', 'the partition offsets are still unverified'], ['kernel/drivers/gpu/drm/epd/epd_lut.c:72', '0.64', 'where the LUT header is parsed']];
window.HUB.results.report = {
  answer: [
    'A Note Air that won’t boot after flashing is recoverable over EDL as long as XBL is intact: the guide’s steps work, and ABL can be replaced because XBL accepts test-key-signed images.',
    'Two things are not settled. The partition offsets the guide uses come from source and are unverified (docs#91 is open for that). And kernel#212’s LUT loader changes nothing in this path; the earlier suspicion in hub#47 that a bad LUT bricks the panel was ruled out in a review thread.'
  ],
  sources: [['DOC', 'guides/recovery/edl.md', 'steps and the 05c6:9008 check'], ['DOC', 'hardware/note-air/boot-chain.md#abl', 'why ABL can be replaced'], ['ISSUE', 'docs#91', 'offsets still unverified'], ['PR', 'kernel#212 · thread t2', 'LUT loader is not in the boot path'], ['CODE', 'kernel/arch/arm64/boot/dts/note-air.dts:41', 'partition node the offsets come from']],
  gaps: ['No one has restored abl_a from a backup on real hardware.', 'The guide doesn’t say what to do if lsusb shows nothing at all.'],
  followups: [['issue', 'Draft an issue for each gap'], ['docs', 'Sweep docs for other unverified hardware facts']]
};
window.HUB.knowledge = {
  domains: [
    { id: 'docs', label: 'Docs', state: 'BUILDING', detail: 'docs.glassine.org · deploy #456 is indexing 7e2d3f1; search answers from a41c09e', count: '412 passages', status: 'exists' },
    { id: 'work', label: 'Work items', state: 'CURRENT', detail: 'issues, PRs, review threads and comments of 11 repos · last ingest 14 min ago', count: '1,284 items', status: 'exists' },
    { id: 'code', label: 'Code', state: 'PLANNED', detail: 'main branch of each repo, chunked by symbol · not indexed yet; results below are illustrative', count: '—', status: 'proposed' }
  ],
  defaultQuery: 'tablet won’t boot after flashing, how do I get it back',
  corpus: [
    { d: 'docs', kind: 'DOC', ref: 'guides/recovery/edl.md#enter-edl-mode', title: 'Recover a Note Air over EDL', repo: 'docs', snip: 'Hold both volume keys while connecting USB. The tablet shows nothing; lsusb lists 05c6:9008 when it is in EDL.', score: 0.86, meta: 'guide · verified 2026-10-12', terms: 'tablet boot flash recover recovery edl brick usb note air' },
    { d: 'work', kind: 'ISSUE', ref: 'docs#91', title: 'Verify Note Air partition table', repo: 'docs', snip: 'reviewer-a: offsets in partitions.md come from the DTS, nobody has read them off a device yet.', score: 0.81, meta: 'open · comment 1 of 4 · 1 d ago', open: true, terms: 'partition flash boot recover offsets verify note air' },
    { d: 'docs', kind: 'DOC', ref: 'hardware/note-air/boot-chain.md#abl', title: 'Boot chain', repo: 'docs', snip: 'XBL accepts an ABL signed with the public test keys, so a broken ABL can be replaced without touching XBL.', score: 0.79, meta: 'hardware · verified 2026-09-30', terms: 'tablet boot chain abl xbl flash recover signed' },
    { d: 'work', kind: 'PR', ref: 'docs#88', title: 'Guide: recover a Note Air over EDL', repo: 'docs', snip: 'Adds the EDL recovery guide. Draft from session docs-edl; waits for docs#91.', score: 0.77, meta: 'draft · from docs-edl · 12 min ago', open: true, terms: 'recover edl guide boot flash note air' },
    { d: 'docs', kind: 'DOC', ref: 'guides/install/backup.md', title: 'Back up partitions before flashing', repo: 'docs', snip: 'Read out boot_a, boot_b and abl_a first. Restoring them is the way back from a failed flash.', score: 0.74, meta: 'guide', terms: 'tablet backup flash partitions restore boot recover' },
    { d: 'code', kind: 'CODE', ref: 'kernel/arch/arm64/boot/dts/note-air.dts:41', title: 'partitions { … } node', repo: 'kernel', snip: 'abl_a: partition@6000000 { label = "abl_a"; reg = <0x0 0x6000000 0x0 0x100000>; };', score: 0.69, meta: 'dts · main @ 9f1e2aa', terms: 'partition abl boot flash dts offsets note air' },
    { d: 'work', kind: 'ISSUE', ref: 'hub#47', title: 'EDL recovery path, documented', repo: 'hub', snip: 'Roadmap item. Session docs-edl covers it together with docs#91.', score: 0.66, meta: 'roadmap · in review', open: true, terms: 'edl recovery roadmap boot docs' },
    { d: 'code', kind: 'CODE', ref: 'kernel/drivers/gpu/drm/epd/epd_lut.c:72', title: 'epd_lut_parse_header()', repo: 'kernel', snip: 'if (hdr->version > EPD_LUT_MAX_VERSION) return -EINVAL; /* version 0 slips through */', score: 0.52, meta: 'c · branch agent/kernel-lut', terms: 'lut waveform version header parse epd firmware' },
    { d: 'work', kind: 'PR', ref: 'kernel#212', title: 'drm/epd: add waveform LUT loader', repo: 'kernel', snip: 'reviewer-a on epd_lut.c:141 — request_firmware() buffer leaks when the header parse fails.', score: 0.49, meta: 'reviewed · thread t2', open: true, terms: 'lut waveform loader firmware leak epd kernel review' },
    { d: 'docs', kind: 'DOC', ref: 'hardware/epd/waveforms.md#versions', title: 'Waveform table versions', repo: 'docs', snip: 'Version 0 is reserved by the controller and must be rejected.', score: 0.47, meta: 'hardware', terms: 'lut waveform version epd reserved' },
    { d: 'docs', kind: 'DOC', ref: 'hardware/note-air/dead-ends.md#fastboot', title: 'Dead ends: fastboot unlock', repo: 'docs', snip: 'The bootloader refuses unlock on retail units; EDL is the only verified path.', score: 0.61, meta: 'hardware', terms: 'fastboot unlock bootloader boot recover dead ends' },
    { d: 'work', kind: 'ISSUE', ref: 'image-builder#37', title: 'rootfs step fails on arm64 runners', repo: 'image-builder', snip: 'debootstrap second stage: exec format error. Needs qemu-user-static or binfmt.', score: 0.31, meta: 'open · in session investigate-1184', open: true, terms: 'ci rootfs arm64 qemu binfmt image build exec format error' },
    { d: 'code', kind: 'CODE', ref: 'image-builder/.github/workflows/build-image.yml:58', title: 'job rootfs · step debootstrap', repo: 'image-builder', snip: 'run: sudo debootstrap --arch=arm64 --foreign bookworm rootfs', score: 0.3, meta: 'yaml · main @ a3f91c2', terms: 'ci rootfs arm64 debootstrap workflow image build exec format error foreign' },
    { d: 'work', kind: 'ISSUE', ref: 'shell#288', title: 'Quick settings: brightness slider skips steps', repo: 'shell', snip: 'The slider maps 0–100 onto 16 panel steps unevenly.', score: 0.22, meta: 'closed · fixed in shell#310', open: false, terms: 'brightness slider quick settings shell ui' }
  ],
  reports: [
    { q: 'Which hardware facts in the docs are still unverified?', when: 'yesterday', model: 'Opus', sources: '14 sources', by: 'you', session: 'research-unverified' },
    { q: 'What blocks reproducible images (hub#60)?', when: '4 days ago', model: 'Sonnet', sources: '9 sources', by: 'the Steward', session: 'research-hub60' }
  ]
};

/* Scale: the project has dozens of repositories. Every repo choice in the design must work at this size. */
(function () {
  const more = [
    ['rfcs', 'STRATEGY', 4, 1, 'pppppppppp', '5 days ago', 'n/a', 'rfc-0007: offline docs'],
    ['website', 'KNOWLEDGE & RULES', 5, 1, 'pppppppppp', '2 days ago', 'live', 'home: new screenshots'],
    ['translations', 'KNOWLEDGE & RULES', 12, 3, 'pppppppfpp', '6 h ago', 'n/a', 'nb: quick settings strings'],
    ['design-assets', 'KNOWLEDGE & RULES', 2, 0, 'pppppppppp', '3 weeks ago', 'n/a', 'icons: pen pressure glyph'],
    ['ota-server', 'DISTRIBUTION', 9, 2, 'pppppppppp', '1 day ago', 'v0.4.1', 'delta: verify signatures first'],
    ['mirror', 'DISTRIBUTION', 3, 0, 'pppppppppp', '2 weeks ago', 'n/a', 'rsync: bandwidth cap'],
    ['installer', 'DISTRIBUTION', 7, 1, 'ppppfppppp', '4 days ago', 'v0.2.0', 'edl: detect 05c6:9008'],
    ['ci-images', 'DISTRIBUTION', 4, 1, 'ppppppppff', '3 h ago', 'n/a', 'arm64: add qemu-user-static'],
    ['notes', 'SYSTEM', 22, 4, 'pppppppppp', '2 h ago', 'v0.5.0', 'notebooks: lasso select'],
    ['sketch', 'SYSTEM', 9, 2, 'pppppppppp', '1 day ago', 'v0.1.3', 'brush: pressure curve'],
    ['launcher', 'SYSTEM', 6, 1, 'pppppppppp', '5 days ago', 'v0.3.0', 'grid: e-ink friendly paging'],
    ['settings', 'SYSTEM', 10, 2, 'pppppppppp', '1 day ago', 'v0.4.0', 'wifi: hidden networks'],
    ['sync-daemon', 'SYSTEM', 15, 3, 'pppfpppppp', '7 h ago', 'v0.2.4', 'webdav: retry with backoff'],
    ['wifi-agent', 'SYSTEM', 5, 0, 'pppppppppp', '2 weeks ago', 'v0.1.1', 'wpa: country code'],
    ['voice', 'SYSTEM', 8, 2, 'pppppppppp', '9 h ago', 'v0.2.0', 'tts: Interleaf voices'],
    ['keyboard', 'SYSTEM', 11, 1, 'pppppppppp', '3 days ago', 'v0.3.1', 'layouts: Norwegian'],
    ['boot', 'HARDWARE ENABLEMENT', 4, 1, 'pppppppppp', '1 week ago', 'n/a', 'abl: test-key signing notes'],
    ['u-boot', 'HARDWARE ENABLEMENT', 6, 1, 'pppppppppp', '2 weeks ago', 'n/a', 'note-air: env in mmc'],
    ['touch-driver', 'HARDWARE ENABLEMENT', 7, 1, 'pppppppppp', '5 days ago', 'none', 'gt9xx: palm rejection'],
    ['wacom-pen', 'HARDWARE ENABLEMENT', 5, 2, 'pppppppppr', '30 min ago', 'none', 'tilt: report in hid'],
    ['battery-fw', 'HARDWARE ENABLEMENT', 3, 0, 'pppppppppp', '1 month ago', 'none', 'fuel gauge: profile v2']
  ];
  more.forEach(([name, layer, issues, prs, runs, last, release, commit]) => window.HUB.repos.push({ name, layer, issues, prs, runs, last, release, commit, labels: [] }));
  window.HUB.recentRepos = ['kernel', 'epd', 'docs', 'image-builder'];
  Object.assign(window.HUB.items, {
    'epd#12': { kind: 'issue', title: 'Reject LUT tables shorter than the header says', state: 'OPEN', icon: 'o', age: '2d', group: 'BACKLOG', partOf: 'hub#44', labels: ['driver'], assignee: 'unassigned', body: 'The parser trusts hdr->len; a truncated blob reads past the buffer.' },
    'epd#14': { kind: 'issue', title: 'Temperature ranges overlap in waveform table', state: 'OPEN', icon: 'o', age: '1w', group: 'BACKLOG', partOf: 'hub#44', labels: ['bug'], assignee: 'unassigned', body: 'Two modes claim 18–20 °C; selection depends on table order.' },
    'kernel#221': { kind: 'issue', title: 'epd: use dev_err_probe() in the probe path', state: 'OPEN', icon: 'o', age: '3h', group: 'BACKLOG', partOf: 'kernel#204', labels: ['cleanup'], assignee: 'unassigned', body: 'Split out of a review nit on kernel#212.' },
    'firmware#19': { kind: 'issue', title: 'Record a checksum for every waveform blob', state: 'CLOSED', icon: 'p', age: '3w', group: 'BACKLOG', partOf: 'hub#44', labels: ['licence'], assignee: 'maintainer', body: 'Done in firmware#20.' }
  });
})();

/* Notes: the read-only view of `notes find` — notes, old docs, diaries, memory files, past transcripts.
   Agents read and add to the same notes with the notes command; this page only searches. */
window.HUB.notes = {
  defaultQuery: 'lut version',
  sources: ['notes', 'diaries', 'old docs', 'memory files', 'transcripts'],
  warnings: ['3 transcripts skipped: permission denied (~/.claude/projects/-home-maintainer-hub-worktrees-audit-hub)', 'memory files: 2 files skipped, not valid UTF-8 (memory/agents/old/*.bin)'],
  rows: [
    { st: 'current', src: 'notes/epd/waveforms.md', label: 'c12', text: 'Waveform table version 0 is reserved by the controller. The loader must reject it with -EINVAL before reading the mode table; kernel#212 does this since 3c1e0aa.' },
    { st: 'current', src: 'notes/epd/waveforms.md', label: 'c14', text: 'The LUT header length is authoritative only after the magic and version checks pass. Read it once, then bound every later read by it.' },
    { st: 'open', src: 'notes/epd/open-questions.md', label: 'q3', text: 'Does firmware 2.1 ship any table with version 0x02, or only 0x01? Nobody has dumped a 2.1 blob yet; this decides whether the loader needs a 0x02 path before 0.3.' },
    { st: 'current', src: 'transcripts/kernel-lut/2026-11-03T16-12.jsonl', label: '', text: 'Session kernel-lut confirmed on hardware: with version 0 rejected, the panel keeps the last good table and refreshes normally. Recorded by the session with notes add --claim c12 --evidence.' },
    { st: 'retracted', src: 'notes/epd/waveforms.md', label: 'c9', text: 'A bad LUT can brick the panel permanently. — Retracted 2026-10-28: the controller falls back to its ROM table on any parse error; the “brick” was a dead FPC cable (see hub#47 thread).' },
    { st: 'history', src: 'diaries/2026-10-21.md', label: '', text: 'Spent the evening on LUT versions. Version byte seems to be at offset 4, not 2 as the vendor PDF says. Will check against a second blob tomorrow.' },
    { st: 'history', src: 'notes/epd/waveforms.md', label: 'c7', text: 'LUT version byte is at offset 2. — Superseded by c11 (offset 4), measured on two blobs.' },
    { st: 'unreviewed', src: 'old-docs/hardware/epd-notes-2025.txt', label: '', text: 'From the 2025 notes: “tables above version 3 use a different temperature encoding”. No source given, and nobody on the project has seen a version 3 table.' },
    { st: '', src: 'memory/agents/researcher/lut.md', label: '', text: 'LUT tables are always 4096 bytes.' },
    { st: 'open', src: 'notes/kernel/review.md', label: 'q7', text: 'Should the loader log every rejected table at warn level, or only the first per boot? reviewer-a prefers once per boot; no decision recorded.' },
    { st: 'current', src: 'notes/ci/arm64.md', label: 'c31', text: 'The arm64 runners have no binfmt handlers by default. debootstrap --foreign needs qemu-user-static registered first, which is why build-image #1184 failed with “exec format error”.' },
    { st: 'unreviewed', src: 'transcripts/audit-hubd/2026-10-27T09-40.jsonl', label: '', text: 'The auditor guessed that tmux socket permissions are 0770, but did not check. Kept as an unreviewed transcript excerpt. ' + 'It goes on to compare the hub socket with the default tmux socket under /tmp, lists which processes could connect if the mode were wider, walks through what an attacker on the same host could do with an attached session, and suggests three mitigations — a private socket directory, an explicit umask in hubd before it starts tmux, and a check at login that refuses to attach when the mode is wrong. Each mitigation is followed by a long discussion of how to test it on the device, what the hub would show in Sessions when the check fails, and why none of this has been verified against the running system yet. '.repeat(4) }
  ],
  more: 40, limit: 340
};

/* Notes upkeep: compaction and the docs sweep. Both are started by hand, for all notes or one topic. */
Object.assign(window.HUB.actions, {
  compact: { label: 'Compact notes', persona: 'Archivist', model: 'claude-opus-5-5', mode: 'default · notes only', result: 'notes', eta: '10–30 min', for: ['new', 'notes'], query: 'duplicate superseded claims', ceiling: 'Changes notes only through the notes command. Never deletes; every change cites its evidence.' },
  sweep: { label: 'Sweep notes for docs', persona: 'Docs writer', model: 'claude-sonnet-5-5', mode: 'plan · read-only', result: 'drafts', eta: '10–20 min', for: ['new', 'notes'], query: 'current claims missing from docs', ceiling: 'Read-only. Drafts docs issues; a docs PR is its own session.' }
});
window.HUB.passages.compact = [['notes/epd/waveforms.md', '0.91', '14 claims, 3 likely duplicates'], ['diaries/2026-10-21.md', '0.77', 'offset measurements not yet in a claim'], ['transcripts/kernel-lut/2026-11-03T16-12.jsonl', '0.72', 'hardware confirmation of c12']];
window.HUB.passages.sweep = [['notes/epd/waveforms.md#c12', '0.88', 'current, not in any guide'], ['hardware/epd/waveforms.md', '0.84', 'the docs page these belong on'], ['guides/recovery/edl.md', '0.63', 'still repeats retracted c9']];
window.HUB.results.notes = [
  ['merge', 'c7 + c11 → c11', 'c7 “version byte is at offset 2” · c11 “version byte is at offset 4”', 'c11 stays current; c7 becomes history, pointing to c11', 'two blob dumps in diaries/2026-10-21.md and 2026-10-22.md'],
  ['distil', 'new claim c15', '5 diary lines and 2 transcript excerpts about the header length', 'c15 (current): “The header length is valid only after the magic and version checks.”', '7 source lines, all cited in the claim'],
  ['answer', 'q3 → c16', 'q3 (open): does firmware 2.1 ship version 0x02 tables?', 'c16 (current): “Firmware 2.1 ships only version 0x01.” q3 closed, pointing to c16', 'transcripts/kernel-lut/2026-11-04T10-02.jsonl · blob dump'],
  ['supersede', 'c9 wording', 'c9 (retracted) has no pointer to what replaced it', 'c9 stays retracted; adds “see c17: falls back to ROM table”', 'hub#47 review thread'],
  ['status', 'memory/agents/researcher/lut.md', 'no status: “LUT tables are always 4096 bytes.”', 'retracted: blobs of 3072 and 6144 bytes exist', 'firmware#19 checksum list'],
  ['flag', 'old-docs/hardware/epd-notes-2025.txt', 'archive, unreviewed: “version 3 uses a different temperature encoding”', 'left as is · needs a human: no source and no counter-evidence', '—']
];
window.HUB.results.drafts.sweep = [
  ['HIGH', 'EDL guide still says a bad LUT can brick the panel', 'guides/recovery/edl.md repeats c9, retracted on 2026-10-28. Replace it with c17: the controller falls back to its ROM table.', 'docs', 'fix · hardware', 'hub#47'],
  ['MEDIUM', 'Waveform page gives the version byte at offset 2', 'hardware/epd/waveforms.md contradicts current c11 (offset 4, measured on two blobs). Both versions quoted in the issue.', 'docs', 'fix · hardware', 'hub#44'],
  ['LOW', 'Document how the loader rejects version 0', 'c12 and c16 are current and in no guide. Proposed section for hardware/epd/waveforms.md with their evidence dates.', 'docs', 'guide · hardware', 'hub#44'],
  ['INFO', 'Known unknowns: temperature encoding above version 3', 'Unreviewed archive note with no source. Listed under “Not known yet” on the waveform page, never as a fact.', 'docs', 'guide', 'hub#44']
];
window.HUB.notes.totals = { entries: '1,912', claims: 214, open: 11, unreviewed: 37, nostatus: 9, sinceCompact: 126, lastCompact: '19 days ago', lastSweep: '5 weeks ago' };
window.HUB.notes.topics = [
  { path: 'notes/epd/', claims: 48, open: 3, unreviewed: 6, nostatus: 2, since: 31, last: '12 days ago' },
  { path: 'notes/kernel/', claims: 37, open: 4, unreviewed: 2, nostatus: 1, since: 22, last: '19 days ago' },
  { path: 'notes/ci/', claims: 21, open: 1, unreviewed: 0, nostatus: 3, since: 18, last: 'never' },
  { path: 'notes/hub/', claims: 29, open: 2, unreviewed: 4, nostatus: 0, since: 9, last: '19 days ago' },
  { path: 'notes/input/', claims: 16, open: 1, unreviewed: 1, nostatus: 1, since: 6, last: '2 months ago' },
  { path: 'diaries/ · transcripts/', claims: 0, open: 0, unreviewed: 24, nostatus: 2, since: 40, last: 'never' }
];
window.HUB.results.notesCmds = [
  'notes merge c7 --into c11',
  'notes add --topic epd --status current --cite diaries/2026-10-21.md:12 --cite transcripts/kernel-lut/2026-11-03T16-12.jsonl:88 "The header length is valid only after the magic and version checks."',
  'notes answer q3 --with "Firmware 2.1 ships only version 0x01." --cite transcripts/kernel-lut/2026-11-04T10-02.jsonl:41',
  'notes supersede c9 --by c17',
  'notes status memory/agents/researcher/lut.md retracted --cite firmware#19',
  '# flagged for you: old-docs/hardware/epd-notes-2025.txt — no command'
];

/* Personas: every session shows its persona as an icon on a family tint, so roles are visible at a glance.
   Family colour groups roles (build, review, investigate, write, organise); the icon tells personas within a family apart. */
window.HUB.families = {
  build: { label: 'builds', tint: '#d6e2ff' },
  review: { label: 'reviews', tint: '#eadcff' },
  investigate: { label: 'investigates', tint: '#ffd9b8' },
  write: { label: 'writes', tint: '#d4efdc' },
  organise: { label: 'organises', tint: '#e2e2e2' },
  steward: { label: 'orchestrates', tint: '#ffffff' },
  shell: { label: 'plain shell', tint: '#ffffff' }
};
window.HUB.personas = {
  'Engineer': { family: 'build', icon: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z' },
  'Kernel engineer': { family: 'build', icon: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4' },
  'CI fixer': { family: 'build', icon: 'M14 4l6 6-3 3-6-6zM11 7l-8 8v3h3l8-8' },
  'Code reviewer': { family: 'review', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11l2 2 4-4' },
  'CI investigator': { family: 'investigate', icon: 'M3 12h4l2-6 4 12 2-6h6' },
  'Security auditor': { family: 'investigate', icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4' },
  'Architect': { family: 'investigate', icon: 'M4 20L12 4l8 16M7 14h10' },
  'Docs writer': { family: 'write', icon: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3' },
  'Issue writer': { family: 'write', icon: 'M5 21V4h11l-2 4 2 4H5' },
  'Researcher': { family: 'write', icon: 'M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7' },
  'Archivist': { family: 'write', icon: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4' },
  'Triage': { family: 'organise', icon: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01' },
  'Release steward': { family: 'organise', icon: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10' },
  'Steward': { family: 'steward', icon: '' },
  'Shell': { family: 'shell', icon: 'M4 6l6 6-6 6M12 18h8' }
};
/* A reviewer running on the PR that docs-edl implements, so two sessions share an item. */
window.HUB.sessions['review-docs-88'] = { persona: 'Code reviewer', model: 'claude-opus-5-5', state: 'RUNNING', covers: ['docs#88'], origin: 'Work · docs#88 · review', cwd: '~/hub-worktrees/docs/review-88', mode: 'plan · read-only',
  lines: [['dim', '# hub started review-docs-88 · Code reviewer · covers docs#88'], ['tool', '● hub.get_pr(docs#88) · +214 −3'], ['tool', '● hub.search("EDL recovery steps verified") → 4 passages'], ['out', '● Step 3 cites partitions.md offsets that docs#91 has not verified yet'], ['out', '● Drafting the summary comment…']] };

/* Direct GitHub actions (things you do yourself, through the hub's gh proxy). Agents never get merge, close or cancel. */
window.HUB.items['kernel#212'].labels = ['driver', 'epd'];
window.HUB.items['kernel#212'].behind = 3;
window.HUB.items['kernel#212'].approved = false;
window.HUB.labelSet = ['bug', 'driver', 'epd', 'firmware', 'hardware', 'cleanup', 'docs', 'ci', 'security', 'good first issue'];
window.HUB.workflows = {
  'image-builder': [['build-image.yml', 'Build image', ['ref', 'board: note-air|tab-ultra', 'publish: false']], ['nightly.yml', 'Nightly', ['ref']]],
  'kernel': [['ci.yml', 'CI', ['ref']], ['boot-test.yml', 'Boot test (qemu)', ['ref', 'config: glassine_defconfig']]],
  'docs': [['deploy.yml', 'Deploy docs', ['ref']]]
};
window.HUB.diffs = {
  'kernel#212': [
    { file: 'drivers/gpu/drm/epd/epd_lut.c', add: 288, del: 0, hunks: [
      ['@@ -0,0 +84,12 @@ static int epd_lut_parse_header(const struct firmware *fw)', [
        [' ', 84, '\tconst struct epd_lut_hdr *hdr = (const void *)fw->data;'],
        [' ', 85, ''],
        [' ', 86, '\tif (fw->size < sizeof(*hdr))'],
        [' ', 87, '\t\treturn -EINVAL;'],
        ['+', 88, '\tif (hdr->version > EPD_LUT_MAX_VERSION)'],
        ['+', 89, '\t\treturn -EINVAL;'],
        ['+', 90, '\tif (le32_to_cpu(hdr->len) > fw->size)'],
        ['+', 91, '\t\treturn -EINVAL;']]]] , thread: 't1' },
    { file: 'drivers/gpu/drm/epd/epd_core.c', add: 64, del: 31, hunks: [] },
    { file: 'drivers/gpu/drm/epd/epd_lut.h', add: 41, del: 0, hunks: [] },
    { file: 'Documentation/devicetree/bindings/display/epd.yaml', add: 12, del: 4, hunks: [] }
  ]
};
window.HUB.logs = {
  'build-image #1184': ['##[group]Run sudo debootstrap --arch=arm64 --foreign bookworm rootfs', 'I: Retrieving InRelease', 'I: Validating Packages', 'I: Extracting base-files…', 'I: Running second stage', 'chroot: failed to run command ‘/debootstrap/debootstrap’: Exec format error', '##[error]Process completed with exit code 1.']
};

/* Workflows: a state machine held by each session (a proposal). A workflow is a statechart: states
   nest in parent states, which give their children a shared grant and shared exits; a state can have
   many exits (branches), tried in their order; a state's managed sessions run workflows of their own.
   Named HUB.machine so it is not taken for GitHub Actions workflows (HUB.workflows above).
   kind = how the state chip draws: holds, moving, waits, up, over. */
window.HUB.personas['Designer'] = { family: 'write', icon: 'M12 3l7 7-7 11-7-11zM12 3v8M10 13a2 2 0 1 0 4 0 2 2 0 1 0-4 0' };
/* Drafts a change to a workflow from your words; it reads workflows and session history and writes drafts, nothing else. */
window.HUB.personas['Workflow author'] = { family: 'organise', icon: 'M4 6h6v4H4zM14 14h6v4h-6zM10 8h4v8M7 10v8h7' };
window.HUB.personas['QA engineer'] = { family: 'review', icon: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10' };
window.HUB.machine = {
  grantKinds: ['GitHub', 'Shell', 'Web', 'Hub tools', 'Sessions', 'Permission mode'],
  sensitive: ['merge to main', 'approve runs from forks', 'make a repository public', 'delete a repository'],
  /* Everything a grant can name, for the editor's pickers. */
  catalogue: {
    'GitHub': ['read issues and PRs', 'comment', 'label and assign', 're-run checks', 'push to its branch', 'open a draft PR', 'mark ready for review', 'merge to main', 'approve runs from forks', 'make a repository public', 'delete a repository'],
    'Shell': ['run in its checkout', 'edit files in its checkout', 'reach the dev hub'],
    'Web': ['search', 'fetch'],
    'Hub tools': ['docs search', 'notes', 'code search', 'code map', 'read workflows', 'read session history', 'write a draft'],
    'Permission mode': ['plan · read-only', 'accept edits', 'default']
  },
  facts: ['branch pushed', 'PR open', 'checks pass', 'checks fail', 'reviewer.verdict == pass', 'reviewer.verdict == fail', 'qa.verdict == pass', 'qa.verdict == fail', 'rounds.review < 3', 'rounds.review >= 3', 'time in state > 2 h', 'tokens > 600 k', 'design PR merged', 'design PR closed unmerged', 'owner answered', 'PR merged', 'the item is user-facing', 'security.findings has HIGH', 'draft written', 'checks find a problem', 'draft grants a sensitive item', 'rounds.draft < 3', 'rounds.draft >= 3', 'you answered', 'you saved it', 'you asked for changes', 'you discarded it'],
  signals: ['Stop', 'SessionEnd', 'PostToolUse: push', 'checks changed', 'review submitted', 'PR merged', 'PR closed', 'managed session ended', 'report answered', 'decision answered', 'checks done'],
  defs: {
    implement: {
      title: 'implement', version: 7, scope: 'organisation default', running: 4, overrides: ['kernel: review asks for 2 reviewers'],
      about: 'Carries a piece of work on git from its first commit to merged: implement, review and fix inside work, with a design spike and escalation beside it.',
      initial: 'work',
      states: {
        'work': { parent: '', kind: 'parent', initial: 'implement', history: true, personas: ['Implementor'], context: 'keep',
          note: 'Shared by implement, review and fix: their common grant and the exit when the work is stuck.',
          grant: { 'GitHub': ['read issues and PRs', 'comment'], 'Shell': ['run in its checkout'], 'Web': ['search', 'fetch'], 'Hub tools': ['docs search', 'notes', 'code search'] }, manages: [] },
        'implement': { parent: 'work', personas: ['Implementor'], context: 'keep', instructions: 'Implement the issue on your branch. Open a draft PR early. Ask for an Engineer when a part is separate enough to hand over.',
          grant: { 'GitHub': ['push to its branch', 'open a draft PR'], 'Shell': ['edit files in its checkout'], 'Permission mode': ['accept edits'] },
          manages: [{ persona: 'Engineer', workflow: 'engineer', start: 'on-demand', when: '', max: 1, reuse: 'resume', on_exit: 'stop', returns: 'commits' }] },
        'review': { parent: 'work', personas: ['Implementor'], context: 'compact: the open findings and what each needs', instructions: 'Don’t change code. Wait for the reviewer and the QA engineer; when they return, summarise their findings by file.',
          grant: { 'GitHub': ['re-run checks'], 'Permission mode': ['plan · read-only'] },
          manages: [{ persona: 'Code reviewer', workflow: 'review', start: 'auto', when: '', max: 1, reuse: 'fresh', on_exit: 'stop', returns: 'verdict pass | fail, findings' },
            { persona: 'QA engineer', workflow: 'qa-audit', start: 'auto', when: 'the workpiece is user-facing', max: 1, reuse: 'resume', on_exit: 'keep', returns: 'verdict pass | fail, findings' }] },
        'fix': { parent: 'work', personas: ['Implementor'], context: 'keep', instructions: 'Answer every finding with a fixup commit or a reply. Don’t start new work.',
          grant: { 'GitHub': ['re-run checks', 'push to its branch'], 'Shell': ['edit files in its checkout'], 'Permission mode': ['accept edits'] },
          manages: [{ persona: 'Engineer', workflow: 'engineer', start: 'on-demand', when: '', max: 1, reuse: 'resume', on_exit: 'stop', returns: 'commits' }] },
        'design': { parent: '', personas: ['Implementor'], context: 'keep', instructions: 'A design question came up. Wait for the Designer’s draft and the maintainer’s answer; don’t build the part in question.',
          grant: { 'GitHub': ['read issues and PRs', 'comment'], 'Hub tools': ['docs search', 'notes'], 'Permission mode': ['plan · read-only'] },
          manages: [{ persona: 'Designer', workflow: 'design-spike', start: 'auto', when: '', max: 1, reuse: 'resume', on_exit: 'stop', returns: 'design PR' }] },
        'merge-ready': { parent: '', personas: ['Implementor'], context: 'compact: the PR’s summary', instructions: 'Mark the PR ready for review and ask for the merge decision. Watch the checks.',
          grant: { 'GitHub': ['read issues and PRs', 'comment', 'mark ready for review'], 'Hub tools': ['docs search', 'notes'], 'Permission mode': ['plan · read-only'] }, manages: [] },
        'escalated': { parent: '', personas: ['Implementor'], context: 'keep', instructions: 'Send your owner a report: the blocker, the evidence, what you propose. Wait for the answer.',
          grant: { 'GitHub': ['read issues and PRs', 'comment'], 'Permission mode': ['plan · read-only'] }, manages: [] },
        'merged': { parent: '', kind: 'final', grant: {}, manages: [] },
        'abandoned': { parent: '', kind: 'final', grant: {}, manages: [], note: 'Reached from any state, by hand only.' }
      },
      /* Order within a state matters: when two exits hold at once, the first one moves. */
      transitions: [
        { id: 't1', from: 'implement', to: 'review', by: 'judge', label: 'complete', when: 'The change is complete and the tests pass', requires: ['branch pushed', 'PR open'], on: ['Stop', 'checks changed'], move: 'auto', approve: 'none' },
        { id: 't2', from: 'implement', to: 'design', by: 'judge', label: 'design question', when: 'The work meets a design question that no accepted board answers', requires: ['the item is user-facing'], on: ['Stop'], move: 'on-request', approve: 'none' },
        { id: 't3', from: 'review', to: 'fix', by: 'fact', label: 'a fail, < 3', when: '', requires: ['reviewer.verdict == fail or qa.verdict == fail', 'rounds.review < 3'], on: ['managed session ended'], move: 'auto', approve: 'none' },
        { id: 't4', from: 'review', to: 'merge-ready', by: 'fact', label: 'both pass', when: '', requires: ['reviewer.verdict == pass', 'qa.verdict == pass', 'checks pass'], on: ['managed session ended', 'checks changed'], move: 'auto', approve: 'none' },
        { id: 't5', from: 'review', to: 'escalated', by: 'counter', label: 'rounds ≥ 3', when: '', requires: ['rounds.review >= 3'], on: ['managed session ended'], move: 'auto', approve: 'none' },
        { id: 't6', from: 'fix', to: 'review', by: 'judge', label: 'fixups in', when: 'Every finding has a fixup commit or a reply', requires: ['checks pass', 'branch pushed'], on: ['Stop'], move: 'auto', approve: 'none' },
        { id: 't7', from: 'work', to: 'escalated', by: 'judge', label: 'stuck', when: 'The session seems stuck: the same error three turns running, or no progress', requires: ['time in state > 2 h or tokens > 600 k'], on: ['Stop'], move: 'auto', approve: 'none' },
        { id: 't8', from: 'escalated', to: 'work', enter: 'history', by: 'fact', label: 'answered', when: '', requires: ['owner answered'], on: ['report answered'], move: 'auto', approve: 'none' },
        { id: 't9', from: 'design', to: 'work', enter: 'history', by: 'fact', label: 'design merged', when: '', requires: ['design PR merged'], on: ['PR merged'], move: 'auto', approve: 'none' },
        { id: 't10', from: 'design', to: 'escalated', by: 'fact', label: 'design closed', when: '', requires: ['design PR closed unmerged'], on: ['PR closed'], move: 'auto', approve: 'none' },
        { id: 't11', from: 'merge-ready', to: 'merged', by: 'fact', label: 'merged', when: '', requires: ['PR merged'], on: ['PR merged'], move: 'auto', approve: 'me' },
        { id: 't12', from: 'merge-ready', to: 'fix', by: 'fact', label: 'checks fail', when: '', requires: ['checks fail'], on: ['checks changed', 'review submitted'], move: 'auto', approve: 'none' },
        { id: 't13', from: '*', to: 'abandoned', by: 'hand', label: 'any state · by hand', when: '', requires: [], on: [], move: 'by hand', approve: 'me' }
      ],
      /* The diagram: boxes [x, y, w, h] and edges (path, label centre) in a 1000 × 600 view. */
      layout: {
        w: 1000, h: 600, start: [44, 108], history: [556, 334],
        states: { 'work': [20, 30, 570, 330], 'implement': [70, 80, 150, 56], 'review': [320, 80, 150, 56], 'fix': [320, 250, 150, 56], 'design': [70, 440, 150, 56],
          'merge-ready': [660, 60, 150, 56], 'merged': [890, 60, 100, 56], 'escalated': [660, 250, 150, 56], 'abandoned': [890, 510, 100, 56] },
        edges: { t1: ['M220 108H320', 270, 108], t2: ['M145 136V440', 145, 400], t3: ['M362 136V250', 290, 193], t4: ['M470 92H660', 565, 92], t5: ['M470 124H780V250', 780, 188],
          t6: ['M430 250V136', 430, 165], t7: ['M590 282H660', 625, 266], t8: ['M735 306V334H568', 650, 348], t9: ['M220 462H556V346', 390, 462], t10: ['M220 480H770V306', 650, 480],
          t11: ['M810 88H890', 850, 88], t12: ['M690 116V224H345V250', 560, 224], t13: ['M700 538H890', 780, 538] }
      }
    },
    review: { title: 'review', version: 3, scope: 'organisation default', running: 2, about: 'The Code reviewer’s own machine, started by review in implement.', initial: 'read',
      path: ['read', 'comment', 'verdict'], returns: 'verdict pass | fail, findings' },
    'qa-audit': { title: 'qa-audit', version: 2, scope: 'organisation default', running: 1, about: 'The QA engineer’s machine: plan the test, run it (tests, the dev hub, the device on your go), report.', initial: 'plan',
      path: ['plan', 'run › tests', 'run › dev hub', 'run › device', 'report'], returns: 'verdict pass | fail, findings' },
    'design-spike': { title: 'design-spike', version: 1, scope: 'organisation default', running: 1, about: 'The Designer’s machine: draft boards, open a draft PR, wait for your answer.', initial: 'draft',
      path: ['draft', 'look', 'revise', 'accepted'], returns: 'design PR' },
    engineer: { title: 'engineer', version: 2, scope: 'organisation default', running: 0, about: 'An Engineer started on demand for a part the Implementor hands over.', initial: 'build', path: ['build', 'hand back'], returns: 'commits' },
    /* Asking an AI for a change to a workflow is a workflow too. The Workflow author drafts; the hub checks
       and replays the draft; a sensitive grant gets a reviewer; you answer. No state can save a workflow:
       saving stays yours. */
    'workflow-change': {
      title: 'workflow-change', version: 1, scope: 'organisation default', running: 1, overrides: [],
      about: 'A change you ask for in words: the Workflow author drafts it, the hub checks it and replays it on past sessions, and you get the before and after.',
      initial: 'drafting', path: ['draft', 'check', 'review', 'propose'], returns: 'a draft version',
      checks: [
        { kind: 'ok', title: 'Every state can be reached, and every state but the final ones has an exit', body: '' },
        { kind: 'ok', title: 'Every loop is bounded by a counter', body: 'draft ⇄ check and draft ⇄ review by rounds.draft: at 3, drafting → ask you.' },
        { kind: 'ok', title: 'Every requires names a fact the hub knows', body: '' },
        { kind: 'ok', title: 'No state grants saving a workflow', body: 'Only you save: → applied needs “you saved it”.' }
      ],
      states: {
        'drafting': { parent: '', kind: 'parent', initial: 'draft', history: true, personas: ['Workflow author'], context: 'keep',
          note: 'Shared by draft, check and review: read-only, and nothing that saves a workflow.',
          grant: { 'Hub tools': ['docs search', 'notes', 'read workflows', 'read session history'], 'Permission mode': ['plan · read-only'] }, manages: [] },
        'draft': { parent: 'drafting', personas: ['Workflow author'], context: 'keep', instructions: 'Write the change as a draft of the workflow. Say what you changed and why, a line each. If the checks found a problem, fix it. You can’t save it.',
          grant: { 'Hub tools': ['write a draft'] }, manages: [] },
        'check': { parent: 'drafting', personas: [], context: 'keep', note: 'The hub runs the checks and replays the last sessions on the draft; no model runs here.', instructions: '', grant: {}, manages: [] },
        'review': { parent: 'drafting', personas: ['Workflow author'], context: 'keep', instructions: 'Wait for the reviewer.', grant: {},
          manages: [{ persona: 'Code reviewer', workflow: 'review', start: 'auto', when: '', max: 1, reuse: 'fresh', on_exit: 'stop', returns: 'verdict pass | fail, findings' }] },
        'ask': { parent: '', personas: ['Workflow author'], context: 'keep', instructions: 'Ask your question in Needs you and wait for the answer.', grant: { 'Permission mode': ['plan · read-only'] }, manages: [] },
        'propose': { parent: '', personas: ['Workflow author'], context: 'keep', instructions: 'Wait: the before and after are in Needs you.', grant: { 'Permission mode': ['plan · read-only'] }, manages: [] },
        'applied': { parent: '', kind: 'final', grant: {}, manages: [] },
        'declined': { parent: '', kind: 'final', grant: {}, manages: [], note: 'Discarded by you, or stopped by hand.' }
      },
      transitions: [
        { id: 'w1', from: 'draft', to: 'check', by: 'fact', label: 'written', when: '', requires: ['draft written'], on: ['Stop'], move: 'auto', approve: 'none' },
        { id: 'w7', from: 'draft', to: 'ask', by: 'judge', label: 'unclear', when: 'The request is unclear, or two parts of it contradict each other', requires: [], on: ['Stop'], move: 'on-request', approve: 'none' },
        { id: 'w2', from: 'check', to: 'draft', by: 'fact', label: 'a problem', when: '', requires: ['checks find a problem', 'rounds.draft < 3'], on: ['checks done'], move: 'auto', approve: 'none' },
        { id: 'w3', from: 'check', to: 'review', by: 'fact', label: 'sensitive', when: '', requires: ['checks pass', 'draft grants a sensitive item'], on: ['checks done'], move: 'auto', approve: 'none' },
        { id: 'w4', from: 'check', to: 'propose', by: 'fact', label: 'checks pass', when: '', requires: ['checks pass'], on: ['checks done'], move: 'auto', approve: 'none' },
        { id: 'w5', from: 'review', to: 'propose', by: 'fact', label: 'pass', when: '', requires: ['reviewer.verdict == pass'], on: ['managed session ended'], move: 'auto', approve: 'none' },
        { id: 'w6', from: 'review', to: 'draft', by: 'fact', label: 'fail', when: '', requires: ['reviewer.verdict == fail'], on: ['managed session ended'], move: 'auto', approve: 'none' },
        { id: 'w8', from: 'drafting', to: 'ask', by: 'counter', label: 'rounds ≥ 3', when: '', requires: ['rounds.draft >= 3'], on: ['checks done'], move: 'auto', approve: 'none' },
        { id: 'w9', from: 'ask', to: 'drafting', enter: 'history', by: 'fact', label: 'answered', when: '', requires: ['you answered'], on: ['decision answered'], move: 'auto', approve: 'none' },
        { id: 'w10', from: 'propose', to: 'applied', by: 'fact', label: 'saved', when: '', requires: ['you saved it'], on: ['decision answered'], move: 'auto', approve: 'me' },
        { id: 'w11', from: 'propose', to: 'draft', by: 'fact', label: 'asked again', when: '', requires: ['you asked for changes'], on: ['decision answered'], move: 'auto', approve: 'none' },
        { id: 'w12', from: 'propose', to: 'declined', by: 'fact', label: 'discarded', when: '', requires: ['you discarded it'], on: ['decision answered'], move: 'auto', approve: 'none' },
        { id: 'w13', from: '*', to: 'declined', by: 'hand', label: 'any state · by hand', when: '', requires: [], on: [], move: 'by hand', approve: 'me' }
      ],
      layout: {
        w: 1000, h: 560, start: [44, 100], history: [520, 334],
        states: { 'drafting': [20, 30, 540, 330], 'draft': [70, 80, 150, 56], 'check': [330, 80, 150, 56], 'review': [330, 250, 150, 56], 'ask': [70, 440, 150, 56],
          'propose': [680, 80, 150, 56], 'applied': [900, 80, 90, 56], 'declined': [900, 440, 90, 56] },
        edges: { w1: ['M220 100H330', 275, 100], w2: ['M330 124H220', 275, 124], w7: ['M145 136V440', 145, 290], w3: ['M380 136V250', 380, 193], w6: ['M330 278H175V136', 250, 278],
          w4: ['M480 100H680', 620, 100], w5: ['M480 278H755V136', 620, 278], w8: ['M300 360V468H220', 300, 405], w9: ['M220 484H520V346', 400, 484],
          w10: ['M830 108H900', 865, 108], w11: ['M705 80V14H8V120H70', 420, 14], w12: ['M790 136V468H900', 790, 300], w13: ['M640 530H945V496', 760, 530] }
      }
    }
  },
  /* One-state workflows: each action as it is today. */
  oneState: ['triage', 'investigate', 'security audit', 'architecture audit', 'docs gap sweep', 'dependency review', 'steward'],

  /* One machine per session. path = the parent states, outermost first. Sessions without one (plain shells) show no chip. */
  sessions: {
    'steward': { workflow: 'steward', state: 'align', kind: 'holds', note: 'organisation', oneState: true },
    'kernel-lut': { workflow: 'implement', path: ['work'], state: 'review', to: 'fix', kind: 'waits', note: 'waits for you', round: 'review 2 of 3', owner: 'steward', since: '3 min' },
    'review-kernel-212': { workflow: 'review', state: 'verdict', kind: 'over', note: 'returned fail', owner: 'kernel-lut' },
    'qa-kernel-212': { workflow: 'qa-audit', state: 'report', kind: 'over', note: 'returned pass', owner: 'kernel-lut' },
    'docs-edl': { workflow: 'docs', state: 'draft', to: 'publish', kind: 'moving', note: 'checking', owner: 'steward' },
    'review-docs-88': { workflow: 'review', state: 'read', kind: 'holds', owner: 'docs-edl' },
    'investigate-1184': { workflow: 'investigate', state: 'investigate', kind: 'up', note: 'sent up to the Steward', owner: 'steward', oneState: true },
    'audit-hub': { workflow: 'security audit', state: 'done', kind: 'over', oneState: true },
    'arch-kernel': { workflow: 'architecture audit', state: 'audit', kind: 'holds', oneState: true },
    'triage-weekly': { workflow: 'triage', state: 'done', kind: 'over', oneState: true },
    'shell-brightness': { workflow: 'implement', state: 'design', kind: 'waits', note: 'waits for ui#31', owner: 'steward' },
    'design-brightness': { workflow: 'design-spike', state: 'look', kind: 'waits', note: 'waits for you', owner: 'shell-brightness' },
    'author-implement': { workflow: 'workflow-change', path: [], state: 'propose', kind: 'waits', note: 'waits for you', owner: 'you', since: '2 min' }
  },
  /* The machine panel of kernel-lut. Newest first. by: judge, fact, counter, you, hub. */
  panel: {
    /* The change request: drafted twice, the checks passed the second time. */
    'author-implement': { visited: ['drafting', 'draft', 'check'], taken: ['w1', 'w2', 'w4'], pending: '', exits: [], counters: [['Rounds', 'draft 2'], ['Since asked', '6 min']], evidence: [], children: [], history: [] },
    'kernel-lut': {
      visited: ['work', 'implement', 'review', 'fix'], taken: ['t1', 't3', 't6'], pending: 't3',
      counters: [['Rounds', 'review 2 of 3 · fix 1'], ['In this state', '3 min'], ['Since start', '2 h 40 min'], ['Judge calls', '6, 1 set aside by you'], ['Tokens', '412 k of 600 k']],
      /* Every exit of the current state, in order, then the parent's: how far each holds now. */
      exits: [
        { t: 't3', holds: true, result: 'holds · waits for you: it widens the grant', checks: [['reviewer.verdict == fail', true, 'review-kernel-212 returned fail, 3 findings'], ['rounds.review < 3', true, '2']] },
        { t: 't4', holds: false, result: 'doesn’t hold', checks: [['reviewer.verdict == pass', false, 'fail'], ['qa.verdict == pass', true, 'qa-kernel-212 returned pass'], ['checks pass', true, '5 of 5']] },
        { t: 't5', holds: false, result: 'doesn’t hold', checks: [['rounds.review >= 3', false, '2']] },
        { t: 't7', holds: false, inherited: 'work', result: 'judge: no · last turn made progress', checks: [['time in state > 2 h or tokens > 600 k', false, '3 min · 412 k']] }
      ],
      evidence: [['fact', 'review-kernel-212 returned verdict = fail, 3 findings'], ['quote', '“epd_lut.c:142 still leaks the buffer when the header check fails.”']],
      /* Managed sessions running under this state, each with its own machine. */
      children: [
        { sid: 'review-kernel-212', persona: 'Code reviewer', workflow: 'review', at: 'verdict', returned: 'fail · 3 findings', on_exit: 'stops when review is left' },
        { sid: 'qa-kernel-212', persona: 'QA engineer', workflow: 'qa-audit', at: 'report', returned: 'pass · 1 finding (a slow test)', on_exit: 'kept: looks after the test setup' }
      ],
      history: [
        { at: '11:52', from: 'review', to: 'fix', what: 'proposed', by: 'fact', signal: 'review-kernel-212 ended', evidence: 'verdict = fail, 3 findings · exits tried in order: → fix holds, → merge-ready and → escalated don’t', checks: 'reviewer.verdict == fail ✓ · rounds.review < 3 ✓', result: 'waits for you: it widens the grant', kind: 'waits' },
        { at: '11:20', from: 'fix', to: 'review', what: 'moved', by: 'judge', signal: 'Stop', evidence: '“Every review thread has a fixup commit and the checks pass.”', checks: 'checks pass ✓ · branch pushed ✓', result: 'narrowed in the session: push and edits taken away · started review-kernel-212 again (fresh)', kind: 'holds', judge: 'small model · high' },
        { at: '11:05', from: 'fix', to: 'review', what: 'set aside', by: 'you', signal: 'Stop', evidence: 'judge: “The fixups are in.” You: “dt-validate still fails on the binding example.”', checks: '—', result: 'stayed in fix', kind: 'hand' },
        { at: '10:31', from: 'review', to: 'fix', what: 'moved', by: 'you', signal: 'review-kernel-212 ended', evidence: 'verdict = fail, 3 findings', checks: 'reviewer.verdict == fail ✓ · rounds.review < 3 ✓', result: 'widened: you confirmed · resumed the same conversation under launch 2', kind: 'holds' },
        { at: '10:05', from: 'implement', to: 'review', what: 'moved', by: 'judge', signal: 'Stop · checks changed', evidence: '“All three cases in kernel#204 are handled and the tests pass.”', checks: 'branch pushed ✓ · PR open ✓ (kernel#212)', result: 'narrowed in the session · started review-kernel-212 and qa-kernel-212', kind: 'holds', judge: 'small model · high' },
        { at: '09:12', from: '', to: 'work › implement', what: 'started', by: 'hub', signal: 'the Steward’s suggestion, accepted by you', evidence: 'covers kernel#204, kernel#219', checks: '—', result: 'launch 1', kind: 'holds' }
      ]
    }
  },
  /* What a move adds, per session: details the confirm modal shows beside the grant comparison. */
  widen: {
    'kernel-lut': { detail: { 'push to its branch': 'agent/kernel-lut only', 'edit files in its checkout': '~/hub-worktrees/kernel/agent-kernel-lut', 'Engineer · on demand, at most 1': 'its grant is capped at this session’s', 'Code reviewer · auto, at most 1': 'stopped when it leaves review', 'QA engineer · auto, at most 1': 'kept: on_exit = keep' },
      how: 'The hub stops kernel-lut at the end of its turn and resumes the same conversation under a new launch with the new grant. Nothing it has done is lost.' },
    'docs-edl': { from: 'draft', to: 'publish', adds: [['GitHub', 'push to its branch', 'agent/docs-edl only'], ['GitHub', 'merge to main', 'docs only, after your approved merge decision']],
      removes: [], keeps: ['read issues and PRs', 'comment', 'edit files in its checkout', 'docs search', 'notes'],
      how: 'The hub stops docs-edl at the end of its turn and resumes the same conversation under a new launch with the grant of publish.' }
  },
  /* A definition change the Steward proposes; it reaches you as a decision in Needs you. The editor opens it as a draft. */
  change: {
    id: 'd1', workflow: 'implement', from: 7, to: 8, scope: 'organisation default', by: 'steward', reviewer: 'review-wf-8', verdict: 'pass, 2 notes', waited: '25 min',
    title: 'implement v7 → v8: QA rounds, fork runs, merging',
    why: 'Two of the last five pieces of work ran three review rounds without a new finding after the second. Contributors’ fixes from forks wait on a person to approve their runs. Merges wait on a person twice: the merge decision and the merge itself.',
    notes: ['The fork-run grant is per repository in effect: only repositories whose rulesets require an approving review are reached.', 'merge-ready still needs your approved merge decision: approve = "me" on → merged is unchanged.'],
    /* The draft: what v8 changes in v7. */
    patch: { grants: { 'review': { 'GitHub': ['approve runs from forks'] }, 'merge-ready': { 'GitHub': ['merge to main'] } }, requires: { t5: ['rounds.review >= 2'] } },
    marks: { states: { 'review': 'changed', 'merge-ready': 'changed' }, edges: { t5: 'changed' } },
    /* The fix the editor's check offers for the overlap it finds in the draft. */
    fix: { requires: { t3: ['reviewer.verdict == fail or qa.verdict == fail', 'rounds.review < 2'] }, labels: { t3: 'a fail, < 2' }, edges: { t3: 'changed' } },
    warnings: [
      { item: 'approve runs from forks', where: 'work › review', what: 'Sessions in review could approve GitHub Actions runs on pull requests from forks, so code from outside the organisation runs on its runners.' },
      { item: 'merge to main', where: 'merge-ready', what: 'Sessions in merge-ready could merge to main themselves once you have approved the merge decision for the PR head.' }
    ],
    affects: '4 sessions run implement now; each takes v8 at its next move. Repository overrides (kernel) keep their own changes on top.'
  },
  /* What the editor's check finds in the v8 draft. kind: problem, sensitive, ok. */
  checks: [
    { kind: 'problem', title: 'Two exits of review can hold at once', body: 'With reviewer.verdict == fail and rounds.review == 2, both → fix (rounds.review < 3) and → escalated (rounds.review >= 2) hold. The first in order moves (→ fix), so the new limit of 2 never applies.', fix: 'Set → fix to rounds.review < 2', at: 't3' },
    { kind: 'sensitive', title: 'review grants approve runs from forks', body: 'One of the four sensitive items. Marked so you see it; it adds no rule.', at: 'review' },
    { kind: 'sensitive', title: 'merge-ready grants merge to main', body: 'One of the four sensitive items. Merges still need your approved merge decision (→ merged: approve = me).', at: 'merge-ready' },
    { kind: 'ok', title: 'Every state can be reached, and every state but the final ones has an exit', body: '' },
    { kind: 'ok', title: 'Every loop is bounded by a counter', body: 'review ⇄ fix by rounds.review; work → escalated → work by tokens and time in state.' },
    { kind: 'ok', title: 'Every requires names a fact the hub knows', body: '' }
  ],
  /* A design spike: a state started a Designer session for a question no accepted board answers. */
  spike: {
    id: 'd2', owner: 'shell-brightness', ownerPersona: 'Engineer', ownerState: 'design', designer: 'design-brightness', item: 'shell#288', pr: 'ui#31', waited: '8 min',
    question: 'How does the brightness slider show the panel’s 16 steps, so each touch moves exactly one?',
    raisedAt: 'implement, after 1 round', why: 'No accepted board covers the slider’s steps. The Designer has a draft with two boards.',
    boards: [['shell', 'QuickSettings.dc.html', 'changed', 'the slider in quick settings, 16 marked steps'], ['shell', 'BrightnessSlider.dc.html', 'new', 'the slider on its own: drag, tap, keys']],
    requires: 'design PR merged (ui#31)', after: 'it goes back into work where it left off (history), with the accepted boards as context.'
  },
  /* Changes asked for in words. The Workflow author's draft is a patch on the definition, like d1's. */
  requests: {
    r1: {
      id: 'r1', workflow: 'implement', from: 7, to: 8, sid: 'author-implement', persona: 'Workflow author', model: 'claude-opus-5-5', asked: '10:40', ready: '10:46',
      words: 'Changes under hubd/auth need a security review before they can merge. Have the Security auditor look at them during review, and send the work up if it finds anything HIGH. Also, two failed review rounds are enough: send it up then, not after three.',
      about: ['work › review'],
      summary: [
        ['review runs a Security auditor', 'when the PR touches hubd/auth; a fresh one each time, stopped when review is left. Its grant is capped at review’s: read-only.'],
        ['review → escalated on a HIGH finding, tried first', 'so a HIGH sends the work up even when the reviewer passes it.'],
        ['review → escalated after 2 rounds', 'was 3.'],
        ['review → fix below 2 rounds', 'was below 3. Draft 1 left it at 3, and the checks found that → fix and → escalated both held at 2 rounds.']
      ],
      drafts: [
        { n: 1, at: '10:43', result: 'The checks found a problem: → fix (rounds < 3) and → escalated (rounds ≥ 2) both hold at 2 rounds, and → fix is tried first.', kind: 'problem' },
        { n: 2, at: '10:46', result: 'The checks pass. No sensitive item, so no reviewer. Replayed on the last 5 sessions: kernel-lut would have gone up at 11:52 instead of to fix; the other 4 move as they did.', kind: 'ok' }
      ],
      patch: {
        requires: { t3: ['reviewer.verdict == fail or qa.verdict == fail', 'rounds.review < 2'], t5: ['rounds.review >= 2'] },
        labels: { t3: 'a fail, < 2', t5: 'rounds ≥ 2' },
        manages: { review: [{ persona: 'Security auditor', workflow: 'security audit', start: 'auto', when: 'the PR touches hubd/auth', max: 1, reuse: 'fresh', on_exit: 'stop', returns: 'findings by severity' }] },
        add: [{ id: 't14', from: 'review', to: 'escalated', by: 'fact', label: 'HIGH', when: '', requires: ['security.findings has HIGH'], on: ['managed session ended'], move: 'auto', approve: 'none' }],
        order: { review: ['t14', 't3', 't4', 't5'] },
        edges: { t14: ['M470 108H740V250', 740, 160] }
      },
      marks: { states: { review: 'changed' }, edges: { t3: 'changed', t5: 'changed', t14: 'changed' } },
      checks: [
        { kind: 'ok', title: 'The exits of review don’t overlap', body: '→ escalated on HIGH first, then → fix below 2 rounds, → merge-ready, → escalated from 2.' },
        { kind: 'ok', title: 'Every state can be reached, and every state but the final ones has an exit', body: '' },
        { kind: 'ok', title: 'Every loop is bounded by a counter', body: 'review ⇄ fix by rounds.review.' },
        { kind: 'ok', title: 'Every requires names a fact the hub knows', body: 'security.findings comes from the Security auditor’s report.' },
        { kind: 'ok', title: 'No sensitive item is granted', body: 'The auditor reads; it can’t push, comment or approve.' }
      ]
    }
  }
};

/* The helpers the hub would run: effective grants (a parent's grant applies to its children), the grant
   comparison that tells a widening move, a definition with a draft applied, and its text form. */
(function (M) {
  /* A draft is the definition with a patch on top. A patch names: grants to add per state, requires,
     labels, sessions a state runs (manages), new transitions, the order of a state's exits and the
     layout of new edges. */
  M.apply = function (d, p, version) {
    const s = {};
    Object.keys(d.states).forEach((k) => {
      const g = {}; Object.keys(d.states[k].grant || {}).forEach((x) => { g[x] = d.states[k].grant[x].slice(); });
      Object.keys(((p.grants || {})[k] || {})).forEach((x) => { g[x] = (g[x] || []).concat(p.grants[k][x]); });
      s[k] = { ...d.states[k], grant: g, manages: (d.states[k].manages || []).concat(((p.manages || {})[k]) || []) };
    });
    let ts = d.transitions.map((t) => ({ ...t, ...((p.requires || {})[t.id] ? { requires: p.requires[t.id] } : {}), ...((p.labels || {})[t.id] ? { label: p.labels[t.id] } : {}) })).concat(p.add || []);
    const froms = []; ts.forEach((t) => { if (froms.indexOf(t.from) < 0) froms.push(t.from); });
    ts = [].concat(...froms.map((f) => { const own = ts.filter((t) => t.from === f), o = (p.order || {})[f]; return o ? o.map((id) => own.find((t) => t.id === id)) : own; }));
    const layout = p.edges ? { ...d.layout, edges: { ...d.layout.edges, ...p.edges } } : d.layout;
    return { ...d, version: version || d.version + 1, draft: true, states: s, transitions: ts, layout };
  };
  /* fixed: also apply the fix the check offers for the overlap (→ fix becomes rounds.review < 2). */
  M.def = function (name, draft, fixed) {
    const d = M.defs[name];
    if (!draft || name !== M.change.workflow) return d;
    const c = M.change, p = { ...c.patch, requires: { ...c.patch.requires, ...(fixed ? c.fix.requires : {}) }, labels: { t5: 'rounds ≥ 2', ...(fixed ? c.fix.labels : {}) } };
    return M.apply(d, p, c.to);
  };
  /* What a change request's draft makes of its workflow. */
  M.requested = function (id) { const r = M.requests[id]; return M.apply(M.defs[r.workflow], r.patch, r.to); };
  /* The outline of a definition as rows: each state, then its exits in order (a parent's after its
     states'). With a second definition, the rows of both, each marked same, added, removed, changed
     or moved; grants and sessions a state runs show only where they differ. */
  M.outlineDiff = function (a, b) {
    const G = { judge: '≈', fact: '=', counter: '#', hand: '' };
    const why = (t) => (G[t.by] ? G[t.by] + ' ' : '') + (t.when ? '“' + t.when + '”' + (t.requires.length ? ' · requires ' + t.requires.join(', ') : '') : t.requires.length ? t.requires.join(', ') : 'by hand') + (t.approve !== 'none' ? ' · approve: ' + t.approve : '');
    const rowsOf = (d) => {
      const out = [], kids = (k) => Object.keys(d.states).filter((c) => d.states[c].parent === k);
      const visit = (k, depth) => {
        const st = d.states[k];
        out.push({ key: 's:' + k, kind: 'state', depth, name: k, tag: st.kind === 'parent' ? 'parent' + (st.history ? ' · H' : '') : st.kind === 'final' ? 'final' : '' });
        Object.entries(st.grant || {}).forEach(([g, xs]) => xs.forEach((x) => out.push({ key: 'g:' + k + ':' + g + ':' + x, kind: 'grant', depth: depth + 1, text: g + ': ' + x, item: x })));
        (st.manages || []).forEach((m) => out.push({ key: 'm:' + k + ':' + m.persona, kind: 'manages', depth: depth + 1, text: 'runs ' + m.persona + ' (' + m.workflow + (m.when ? ', when ' + m.when : '') + ')' }));
        kids(k).forEach((c) => visit(c, depth + 1));
        M.exitsOf(d, k).forEach((t, i) => out.push({ key: 't:' + t.id, kind: 'exit', depth: depth + 1, n: st.kind === 'parent' ? 'then' : String(i + 1), to: t.to + (t.enter === 'history' ? ' (where it was)' : ''), why: why(t) }));
      };
      Object.keys(d.states).filter((k) => !d.states[k].parent).forEach((k) => visit(k, 0));
      return out;
    };
    const A = rowsOf(a), B = b ? rowsOf(b) : A, ka = {}, kb = {};
    A.forEach((r) => { ka[r.key] = r; }); B.forEach((r) => { kb[r.key] = r; });
    const res = [];
    const mark = (x, y) => {
      if (!x) return 'added'; if (!y) return 'removed';
      if (x.kind === 'exit') { if (x.to !== y.to || x.why !== y.why) return 'changed'; if (x.n !== y.n) return 'moved'; }
      return 'same';
    };
    let ia = 0;
    B.forEach((r) => {
      /* Rows of the old outline that are gone come in where they stood, before the next row both share. */
      if (ka[r.key]) { const at = A.indexOf(ka[r.key]); for (; ia < at; ia++) if (!kb[A[ia].key]) res.push({ ...A[ia], change: 'removed', before: A[ia], after: null }); ia = Math.max(ia, at + 1); }
      res.push({ ...r, change: mark(ka[r.key], r), before: ka[r.key] || null, after: r });
    });
    for (; ia < A.length; ia++) if (!kb[A[ia].key]) res.push({ ...A[ia], change: 'removed', before: A[ia], after: null });
    /* A state holds a change when one of its rows does. */
    res.forEach((r, i) => { if (r.kind === 'state') { let j = i + 1, any = false; while (j < res.length && !(res[j].kind === 'state' && res[j].depth <= r.depth)) { if (res[j].change !== 'same') any = true; j++; } r.holds = any; } });
    return res.filter((r) => r.kind === 'state' || r.kind === 'exit' || r.change !== 'same');
  };
  M.chain = function (d, id) { const out = []; let k = id; while (k) { out.unshift(k); k = (d.states[k] || {}).parent; } return out; };
  M.effective = function (d, id) {
    const g = {}, from = {};
    M.chain(d, id).forEach((k) => {
      Object.entries(d.states[k].grant || {}).forEach(([kind, xs]) => { if (kind === 'Permission mode') { g[kind] = xs.slice(); xs.forEach((x) => { from[kind + ':' + x] = k; }); return; } g[kind] = (g[kind] || []).concat(xs.filter((x) => (g[kind] || []).indexOf(x) < 0)); xs.forEach((x) => { if (!from[kind + ':' + x]) from[kind + ':' + x] = k; }); });
      (d.states[k].manages || []).forEach((m) => { g['Sessions'] = (g['Sessions'] || []).concat([m.persona + ' · ' + (m.start === 'auto' ? 'auto' : 'on demand') + ', at most ' + m.max]); });
    });
    return { grant: g, from };
  };
  M.compare = function (workflow, from, to) {
    const d = M.defs[workflow], a = M.effective(d, from).grant, b = M.effective(d, to).grant, out = { adds: [], removes: [], keeps: [] };
    M.grantKinds.forEach((k) => {
      (b[k] || []).forEach((x) => { if ((a[k] || []).indexOf(x) < 0) out.adds.push([k, x]); else out.keeps.push(x); });
      (a[k] || []).forEach((x) => { if ((b[k] || []).indexOf(x) < 0) out.removes.push([k, x]); });
    });
    return out;
  };
  /* A line diff (longest common subsequence), with n lines of context around each change. */
  M.diff = function (a, b, n) {
    const m = a.length, k = b.length, T = Array.from({ length: m + 1 }, () => new Array(k + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) for (let j = k - 1; j >= 0; j--) T[i][j] = a[i] === b[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < m || j < k) {
      if (i < m && j < k && a[i] === b[j]) { out.push(['', a[i]]); i++; j++; }
      else if (i < m && (j === k || T[i + 1][j] >= T[i][j + 1])) { out.push(['del', a[i]]); i++; }
      else { out.push(['add', b[j]]); j++; }
    }
    const keep = out.map(() => false), head = (x) => /^\[/.test(x);
    out.forEach((d, x) => { if (d[0]) { for (let y = Math.max(0, x - n); y <= Math.min(out.length - 1, x + n); y++) keep[y] = true;
      for (let y = x; y >= 0; y--) if (head(out[y][1])) { keep[y] = true; break; } } });
    const res = []; let gap = false;
    out.forEach((d, x) => { if (keep[x]) { if (gap && res.length) res.push(['gap', '⋯']); res.push(d); gap = false; } else gap = true; });
    return res;
  };
  M.exitsOf = function (d, id) { return d.transitions.filter((t) => t.from === id); };
  M.text = function (d) {
    const L = [], q = (xs) => '[' + xs.map((x) => '"' + x + '"').join(', ') + ']', name = (k) => M.chain(d, k).join('.');
    L.push('# ' + d.title + ' v' + d.version + (d.draft ? ' (draft)' : '') + ' · ' + d.scope);
    L.push('initial = "' + d.initial + '"');
    Object.entries(d.states).forEach(([k, s]) => {
      L.push(''); L.push('[state.' + name(k) + ']');
      if (s.kind === 'parent') { L.push('initial = "' + s.initial + '"'); if (s.history) L.push('history = true'); }
      if (s.kind === 'final') L.push('final = true');
      if (s.personas) L.push('personas = ' + q(s.personas));
      if (s.context && s.kind !== 'final') L.push('context = "' + s.context + '"');
      Object.entries(s.grant || {}).forEach(([kind, xs]) => { L.push('grant.' + kind.toLowerCase().replace(/ /g, '_') + ' = ' + q(xs)); });
      (s.manages || []).forEach((m) => { L.push('manages = { persona = "' + m.persona + '", workflow = "' + m.workflow + '", start = "' + m.start + '"' + (m.when ? ', when = "' + m.when + '"' : '') + ', max = ' + m.max + ', reuse = "' + m.reuse + '", on_exit = "' + m.on_exit + '" }'); });
      d.transitions.filter((t) => t.from === k).forEach((t) => {
        L.push('[[state.' + name(k) + '.transition]]');
        L.push('to = "' + name(t.to) + '"' + (t.enter === 'history' ? '   # back to where it was' : ''));
        if (t.when) L.push('when = "' + t.when + '"');
        if (t.requires.length) L.push('requires = ' + q(t.requires));
        if (t.on.length) L.push('on = ' + q(t.on));
        L.push('move = "' + t.move + '"' + (t.approve !== 'none' ? '\napprove = "' + t.approve + '"' : ''));
      });
    });
    d.transitions.filter((t) => t.from === '*').forEach((t) => { L.push(''); L.push('[[transition]]   # from any state'); L.push('to = "' + t.to + '"'); L.push('move = "by hand"'); });
    return L.join('\n').split('\n');
  };
})(window.HUB.machine);

/* Starts (how a workflow begins on an item): each names its kind of item, label, summary, starting state, lead
   flag, the models and efforts the brief may choose, its prompt, and what it does while an instance holds the
   item: runs beside it, asks the owner (ask = the request's label), or is hidden. A start of a multi-state
   workflow takes its persona and ceiling from its starting state; a one-state one names them. launch = the
   Launch action its brief opens with. writes = its starting grant can write on the item. */
window.HUB.personas['Implementor'] = { family: 'build', icon: 'M4 17l5-5-5-5M11 19h9M14 5h6M14 9h4' };
window.HUB.items['boot-test #77'] = { kind: 'run', title: 'kernel · boot-test (qemu)', state: 'FAILED', icon: 'f', age: '2h', group: 'FAILED', repo: 'kernel', trigger: 'nightly · main @ 9f1e2aa', runner: 'ubuntu-24.04-arm', duration: '22m 40s',
  body: 'The boot test timed out waiting for the login prompt. The two runs before it passed on the same commit.', checks: [['build · arm64', 'p', '6m 02s'], ['boot-test · qemu', 'f', '16m 38s']] };
(function (M) {
  const BIG = ['claude-fable-5-1', 'claude-opus-5-5'], MID = ['claude-opus-5-5', 'claude-sonnet-5-5'], SMALL = ['claude-sonnet-5-5', 'claude-haiku-5-5'];
  M.starts = [
    { id: 'st-work', workflow: 'implement', kind: 'issue', label: 'Work on this', lead: true, state: 'implement', launch: 'implement', models: BIG, efforts: ['high', 'medium'], held: 'hide',
      summary: 'Implement it on a branch and carry it through review to merged.',
      prompt: 'Implement the issue below on your own branch. Open a draft PR early and say in its body which issue it closes. Ask before you widen what the issue asks for.' },
    { id: 'st-take', workflow: 'implement', kind: 'pr', label: 'Take this on', lead: true, state: 'review', launch: 'review', models: BIG, efforts: ['high', 'medium'], held: 'hide',
      summary: 'An implementor makes this pull request its own, starting at review.',
      prompt: 'The pull request below is now yours. Read it and its threads, let the reviewer and QA run, then summarise their findings by file. Don’t change code in review.' },
    { id: 'st-triage', workflow: 'triage', kind: 'issue', label: 'Triage', state: 'triage', launch: 'triage', persona: 'Triage', ceiling: 'Proposes labels and Part of lines; you apply them.', writes: false, models: SMALL, efforts: ['low', 'medium'], held: 'beside',
      summary: 'Labels and a Part of line, proposed for you to apply.',
      prompt: 'Propose labels for the issue below and a “Part of …” line if it belongs to a strategic issue. Propose; don’t apply.' },
    { id: 'st-design', workflow: 'design-spike', kind: 'issue', label: 'Design it on the boards', state: 'draft', launch: 'implement', persona: 'Designer', ceiling: 'Its own branch in ui and a draft design PR. No merge.', writes: true, models: MID, efforts: ['high'], held: 'ask', ask: 'Ask for a design spike',
      summary: 'Boards for the question the issue raises, as a draft design PR.',
      prompt: 'Draw boards that answer the design question in the issue below. Open a draft PR in ui with the boards changed or added, and say which question each answers.' },
    { id: 'st-docs', workflow: 'docs gap sweep', kind: 'issue', label: 'Draft docs', state: 'sweep', launch: 'docs', persona: 'Docs writer', ceiling: 'Read-only. Drafts docs issues; you file them.', writes: false, models: SMALL, efforts: ['medium'], held: 'beside',
      summary: 'What the docs would need to say once this ships.',
      prompt: 'List what the docs would need to say once the issue below is done. One draft docs issue per page.' },
    { id: 'st-sess-i', workflow: 'session', kind: 'issue', label: 'Open a session', state: 'session', launch: 'implement', persona: 'Engineer', ceiling: 'Its own checkout; asks you before each edit, push or comment.', writes: true, models: BIG.concat(['claude-sonnet-5-5']), efforts: ['high', 'medium', 'low'], held: 'hide',
      summary: 'A session with the issue loaded and no plan; you steer it.',
      prompt: 'The issue below is the context. Wait for the maintainer’s first message.' },
    { id: 'st-review', workflow: 'review', kind: 'pr', label: 'Review this PR', state: 'read', launch: 'review', persona: 'Code reviewer', ceiling: 'Read and comment. Never merge, close or push.', writes: true, models: BIG, efforts: ['high'], held: 'ask', ask: 'Ask for a review',
      summary: 'One summary comment; inline notes only for blockers.',
      prompt: 'Review the pull request below for correctness, tests and fit with what it is part of. One summary comment; inline notes only for blockers.' },
    { id: 'st-explain-pr', workflow: 'explain', kind: 'pr', label: 'Explain the diff', state: 'explain', launch: 'research', persona: 'Researcher', ceiling: 'Read-only. Answers in the session; writes nothing on GitHub.', writes: false, models: MID, efforts: ['medium'], held: 'beside',
      summary: 'What the change does, file by file, in plain words.',
      prompt: 'Explain the diff of the pull request below file by file: what each change does and why it is there. Write nothing on GitHub.' },
    { id: 'st-sec-pr', workflow: 'security audit', kind: 'pr', label: 'Security audit', state: 'audit', launch: 'sec', persona: 'Security auditor', ceiling: 'Read-only checkout. Drafts findings; you file them.', writes: false, models: BIG, efforts: ['high'], held: 'beside',
      summary: 'Findings with severity and evidence, as drafts.',
      prompt: 'Audit the change in the pull request below as an attacker would read it. One finding per draft issue, with severity and evidence. Read-only.' },
    { id: 'st-sess-p', workflow: 'session', kind: 'pr', label: 'Open a session', state: 'session', launch: 'review', persona: 'Engineer', ceiling: 'Its own checkout of the branch; asks you before each edit, push or comment.', writes: true, models: BIG.concat(['claude-sonnet-5-5']), efforts: ['high', 'medium', 'low'], held: 'hide',
      summary: 'A session on the branch with the pull request loaded; you steer it.',
      prompt: 'The pull request below is the context. Wait for the maintainer’s first message.' },
    { id: 'st-inv', workflow: 'investigate', kind: 'run', label: 'Investigate failure', lead: true, state: 'investigate', launch: 'investigate', persona: 'CI investigator', ceiling: 'Own branch; reruns only when you ask.', writes: true, models: MID, efforts: ['high', 'medium'], held: 'hide',
      summary: 'The cause and the smallest fix, on its own branch.',
      prompt: 'Find why the run below failed. Its failed log is attached. Report the cause and the smallest fix; open a draft PR only for a fix you are sure of.' },
    { id: 'st-explain-run', workflow: 'explain', kind: 'run', label: 'Explain', state: 'explain', launch: 'investigate', persona: 'Researcher', ceiling: 'Read-only. Answers in the session; writes nothing on GitHub.', writes: false, models: SMALL, efforts: ['low', 'medium'], held: 'beside',
      summary: 'What the run does, step by step, and where it stopped.',
      prompt: 'Explain the run below step by step and where it stopped. Write nothing on GitHub.' },
    { id: 'st-fix-run', workflow: 'fix checks', kind: 'run', label: 'Fix on a branch', state: 'fix', launch: 'investigate', persona: 'CI fixer', ceiling: 'Its own branch and a draft PR. No merge.', writes: true, models: MID, efforts: ['high', 'medium'], held: 'ask', ask: 'Ask it to fix on its branch',
      summary: 'The smallest change that makes the run pass, as a draft PR.',
      prompt: 'Make the run below pass with the smallest change, on your own branch, and open a draft PR that says which run it fixes.' },
    { id: 'st-flaky', workflow: 'flakiness', kind: 'run', label: 'Flakiness', state: 'flakiness', launch: 'investigate', persona: 'CI investigator', ceiling: 'Read-only. Reads the last 30 runs; writes a report.', writes: false, models: SMALL, efforts: ['medium'], held: 'beside',
      summary: 'Whether this step fails on its own, from the last 30 runs.',
      prompt: 'From the last 30 runs of this workflow, say whether the failing step of the run below fails without a change to blame, and how often.' },
    { id: 'st-slow', workflow: 'why slow', kind: 'run', label: 'Why slow', state: 'timing', launch: 'investigate', persona: 'CI investigator', ceiling: 'Read-only. Compares step timings; writes a report.', writes: false, models: SMALL, efforts: ['low', 'medium'], held: 'beside',
      summary: 'Where the time goes, step by step, against the last green run.',
      prompt: 'Compare the step timings of the run below with the last green run of the same workflow and say where the time goes.' }
  ];
  /* What the page of an item an instance holds says next, and the moves the maintainer can ask its owner for.
     holds = whether the move's facts hold now. */
  M.held = {
    'kernel-lut': { next: 'Waits for you: → fix holds, and it widens the grant (push to its branch), so it needs your confirm.',
      moves: [{ label: 'Move to fix', via: 'a move request: review → fix', holds: true, note: 'Its facts hold now; it still waits for your confirm, as any widening move does.' },
        { label: 'Mark ready to merge', via: 'a move request: review → merge-ready', holds: false, note: 'Doesn’t hold: reviewer.verdict == pass is false (review-kernel-212 returned fail).' }] },
    'investigate-1184': { next: 'Sent up to the Steward: it asks which fix image-builder#40 should use. The question is in Needs you.', moves: [] },
    'docs-edl': { next: 'Checking the draft before it asks to move to publish.', moves: [] }
  };
  /* The instance that holds an item: a session that has not ended, carries the item (covers) or opened it (prs),
     and is not a managed session of another holder. */
  M.holderOf = function (ref) {
    const H = window.HUB, on = Object.entries(H.sessions).filter(([id, s]) => s.state !== 'DONE' && M.sessions[id] && ((s.covers || []).indexOf(ref) >= 0 || (s.prs || []).indexOf(ref) >= 0));
    const ids = on.map(([id]) => id), top = ids.filter((id) => ids.indexOf(M.sessions[id].owner) < 0);
    return top[0] || null;
  };
  /* The plain-words ceiling of a grant. */
  M.ceiling = function (g) {
    const gh = g['GitHub'] || [], ro = (g['Permission mode'] || []).indexOf('plan · read-only') >= 0, out = [];
    if (ro) out.push('Read-only checkout'); else if ((g['Shell'] || []).indexOf('edit files in its checkout') >= 0) out.push('Edits its own checkout');
    const does = [];
    if (gh.indexOf('push to its branch') >= 0) does.push('pushes to its own branch');
    if (gh.indexOf('open a draft PR') >= 0) does.push('opens a draft PR');
    if (gh.indexOf('comment') >= 0) does.push('comments');
    if (gh.indexOf('re-run checks') >= 0) does.push('re-runs checks');
    const ses = g['Sessions'] || [], auto = ses.filter((x) => / · auto/.test(x)).map((x) => x.split(' · ')[0]), ask = ses.filter((x) => !/ · auto/.test(x)).map((x) => 'an ' + x.split(' · ')[0]);
    let line = out.join('') + (does.length ? (out.length ? '; ' : '') + does.join(', ') : '');
    line = line.charAt(0).toUpperCase() + line.slice(1) + '.';
    if (auto.length) line += ' Runs the ' + auto.join(' and the ') + '.';
    if (ask.length) line += ' Can ask for ' + ask.join(' or ') + '.';
    if (gh.indexOf('merge to main') < 0) line += ' No merge.';
    return line;
  };
  /* A start as an item's page shows it: its persona, ceiling and whether it writes. */
  M.startView = function (st) {
    const d = M.defs[st.workflow];
    if (d && d.states && d.states[st.state]) {
      const g = M.effective(d, st.state).grant, gh = g['GitHub'] || [];
      return { ...st, persona: d.states[st.state].personas[0], ceiling: M.ceiling(g), where: st.workflow + ' › ' + M.chain(d, st.state).join(' › '),
        writes: gh.some((x) => ['push to its branch', 'open a draft PR', 'comment', 'mark ready for review'].indexOf(x) >= 0) || (g['Shell'] || []).indexOf('edit files in its checkout') >= 0 };
    }
    return { ...st, where: st.workflow + (st.state && st.state !== st.workflow ? ' › ' + st.state : '') };
  };
  /* The starts for a kind, lead first. */
  M.startsFor = function (kind) { return M.starts.filter((s) => s.kind === kind).map(M.startView).sort((a, b) => !!b.lead - !!a.lead); };
  /* The item's details as the session receives them after the prompt, marked as data. */
  M.details = function (ref) {
    const H = window.HUB, it = H.items[ref] || {}, num = ref.indexOf('#') >= 0 ? ref.split('#')[1].trim() : '';
    const repo = it.repo || ref.split('#')[0].split(' ')[0];
    const K = { issue: 'issue', pr: 'pull request', run: 'workflow run', roadmap: 'issue' };
    const L = [['kind', K[it.kind] || it.kind], ['repository', 'GlassineOS/' + repo], ['number', num], ['title', it.title], ['state', (it.state || '').toLowerCase()]];
    if (it.branch) L.push(['branch', it.branch]);
    if (it.labels) L.push(['labels', it.labels.join(', ') || 'none']);
    if (it.checks) L.push(['checks', it.checks.map(([n, s]) => n + ' ' + ({ p: 'passed', f: 'failed', r: 'running' }[s])).join(' · ')]);
    L.push(['links', (it.partOf ? 'Part of ' + it.partOf : 'none')]);
    return L;
  };
})(window.HUB.machine);
