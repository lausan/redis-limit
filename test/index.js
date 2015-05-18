var RedisRateLimiter = require("../");
var redis = require("redis");
var async = require("async");

var test = require("tap").test;

test("limiter consumes tokens for different clients", function(t) {
  t.plan(1);
  var client = redis.createClient();
  var options = {
    redis: client,
    maxInInterval: 2, // allow 2 requests
    interval: 2000, // every 2000 milliseconds
  };
  var limiter = RedisRateLimiter(options);

  async.series([
    function(callback) {
      limiter("foo", callback);
    },
    function(callback) {
      limiter("bar", callback);
    },
    function(callback) {
      limiter("foo", callback);
    },
    function(callback) {
      limiter("bar", callback);
    },
    function(callback) {
      limiter("foo", callback);
    },
    function(callback) {
      limiter("bar", callback);
    },
  ], function(err, tokens) {
    client.quit();
    if (err) return t.fail(err);
    t.similar(tokens, [0, 0, 0, 0, 1000, 1000]);
  });

});

test("limiter refills for different clients", function(t) {
  t.plan(3);
  var client = redis.createClient();
  var options = {
    redis: client,
    maxInInterval: 2, // allow 2 requests
    interval: 4000 // every 4000 milliseconds
  };
  var limiter = RedisRateLimiter(options);

  async.parallel([
    function(callback) {
      limiter("foo", callback);
    },
    function(callback) {
      limiter("bar", callback);
    },
    function(callback) {
      limiter("foo", callback);
    },
    function(callback) {
      limiter("bar", callback);
    },
    function(callback) {
      limiter("foo", callback);
    },
    function(callback) {
      limiter("bar", callback);
    }
  ], function(err, tokens) {
    if (err) {
      client.quit();
      return t.fail(err);
    }
    t.similar(tokens, [0, 0, 0, 0, 2000, 2000]);

    setTimeout(function() {
      async.series([
        function(callback) {
          limiter("foo", callback);
        },
        function(callback) {
          limiter("bar", callback);
        }
      ], function(err, tokens) {
        if (err) {
          client.quit();
          return t.fail(err);
        }
        t.similar(tokens, [2000, 2000]);
        setTimeout(function() {
          async.series([
            function(callback) {
              limiter("foo", callback);
            },
            function(callback) {
              limiter("foo", callback);
            },
            function(callback) {
              limiter("bar", callback);
            },
            function(callback) {
              limiter("bar", callback);
            }
          ], function(err, tokens) {
            client.quit();
            if (err) return t.fail(err);
            t.similar(tokens, [0, 2000, 0, 2000]);
          });
        }, 2000);
      });
    }, 1000);

  });

});

test("failed requests prevent further requests", function(t) {
  t.plan(3);
  var client = redis.createClient();
  var options = {
    redis: client,
    maxInInterval: 2, // allow 2 requests
    interval: 4000 // every 4000 milliseconds
  };
  var limiter = RedisRateLimiter(options);

  async.parallel([
    function(callback) {
      limiter("foo", callback);
    },
    function(callback) {
      limiter("bar", callback);
    },
    function(callback) {
      limiter("foo", callback);
    },
    function(callback) {
      limiter("bar", callback);
    },
    function(callback) {
      limiter("foo", callback);
    },
    function(callback) {
      limiter("bar", callback);
    }
  ], function(err, tokens) {
    if (err) {
      client.quit();
      return t.fail(err);
    }
    t.similar(tokens, [0, 0, 0, 0, 2000, 2000]);

    setTimeout(function() {
      async.series([
        function(callback) {
          limiter("foo", callback);
        },
        function(callback) {
          limiter("bar", callback);
        }
      ], function(err, tokens) {
        if (err) {
          client.quit();
          return t.fail(err);
        }
        t.similar(tokens, [2000, 2000]);
        setTimeout(function() {
          async.series([
            function(callback) {
              limiter("foo", callback);
            },
            function(callback) {
              limiter("bar", callback);
            }
          ], function(err, tokens) {
            client.quit();
            if (err) return t.fail(err);
            t.similar(tokens, [2000, 2000]);
          });
        }, 1000);
      });
    }, 1000);

  });

});

test("limiter doesn't allow two requests within minDifference", function(t) {
  t.plan(3);
  var client = redis.createClient();
  // 10 tokens with a 2 second min difference
  var options = {
    redis: client,
    maxInInterval: 10, // allow 10 requests
    interval: Infinity, // never allow more
    minDifference: 2000 // but they have to be at least 2000 milliseconds apart
  }
  var limiter = RedisRateLimiter(options);

  async.series([
    function(callback) {
      limiter("foo", callback);
    },
    function(callback) {
      limiter("foo", callback);
    }
  ], function(err, tokens) {
    if (err) {
      client.quit();
      return t.fail(err);
    }
    t.equal(tokens[0], 0);
    t.ok(tokens[1] > 10 && tokens[1] < 2000);
    setTimeout(function() {
      limiter("foo", function(err, tokens) {
        client.quit();
        if (err) return t.fail(err);
        t.equal(tokens, 0);
      });
    }, tokens[1]);
  });

});

test("redis ttl functions", function(t) {
  t.plan(2);
  var client = redis.createClient();
  var namespace = Math.random().toString(36).slice(2);
  var limiter = RedisRateLimiter({
    redis: client,
    interval: 10000,
    maxInInterval: 5,
    namespace: namespace
  });

  limiter("1", function(err, result) {
    var tokenKey = namespace + "1" + ":token";
    var lastAccessedKey = namespace + "1" + ":timestamp";
    async.parallel({
      token: function(callback) {
        client.ttl(tokenKey, callback);
      },
      lastAccessed: function(callback) {
        client.ttl(lastAccessedKey, callback);
      }
    }, function(err, results) {
      client.quit();
      t.equal(results.token, 10);
      t.equal(results.lastAccessed, 10);
    });
  });

});
