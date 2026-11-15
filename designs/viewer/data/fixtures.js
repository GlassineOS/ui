/* The board viewer's mock data: a design that looks like the shell's, and one open proposal.
   Every name here is made up for the mockups; nothing reads a real design folder.
   SPDX-License-Identifier: GPL-2.0-or-later */
(function () {
  'use strict';
  const S = (id, title, kind, col, row, more) => Object.assign({ id, title, kind, col, row, file: id + '.dc.html', w: 760, h: 1140, interactive: true, states: [], errors: 0, change: null }, more || {});
  const boards = [
    S('settings.eink', 'E-ink', 'settings', 0, 0, { states: ['Fluid', 'Balanced', 'Clear', 'Calm'], links: ['settings.eink.dithering', 'settings.light'] }),
    S('settings.eink.dithering', 'E-ink › Dithering', 'settings', 1, 0, { v: 'b' }),
    S('settings.light', 'Light', 'settings', 2, 0, { states: ['Off', 'Low', 'Reading'] }),
    S('settings.appearance', 'Appearance', 'settings', 3, 0, { states: ['White', 'Editorial', 'Stationery'] }),
    S('settings.gestures', 'Gestures', 'settings', 4, 0, { v: 'b' }),
    S('settings.power', 'Power', 'settings', 5, 0),
    S('settings.bluetooth', 'Bluetooth', 'pair', 0, 1, { change: 'changed', states: ['Off', 'On', 'Scanning', 'Connected'], links: ['settings.bluetooth.pairing'] }),
    S('settings.bluetooth.pairing', 'Bluetooth › Pairing', 'dialog', 1, 1, { change: 'added', states: ['Code', 'Waiting', 'Paired'], links: ['settings.bluetooth.code', 'settings.bluetooth.failed'] }),
    S('settings.bluetooth.code', 'Bluetooth › Code shown', 'dialog', 2, 1, { change: 'added', v: 'b' }),
    S('settings.bluetooth.failed', 'Bluetooth › Failed', 'dialog', 3, 1, { change: 'changed', v: 'c', errors: 1 }),
    S('settings.keyboard', 'Keyboard', 'keyboard', 4, 1, { states: ['Letters', 'Numbers', 'Emoji'] }),
    S('settings.network', 'Wi-Fi', 'list', 5, 1, { states: ['Off', 'Networks', 'Password'] }),
    S('settings.apps', 'Apps: everything installed', 'list', 0, 2, { v: 'b' }),
    S('settings.app', 'One app', 'settings', 1, 2),
    S('settings.app.eink', 'One app › E-ink', 'settings', 2, 2, { v: 'b' }),
    S('settings.date', 'Date & time', 'settings', 3, 2),
    S('settings.about', 'About', 'list', 4, 2, { interactive: false }),
    S('settings.more', 'More · 1/2', 'list', 5, 2, { interactive: false, v: 'b' }),
  ];
  const pages = [
    { id: 'start', name: 'Start here', n: 1 },
    { id: 'shell', name: 'Shell', n: 21 },
    { id: 'home', name: 'Home screen', n: 9 },
    { id: 'settings', name: 'Settings', n: 20 },
    { id: 'packages', name: 'Packages', n: 20 },
    { id: 'setup', name: 'First-run setup', n: 10 },
    { id: 'fit', name: 'Fit (window sizes)', n: 20 },
    { id: 'found', name: 'Foundations', n: 12 },
  ];
  const pr = {
    n: 47, title: 'Settings: pair a Bluetooth device from the list', branch: 'designs/bt-pair', rev: '3f9c2a1',
    by: 'designer session', updated: '14 min ago', checks: 'passed', revisions: 4,
    body: 'Pairing moves from a separate page into a sheet over the device list. The code is shown large, the failure names the device.',
    boards: [
      { id: 'settings.bluetooth', change: 'changed', what: 'Device list: pair from the row, no separate page' },
      { id: 'settings.bluetooth.pairing', change: 'added', what: 'New sheet: pairing over the list' },
      { id: 'settings.bluetooth.code', change: 'added', what: 'New: the code, large' },
      { id: 'settings.bluetooth.failed', change: 'changed', what: 'Failure names the device', errors: 1 },
      { id: 'settings.bluetooth.empty', change: 'removed', what: 'Old empty page, folded into the list' },
      { id: 'fit.bluetooth', change: 'changed', what: 'Window sizes follow the list change' },
    ],
  };
  const designs = [
    { id: 'shell', name: 'GlassineOS shell', boards: 114, pages: 8, updated: 'yesterday', kinds: ['settings', 'home', 'keyboard', 'list', 'dialog', 'pair'] },
    { id: 'hub', name: 'Project Command Center', boards: 79, pages: 6, updated: '3 days ago', kinds: ['list', 'list', 'settings', 'dialog', 'list', 'welcome'] },
    { id: 'installer', name: 'GlassineOS installer', boards: 71, pages: 5, updated: 'today', kinds: ['welcome', 'list', 'dialog', 'list', 'welcome', 'settings'] },
    { id: 'viewer', name: 'Board viewer', boards: 16, pages: 4, updated: 'now', kinds: ['list', 'home', 'list', 'dialog', 'settings', 'list'] },
  ];
  const prs = [
    pr,
    { n: 51, title: 'Home: widget settings in one sheet', branch: 'designs/widget-sheet', rev: '9ab01c2', by: 'designer session', updated: '2 h ago', checks: 'failed', revisions: 2,
      boards: [{ id: 'home.widget-settings', change: 'changed' }, { id: 'home.edit', change: 'changed' }], design: 'shell' },
  ];
  pr.design = 'shell';
  window.VIEWER = {
    boards, pages, pr, prs, designs,
    board: id => boards.find(b => b.id === id) || S(id, id.replace(/^[^.]+\./, ''), 'list', 0, 0, { interactive: false }),
    theme: (voice, scheme) => (voice || 'white') + '-' + (scheme || 'paper'),
    VOICES: [['white', 'White'], ['editorial', 'Editorial'], ['stationery', 'Stationery']],
    SCHEMES: [['paper', 'Paper'], ['night', 'Night'], ['eink', 'E-ink']],
    PENS: [['1', 'Pen 1'], ['2', 'Pen 2'], ['3', 'Pen 3']],
    name: (list, id) => (list.find(x => x[0] === id) || list[0])[1],
  };
})();
