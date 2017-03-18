'use strict';
/* eslint no-inline-comments: 0 */
/* eslint no-unused-vars: 0 */
/* eslint no-undef: 0 */
/* eslint no-console: 0 */

const express = require('express');
const app = express();
const io = require('socket.io');

let server;
let clrIO;

function startCLR() {
  console.log('Starting CLR Browser');
  fs.exists(path.join(__dirname, 'clr/assets/images'), (exists) => {
    if (!exists) {
      fs.mkdir(path.join(__dirname, 'clr/assets/images'), (err) => {
        if (err) console.error('Error making images directory for the clr browser', err);
      });
    }
  });

  app.use(express.static(path.join(__dirname, 'clr/assets')));
  app.set('port', config.get('app.clr.port') || 3000);

  server = app.listen(app.get('port'), () => {
    console.log(`Listening on *:${app.get('port')}`);
    clrRunning = true;
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'clr/index.html'));
  });

  clrIO = io.listen(server, {});
  clrIO.on('connection', (socket) => { // Client Connect
    if (!config.get('app.clr.enabled')) return;
    let num = 0;
    const keys = config.get('keys');
    const count = Object.keys(keys).length;
    images = {};
    for (const key in keys) { // Loop through keys
      if (keys.hasOwnProperty(key)) {
        const p = keys[key].clr.path;
        if (!p) {
          num++;
        } else {
          const ext = path.parse(p).ext.toLowerCase();
          fs.stat(path.join(__dirname, `clr/assets/images/${key}${ext}`), (err, stats) => {
            if (!err) {
              const m = Date.parse(stats.mtime.toString()) / 1000;
              images[key] = { src: `images/${key}${ext}?m=${m}` };
            } else {
              console.log(JSON.stringify(err));
            }
            if (num++ >= count - 1) {
              socket.emit('images', images);
            }
          });
        }
      }
    }
  });
}

function stopCLR(callback) {
  console.log('Stopping CLR Browser');
  clrIO.close();
  clrIO = null;
  server.close(() => {
    console.log('CLR Browser stopped');
    clrRunning = false;
    if (callback) return callback();
    return null;
  });
}

ipc.on('port_changed', () => {
  stopCLR(() => {
    startCLR();
    clrNoty();
  });
});
