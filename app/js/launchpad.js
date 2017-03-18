'use strict';
/* eslint no-inline-comments: 0 */
/* eslint no-unused-vars: 0 */
/* eslint no-undef: 0 */
/* eslint no-console: 0 */

// All midi and gui key events land here
function keyEvent(source, key, action, edit) {
  // console.log(`${source} key ${action === 'press' ? 'pressed' : 'release'}: ${key}`); // Log the key action
  const keyConfig = getKeyConfig(key);
  if (!edit) { // Only perform these actions if left-click on key - no right-click
    colorKey(key, action, keyConfig); // Color the key based on the action
    playAudio(key, action, keyConfig); // Play Audio if used
    sendAPI(key, action, keyConfig); // Send API event if used
    sendCLR(key, action, keyConfig); // Send CLR event if used
    sendHotkey(key, action, keyConfig); // Send Hotkey if used
  }
  if (action === 'press') {
    $('.options .key_pos_label').text(`(${key.join(',')})`); // Change key label to show last pressed key
    lastKey = key; // Update what the last key pressed was
    setKeyOptions(); // Update the Edit key options fields
  }
}

function readyLaunchpad() { // On DOM ready
  const launchpadGuiKey = $('.launchpad .key');
  launchpadGuiKey.mousedown((event) => { // Launchpad gui key was pressed
    const key = getKeyPosition(event.currentTarget); // Get key position array
    if (event.which === 3) { // Mouse click was a 'right-click'
      keyEvent('gui', key, 'press', 'right-click');
      return;
    }
    keyEvent('gui', key, 'press'); // Forward to key event handler
  });

  launchpadGuiKey.mouseup((event) => { // Launchpad gui key was released
    releasedKey(event.currentTarget);
  });

  launchpadGuiKey.mouseleave((event) => { // Mouse left Launchpad gui key
    // Release if mouse left key while pressed
    if ($(event.currentTarget).hasClass('pressed')) releasedKey(event.currentTarget);
  });
}

// Find the respective gui element with the key position
function getGuiKey(key) {
  if (Array.isArray(key)) key = key.join(',');
  return $(`.launchpad .key[data-pos='${key}']`);
}

function releasedKey(that) { // Gui key was released
  keyEvent('gui', getKeyPosition(that), 'release'); // Forward to key event handler
}

function getKeyPosition(that) {
  const pos = $(that).data('pos').split(','); // Gets key position number
  pos[0] = parseInt(pos[0]);
  pos[1] = parseInt(pos[1]);
  return pos; // Returns key position as an array
}

function setAllLights() { // Sets all key lights to their released state color (background color)
  for (let c = 0; c <= 8; c++) {
    for (let r = 0; r <= 8; r++) {
      if (c === 8 && r === 8) break; // 8,8 does not exist on the pad
      const keyConfig = getKeyConfig([c, r]);
      colorKey([c, r], 'release', keyConfig); // Color the button
      setIcons([c, r], keyConfig);
    }
  }
}

function colorKey(key, action, keyConfig) {
  const guiKey = getGuiKey(key); // Find key in DOM
  guiKey.removeClass(guiKey.data('color')); // Remove old color class
  const keyColor = keyConfig.color[action] || 'OFF'; // Try to get key color
  guiKey.addClass(keyColor); // Add new key color class
  guiKey.data('color', keyColor); // Store color to data attribute
  if (action === 'press') {
    guiKey.addClass('pressed');
    $(`.c${key.join('-')}`).addClass('pressed');
  } else {
    guiKey.removeClass('pressed');
    $(`.c${key.join('-')}`).removeClass('pressed');
  }
  if (launchpad) { // Set midi color if launchpad is connected
    const button = launchpad.getButton(key[0], key[1]); // Get button object
    button.light(color[keyColor]); // Color the key
  }
}

ipc.on('all_dark', () => { // Message to turn off all the midi key lights
  if (launchpad) launchpad.allDark(); // Turn off all lights if launchpad is connected
});

function stopAudio(track) { // Stops the track
  const tmp = track.src; // Stores the current source
  track.src = ''; // Clears the source, this is what actually stops the audio
  track.src = tmp; // Restore the source for next play
}

function playAudio(key, action, keyConfig) { // Handle Audio playback
  const audio = keyConfig.audio; // Get key audio settings if they exist
  if (!audio || !audio.path) return; // Return if no settings or disabled
  const track = tracks[key.join(',')]; // Get loaded track from memory
  const audioPath = path.normalize(audio.path);
  switch (action) {
    case 'press':
      if (!track) { // Track was just created in edit mode
        tracks[key.join(',')] = new Audio(audioPath); // Create and add new track to tracks
        tracks[key.join(',')].play(); // Play Track
        return;
      }
      if (!track.played || track.played.length === 0 || track.ended) {
        // Start the track if it hasn't played before or has finished playing
        track.play();
        return;
      }
      if (!track.ended) { // What do we do if the key is repressed while the track is playing
        switch (audio.type) {
          case 'toggle': // Stops the track
            stopAudio(track);
            break;
          case 'restart': // Restarts the track
            stopAudio(track);
            track.play();
            break;
          default:
          // Do Nothing
        }
        return;
      }
      break;
    case 'release':
      if (!track) return;
      if (track && !track.ended && audio.type === 'hold') {
        stopAudio(track); // Stop audio on release if that is what's set
      }
      break;
    default:
    // Do Nothing
  }
}

function sendHotkey(key, action, keyConfig) {
  const hotkey = keyConfig.hotkey; // Get key audio settings if they exist
  if (!hotkey || !hotkey.string) return; // Return if no settings or disabled
  const keys = hotkey.string.split(' + '); // Split hotkey string into an array
  switch (hotkey.type) {
    case 'send': // Send and release hotkeys
      if (action !== 'press') return;
      kbAction(keys, 'down', () => {
        kbAction(keys, 'up');
      });
      break;
    case 'hold':
      switch (action) {
        case 'press': // Hold hotkeys
          kbAction(keys, 'down');
          break;
        case 'release': // Release Hotkeys
          kbAction(keys, 'up');
          break;
        default:
        // Do Nothing
      }
      break;
    default:
    // Do Nothing
  }
}

function resolveKey(key) { // Match up the different key names from the 2 different libraries we are using
  key = key.toLowerCase();
  if (key.startsWith('numpad')) {
    switch (key.split(' ')[1]) {
      case '/':
        return 'numpad_divide';
      case '*':
        return 'numpad_multiply';
      case '-':
        return 'numpad_minus';
      case '+':
        return 'numpad_plus';
      case '.':
        return 'numpad_decimal';
      default:
        return key.replace(' ', '_');
    }
  }
  switch (key) {
    case 'l-ctrl':
      return 'left_control';
    case 'r-ctrl':
      return 'right_control';
    case 'l-shift':
      return 'left_shift';
    case 'r-shift':
      return 'right_shift';
    case 'l-alt':
      return 'left_alt';
    case 'r-alt':
      return 'right_alt';
    case 'esc':
      return 'escape';
    case 'page up':
      return 'pageup';
    case 'page down':
      return 'pagedown';
    default:
      return key;
  }
}

function kbAction(keys, action, callback) {
  for (let i = 0; i < keys.length; i++) {
    let c = keyboard[keys[i]] || 0;
    switch (action) {
      case 'down':
        c++;
        keyboard[keys[i]] = c;
        if (c > 1) continue;
        break;
      case 'up':
        c--;
        keyboard[keys[i]] = c;
        if (c !== 0) continue;
        break;
      default:
      // Do Nothing
    }
    ipc.send('robot_key', { key: resolveKey(keys[i]), action: action });
  }
  if (callback) return callback();
  return null;
}

function sendCLR(key, action, keyConfig) {
  if (action === 'release') return;
  if (!config.get('app.clr.enabled')) return;
  const clr = keyConfig.clr;
  if (!clr || !clr.path) return;
  clrIO.emit('key_press', { key: key.join(','), options: clr });
}

function sendAPI(key, action, keyConfig) {
  if (action === 'release') return;
  const api = keyConfig.api;
  if (!api || !api.path) return;
  if (!isURL(api.path)) return;
  const oldColor = keyConfig.color.release;
  keyConfig.color.release = 'YELLOW';
  colorKey(key, 'release', keyConfig);
  fetch
    .get(api.path)
    .then(res => {
      if (res.statusCode !== 200) {
        err();
      } else if (res.body.error) {
        err();
      } else {
        ok();
      }
    }, () => {
      err();
    });

  function ok() {
    keyConfig.color.release = 'GREEN';
    colorKey(key, 'release', keyConfig);
    setTimeout(() => {
      keyConfig.color.release = oldColor;
      colorKey(key, 'release', keyConfig);
    }, 1500);
  }

  function err() {
    keyConfig.color.release = 'RED';
    colorKey(key, 'release', keyConfig);
    setTimeout(() => {
      keyConfig.color.release = oldColor;
      colorKey(key, 'release', keyConfig);
    }, 1500);
  }
}
