'use strict';

var colors = require('colors')
  , sugar = require('sugar')
  , table = require('tab');

/**
 * Metrics collection and generation.
 *
 * @constructor
 * @param {Number} requests The total amount of requests scheduled to be send
 */
function Metrics(requests) {
  this.requests = requests;             // The total amount of requests send

  this.connections = 0;                 // Connections established
  this.disconnects = 0;                 // Closed connections
  this.failures = 0;                    // Connections that received an error
  this.messages_sent = 0;
  this.messages_recieved = 0;
  this.rx_sizes = [0];
  this.tx_sizes = [0];

  this.errors = Object.create(null);    // Collection of different errors
  this.timing = Object.create(null);    // Different timings

  this.read = 0;                        // Bytes read
  this.send = 0;                        // Bytes send

  // Start tracking
  this.start();
}

/**
 * The metrics has started collecting.
 *
 * @api public
 */
Metrics.prototype.start = function start() {
  this.timing.start = Date.now();
  return this;
};

/**
 * The metrics has stopped collecting.
 *
 * @api public
 */
Metrics.prototype.stop = function stop() {
  if (this.timing.stop) return this;

  this.timing.stop = Date.now();
  this.timing.duration = this.timing.stop - this.timing.start;
  return this;
};

/**
 * All the connections are established
 *
 * @api public
 */
Metrics.prototype.established = function established() {
  if (this.timing.established) return this;

  this.timing.ready = Date.now();
  this.timing.established = this.timing.ready - this.timing.start;
  return this;
};

/**
 * Log an new error.
 *
 * @param {Object} data The error
 * @api public
 */
Metrics.prototype.error = function error(data) {
  this.failures++;

  var collection = this.errors[data.message];
  if (!collection) this.errors[data.message] = 1;
  else this.errors[data.message]++;

  return this;
};

/**
 * Register a message resposne.
 *
 * @param {Object} data The message details.
 * @api public
 */
Metrics.prototype.message_recieved = function message(data) {
  this.messages_recieved++;
  this.rx_sizes.push(data.read);

  return this;
};

Metrics.prototype.message_sent = function message(data) {
  this.messages_sent++;
  this.tx_sizes.push(data.send);

  return this;
};

/**
 * Register a successful handshake + open.
 *
 * @param {Object} data Handshake details.
 * @api public
 */
Metrics.prototype.handshaken = function handshaken(data) {
  this.connections++;

  return this;
};

/**
 * The connection has closed.
 *
 * @param {Object} data Close information
 * @api public
 */
Metrics.prototype.close = function close(data) {
  this.read += data.read;
  this.send += data.send;

  return this;
};

Metrics.prototype.disconnect = function(data){
  this.disconnects++;

  var collection = this.errors['Disconnect: ' + data.message];
  if (!collection) this.errors['Disconnect: ' + data.message] = 1;
  else this.errors['Disconnect: ' + data.message]++;

  return this;
};

/**
 * Generate a summary of the metrics.
 *
 * @returns {Object} The summary
 * @api public
 */
Metrics.prototype.summary = function summary() {
  var results = new table.TableOutputStream({ columns: [
    { label: '', width: 20 },
    { label: '' }
  ]});

  var datas = new table.TableOutputStream({columns: [
    { label: '', width: 15},
    { label: 'Total Data', width: 15},
    { label: 'Avg. Msg', width: 15},
    { label: 'Max. Msg', width: 15},
    { label: 'Min. Msg', width: 15},
    { label: '# Msgs'},
  ]});

  console.log();
  results.writeRow(['Time ran', (this.timing.duration / 1000).round(3) + ' seconds']);
  results.writeRow(['Connected', this.connections.toString().green]);
  results.writeRow(['Disconnected', this.disconnects.toString().red]);
  results.writeRow(['Errors', this.failures.toString().red]);

  datas.writeRow([
      'TX Stats: ',
      this.send.bytes(2),
      (this.send / this.messages_sent).bytes(2),
      this.tx_sizes.reduce(function(p, c){return Math.max(p,c);}).bytes(2),
      this.tx_sizes.reduce(function(p, c){return Math.min(p,c);}).bytes(2),
      this.messages_sent
  ]);
  datas.writeRow([
      'RX Stats: ',
      this.read.bytes(2),
      (this.read / this.messages_recieved).bytes(2),
      this.rx_sizes.reduce(function(p, c){return Math.max(p,c);}).bytes(2),
      this.rx_sizes.reduce(function(p, c){return Math.min(p,c);}).bytes(2),
      this.messages_recieved
  ]);


  // Output more error information, there could be multiple causes on why we
  // failed to send a message.
  if (this.failures || this.disconnects) {
    console.log();
    console.log('Received errors:');
    console.log();

    Object.keys(this.errors).forEach(function error(err) {
      results.writeRow([this.errors[err] +'x', err]);
    }, this);
  }

  return this;
};

// Expose the metrics constructor.
module.exports = Metrics;
