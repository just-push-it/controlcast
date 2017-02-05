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
        click: (e) => config.set('app.close_to_tray', e.checked),
      },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        click: (e) => ipc.send('windows_auto_start', e.checked),
      },
      {
        label: 'Start Minimized',
        type: 'checkbox',
        click: (e) => config.set('app.start_minimized', e.checked),
      },
      {
        label: 'CLR Browser',
        submenu: [
          {
            label: 'Enabled',
            type: 'checkbox',
            click: (e) => {
              config.set('app.clr.enabled', e.checked);
              titleMenu.items[1].submenu.items[3].submenu.items[1].enabled = e.checked;
              titleMenu.items[1].submenu.items[3].submenu.items[2].enabled = e.checked;
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
            },
          },
          {
            label: 'Change Port',
            click: () => ipc.send('change_port'),
          },
          {
            label: 'Open Browser',
            click: () => require('electron').shell.openExternal(`http://localhost:${config.get('app.clr.port')}`),
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
            message: `'ControlCast' by DBKynd\nVersion: ${remote.getGlobal('app_version')}` +
            `\ndb@dbkynd.com\n©${moment().format('YYYY')}\n\nArtwork and Beta Testing by AnneMunition`,
          });
        },
      },
    ],
  },
]);

Menu.setApplicationMenu(titleMenu); // Set title menu

// Set options from config
titleMenu.items[1].submenu.items[0].checked = config.get('app.close_to_tray');
titleMenu.items[1].submenu.items[1].checked = config.get('app.auto_start');
titleMenu.items[1].submenu.items[2].checked = config.get('app.start_minimized');
titleMenu.items[1].submenu.items[3].submenu.items[0].checked = config.get('app.clr.enabled');
titleMenu.items[1].submenu.items[3].submenu.items[1].enabled = config.get('app.clr.enabled');
titleMenu.items[1].submenu.items[3].submenu.items[2].enabled = config.get('app.clr.enabled');

function clrNoty() {
  const blanket = $('.blanket');
  $(blanket).fadeIn(200); // Darken the body
  const address = `http://localhost:${config.get('app.clr.port') || 3000}`;
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
