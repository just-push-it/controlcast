'use strict';
/* eslint no-inline-comments: 0 */
/* eslint no-unused-vars: 0 */
/* eslint no-undef: 0 */
/* eslint no-console: 0 */

function readyOptions() {
  // When hovering in the options window
  $('.options').mouseenter((event) => { // Adds a border around the key to show which is being edited
    const key = getGuiKey(lastKey);
    $(key).addClass('editing'); // Show the last key
    $(`.center.c${lastKey.join('-')}`).addClass('editing'); // Show center key border if center key
    $(event.currentTarget).mouseleave(() => {
      $(key).removeClass('editing'); // Don't show the last key
      $('.center').removeClass('editing'); // Remove border from all center keys
    });
  });

  $('.expandable').click((event) => { // Click to expand/hide option groups
    if (event.target.className === 'clear_opt') return; // Don't expand if the 'Clear' button is what was clicked
    const content = $(event.currentTarget).next(); // Target the content div
    if (content.hasClass('expanded')) {
      content.removeClass('expanded').slideUp(500); // Hide if this was already expanded
    } else {
      $('.expanded').removeClass('expanded').slideUp(500); // Hide all expanded divs
      content.addClass('expanded').slideDown(500); // Expand the div we want
    }
  });

  $('.color_select div').click((event) => {
    const parent = $(event.currentTarget).parent(); // Target the wrapper div for all the colors
    const color = $(event.currentTarget).data('color'); // Get the color we clicked on
    // Determine which action group we are dealing with
    const parentClass = parent.hasClass('active') ? 'active' : 'inactive';
    parent.children().removeClass('selected'); // Remove the selected class from everything
    parent.data('color', color); // Set out parent class' data-color to the color we clicked on
    $(event.currentTarget).addClass('selected'); // Add the selected class to the color we clicked on
    if (color === 'OFF') { // Handle the 'X' image in the OFF color div
      $(`.color_select.${parentClass} div img`).addClass('selected');
    } else {
      $(`.color_select.${parentClass} div img`).removeClass('selected');
    }
    // Set the color name to our new gui friendly name
    $(`.color_select.${parentClass} span`).text(toTitleCase(color.split('_')));
    const keyConfig = getKeyConfig(lastKey); // Get the key config or defaults
    const action = parentClass === 'active' ? 'press' : 'release'; // Set action
    keyConfig.color[action] = $(`#${parentClass}_key_color`).data('color'); // Update the changed color
    tempKeys[lastKey.join(',')] = keyConfig; // Save to temp config
    colorKey(lastKey, 'release', keyConfig);
    checkmarks(); // Update gui checkmarks
  });

  // Discard button clicked
  $('#discard_settings').click(() => {
    tempKeys = {}; // Clear all temp settings
    setKeyOptions(); // Reset current key config to options
    setAllLights(); // Set all gui and midi lights to released state
    loadTracks(); // Load audio tracks into memory to be played immediately on demand
  });

  // Save button clicked
  $('#save_settings').click(() => {
    const keys = config.get('keys'); // Get current key settings
    for (const key in tempKeys) { // Loop through all temp keys
      if (tempKeys.hasOwnProperty(key)) {
        keys[key] = tempKeys[key]; // Overwrite with new key
      }
    }
    config.set('keys', removeDefaultKeys(keys)); // Save changed keys to file
    tempKeys = {}; // Clear all temp keys
    centerNOTY('success', 'Save Successful!');
  });

  $('#kill_audio').click(() => { // Stop All Audio button was pressed
    for (const track in tracks) { // Loop through all tracks in the tracks object
      if (tracks.hasOwnProperty(track)) {
        stopAudio(tracks[track]); // Stop the track
      }
    }
  });

  const volumeSlider = $('#volume_slider');
  volumeSlider.slider({ // Volume slider options
    min: 0,
    max: 100,
    range: 'min',
    animate: true,
    slide: (event, ui) => {
      // Reset track volume if track exists
      if (tracks[lastKey.join(',')]) tracks[lastKey.join(',')].volume = ui.value / 100;
      $('#vol_val').text(`${ui.value}%`); // Set volume label
    },
  });

  volumeSlider.mousedown(() => {
    volumeSlider.mouseleave(() => {
      const keyConfig = getKeyConfig(lastKey); // Get the key config or defaults
      keyConfig.audio.volume = $('#vol_val').text().replace('%', '');
      tempKeys[lastKey.join(',')] = keyConfig; // Save to temp config
    });
  });


  // Hotkey Logic


  $('#hotkey_string').focus((event) => { // Text box field to create hotkey was focused
    const combo = { // Create combo object to store what keys we want
      ctrl: null,
      shift: null,
      alt: null,
      key: null,
    };
    $(event.currentTarget).keydown((keydownEvent) => { // Key pressed while focused
      keydownEvent.preventDefault(); // Cancel any normal inputs from being entered
      const keyName = keycode(keydownEvent).toUpperCase(); // Get text keyName
      const ignoredKeys = [
        'CAPS LOCK',
        'NUM LOCK',
        'SCROLL LOCK',
        'PAUSE/BREAK',
        'MY CALCULATOR',
      ];
      if (ignoredKeys.indexOf(keyName) !== -1) return;
      const originalKey = keydownEvent.originalEvent.code.toUpperCase();
      if (originalKey.includes('CONTROL')) {
        combo.ctrl = originalKey.includes('LEFT') ? 'L-CTRL' : 'R-CTRL';
      } else if (originalKey.includes('SHIFT')) {
        combo.shift = originalKey.includes('LEFT') ? 'L-SHIFT' : 'R-SHIFT';
      } else if (originalKey.includes('ALT')) {
        combo.alt = originalKey.includes('LEFT') ? 'L-ALT' : 'R-ALT';
      } else {
        combo.key = keyName;
      }

      const display = []; // Create an empty array to be filled with combo keys
      // Only add the keys to the display array if they exist
      if (combo.ctrl) display.push(combo.ctrl);
      if (combo.shift) display.push(combo.shift);
      if (combo.alt) display.push(combo.alt);
      if (combo.key) display.push(combo.key);
      // Stringify the combo key options array and display it in the text field
      $(keydownEvent.currentTarget).val(display.join(' + '));
      const keyConfig = getKeyConfig(lastKey);
      keyConfig.hotkey.string = $(keydownEvent.currentTarget).val();
      tempKeys[lastKey.join(',')] = keyConfig; // Save to config
      setIcons(lastKey, keyConfig);
      checkmarks();
    }).alphanum({
      allow: '+`-[]\\;\',./!*',
      allowOtherCharSets: false,
    });
    $(event.currentTarget).keyup((keyupEvent) => { // Key released while focused
      const keyName = keycode(keyupEvent).toUpperCase(); // Get text keyName
      const originalKey = keyupEvent.originalEvent.code.toUpperCase();
      if (originalKey.includes('CONTROL')) {
        combo.ctrl = null;
      } else if (originalKey.includes('SHIFT')) {
        combo.shift = null;
      } else if (originalKey.includes('ALT')) {
        combo.alt = null;
      } else if (combo.key === keyName) {
        combo.key = null;
      }
    });
  });


  // Path Input Fields


  $('#audio_path').change((event) => { // Audio path was changed
    if ($(event.currentTarget).val() === '') return; // Return if blank
    const audioPath = path.parse($(event.currentTarget).val()); // Parse path
    const ext = audioPath.ext.toLowerCase(); // Get file extension
    if (ext !== '.mp3' && ext !== '.wav' && ext !== '.oog') { // Must be these formats to be playable
      centerNOTY('notify', 'Only able to play [ .mp3 | .wav | .ogg ] files.', 4000);
      return;
    }
    if (isURL($(event.currentTarget).val())) {
      request.get({
        url: $(event.currentTarget).val(),
      }, (err, res) => { // Try to access the web file and warn if unable
        if (err || res.statusCode !== 200) {
          centerNOTY('warning', 'Unable to access that audio file.', 3000);
          console.log(JSON.stringify(err));
        }
      });
    } else {
      fs.access($(event.currentTarget).val(), fs.R_OK, (err) => { // Try to access the web file and warn if unable
        if (err) {
          centerNOTY('warning', 'Unable to access that audio file.', 3000);
          console.log(JSON.stringify(err));
        }
      });
    }
  });

  $('#clr_path').change((event) => { // CLR path was changed
    if ($(event.currentTarget).val() === '') return; // Return if blank
    const clrPath = path.parse($(event.currentTarget).val()); // Parse path
    const ext = clrPath.ext.toLowerCase(); // Get file extension
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.gif') { // Must be these formats
      centerNOTY('notify', 'Only able to show [ .png | .jpg | .gif ] files.', 4000);
      return;
    }
    const filePath = path.join(__dirname, `clr/assets/images/${lastKey.join(',')}${ext}`);
    if (isURL($(event.currentTarget).val())) {
      // Try to access the web file and warn if unable
      request.get({
        url: $(event.currentTarget).val(),
        encoding: null,
      }, (requestErr, res, buffer) => {
        if (requestErr || res.statusCode !== 200) {
          centerNOTY('warning', 'Unable to access that image file.', 3000);
          console.log(JSON.stringify(requestErr));
        } else {
          fs.writeFile(filePath, buffer, (writeFileErr) => {
            if (writeFileErr) {
              centerNOTY('warning', 'Error saving file for CLR.', 3000);
              console.log(JSON.stringify(writeFileErr));
            } else {
              sendImageChange(filePath, ext);
            }
          });
        }
      });
    } else {
      fs.access($(event.currentTarget).val(), fs.R_OK, (accessErr) => { // Try to access the web file and warn if unable
        if (accessErr) {
          centerNOTY('warning', 'Unable to access that image file.', 3000);
          console.log(JSON.stringify(accessErr));
        } else {
          fs.readFile($(event.currentTarget).val(), (readFileErr, data) => {
            if (readFileErr) {
              centerNOTY('warning', 'Error reading file for CLR.', 3000);
              console.log(JSON.stringify(err));
            } else {
              fs.writeFile(filePath, data, (writeFileErr) => {
                if (writeFileErr) {
                  centerNOTY('warning', 'Error saving file for CLR.', 3000);
                  console.log(JSON.stringify(writeFileErr));
                } else {
                  sendImageChange(filePath, ext);
                }
              });
            }
          });
        }
      });
    }
  });

  $('#browse').click(() => { // Browse for audio file button was pressed
    dialog.showOpenDialog({ // Open dialog to choose a file
      title: 'Choose Audio File',
      filters: [
        { name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] }, // Restrict allowed files to these formats
      ],
      properties: ['openFile'], // Only allow 1 file to be chosen
    }, (file) => {
      $('#audio_path').val(file).trigger('change'); // When we get the file name that was chosen, input it into the form
    });
  });

  $('#clr_browse').click(() => { // Browse for clr image file button was pressed
    dialog.showOpenDialog({ // Open dialog to choose a file
      title: 'Choose Image File',
      filters: [
        { name: 'Image', extensions: ['png', 'jpg', 'gif'] }, // Restrict allowed files to these formats
      ],
      properties: ['openFile'], // Only allow 1 file to be chosen
    }, (file) => {
      $('#clr_path').val(file).trigger('change'); // When we get the file name that was chosen, input it into the form
    });
  });


  // Make sure a web address is given here
  $('.api_request input').blur((event) => {
    const str = $(event.currentTarget).val();
    if (str === '') return;
    if (!isURL(str)) { // eslint-disable-line
      centerNOTY('notify', 'That is not a known web address format.', 4000);
    }
  });

  // Options Changed

  $('.opt').on('input change', (event) => { // A savable option was changed, update the key config
    const keyConfig = getKeyConfig(lastKey);
    setProp(keyConfig, $(event.currentTarget).data('config'), $(event.currentTarget).val());
    tempKeys[lastKey.join(',')] = keyConfig;
    setIcons(lastKey, keyConfig);
    checkmarks();
  });


  // CSS syntax highlighter


  css_editor = ace.edit('clr_css');
  css_editor.setTheme('ace/theme/tomorrow_night_eighties');
  css_editor.getSession().setMode('ace/mode/css');
  css_editor.getSession().setTabSize(2);
  css_editor.$blockScrolling = Infinity;

  css_editor.on('focus', () => {
    css_editor.getSession().on('change', () => {
      const keyConfig = getKeyConfig();
      keyConfig.clr.css = css_editor.getSession().getValue();
      tempKeys[lastKey.join(',')] = keyConfig;
    });
  });

  $('#reset_clr_css').click(() => {
    css_editor.setValue(getDefaultKeyConfig().clr.css);
    css_editor.clearSelection();
  });

  $('.ace_text-input').on('blur', () => {
    const e = $('.ace_error').length;
    if (e) centerNOTY('warning', 'There is an error in the custom CSS', 3000);
  });

  $('.num_input').numeric({
    allowMinus: false,
    allowThouSep: false,
    allowDecSep: true,
    maxDecimalPlaces: 3,
    maxPreDecimalPlaces: 3,
  });


  // Clear Buttons


  $('#clear_all').click(() => { // Reset key button was pressed
    tempKeys[lastKey.join(',')] = defaultKeyConfig();
    const keyConfig = getKeyConfig(lastKey);
    colorKey(lastKey, 'release', keyConfig);
    setKeyOptions(); // Update all key settings to show default
  });

  $('.color .clear_opt').click(() => {
    const keyConfig = getKeyConfig(lastKey);
    keyConfig.color = defaultKeyConfig().color;
    tempKeys[lastKey.join(',')] = keyConfig;
    colorKey(lastKey, 'release', keyConfig);
    setKeyOptions(); // Update key settings
  });

  $('.hotkey .clear_opt').click(() => {
    const keyConfig = getKeyConfig(lastKey);
    keyConfig.hotkey = defaultKeyConfig().hotkey;
    tempKeys[lastKey.join(',')] = keyConfig;
    colorKey(lastKey, 'release', keyConfig);
    setKeyOptions(); // Update key settings
  });

  $('.audio .clear_opt').click(() => {
    const keyConfig = getKeyConfig(lastKey);
    keyConfig.audio = defaultKeyConfig().audio;
    tempKeys[lastKey.join(',')] = keyConfig;
    colorKey(lastKey, 'release', keyConfig);
    setKeyOptions(); // Update key settings
  });

  $('.api_request .clear_opt').click(() => {
    const keyConfig = getKeyConfig(lastKey);
    keyConfig.api = defaultKeyConfig().api;
    tempKeys[lastKey.join(',')] = keyConfig;
    colorKey(lastKey, 'release', keyConfig);
    setKeyOptions(); // Update key settings
  });

  $('.clr_options .clear_opt').click(() => {
    const keyConfig = getKeyConfig(lastKey);
    keyConfig.clr = defaultKeyConfig().clr;
    tempKeys[lastKey.join(',')] = keyConfig;
    colorKey(lastKey, 'release', keyConfig);
    setKeyOptions(); // Update key settings
  });


  // General


  $('#flush_clr').click(() => clrIO.emit('flush'));
  setKeyOptions(); // Set 0,0 key config on load
}

function setIcons(key, keyConfig) {
  const usingHotkey = keyConfig.hotkey.string; // Gets bool if we are using hotkey
  const usingAudio = keyConfig.audio.path; // Gets bool if we are using audio
  const usingAPI = keyConfig.api.path; // Gets bool if we are using api
  let usingCLR = null;
  if (config.get('app.clr.enabled')) { // Gets bool if we are using clr
    usingCLR = keyConfig.clr.path;
  }
  let j = 0;
  if (usingHotkey) j++;
  if (usingAudio) j++;
  if (usingAPI) j++;
  if (usingCLR) j++;
  const hotkeyImg = usingHotkey ? '<img src=\'images/hotkey.png\'>' : '';
  const audioImg = usingAudio ? '<img src=\'images/audio.png\'>' : '';
  const clrImg = usingCLR ? '<img src=\'images/clr.png\'>' : '';
  const apiImg = usingAPI ? '<img src=\'images/cloud.png\'>' : '';
  const guiKey = getGuiKey(key);
  // Sets the inner key div to show associated icons to events
  guiKey.html(`<div><span>${hotkeyImg}${audioImg}${clrImg}${apiImg}</span></div>`);
  if (j > 2) {
    $(guiKey).find('div').addClass('shift_up');
  } else {
    $(guiKey).find('div').removeClass('shift_up');
  }
}

// Update all the key gui elements
function setKeyOptions() {
  const keyConfig = getKeyConfig(lastKey);
  const colorSelectInactive = $('.color_select.inactive div img');
  const colorSelectActive = $('.color_select.active div img');
  $('#key_description').val(keyConfig.description); // Set key description
  $('.color_select div').removeClass('selected');  // Colors
  $('.color_select div img').removeClass('selected');
  $(`.color_select.inactive div[data-color=${keyConfig.color.release}]`).addClass('selected');
  $(`.color_select.active div[data-color=${keyConfig.color.press}]`).addClass('selected');
  if (keyConfig.color.release === 'OFF') $(colorSelectInactive).addClass('selected');
  if (keyConfig.color.press === 'OFF') $(colorSelectActive).addClass('selected');
  $(colorSelectInactive).text(toTitleCase(keyConfig.color.release));
  $(colorSelectActive).text(toTitleCase(keyConfig.color.press));
  $('#inactive_key_color').data('color', keyConfig.color.release);
  $('#active_key_color').data('color', keyConfig.color.press);
  $('#hotkey_string').val(keyConfig.hotkey.string); // Hotkey
  $(`input[name="hotkey_type"][value=${keyConfig.hotkey.type}]`).prop('checked', true);
  $('#audio_path').val(keyConfig.audio.path); // Audio
  $('#volume_slider').slider('value', parseInt(keyConfig.audio.volume));
  $('#vol_val').text(`${keyConfig.audio.volume}%`);
  $(`input[name="audio_type"][value=${keyConfig.audio.type}]`).prop('checked', true);
  $('#api_path').val(keyConfig.api.path); // API
  $('#clr_path').val(keyConfig.clr.path); // CLR
  $('#clr_pos').val(keyConfig.clr.pos);
  $('#animate-open').val(keyConfig.clr.animate.open.type);
  $('#animate-close').val(keyConfig.clr.animate.close.type);
  $('.open .delay').val(keyConfig.clr.animate.open.delay);
  $('.open .duration').val(keyConfig.clr.animate.open.duration);
  $('.close .delay').val(keyConfig.clr.animate.close.delay);
  $('.close .duration').val(keyConfig.clr.animate.close.duration);
  css_editor.setValue(keyConfig.clr.css);
  css_editor.clearSelection();
  checkmarks();
  setIcons(lastKey, keyConfig);
}

function checkmarks() {
  const keyConfig = getKeyConfig(lastKey);
  if (!keyConfig) {
    $('.color .check_mark').hide();
    $('.hotkey .check_mark').hide();
    $('.audio .check_mark').hide();
    $('.api_request .check_mark').hide();
    $('.clr_options .check_mark').hide();
    return;
  }
  if (keyConfig.color.press !== 'OFF' || keyConfig.color.release !== 'OFF') {
    $('.color .check_mark').show();
  } else {
    $('.color .check_mark').hide();
  }
  if (keyConfig.hotkey.string !== '') {
    $('.hotkey .check_mark').show();
  } else {
    $('.hotkey .check_mark').hide();
  }
  if (keyConfig.audio.path !== '') {
    $('.audio .check_mark').show();
  } else {
    $('.audio .check_mark').hide();
  }
  if (keyConfig.api.path !== '') {
    $('.api_request .check_mark').show();
  } else {
    $('.api_request .check_mark').hide();
  }
  if (keyConfig.clr.path !== '') {
    $('.clr_options .check_mark').show();
  } else {
    $('.clr_options .check_mark').hide();
  }
}

function removeDefaultKeys(keys) { // This is to try and keep the config.json file as small as possible
  const defaultConfig = defaultKeyConfig();
  for (const key in keys) {
    if (keys.hasOwnProperty(key)) {
      if (_.isEqual(keys[key], defaultConfig)) delete keys[key];
    }
  }
  return keys;
}

function sendImageChange(filePath, ext) {
  fs.stat(path.join(filePath), (err, stats) => {
    if (!err) {
      const m = Date.parse(stats.mtime.toString()) / 1000;
      const k = lastKey.join(',');
      clrIO.emit('image_change', { key: k, src: `images/${k}${ext}?m=${m}` });
    } else {
      console.log(JSON.stringify(err));
    }
  });
}

function isURL(str) {
  return /^(https?:\/\/)?(([\da-z\.-]+)\.([a-z\.]{2,6})|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(\:[0-9]*)?([\/\w \.-]*)*\/?(\?(.*))?$/ // eslint-disable-line
    .test(str);
}

function toTitleCase(str) {
  if (Array.isArray(str)) str = str.join(' ');
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function setProp(obj, str, val) {
  str = str.split('.');
  while (str.length > 1) {
    obj = obj[str.shift()];
  }
  obj[str.shift()] = val;
}

// Display notification on center of window that auto disappears and darkens the main content
function centerNOTY(type, text, timeout) {
  const blanket = $('.blanket');
  blanket.fadeIn(200); // Darken the body
  noty({ // Show NOTY
    layout: 'center',
    type: type,
    text: text,
    animation: {
      open: 'animated flipInX', // Animate.css class names
      close: 'animated flipOutX', // Animate.css class names
    },
    timeout: timeout || 1500,
    callback: {
      onClose: () => blanket.fadeOut(1000), // Restore body
    },
  });
}
