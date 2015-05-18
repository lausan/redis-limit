var assert = require("assert");
var fs = require("fs");
var lua = fs.readFileSync("./src/token-bucket.lua");

function isInt(x) {
  return x === (x | 0);
}

function RedisRateLimiter(options) {
  var redis = options.redis,
      interval = options.interval, // in milliseconds
      maxInInterval = options.maxInInterval,
      minDifference = options.minDifference || 0,
      namespace = options.namespace || "redis-rate-limiter-" + Math.random().toString(36).slice(2);
  var result, sha;

  assert(interval === Infinity || interval > 0 && isInt(options.interval), "`options.interval` must be a positive integer");
  assert(maxInInterval > 0 && isInt(maxInInterval), "`options.maxInInterval must be a positive integer");

  /*
    convert interval and maxInInterval to a fill rate
    fillRate = x tokens / millisecond
             = maxInInterval / interval
  */
  var fillRate = maxInInterval / interval;

  /*
    capacity = x tokens
             = maxInInterval
  */

  result = function (id, cb) {
    if (!cb) {
      cb = id;
      id = "";
    }


    assert.equal(typeof cb, "function", "Callback must be a function.");

    var now = Date.now();
    var key = namespace + id;
    var tokenKey = key + ":token";
    var lastAccessedKey = key + ":timestamp";

    var args = [
      sha || lua, // sha from SCRIPT LOAD or lua script as string or buffer
      2, // number of keys
      tokenKey,
      lastAccessedKey,
      fillRate,
      maxInInterval, // bucket capacity
      now,
      minDifference || 0,
      isFinite(interval) ? Math.ceil(interval / 1000) : 0 // interval in seconds for redis ttl
    ];

    redis[sha ? "evalsha" : "eval"](args, function(err, res) {
      if (err) return cb(err);
      res = Number(res);
      if (res < 0) {
        // this is the time until minDifference is satisfied in milliseconds
        return cb(null, -Math.floor(res));
      } else if (res === 0) {
        // no tokens left so the client will have to wait 1 / fillRate milliseconds
        return cb(null, 1 / fillRate);
      } else {
        // there are tokens
        return cb(null, 0);
      }
    });

  }

  result.load = function(cb) {
    redis.script(["LOAD", lua], function(err, result) {
      if (err) return cb(err);
      sha = result;
      cb(null);
    });
  }

  return result;

}

module.exports = RedisRateLimiter;
