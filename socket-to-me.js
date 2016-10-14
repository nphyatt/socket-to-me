'use strict';

var Socket = require('ws'),
    connections = {};

// Get the function that is used to generate the data.
var generator = require(process.argv[2]);

function byteReadDelta(socket){
  var delta = socket._socket.bytesRead - socket.lastBytesRead;
  socket.lastBytesRead = socket._socket.bytesRead;
  return delta;
}

function byteWrittenDelta(socket){
  var delta = socket._socket.bytesWritten - socket.lastBytesWritten;
  socket.lastBytesWritten = socket._socket.bytesWritten;
  return delta;
}

process.on('message', function message(task) {

  // Shut down every single socket.
  if (task.shutdown) {
    Object.keys(connections).forEach(function shutdown(id) {
      connections[id].close();
      connections[id].stop = true;
    });
  }

  // End of the line, we are gonna start generating new connections.
  if (!task.url) return;

  var socket = new Socket(task.url, task.wsoptions);
  socket.lastBytesWritten = 0;
  socket.lastBytesRead = 0;
  socket.generateMsg = generator.generateMsg();
  var initTime = Date.now();

  socket.on('open', function open() {
    process.send({ type: 'open', duration: Date.now() - initTime, id: task.id });
    write(socket, task, task.id);
  });

  socket.on('message', function message(data) {
    process.send({
      type: 'message',
      read: byteReadDelta(socket),
      id: task.id
    });
  });

  socket.on('close', function close(code, msg) {
    var internal = socket._socket || {};
    if (code !== 1000) {
      process.send({
        type: 'disconnect',
        message: msg,
        id: task.id
      });
    }
    process.send({
      type: 'close', id: task.id,
      read: internal.bytesRead || 0,
      send: internal.bytesWritten || 0
    });
  });

  socket.on('error', function error(err) {
    process.send({ type: 'error', message: err.message, id: task.id });
    socket.close();
    delete connections[task.id];
  });

  // Adding a new socket to our socket collection.
  connections[task.id] = socket;
});

function getSize(task){
  var maxPayload = Math.max(task.payload[0], task.payload[1]);
  var minPayload = Math.min(task.payload[0], task.payload[1]);
  if(task.buffer){
    return task.buffer;
  } else {
    return Math.round(Math.random() * (maxPayload - minPayload) + minPayload);
  }
}

function getFrequency(task){
  var maxDuration = Math.max(task.frequency[0], task.frequency[1]);
  var minDuration = Math.min(task.frequency[0], task.frequency[1]);
  return Math.round(Math.random() * (maxDuration - minDuration) + minDuration);
}

/**
 * Helper function from writing messages to the socket.
 *
 * @param {WebSocket} socket WebSocket connection we should write to
 * @param {Object} task The given task
 * @param {String} id
 * @api private
 */
function write(socket, task, id) {

  var sz = getSize(task);
  socket.generateMsg(sz, function message(err, data) {
    if (socket.readyState !== socket.OPEN) {
      return;
    }
    socket.send(data, function(err){
      if (err) {
        process.send({ type: 'error', message: err.message });
        socket.close();
        delete connections[id];
      }else {
        process.send({ type: 'sent', send: byteWrittenDelta(socket)});
      }
    });
  });
  if(!socket.stop && !(socket.readyState === socket.CLOSED)){
    setTimeout(function(){
      write(socket, task, id);
    }, getFrequency(task));
  }
}
