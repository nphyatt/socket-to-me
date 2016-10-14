'use strict';

/**
 * Return a function which generates messages.
 */
exports.generateMsg = function(){
  var id = 0;
  return function(size, fn) {

    var key = 'cache::'+ size
      , cached = cache[key];

    // We have a cached version of this size, return that instead.
    if (!cached) {
      cached = cache[key] = Buffer.alloc(size, 'f'); // Fill a buffer with f's
    }
    var msg = {id: id, data: cached.toString()}; //simple msg with id # and fill
    id++;
    return JSON.stringify(msg);
  }
};

// cache for messages of same size
var cache = Object.create(null);
