'use strict';
/* eslint no-inline-comments: 0 */
/* eslint no-unused-vars: 0 */
/* eslint no-undef: 0 */
/* eslint no-console: 0 */
/* eslint new-cap: 0 */
/* eslint prefer-const: 0 */

const remote = require('electron').remote;
const Menu = remote.Menu;
const MenuItem = remote.MenuItem;
const dialog = remote.dialog;
const Tray = remote.Tray;
const autoUpdater = remote.autoUpdater;
const clipboard = require('electron').clipboard;
const path = require('path');
const ipc = require('electron').ipcRenderer;
const midi = require('midi');
const usbDetect = require('usb-detection');
const launchpadder = require('launchpadder').Launchpad;
const color = require('launchpadder').Color;
const _ = require('underscore');
const noty = require('noty');
const keycode = require('keycode');
const fs = require('fs');
const request = require('request');

window.$ = window.jQuery = require('jquery');
require('./js/jquery/jquery-ui.min.js');
require('./js/jquery/alphanum.min.js');

let config; // Holds all the app and key settings
let launchpad; // Our launchpadder instance
let usbConnected; // Bool for Launchpad USB state
let reconnectTimer; // Reconnection timer
let lastKey = [0, 0]; // Stores the last key pressed
let notyUpdates;
let clrRunning = false;
let css_editor;

const keyboard = [];
const tracks = {}; // Holds all the audio tracks in memory to be played
const images = {};

const app_version = remote.getGlobal('app_version');
const releaseUrl = remote.getGlobal('release_url');

ipc.on('config', (e, data) => { // Sent from main app on DOM ready. Sends the current config
  config = data; // Save config object
  setAllLights(); // Set all gui and midi lights to released state
  setKeyOptions(); // Set all key configs
  loadTracks(); // Load audio tracks into memory to be played immediately on demand
  if (titleMenu) {
    titleMenu.items[1].submenu.items[0].checked = config.app.close_to_tray;
    titleMenu.items[1].submenu.items[1].checked = config.app.auto_start;
    titleMenu.items[1].submenu.items[2].submenu.items[0].checked = config.app.clr.enabled;
  } // Set title menu checkbox
  if (config.app.clr.enabled && !clrRunning) {
    $('.clr_options').show();
    startCLR();
  } else {
    $('#flush_clr').hide();
  }
});

$(document).ready(() => { // On DOM ready
  $('body').fadeIn(200);
  isMidiConnected(); // Set midi_connected on load

  for (let c = 0; c < 8; c++) { // Creates the top row key divs
    const newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'key round OFF');
    newDiv.setAttribute('data-pos', `${c},8`);
    newDiv.setAttribute('data-color', 'OFF');
    $('.launchpad .keys_top').append(newDiv);
  }
  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 8; r++) { // Creates the main key grid divs
      const newDiv = document.createElement('div');
      newDiv.setAttribute('class', 'key square OFF');
      newDiv.setAttribute('data-pos', `${r},${c}`);
      newDiv.setAttribute('data-color', 'OFF');
      $('.launchpad .keys_main').append(newDiv);
    }
  }
  for (let r = 0; r < 8; r++) { // Creates the side key divs
    const newDiv = document.createElement('div');
    newDiv.setAttribute('class', 'key round OFF');
    newDiv.setAttribute('data-pos', `8,${r}`);
    newDiv.setAttribute('data-color', 'OFF');
    $('.launchpad .keys_side').append(newDiv);
  }

  $('#update_available').click(() => {
    ipc.send('quit_and_install');
  });
});

function get(obj, key) { // Search and return a nested element in an object or null
  return key.split('.').reduce((o, x) => (typeof o === 'undefined' || o === null) ? o : o[x], obj);
}

function set(obj, str, val) {
  str = str.split('.');
  while (str.length > 1) {
    obj = obj[str.shift()];
  }
  obj[str.shift()] = val;
}

function connectToLaunchpad() { // Attempt to connect to the Launchpad
  const midiIn = new midi.input(); // Create new Midi input
  const midiOut = new midi.output(); // Create new Midi output
  const midiInCount = midiIn.getPortCount(); // Gets the number of Midi input ports connected
  const midiOutCount = midiOut.getPortCount(); // Gets the number of Midi output ports connected
  if (midiInCount <= 0 || midiOutCount <= 0) {
    console.log('No Midi devices found. Have you plugged in the Launchpad Device yet?');
    return;
  }
  let midiInPort = null;
  let midiOutPort = null;
  for (let i = 0; i < midiInCount; i++) { // Loop through Midi input ports
    if (midiIn.getPortName(i).toLowerCase().includes('launchpad')) {
      midiInPort = i; // Save index of Launchpad input port if found
    }
  }
  for (let i = 0; i < midiOutCount; i++) { // Loop through Midi output ports
    if (midiOut.getPortName(i).toLowerCase().includes('launchpad')) {
      midiOutPort = i; // Save index of Launchpad output port if found
    }
  }
  if (midiInPort === null || midiOutPort === null) {
    console.log('Launchpad Device not found. Is it unplugged?');
    return;
  }

  launchpad = new launchpadder(midiInPort, midiOutPort); // Connect to launchpad
  if (launchpad) {
    console.log(`'${midiIn.getPortName(midiInPort)}' connection successful`);
    isMidiConnected(); // Set midi_connected

    launchpad.on('press', button => { // Create the midi button press handler
      keyEvent('midi', [button.x, button.y], 'press'); // Pass to key event handler
    });

    launchpad.on('release', button => { // Create midi button release handler
      keyEvent('midi', [button.x, button.y], 'release'); // Pass to key event handler
    });
  } else {
    console.log('Unable to connect to the Launchpad Device');
  }
}

usbDetect.on('add', device => {
  if (device.deviceName.toLowerCase().includes('launchpad')) { // Launchpad USB was inserted
    console.log(`'${device.deviceName}' USB detected. Connecting in 4 seconds`);
    if (!usbConnected) { // This stops the random occurrence of the add event firing twice rapidly
      usbConnected = true;
      reconnectTimer = setTimeout(() => {
        connectToLaunchpad();
        setAllLights();
      }, 4000); // Wait 4 seconds for the Launchpad init to finish before attempting to connect.
    }
  }
});

usbDetect.on('remove', device => {
  if (device.deviceName.toLowerCase().includes('launchpad')) { // Launchpad USB was removed
    console.log(`'${device.deviceName}' USB disconnected`);
    if (reconnectTimer) clearTimeout(reconnectTimer); // Stop reconnect timer if it was started
    usbConnected = false;
    launchpad = null;
    isMidiConnected(); // Set midi_connected
  }
});

connectToLaunchpad(); // Connect on startup

function isMidiConnected() {
  if (launchpad) { // Set the midi_connected color based on if launchpad is connected
    $('.midi_connected').addClass('connected');
  } else {
    $('.midi_connected').removeClass('connected');
  }
}

function loadTracks() { // Load track data to array
  for (const key in config.keys) { // Loop through keys
    if (config.keys.hasOwnProperty(key)) {
      const audio = config.keys[key].audio; // Get key audio settings
      if (audio && audio.path) {
        const audioPath = path.normalize(audio.path);
        if (!tracks[key] || tracks[key].src !== audioPath) {
          tracks[key] = new Audio(audioPath);
        }
        tracks[key].volume = audio.volume / 100;
      }
    }
  }
}

autoUpdater.setFeedURL(releaseUrl);
setInterval(() => {
  checkForUpdates();
}, 1000 * 60 * 15);

function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

autoUpdater.on('error', (err) => {
  console.log('Squirrel error', err);
});

autoUpdater.on('checking-for-update', () => {
  console.log('Squirrel: checking-for-update');
});

autoUpdater.on('update-available', () => {
  console.log('Squirrel: update-available');
  if (notyUpdates) {
    notyUpdates = false;
    centerNOTY('notification', 'Updates available, Downloading...', 3000);
  }
});

autoUpdater.on('update-not-available', () => {
  console.log('Squirrel: update-not-available');
  if (notyUpdates) {
    notyUpdates = false;
    centerNOTY('notification', 'There are no updates available.');
  }
});

autoUpdater.on('update-downloaded', () => {
  console.log('Squirrel: update-downloaded');
  $('#update_available').show();
});
