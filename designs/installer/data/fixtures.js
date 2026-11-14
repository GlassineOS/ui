/* GlassineOS installer — sample data for every board (a proposal, not the installer's data).
   The screens never name a device or a system: every such text is here, as it would come from a
   device description (spec 001, SC-005: the same screens for every machine, only these texts
   differ). No unit-unique values (no serials, addresses, accounts): the screens show none.
   Texts marked owed: below are not known yet and show as a dashed placeholder. */
window.INSTALLER = {
  flow: [
    { id: 'check', name: 'Check' },
    { id: 'plan', name: 'Plan' },
    { id: 'confirm', name: 'Confirm' },
    { id: 'backup', name: 'Back up' },
    { id: 'install', name: 'Install' },
    { id: 'verify', name: 'Verify' }
  ],
  browsers: 'Chromium, Google Chrome, Microsoft Edge, Brave, Opera or Vivaldi',

  machines: {
    /* ---------------------------------------------------------------- the e-ink device */
    device: {
      kind: 'device',
      name: 'Onyx Boox Note Air',
      short: 'Note Air',
      the: 'the Note Air',
      chip: 'Onyx Boox Note Air · USB',
      where: 'Connected to this computer by USB',
      facts: [
        ['Recognised as', 'Onyx Boox Note Air'],
        ['Processor', 'Qualcomm Snapdragon 636'],
        ['Storage', '32 GB'],
        ['Runs now', 'Android 10, the maker’s system'],
        ['Reached through', 'Its start-up mode, over USB']
      ],
      tech: [
        ['Recognised by', 'SoC, board, boot loader and storage layout (not by its name)'],
        ['SoC', 'SDM636 (sdm660 family)'],
        ['Storage', 'eMMC, one partition table, one slot (A)'],
        ['Boot loader', 'Android boot loader, fastboot over USB'],
        ['Backend', 'Android boot loader']
      ],
      connections: [
        { name: 'Its start-up mode (USB)', here: true, note: 'All steps of the installation use it.' },
        { name: 'Android’s USB debugging', here: true, note: 'Optional: lets the installer restart the device into its start-up mode for you.' }
      ],
      state: { name: 'As it came from the maker', body: 'Android 10 runs on it. No part of GlassineOS is on it.' },
      caps: [
        { name: 'Choose which kernel starts', has: 'yes', body: 'GlassineOS can start the kernel it was built with.' },
        { name: 'Trial start', has: 'yes', body: 'A new GlassineOS version starts once on trial. If it doesn’t start properly, the previous one starts again.' },
        { name: 'Recovery', has: 'yes', body: 'GlassineOS’s own repair tool, started on the device itself.' },
        { name: 'Keep the maker’s system', has: 'yes', body: 'Android can stay, and both start. You pick one at start-up.' }
      ],
      fate: {
        keep: ['Android 10 and its apps', 'The device’s own data that must never change (only read)'],
        backup: ['A full copy of the device, about 8.6 GB, to a folder on this computer or an external disk', 'The values unique to this device, in any case'],
        replace: ['The boot loader, the program that starts the device', 'The storage layout: two start-up options instead of one'],
        create: ['GlassineOS, on the second start-up option', 'GlassineOS recovery', 'Your GlassineOS storage, about 20 GB']
      },
      erase: {
        title: 'Your files in Android will be erased',
        body: 'Step 3 shrinks the storage Android keeps your files on from about 24 GB to about 20 GB and empties it: books, notes, downloads and app data. Android then starts like a new device.',
        withBackup: 'They are in the full copy of the device: going back to the maker’s system puts them back as they were.',
        withoutBackup: 'Without a backup, they are gone for good.',
        exit: 'Copy what you want to keep to this computer first. Until you confirm, nothing changes.',
        ack: 'I know that my files in Android will be erased: books, notes, downloads and app data.'
      },
      space: [['For the backup', 'About 8.6 GB, in a folder on this computer or an external disk'], ['On the device', 'About 4 GB of Android’s storage, for GlassineOS']],
      backup: {
        on: 'Back up the whole Note Air',
        onTag: 'Recommended',
        onBody: 'A full copy of the device: every part of it and its partition table. With it, the installer can repair any damage and put the Note Air back exactly as it was, your files in Android too.',
        size: 'About 8.6 GB',
        sizeNote: 'Estimated from what is on this Note Air now: 29 GB before it is compressed. Storage that is mostly empty compresses to little.',
        where: 'It goes to a folder on this computer or on an external disk; you choose it on the next screen.',
        off: 'Install without a backup',
        offBody: 'For when there isn’t room for one anywhere.',
        offWhat: 'Without a backup, going back to the maker’s system and repairing damage are not possible.',
        always: 'The values unique to this Note Air, such as its calibration, are saved in any case, with or without a backup. They are small.'
      },
      /* How a person picks a system at start-up is the device's own (its description holds it):
         today a power-menu item and the cover; later a start-up chooser on the device. */
      /* The plan's "In short" card: one plain sentence per outcome, no technical words. */
      plain: {
        keep: 'Android stays. GlassineOS is added next to it, and you can start either one.',
        replace: 'Android and its apps are removed. GlassineOS takes their place.',
        erase: 'Your files in Android (books, notes, downloads) are erased. Copy what you want to keep first.',
        backup: 'First, a full copy of the Note Air is saved on this computer. With it, everything can be put back.',
        noBackup: 'No copy of the Note Air is made. If something goes wrong, it can’t be put back as it was.',
        stock: 'GlassineOS is removed and the Note Air goes back to how it came from the maker, from your backup.',
        cableNeed: 'An emergency cable',
        cableNote: 'Only used if something goes wrong in step 2.'
      },
      keepChoice: {
        os: 'Android 10',
        heading: 'Android 10, the maker’s system',
        keep: 'Keep Android 10',
        keepBody: 'It stays on the first start-up option, and both systems start. GlassineOS starts by default.',
        pick: 'To start Android: choose “Restart into Android” in GlassineOS’s power menu. To come back: start the device with its cover closed; GlassineOS recovery opens and starts GlassineOS.',
        replace: 'Replace Android 10',
        replaceBody: 'Android and its apps are removed. It can come back only from the backup.',
        replaceBodyNoBackup: 'Android and its apps are removed. Without a backup it can’t come back.'
      },
      cable: {
        question: 'Do you have an emergency cable for the Note Air?',
        what: 'A USB cable that starts the device in its emergency mode, where it can always be written. It’s needed only if the step that replaces the boot loader fails.',
        yes: 'Yes, I have one',
        no: 'No',
        refused: 'Without one, the Note Air can’t be installed: only that cable can undo a failed step 2, and the installation can’t skip that step. Nothing has changed: the device still starts Android.',
        get: 'What an emergency cable is'
      },
      steps: [
        { id: 'backup', title: 'Back up the whole device', body: 'The installer copies the whole device, every part and its partition table, compressed, to the place you choose, and reads the copy back to check it.',
          escape: 'Nothing on the device has changed yet. It starts Android as before.', tech: 'every partition and the partition table (GPT), read in the chip’s emergency mode through the programmer you provide: 29.5 GB raw, about 8.6 GB compressed (estimate)',
          noBackup: { title: 'Save the values unique to this device', body: 'Its calibration and the like, to the folder you choose. There is no backup: you chose to install without one.', tech: 'persist, onyxconfig, modemst1, modemst2, fsg, devinfo' } },
        { id: 'loader', title: 'Replace the boot loader', ponr: true, body: 'The device gets GlassineOS’s boot loader. It starts both systems; Android keeps working with it.',
          escape: 'The device starts only in its emergency mode. With the emergency cable, the installer puts the old boot loader back from the backup.', cable: true, tech: 'abl: GlassineOS boot loader, signed with the test keys the device accepts',
          noBackup: { escape: 'The device starts only in its emergency mode. With the emergency cable, the installer writes GlassineOS’s boot loader again; without a backup, the old one can’t come back.' } },
        { id: 'layout', title: 'Make room for a second start-up option', erase: true, body: 'The storage is divided anew. Android’s storage shrinks from about 24 GB to about 20 GB and is emptied.',
          escape: 'Android still starts. The installer can write the old layout back from the backup.', tech: 'GPT rewritten for A/B: boot_b, system_b, vendor_b created; userdata 24 → 20 GB, reformatted',
          noBackup: { escape: 'Android still starts. The installer can finish the installation; without a backup, the old layout can’t come back.' } },
        { id: 'write', title: 'Write GlassineOS', body: 'Its base and first version go onto the second start-up option. Files GlassineOS needs from Android are read from the device, used, and deleted from this computer afterwards; they are never uploaded.',
          escape: 'Android still starts. The installer can write GlassineOS again, or undo.', tech: 'slot B: base (send stream) and first deployment; vendor files from the device',
          noBackup: { escape: 'Android still starts. The installer can write GlassineOS again.' } },
        { id: 'recovery', title: 'Add GlassineOS recovery', body: 'A repair tool on the device, for when GlassineOS doesn’t start.',
          escape: 'Both systems still start. The installer can write it again.', tech: 'recovery partition; TWRP stays reachable from it for Android' },
        { id: 'start', title: 'Start GlassineOS and wait until it’s accepted', body: 'The device restarts into GlassineOS. The installation is done once that start has been accepted, about two minutes later.',
          escape: 'If GlassineOS doesn’t start properly, the device starts Android again by itself. The installer can try again, or undo.', tech: 'one-shot trial boot of slot B; accepted per boot 001',
          noBackup: { escape: 'If GlassineOS doesn’t start properly, the device starts Android again by itself. The installer can try again.' } }
      ],
      backupWhere: { kind: 'folder', label: 'A folder on this computer or on an external disk', chosen: 'Glassine backup, in Downloads', choose: 'Choose a folder…', note: 'Your browser asks to let the installer save there. The backup needs about 8.6 GB; if the folder is too small, the installer says so and you choose another.' },
      backupWhereNone: { label: 'Only the values unique to this device', chosen: 'Glassine backup, in Downloads', choose: 'Choose a folder…', note: 'They are small. Your browser asks to let the installer save there.' },
      backupTotal: 'About 8.6 GB compressed, from 29 GB',
      backupItems: [
        { name: 'The partition table', tech: 'GPT, primary and backup', size: '0.1 MB' },
        { name: 'Start-up firmware and boot loader', tech: 'xbl, xblbak, tz, rpm, hyp, pmic, devcfg, keymaster, cmnlib, cmnlib64, mdtpsecapp, mdtp, abl, dip, apdp, msadp, dpo, limits, toolsfv, ddr, sec, storsec, sti', size: '60 MB' },
        { name: 'Start-up files and recovery', tech: 'boot, recovery, vbmeta, misc, splash', size: '160 MB' },
        { name: 'Radio and signal firmware', tech: 'modem, dsp, bluetooth, fsg, modemst1, modemst2, fsc, ssd', size: '130 MB' },
        { name: 'The device’s own data, such as its calibration', tech: 'persist, onyxconfig, devinfo, keystore, frp', size: '65 MB' },
        { name: 'Android’s system', tech: 'system', size: '3.0 GB' },
        { name: 'Android’s vendor part', tech: 'vendor', size: '0.8 GB' },
        { name: 'Cache and log areas', tech: 'cache, logfs, logdump, rawdump', size: '0.5 GB' },
        { name: 'Your files in Android', tech: 'userdata', size: '24 GB' }
      ],
      backupAt: 5, backupPct: 62,
      installAt: 3, installPct: 45,
      keepConnected: 'Keep the Note Air connected and this page open.',
      /* A file the backup needs that only the person can provide (installer spec 004; description
         [[supplied_files]], spec 002 FR-018b). No link and no search: the usual name is shown to copy. */
      supply: {
        noun: 'emergency programmer',
        title: 'The Note Air’s emergency programmer',
        what: 'A small program, signed by the chip’s maker, that the Note Air runs in its emergency mode. Through it the installer reads the whole device for the backup, before anything changes. It isn’t on the device, so the installer can’t read it from there.',
        why: 'It belongs to the chip’s maker, and GlassineOS may not pass it on. You find it yourself, for your own device. It stays on this computer, is used only for this backup, and is never uploaded.',
        matches: [['Chip', 'Qualcomm Snapdragon 636 (000cc0e1)'], ['Signing key', '7be49b72f9e43372…'], ['Kind', 'A Firehose programmer for eMMC storage']],
        usualName: '000cc0e100000000_7be49b72f9e43372_',
        nameNote: 'Files for Qualcomm’s emergency mode are named after the chip and its signing key. Search the web for a file whose name starts with this; the end of the name varies.',
        risk: 'The Note Air runs any programmer that carries a test signature, and a programmer can read and change all of its storage. A changed file could damage the device or what is on it. A known file is the same, byte for byte, as one that has read Note Airs before.',
        files: {
          known: { name: '000cc0e100000000_7be49b72f9e43372_fhprg_bqx2_peek.bin', size: '620 KB', sum: 'b3e40955 8677f9b2 … 98d86c14 d41b', note: 'The same as a file that has read Note Airs in testing.' },
          unknown: { name: 'prog_firehose_sdm636_emmc.elf', size: '612 KB', sum: '9f2a07c1 3e5b88d0 … 0b7e19aa 41c7', note: 'Made for this chip and its signing key, but not the same as any file known to work.' },
          wrong: { name: '0014d0e100000000_d40eee56f3194665_FHPRG.bin', size: '588 KB', sum: '4410d2be 90ac7f13 … c25e8b04 7d91',
            rows: [['Chip', 'Qualcomm Snapdragon 662 (0014d0e1)', 'Snapdragon 636 (000cc0e1)'], ['Signing key', 'd40eee56f3194665…', '7be49b72f9e43372…'], ['Storage', 'UFS', 'eMMC']] }
        },
        refused: 'The Note Air didn’t accept the programmer, or the programmer didn’t answer the installer.',
        leave: 'Hold the power button for about 10 seconds: the Note Air leaves its emergency mode and starts Android.'
      },
      restart: 'The Note Air restarts into GlassineOS',
      verifyWhere: 'Keep the Note Air connected. This page follows its start.',
      cutAt: 3,
      cut: 'The installation was cut off during step 4, Write GlassineOS. Steps 1 to 3 are complete.',
      cutNow: 'Android starts. GlassineOS doesn’t start yet.',
      installed: {
        version: 'GlassineOS 2026.11',
        since: 'Installed on 12 November 2026, with Android 10 kept',
        backup: 'The backup from the installation: Glassine backup, in Downloads',
        backupNote: 'Your browser asks you to choose that folder again before the installer can use it.'
      },
      done: {
        title: 'GlassineOS is installed on your Note Air',
        next: 'Set up GlassineOS on the device: it asks for a language, Wi-Fi and a password.',
        kept: 'Android 10 is still there. To start it, choose “Restart into Android” in GlassineOS’s power menu.',
        backup: 'Keep the backup in Glassine backup, in Downloads: with it the Note Air can be repaired, or go back to how it came from the maker.',
        record: 'A record of this installation is on the device and next to the backup: the device, the versions, the layout, its capabilities and where the backup is.',
        vendor: 'The files GlassineOS needed from Android were deleted from this computer.',
        stockTitle: 'Your Note Air runs Android again, as it came from the maker',
        stockBody: 'The whole device is back from the full copy, checked against it. GlassineOS, its recovery and your GlassineOS storage are gone.',
        stockLost: 'Your files in Android are back as they were when the copy was made, at the installation. What changed in Android since then isn’t.',
        stockBackup: 'The backup in Glassine backup, in Downloads, isn’t needed any more. You can delete it.'
      },
      reach: {
        intro: 'The installer works with the Note Air in its start-up mode, a mode it starts in before Android. For this installation it must be started into that mode freshly.',
        auto: 'Restart it for me',
        autoBody: 'With USB debugging on in Android, the installer restarts the Note Air into its start-up mode. Your browser asks twice which device to use: once for Android, once for the start-up mode.',
        only: 'For now, the installer reaches a stock Note Air only this way: there is no way to start it into its start-up mode by hand yet.',
        debugSteps: [
          'On the Note Air, open Settings.',
          'Open “About tablet” and tap “Build number” seven times. Android says you are now a developer.',
          'Open “Developer options” and turn on “USB debugging”.',
          'Connect the Note Air to this computer. When it asks “Allow USB debugging?”, tap Allow.'
        ],
        debugOwed: 'Menu names as in Android 10; the Note Air’s own names come from its description, to be checked on the device.',
        chooserName: 'Android',
        chooserNote: 'The Note Air may be listed as “Android”.',
        waitHints: ['Is the cable in both the Note Air and this computer?', 'Some cables only charge. Try another cable.', 'Is the screen of the Note Air showing its start-up mode?'],
        found: 'Found your Note Air, freshly started in its start-up mode.',
        notFresh: 'The Note Air answered, but it wasn’t started freshly into its start-up mode. It has to be, for this installation.'
      },
      stockErase: {
        title: 'Your GlassineOS storage will be erased',
        body: 'Going back puts the full copy of the device back: GlassineOS, its recovery and your GlassineOS storage are erased, and Android is as it was at the installation, your files in it too. What changed in Android since then is replaced.',
        exit: 'Copy what you want to keep from GlassineOS first. Until you confirm, nothing changes.'
      },
      stockSteps: [
        { id: 'check', title: 'Check the backup', body: 'The installer reads the backup and checks that every part is complete and unchanged.',
          escape: 'Nothing on the device has changed yet. GlassineOS starts as before.', tech: 'checksums of every backed-up partition against the installation record' },
        { id: 'layout', title: 'Put the old storage layout back', erase: true, body: 'One start-up option again, and Android’s storage at its old size. GlassineOS and your GlassineOS storage are erased.',
          escape: 'The installer can finish going back.', tech: 'partition table (GPT) from the full copy' },
        { id: 'android', title: 'Put the rest of the device back', body: 'Every other part from the full copy: Android’s system and start-up files, its recovery, and your files in Android.',
          escape: 'The installer can write them again.', tech: 'every partition from the full copy except abl' },
        { id: 'loader', title: 'Put the maker’s boot loader back', ponr: true, body: 'The last step: the device starts as it came from the maker.',
          escape: 'The device starts only in its emergency mode. With the emergency cable, the installer writes the boot loader again.', cable: true, tech: 'abl from the backup' },
        { id: 'start', title: 'Start Android and check it', body: 'The device restarts. Going back is done once Android has started.',
          escape: 'If Android doesn’t start, the installer can write the backup again.', tech: 'normal boot; checked over USB' }
      ],
      resumeStep: 'Resume from step 4, Write GlassineOS',
      undoBody: 'The full copy goes back: the Note Air is as it was before the installation, your files in Android too.',
      repair: 'The boot loader, the start-up files and GlassineOS recovery are put back.',
      reinstall: 'A fresh first version of GlassineOS on the second start-up option.',
      stock: 'The full copy goes back. Android 10 is the only system again, with your files as they were at the installation; GlassineOS and your GlassineOS storage are erased.'
    },

    /* ---------------------------------------------------------------- the PC */
    pc: {
      kind: 'pc',
      name: 'This PC',
      short: 'this PC',
      the: 'this PC',
      chip: 'This PC',
      where: 'The installer runs on this PC, started from the GlassineOS USB stick',
      facts: [
        ['Recognised as', 'A PC that starts with UEFI'],
        ['Processor', '64-bit x86'],
        ['Storage', 'One 512 GB disk'],
        ['Runs now', 'Windows 11'],
        ['Free space', '100 GB that no system uses']
      ],
      tech: [
        ['Recognised by', 'firmware (UEFI), Secure Boot state and the disks’ partition tables'],
        ['Disk', 'NVMe, GPT: EFI system partition, Windows, Windows recovery, 100 GB unallocated'],
        ['Backend', 'UEFI PC']
      ],
      connections: [
        { name: 'This PC’s own disks and firmware', here: true, note: 'The installer runs on this PC.' }
      ],
      state: { name: 'Windows 11, no GlassineOS', body: 'Windows 11 is installed. No part of GlassineOS is on it.' },
      caps: [
        { name: 'Choose which kernel starts', has: 'yes', body: 'GlassineOS can start the kernel it was built with.' },
        { name: 'Trial start', has: 'yes', body: 'A new GlassineOS version starts once on trial. If it doesn’t start properly, the previous one starts again.' },
        { name: 'Recovery', has: 'not yet', body: 'GlassineOS recovery isn’t built for PCs yet. Until it is, repair and go back by starting from the GlassineOS USB stick.' },
        { name: 'Keep the other system', has: 'yes', body: 'Windows can stay, and both start. You pick one at start-up.' }
      ],
      fate: {
        keep: ['Windows 11 and all its files', 'Windows recovery'],
        backup: ['The PC’s start-up files and its list of start-up entries: 0.2 GB, to the USB stick'],
        backupReplace: ['All of Windows 11 and the start-up files: about 410 GB, to a disk you choose'],
        replace: ['Nothing'],
        create: ['GlassineOS’s system (20 GB) and your storage (80 GB), in the free space', 'A start-up entry for GlassineOS']
      },
      erase: null,
      space: [['On the disk', '100 GB, the free space'], ['For the backup', '0.2 GB on the USB stick']],
      spaceReplace: [['On the disk', 'The whole 512 GB disk'], ['For the backup', 'About 410 GB on another disk: the USB stick has 12 GB free']],
      backup: {
        on: 'Back up the PC’s start-up files',
        onTag: 'Recommended',
        onBody: 'Its start-up files, the list of start-up entries and the partition table. With them, the installer can repair the PC’s start-up and take GlassineOS off again.',
        size: '0.2 GB',
        sizeNote: 'It fits on the GlassineOS USB stick (12 GB free).',
        where: 'It goes to the USB stick, or to another disk you choose on the next screen.',
        off: 'Install without a backup',
        offBody: 'For when there isn’t room for one anywhere.',
        offWhat: 'Without a backup, going back to how this PC was and repairing damage are not possible.',
        always: ''
      },
      backupReplace: {
        on: 'Back up Windows 11 and the start-up files',
        onTag: 'Recommended',
        onBody: 'All of Windows 11, its files, the start-up entries and the partition table. With it, the installer can repair damage and put Windows back as it was.',
        size: 'About 410 GB',
        sizeNote: 'That doesn’t fit on the USB stick (12 GB free): on the next screen you choose another disk, such as an external one.',
        where: '',
        off: 'Install without a backup',
        offBody: 'For when there isn’t a disk with room for it.',
        offWhat: 'Without a backup, Windows 11 and its files are gone for good: going back to it and repairing damage are not possible.',
        always: ''
      },
      plain: {
        keep: 'Windows stays. GlassineOS is added in the free space, and you can start either one.',
        replace: 'Windows and every file in it are erased. GlassineOS uses the whole disk.',
        erase: '',
        backup: 'First, the PC’s start-up files are saved to the USB stick. With them, the PC can be put back.',
        backupReplace: 'First, a full copy of Windows is saved to a disk you choose. With it, Windows can be put back.',
        noBackup: 'No backup is made. If something goes wrong, the PC can’t be put back as it was.',
        stock: 'GlassineOS is removed and the PC goes back to how it was, from your backup.'
      },
      disks: [{ name: '512 GB disk', body: 'Windows 11 · 100 GB free', checked: true }],
      oses: [{
        os: 'Windows 11',
        heading: 'Windows 11, found on the 512 GB disk',
        keep: 'Keep Windows 11',
        keepBody: 'It stays as it is, and both systems start. GlassineOS starts by default.',
        pick: 'To start Windows: choose it in GlassineOS’s start menu, or in the PC’s own start-up menu.',
        replace: 'Replace Windows 11',
        replaceBody: 'Windows and every file in it are erased. GlassineOS uses the whole disk.'
      }],
      replaceNeeds: 'Windows 11 and every file in it are erased. Below you choose whether the installer backs it up first.',
      stepsReplace: [
        { id: 'backup', title: 'Back up Windows 11 and the start-up files', body: 'The installer saves all of Windows 11, its files and the start-up entries on the disk you choose, and reads the copy back to check it.',
          escape: 'Nothing on the PC has changed yet. It starts Windows as before.', tech: 'whole disk image of the Windows partitions, EFI system partition, UEFI boot entries, partition table; about 410 GB',
          noBackup: { title: 'Note the PC’s start-up entries', body: 'The list of start-up entries, on the USB stick. There is no backup: you chose to install without one.', tech: 'UEFI boot entries and BootOrder, a few KB' } },
        { id: 'room', title: 'Erase Windows 11 and divide the disk for GlassineOS', ponr: true, erase: true, body: 'Windows and every file in it are erased. The whole disk goes to GlassineOS’s system (20 GB) and your storage (the rest).',
          escape: 'Windows no longer starts. The installer can put it back from the backup, or finish.', tech: 'new GPT: EFI system partition kept, Windows partitions removed, system and data partitions created',
          noBackup: { escape: 'Windows no longer starts, and without a backup it can’t come back. The installer can finish.' } },
        { id: 'write', title: 'Write GlassineOS', body: 'Its base and first version go into the new system area.',
          escape: 'No system starts from the disk. Start from the USB stick again: the installer can write GlassineOS again, or put Windows back.', tech: 'system partition: base (send stream) and first deployment',
          noBackup: { escape: 'No system starts from the disk. Start from the USB stick again: the installer can write GlassineOS again.' } },
        { id: 'entry', title: 'Add GlassineOS to the PC’s start-up', body: 'GlassineOS’s start-up files and an entry that starts first.',
          escape: 'Start from the USB stick again: the installer can write the entry again.', tech: 'EFI system partition: GlassineOS boot files; Windows Boot Manager entry removed; new UEFI boot entry' },
        { id: 'recovery', title: 'GlassineOS recovery: not yet on PCs', notyet: true, body: 'This step is left out: GlassineOS recovery isn’t built for PCs yet. Keep the USB stick: repair and going back start from it.',
          escape: 'Nothing is written in this step.', tech: 'no recovery entry yet' },
        { id: 'start', title: 'Start GlassineOS and wait until it’s accepted', body: 'Remove the USB stick when asked; the PC restarts into GlassineOS. The installation is done once that start has been accepted, about two minutes later.',
          escape: 'If GlassineOS doesn’t start properly, start from the USB stick again to try again, or put Windows back.', tech: 'one-shot trial boot (BootNext); accepted per boot 001',
          noBackup: { escape: 'If GlassineOS doesn’t start properly, start from the USB stick again to try again.' } }
      ],
      steps: [
        { id: 'backup', title: 'Back up the PC’s start-up files', body: 'The installer saves the start-up files and the list of start-up entries on the USB stick and reads the copy back to check it.',
          escape: 'Nothing on the PC has changed yet. It starts Windows as before.', tech: 'EFI system partition (files), UEFI boot entries and BootOrder, partition table',
          noBackup: { title: 'Note the PC’s start-up entries', body: 'The list of start-up entries, on the USB stick. There is no backup: you chose to install without one.', tech: 'UEFI boot entries and BootOrder, a few KB' } },
        { id: 'room', title: 'Make room for GlassineOS', body: 'Two new areas in the 100 GB no system uses: GlassineOS’s system (20 GB) and your storage (80 GB). Windows isn’t touched.',
          escape: 'Windows still starts. The installer can remove what it made.', tech: 'two GPT partitions in unallocated space; Windows partitions untouched' },
        { id: 'write', title: 'Write GlassineOS', body: 'Its base and first version go into the new system area.',
          escape: 'Windows still starts. The installer can write GlassineOS again, or undo.', tech: 'system partition: base (send stream) and first deployment' },
        { id: 'entry', title: 'Add GlassineOS to the PC’s start-up', body: 'GlassineOS’s start-up files and an entry that starts first. GlassineOS’s start menu lists Windows too.',
          escape: 'Windows still starts from the PC’s own start-up menu. The installer can put the old entries back.', tech: 'EFI system partition: GlassineOS boot files; new UEFI boot entry, first in BootOrder',
          noBackup: { escape: 'Windows still starts from the PC’s own start-up menu. The installer can write the entry again.' } },
        { id: 'recovery', title: 'GlassineOS recovery: not yet on PCs', notyet: true, body: 'This step is left out: GlassineOS recovery isn’t built for PCs yet. Keep the USB stick: repair and going back start from it.',
          escape: 'Nothing is written in this step.', tech: 'no recovery entry yet' },
        { id: 'start', title: 'Start GlassineOS and wait until it’s accepted', body: 'Remove the USB stick when asked; the PC restarts into GlassineOS. The installation is done once that start has been accepted, about two minutes later.',
          escape: 'If GlassineOS doesn’t start properly, the PC starts Windows. Start from the USB stick again to try again, or undo.', tech: 'one-shot trial boot (BootNext); accepted per boot 001' }
      ],
      backupWhere: { kind: 'disk', label: 'The GlassineOS USB stick', chosen: 'GlassineOS USB stick, 12 GB free', choose: 'Choose another disk…', note: 'The backup needs 0.2 GB.' },
      backupWhereReplace: { kind: 'disk', label: 'Another disk', chosen: 'External disk, 1 TB, 870 GB free', choose: 'Choose another disk…', note: 'The backup needs about 410 GB.' },
      backupWhereNoRoom: { kind: 'disk', label: 'No disk with room for it', chosen: 'GlassineOS USB stick, 12 GB free', choose: 'Choose another disk…', note: 'The backup needs about 410 GB. No connected disk has that much free. Connect one, such as an external disk, and choose it.' },
      backupWhereNone: { label: 'Only the start-up entries', chosen: 'GlassineOS USB stick, 12 GB free', choose: 'Choose another disk…', note: 'A few KB.' },
      backupItems: [
        { name: 'Storage layout', tech: 'partition table (GPT)', size: '0.1 MB' },
        { name: 'Start-up entries', tech: 'UEFI boot entries, BootOrder', size: '0.1 MB' },
        { name: 'Start-up files', tech: 'EFI system partition', size: '0.2 GB' }
      ],
      backupAt: 2, backupPct: 40,
      installAt: 2, installPct: 45,
      keepConnected: 'Keep the PC plugged in and the USB stick in.',
      restart: 'The PC restarts into GlassineOS',
      verifyWhere: 'This screen comes back on GlassineOS’s first start and follows it there.',
      cutAt: 1,
      cut: 'The installation was cut off during step 2, Make room for GlassineOS. Step 1 is complete.',
      cutNow: 'Windows starts. GlassineOS doesn’t start yet.',
      installed: {
        version: 'GlassineOS 2026.11',
        since: 'Installed on 12 November 2026, with Windows 11 kept',
        backup: 'The backup from the installation: on the GlassineOS USB stick',
        backupNote: 'The installer found it on the USB stick.'
      },
      done: {
        title: 'GlassineOS is installed on this PC',
        next: 'Set up GlassineOS: it asks for a language, a network and a password.',
        kept: 'Windows 11 is still there. To start it, choose it in GlassineOS’s start menu.',
        backup: 'Keep the USB stick: the backup is on it, and repair and going back start from it until PCs have GlassineOS recovery.',
        record: 'A record of this installation is on this PC and next to the backup: the PC, the versions, the layout, its capabilities and where the backup is.',
        vendor: 'Nothing was copied off this PC.',
        stockTitle: 'This PC is as it was before GlassineOS',
        stockBody: 'GlassineOS’s areas are removed and the start-up files and entries are back, checked against the backup. Windows 11 starts as before.',
        stockLost: 'Your GlassineOS storage is gone with it.',
        stockBackup: 'The backup on the USB stick isn’t needed any more.'
      },
      reach: {
        found: 'The installer runs on this PC and reads it directly. There is nothing to connect.'
      },
      resumeStep: 'Resume from step 2, Make room for GlassineOS',
      undoBody: 'What the installer made in the free space is removed and the start-up entries go back. Windows starts as before.',
      repair: 'GlassineOS’s start-up files and its start-up entry are put back.',
      reinstall: 'A fresh first version of GlassineOS in its system area.',
      stock: 'GlassineOS’s areas are removed and the start-up files and entries go back. Windows 11 stays; your GlassineOS storage is erased.'
    },

    /* ---------------------------------------------------------------- not supported */
    unsupported: {
      kind: 'device',
      name: 'An e-ink tablet',
      short: 'tablet',
      the: 'the tablet',
      chip: 'Tablet · USB',
      title: 'GlassineOS doesn’t support this device yet',
      lead: 'The check is done and nothing was changed. Here is what the installer found, and what is missing.',
      facts: [
        ['Recognised as', 'No device description matches this hardware'],
        ['Processor', 'Rockchip RK3566'],
        ['Storage', '64 GB'],
        ['Runs now', 'Android 11'],
        ['Reached through', 'Android’s USB debugging']
      ],
      missing: [
        { name: 'A device description', has: 'no', body: 'No description of this hardware exists yet, so the installer doesn’t know which parts it may write.' },
        { name: 'Choose which kernel starts', has: 'no', body: 'Its boot loader is locked: it starts only what its maker signed.' },
        { name: 'Trial start', has: 'unknown', body: 'Not known without a description.' }
      ],
      report: [
        'Model name (as the device reports it): not shown, no description',
        'Processor: Rockchip RK3566 · board: rk3566',
        'Storage: 64 GB, eMMC',
        'Boot loader: locked, Android boot loader',
        'System: Android 11',
        'Installer: version 0.1, from a browser'
      ]
    },
    conflict: {
      kind: 'device',
      name: 'A device named Onyx Boox Note Air',
      short: 'device',
      the: 'the device',
      chip: 'Device · USB',
      title: 'This device doesn’t match its name',
      lead: 'Its name says one device, its hardware another. The installer goes by the hardware and treats it as unsupported. Nothing was changed.',
      facts: [
        ['Its name says', 'Onyx Boox Note Air'],
        ['Its processor', 'Qualcomm Snapdragon 662'],
        ['The Note Air has', 'Qualcomm Snapdragon 636'],
        ['Runs now', 'Android 11']
      ],
      conflicts: [
        { name: 'Model name and processor disagree', has: 'no', body: 'A device named Note Air has a Snapdragon 636; this one has a Snapdragon 662.' },
        { name: 'Storage layout', has: 'no', body: 'Its storage isn’t laid out like the Note Air’s.' }
      ],
      report: [
        'Model name (as the device reports it): Onyx Boox Note Air',
        'Processor: Qualcomm Snapdragon 662 · board: bengal',
        'Storage: 64 GB, UFS',
        'Conflict: the name matches the description “Onyx Boox Note Air”, the processor and the storage don’t',
        'System: Android 11',
        'Installer: version 0.1, from a browser'
      ]
    }
  }
};
