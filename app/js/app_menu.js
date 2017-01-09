'use strict';
/* eslint no-inline-comments: 0 */
/* eslint no-unused-vars: 0 */
/* eslint no-undef: 0 */
/* eslint no-console: 0 */

const titleMenu = Menu.buildFromTemplate([
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            if (tray) tray.destroy();
            focusedWindow.reload(); // Reload the main window and it's elements
          }
        },
      },
      {
        label: 'Toggle Dev Tools',
        accelerator: (() => {
          if (process.platform === 'darwin') return 'Alt+Command+I';
          else return 'Ctrl+Shift+I';
        })(),
        click: (item, focusedWindow) => {
          if (focusedWindow) focusedWindow.toggleDevTools();
        },
      },
    ],
  },
  {
    label: 'Settings',
    submenu: [
      {
        label: 'Close to Tray',
        type: 'checkbox',
        click: (e) => {
          config.app.close_to_tray = e.checked; // Store and save close to tray to config here and main app config
          ipc.send('close_to_tray', e.checked, true);
        },
      },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        click: (e) => ipc.send('windows_auto_start', e.checked),
      },
      {
        label: 'CLR Browser',
        submenu: [
          {
            label: 'Enabled',
            type: 'checkbox',
            click: (e) => {
              ipc.send('clr_enabled', e.checked);
              config.app.clr.enabled = e.checked;
              if (e.checked) {
                $('.clr_options').show();
                $('#flush_clr').show();
                startCLR();
                clrNoty();
              } else {
                $('.clr_options').hide();
                $('#flush_clr').hide();
                stopCLR();
              }
              setAllLights();
            },
          },
          {
            label: 'Change Port',
            click: () => ipc.send('change_port'),
          },
          {
            label: 'Open Browser',
            click: () => require('electron').shell.openExternal(`http://localhost:${config.app.clr.port}`),
          },
        ],
      },
    ],
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'Check for Updates',
        click: () => {
          notyUpdates = true;
          checkForUpdates();
        },
      },
      {
        label: 'View on GitHub', // Open client browser to Github
        click: () => require('electron').shell.openExternal('https://github.com/dbkynd/controlcast'),
      },
      {
        label: 'About',
        click: () => {
          dialog.showMessageBox({ // Show message box with detail about the application
            type: 'info',
            buttons: ['ok'],
            title: 'About ControlCast',
            message: `'ControlCast' by DBKynd\nVersion: ${app_version}` +
            `\ndb@dbkynd.com\n©2016\n\nArtwork and beta testing by Annemunition`,
          });
        },
      },
    ],
  },
]);

Menu.setApplicationMenu(titleMenu); // Set title menu

ipc.on('update_port', (e, data) => {
  console.log(data);
  config.app.clr.port = data;
  stopCLR(() => {
    startCLR();
    clrNoty();
  });
});

function clrNoty() {
  const blanket = $('.blanket');
  $(blanket).fadeIn(200); // Darken the body
  const address = `http://localhost:${config.app.clr.port || 3000}`;
  noty({
    text: `<b>${address}</b>`,
    animation: {
      open: 'animated flipInX', // Animate.css class names
      close: 'animated flipOutX', // Animate.css class names
    },
    layout: 'center',
    type: 'alert',
    timeout: false,
    closeWith: ['click', 'button'],
    callback: {
      onClose: () => $(blanket).fadeOut(1000),
    },
    buttons: [
      {
        addClass: 'btn btn-primary',
        text: 'Copy to Clipboard',
        onClick: ($noty) => {
          $noty.close();
          clipboard.writeText(address);
        },
      },
      {
        addClass: 'btn',
        text: 'Close',
        onClick: ($noty) => $noty.close(),
      },
    ],
  });
}
