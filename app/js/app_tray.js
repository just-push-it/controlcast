'use strict';
/* eslint no-inline-comments: 0 */
/* eslint no-unused-vars: 0 */
/* eslint no-undef: 0 */
/* eslint no-console: 0 */

const tray = new Tray(path.join(__dirname, 'images/icon.ico'));
const contextMenu = Menu.buildFromTemplate([
  {
    label: 'Restore',
    click: () => {
      remote.getCurrentWindow().setSkipTaskbar(false); // Show Taskbar Icon
      remote.getCurrentWindow().restore(); // Restore main window
      remote.getCurrentWindow().focus(); // Focus Window
    },
  },
  {
    label: 'Reset Position',
    click: () => {
      remote.getCurrentWindow().setSkipTaskbar(false); // Show Taskbar Icon
      remote.getCurrentWindow().restore(); // Restore main window
      remote.getCurrentWindow().setPosition(0, 0); // Move to main screen, 0,0
      remote.getCurrentWindow().focus(); // Focus Window
    },
  },
  {
    type: 'separator',
  },
  {
    label: 'Exit',
    click: () => ipc.send('force_quit'),
  },
]);

tray.setToolTip('ControlCast');
tray.setContextMenu(contextMenu);

tray.on('double-click', () => {
  if (remote.getCurrentWindow().isMinimized()) {
    remote.getCurrentWindow().setSkipTaskbar(false); // Show Taskbar Icon
    remote.getCurrentWindow().restore(); // Restore main window
    remote.getCurrentWindow().focus(); // Focus Window
  } else {
    remote.getCurrentWindow().minimize(); // Minimize main window
  }
});
