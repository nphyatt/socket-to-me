#!/usr/bin/env node
'use strict';

require('colors');
var Metrics = require('../metrics')
  , async = require('async')
  , path = require('path')
  , os = require('os')
  , librato = require('../librato');

function range(val){
    return val.split(',').map(Number);
}

function parseProtocol(val){
    return {protocol: val, perMessageDeflate: false};
}

// Setup the Command-Line Interface.
var cli = require('commander');

cli.usage('[options] ws://localhost')
   .option('-D, --duration <duration>', 'duration in seconds to send messages for', parseInt, 30)
   .option('-p, --payloads <payloads>', 'comma separated max and min payloads in bytes', range, [1, 1024])
   .option('-F, --frequency <frequency>', 'comma separated max and min frequency between messages in ms', range, [100, 1000])
   .option('-I, --interval <interval>', 'the interval over which to bring connections up', parseInt, 0)
   .option('-A, --amount <connections>', 'the amount of persistent connections to generate', parseInt, 10000)
   .option('-C, --concurrent <connections>', 'how many connections to bring up at a time per url over the interval', parseInt, Infinity)
   .option('-B, --buffer <size>', 'size of the messages that are send', parseInt, null)
   .option('-W, --workers <cpus>', 'workers to be spawned', parseInt, os.cpus().length)
   .option('-G, --generator <file>', 'custom message generators')
   .option('-U, --user <librato-user>', 'email for librato account')
   .option('-T, --token <librato-token>', 'token for librato account')
   .option('-L, --nolive <no-live>', 'no live output')
   .option('-P, --protocol <protocol>', 'name of websocket protocol', parseProtocol, {perMessageDeflate: false})
   .version(require('../package.json').version)
   .parse(process.argv);

librato.init(cli.user, cli.token);

// Check if all required arguments are supplied, if we don't have a valid url we
// should bail out
if (!cli.args.length) {
    ['Hey Dummy,',
     'You forgot to include urls...how the $#&! am I supposed to know where to unload all these messages.'
    ].forEach(function stderr(line) {
      console.error(line);
    });
    process.exit(-1);
}

// Let's make shit happen.
var cluster = require('cluster')
  , workers = cli.workers || 1
  , ids = Object.create(null)
  , concurrents = Object.create(null)
  , connections = 0
  , received = 0
  , robin = [];

cluster.setupMaster({
    exec: path.resolve(__dirname, '../socket-to-me.js')
  , silent: false
  , args: [
      cli.generator
      ? path.resolve(process.cwd(), cli.generator)
      : path.resolve(__dirname, '../generator.js')
    ]
});

while (workers--) cluster.fork();

function fmtMsg(message){
    if(!message || message === ''){
        return '.unknown';
    }else{
        return '.' + message.replace(/[^\w\s]+/g,'').replace(/[\s]+/g, '_').toLowerCase();
    }
}
Object.keys(cluster.workers).forEach(function each(id) {
  var worker = cluster.workers[id];

  worker.on('message', function message(data) {

    switch (data.type) {
      case 'open':
        metrics.handshaken(data);
        librato.increment('socket_open', 1);
        worker.emit('open::'+ data.id);
        if(concurrents[data.id]){
            concurrents[data.id]++;
        }else{
            concurrents[data.id] = 1;
        }

        // Output the connection progress
        ++connections;
        break;

      case 'close':
        concurrents[data.id]--;
        ids[data.id]--;
        if(!ids[data.id]){
            delete ids[data.id];
        }
        metrics.close(data);
        librato.increment('socket_closed', 1);
        break;

      case 'disconnect':
        metrics.disconnect(data);
        librato.increment('socket_disconnect' + fmtMsg(data.message), 1);
        break;

      case 'error':
        metrics.error(data);
        librato.increment('socket_error' + fmtMsg(data.message), 1);
        break;

      case 'sent':
        librato.increment('message_sent', 1);
        librato.measure('tx_size', data.send);
        metrics.message_sent(data);
        break;

      case 'message':
        received++;
        librato.increment('message_recieved', 1);
        librato.measure('rx_size', data.read);
        metrics.message_recieved(data);
    }

    // Check if we have processed all connections so we can quit cleanly.
    if (!Object.keys(ids).length) process.exit();
  });

  // Add our worker to our round robin queue so we can balance all our requests
  // across the different workers that we spawned.
  robin.push(worker);
});

// Output live, real-time stats.
function live() {
  var frames = live.frames
    , len = frames.length
    , interval = 100
    , i = 0;

  live.interval = setInterval(function tick() {
    var active = Object.keys(concurrents).reduce(function (count, id) {
      return count + (concurrents[id] || 0);
    }, 0);

    process.stdout.clearLine();
    process.stdout.write('\r'+ frames[i++ % len] +' Progress :: '.white + [
      'Created '.white + connections.toString().green,
      'Active '.white + active.toString().green
    ].join(', '));
  }, interval);
}

/**
 * Live frames.
 *
 * @type {Array}
 * @api private
 */
live.frames = [
    '  \u001b[96m◜ \u001b[90m'
  , '  \u001b[96m◠ \u001b[90m'
  , '  \u001b[96m◝ \u001b[90m'
  , '  \u001b[96m◞ \u001b[90m'
  , '  \u001b[96m◡ \u001b[90m'
  , '  \u001b[96m◟ \u001b[90m'
];

/**
 * Stop the live stats from running.
 *
 * @api private
 */
live.stop = function stop() {
  process.stdout.write('\u001b[2K');
  clearInterval(live.interval);
};

// Up our WebSocket socket connections.
[
    ''
  , 'Socket To Me!                                                  version: '+ cli._version
  , ''
  , ''
  , 'Yo here\'s the deal,'
  , 'I\'m gonna...'
  , '- Run '+ cli.workers +' workers.'
  , '- Create '+ (cli.concurrent !== Infinity ? cli.concurrent : 'all the') + ' connections at ' + (cli.concurrent !== Infinity ? 'a time over ' + cli.interval + ' seconds.': 'once')
  , '- Socket To '+ cli.amount + ' websockets on ' + cli.args.length + ' connection' + (cli.args.length > 1 ? 's':'') +' for ' + cli.duration + ' seconds.'
  , ''
  , 'Hope you\'re happy with yourself.'
  , ''
].forEach(function stdout(line) {
  console.log(line);
});

// Metrics collection.
var metrics = new Metrics(cli.amount * cli.args.length);

setTimeout(finish, cli.duration * 1000);

// Iterate over all the urls so we can target multiple locations at once, which
// is helpfull if you are testing multiple loadbalancer endpoints for example.
async.forEach(cli.args, function forEach(url, done) {

  console.log('Connecting to %s', url);

  // Create a simple WebSocket connection generator.
  var queue = async.queue(function working(id, fn) {
    var worker = robin.shift();

    // Register the id, so we can keep track of the connections that we still
    // need to process.
    if(ids[id]){
        ids[id]++;
    }else{
        ids[id] = 1;
    }

    // Process the connections
    worker.send({
        url: url,
        frequency: cli.frequency,
        payload: cli.payloads,
        buffer: cli.buffer,
        wsoptions: cli.protocol,
        id: id });
    worker.once('open::' + id, fn);

    // Add the worker  back at the end of the round robin queue.
    robin.push(worker);
  }, Infinity);


  var batches = (cli.amount / cli.concurrent);
  var freq = 1000;
  if (batches !== 1) {
      freq = (cli.interval * 1000) / (batches - 1)
  }

  // When all the events are processed successfully we should call.. back ;P
  var run = batches;
  queue.drain = function(){
      if (run--) return;
      done();
  }

  // Add connections to the processing queue in batches
  function socketStarter(amount){
      var i = amount;
      return function start() {
          var c = cli.concurrent;
          while (c--) {
              if (i) { 
                  queue.push(url +'::'+ i);
              }else {
                  break;
              }
              i--;
          }
          if (i) {
              setTimeout(start, freq);
          }
      };
  }
  var fn = socketStarter(cli.amount);
  fn(); //Call the starter with itself as the cb
}, function established(err) {
    metrics.established();
});

// We are setup, everything is running
console.log('');
if (!cli.nolive){
  live();
}

function finish(){
  live.stop();
  robin.forEach(function nuke(worker) {
    try { worker.send({ shutdown: true }); }
    catch (e) {}
  });
}

process.once('exit', function(){
  metrics.established().stop().summary();
});

process.once('SIGINT', function end() {
    finish();
});
