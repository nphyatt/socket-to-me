'use strict';

const librato = require('librato-node');

function init(email, token) {
  const credentials = {
    email: email || process.env.LIBRATO_USER,
    token: token || process.env.LIBRATO_TOKEN
  };
  librato.configure(credentials);
  librato.start();
  process.once('SIGINT', () => librato.stop());

  librato.on('error', (err) => {
    console.log(`Saw librato error: ${err}`)
  });
}

const src = {source: 'load_testing'};
const prefix = 'ionic_api_db.nicks_socket_smasher.';
function measure(metric, value){
  metric = prefix + metric;
  librato.measure(metric, value, src);
}

function increment(metric, value){
  metric = prefix + metric;
  if(!value) {
    value = 1;
  }
  librato.increment(metric, value, src);
}

let reqs = {};

function request(id) {
  reqs[id] = process.hrtime();
}

function response(id) {
  if(reqs[id]){
    let msec = delta(reqs[id]);
    delete reqs[id];
    measure('response_time', msec);
  }
}

//return time delta in ms
function delta(time){
  let tuple = process.hrtime(time);
  return (tuple[0] * 1000) + Math.max(tuple[1] / 1000 / 1000);
}

//should clean up reqs object for memory purposes
setInterval(function(){
  Object.keys(reqs).forEach(function(id){
    if(delta(reqs[id]) > 30000){
      librato.increment('unacknowledged_requests', 1);
      delete reqs[id];
    }
  });
}, 10000);

module.exports = {
  init: init,
  measure: measure,
  increment: increment,
  request: request,
  response: response
};
