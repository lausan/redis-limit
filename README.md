# redis-limit
[![Build Status](https://travis-ci.org/lausan/redis-limit.svg?branch=master)](https://travis-ci.org/lausan/redis-limit)

[![NPM](https://nodei.co/npm/redis-limit.png?downloads=true&downloadRank=true)](https://nodei.co/npm/redis-limit/)
[![NPM](https://nodei.co/npm-dl/redis-limit.png?months=6&height=3)](https://nodei.co/npm/redis-limit/)


## Description
A simple redis backed rate limiter. This is based on [this implementation](https://github.com/classdojo/rolling-rate-limiter) and [redis-rate-limiter](https://github.com/TabDigital/redis-rate-limiter).

The bucket is constantly being refilled with tokens. This means that setting an `interval` of 1000 milliseconds and a `maxInInterval` of 10 requests will fill tokens at a rate of 10 tokens per second (1 token every 0.1 seconds). Therefore if a bucket is full 10 requests could be made immediately then 1 more request every 0.1 seconds, so it's possible to make more than 10 requests in any second if tokens are saved up. Instead using a `maxInInterval` of 1 and `interval` of 100 milliseconds will prevent there from ever being more than 10 requests per second, but requests will have to be 100 milliseconds apart.

## Installation

```
npm install redis-limit
```

## Usage

```javascript
var redis = require("redis");
var RateLimiter = require("redis-limit");

var limiter = RateLimiter({
    redis: redis.createClient(),
    interval: 1000, // milliseconds
    maxInInterval: 10,
    minDifference: 10, // requests have to be 10 milliseconds apart
    namespace: "redis-limit"
});

limiter("key", function(err, result) {
    // result is the time in milliseconds until a request is allowed
    // 0 if there are tokens in the bucket now
    console.log(result);
});

// calling load will SCRIPT LOAD the lua script in redis and use EVALSHA for much better performance
limiter.load(function(err) {
    limiter("key", function(err, result) {
        console.log(result);
    });
});
```

### Options
- `redis` - a redis client
- `interval` - the time in milliseconds to completely fill the bucket
- `maxInInterval` - the capacity of the bucket. see the note above about why this isn't truly the maximum requests allowed in any interval
- `minDifference` - minimum time between requests. requests made when there are no tokens keep the bucket from refilling, requests made less than `minDifference` apart do not keep the bucket from filling
- `namespace` - namespace for keys in redis, multiple instaces can share a namespace with no race conditions