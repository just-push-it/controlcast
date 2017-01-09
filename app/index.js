'use strict';
/* eslint no-inline-comments: 0 */

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipc = electron.ipcMain;
const autoUpdater = electron.autoUpdater;
const dialog = electron.dialog;
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const spawn = require('child_process').spawn;
const robot = require('robotjs');
const logger = require('./logger')();
const Woopra = require('woopra');
const woopra = new Woopra('ControlCast.tv', {});
const simpleflake = require('simpleflakes');


// Squirrel Auto Update Handlers


const target = path.basename(process.execPath);
function runCommand(args, callback) {
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  logger.debug('Spawning `%s` with args `%s`', updateExe, args);
  spawn(updateExe, args, { detached: true }).on('close', callback);
}

function handleStartupEvent() {
  if (process.platform !== 'win32') {
    return false;
  }
  const squirrelCommand = process.argv[1];
  switch (squirrelCommand) {
    case '--squirrel-install':
    case '--squirrel-updated':
      runCommand([`--createShortcut=${target}`, '--shortcut-locations=Desktop,StartMenu'], () => {
        app.quit();
      });
      return true;
    case '--squirrel-uninstall':
      runCommand([`--removeShortcut=${target}`, '--shortcut-locations=Desktop,StartMenu'], () => {
        app.quit();
      });
      return true;
    case '--squirrel-obsolete':
      app.quit();
      return true;
    default:
      return false;
  }
}

if (handleStartupEvent()) {
  return;
}


// Force Single Instance


const shouldQuit = app.makeSingleInstance(() => {
  // Restore and focus window if instance exists on load
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Application is already running
if (shouldQuit) {
  app.quit();
  return;
}


// Application Init


let mainWindow = null; // Main application window
let errorWindow = null; // Config load error window
let portWindow = null; // Config load error window
let config = null; // Main settings object
let forceQuit = null; // Bool to force quit app from tray

app.setAppUserModelId('com.squirrel.ControlCast.ControlCast');
const configFile = path.join(process.cwd(), '../config.json'); // Set config file path
robot.setKeyboardDelay(50); // Set delay for each keypress for OBS

global.app_version = app.getVersion(); // Store app version for in app displays
global.release_url = require('./package.json').releaseUrl; // Store releaseUrl for update queries

app.on('window-all-closed', () => { // Quit when all windows are closed.
  if (process.platform !== 'darwin') app.quit();
});

app.on('ready', () => { // Application has finished loading
  fs.exists(configFile, exist => { // Check if config files already exists
    if (!exist) { // config.json does not exist
      config = getDefaultConfig(); // Get config defaults
      saveConfig(); // Save config file
      createMainWindow(); // Load Main Window
    } else { // config.json files already exists
      try {
        config = require(configFile); // Store loaded data
      } catch (e) { // There was an error reading the config file
        logger.error('Error loading config.json', e);
        createErrorWindow(); // Load Error Window
        return;
      }
      checkConfigVer(); // Update config version if needed
      createMainWindow(); // Show Main Window
    }
  });
});

function getDefaultConfig() { // Returns the default config object
  return {
    app: {
      version: 2,
      id: simpleflake.simpleflake().toString(),
      pos: {
        x: null,
        y: null,
      },
      close_to_tray: false,
      auto_start: false,
      clr: {
        enabled: false,
        port: 3000,
      },
    },
    keys: {},
  };
}


// Main Application Window


function createMainWindow() { // Loads main application window
  woopra.identify(config.app.id).push();
  mainWindow = new BrowserWindow({ // Main window options
    x: config.app.pos.x,
    y: config.app.pos.y,
    width: 900,
    height: 760,
    resizable: false,
    icon: path.join(__dirname, 'images/icon.ico'),
    title: `ControlCast - ${global.app_version}`,
  });

  mainWindow.on('closed', () => { // Destroy window object on close
    mainWindow = null;
  });

  mainWindow.on('close', (e) => { // App is about to close
    if (config.app.close_to_tray && !forceQuit) { // Minimize on close if Close To Tray and not force quit
      mainWindow.setSkipTaskbar(true); // Hide Taskbar Icon
      mainWindow.minimize(); // Minimize main window
      e.preventDefault(); // Cancel close process
      return;
    }
    sendMessageToMain('all_dark'); // Tell the launchpad to turn off all lights before we close
    const pos = mainWindow.getPosition(); // Save last position of the window for next time the app is run
    config.app.pos.x = pos[0];
    config.app.pos.y = pos[1];
    saveConfig(); // Save config to disk
  });

  mainWindow.setMenu(null); // Disable the default app menu
  mainWindow.loadURL(`file://${path.join(__dirname, '/index.html')}`); // Display the main window html
}


// Config Error Window


function createErrorWindow() { // Error window to tell us if there was an error loading the config.json file on load
  errorWindow = new BrowserWindow({
    width: 420,
    height: 230,
    resizable: false,
    icon: path.join(__dirname, 'images/icon.ico'),
  });

  errorWindow.setMenu(null); // Disable the default menu
  errorWindow.loadURL(`file://${path.join(__dirname, '/error.html')}`); // Display the error window html

  errorWindow.on('closed', () => { // Destroy window object on close
    errorWindow = null;
  });

  ipc.once('reset_config', () => { // The user has decided to reset the config file
    errorWindow.hide(); // Hide the error window
    config = getDefaultConfig(); // Save defaults to config
    const oldPath = path.parse(configFile); // Parse old file path
    const newPath = path.normalize(`${oldPath.dir}/${oldPath.name}.bak-` +
      `${moment().format('YYYYMMDDHHmmss')}${oldPath.ext}`); // Create new filename with appended datetime
    fs.rename(configFile, newPath, (err) => { // Backup the old config.json file
      if (!err) { // Rename OK
        saveConfig(); // Save config file
        createMainWindow(); // Show Main Window
        errorWindow.close(); // Close the error window out after the main window loads
      } else { // There was an error renaming the config.json file. Permissions issue?
        logger.error('config.json rename error', err);
        dialog.showErrorBox('ControlCast Error', 'There seems to be an error accessing the config file.\n' +
          'Please check that permissions are setup correctly for the application directory.\n\n' +
          'Please contact db@dbkynd.com if the issue persists.');
        app.quit(); // Exit the app gracefully
      }
    });
  });
}


// Port Window


function createPortWindow() { // Window to tell us what port the application is running on
  const pos = mainWindow.getPosition(); // Get main window position
  const size = mainWindow.getSize(); // Get main window size
  const x = Math.floor(((size[0] - 320) / 2) + pos[0]); // Determine x pos to center port window
  const y = Math.floor(((size[1] - 180) / 2) + pos[1]); // Determine y pos to center port window

  portWindow = new BrowserWindow({
    x,
    y,
    width: 320,
    height: 180,
    resizable: false,
    icon: path.join(__dirname, 'images/icon.ico'),
  });

  portWindow.setMenu(null); // Disable the default menu
  portWindow.loadURL(`file://${path.join(__dirname, '/port.html')}`); // Display the port window html

  portWindow.on('closed', () => { // Destroy window object on close
    portWindow = null;
  });
}

function saveConfig(callback) { // Save the config to disk
  fs.writeFile(configFile, JSON.stringify(config, null, 2), callback);
}

ipc.on('app_quit', () => { // Quit message
  app.quit(); // Exit the app gracefully
});

function sendMessageToMain(message, data) { // Sends a message to the mainWindow, if available
  if (mainWindow) mainWindow.webContents.send(message, data);
}

ipc.on('get_config', (e) => { // Config changes were discarded
  e.sender.send('config', config); // Send unchanged config object
});

ipc.on('save_config', (e, data) => { // The changed config has been sent back for us to save
  if (!data) return;
  config = data; // Save data to config object
  saveConfig((err) => { // Save to disk and callback
    e.sender.send('save_config_callback', err); // Send back error or null
  });
});

ipc.on('close_to_tray', (e, data) => {
  config.app.close_to_tray = data; // Set close to tray option only
  saveConfig();
});

ipc.on('force_quit', () => {
  forceQuit = true; // Quit selected from tray menu, force close the app
  app.quit();
});

ipc.on('restore_main', () => { // From tray icon
  if (mainWindow) {
    mainWindow.setSkipTaskbar(false); // Show Taskbar Icon
    mainWindow.restore(); // Restore main window
  }
});

ipc.on('toggle_minimize', () => { // From tray icon
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.setSkipTaskbar(false); // Show Taskbar Icon
      mainWindow.restore(); // Restore main window
    } else {
      mainWindow.minimize(); // Minimize main window
    }
  }
});

ipc.on('windows_auto_start', (e, data) => {
  config.app.auto_start = data; // Set option and save
  saveConfig();
  if (data) {
    runCommand([`--createShortcut=${target}`, '--shortcut-locations=Startup'], () => {
      // Do Nothing
    });
  } else {
    runCommand([`--removeShortcut=${target}`, '--shortcut-locations=Startup'], () => {
      // Do Nothing
    });
  }
});

ipc.on('quit_and_install', () => {
  forceQuit = true;
  autoUpdater.quitAndInstall();
});

ipc.on('clr_enabled', (e, data) => {
  config.app.clr.enabled = data; // Set option and save
  saveConfig();
});

ipc.on('change_port', () => {
  createPortWindow();
});

ipc.on('get_port', (e) => {
  e.sender.send('port', config.app.clr.port || 3000);
});

ipc.on('port_quit', () => {
  portWindow.close();
});

ipc.on('set_port', (e, data) => {
  portWindow.close();
  sendMessageToMain('update_port', data);
  config.app.clr.port = data; // Set option and save
  saveConfig();
});

ipc.on('send_key', (e, data) => {
  try {
    robot.keyToggle(data.key, data.action);
  } catch (err) {
    logger.error(`robot error, key: ${data.key}`, err);
  }
});

ipc.on('reset_position', () => {
  if (mainWindow) {
    mainWindow.setSkipTaskbar(false); // Show Taskbar Icon
    mainWindow.restore(); // Restore main window
    mainWindow.setPosition(0, 0); // Move to main screen, 0,0
  }
});

function checkConfigVer() {
  let save = false;
  while (getDefaultConfig().app.version > config.app.version) {
    save = true;
    switch (config.app.version) {
      case 2:
        break;
      default:
      // Do Nothing
    }
  }
  if (save) saveConfig();
}

process.on('unhandledRejection', logger.error);
