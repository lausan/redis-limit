-- EVAL "$(cat token-bucket.lua)" 2 tokenKey lastAccessedKey fillRate capacity now minDifference interval

-- convert all ARGV to numbers
for i = 1,table.getn(ARGV) do
   ARGV[i] = tonumber(ARGV[i])
end

local fill_rate = ARGV[1]
local capacity = ARGV[2]
local now = ARGV[3]
local min_difference = ARGV[4]
local interval = ARGV[5]
local tokens = redis.call("GET", KEYS[1])
local last_accessed = redis.call("GET", KEYS[2])
local result = nil

if last_accessed == false or tokens == false then
   -- the bucket doesn't exist yet
   redis.call("SET", KEYS[1], capacity - 1)
   redis.call("SET", KEYS[2], now)
   result = capacity

elseif (now - last_accessed) < min_difference then
   -- min_difference time hasn't elapsed
   -- this will be negative
   result = (now - last_accessed) - min_difference

else

   local tokens_to_add = math.floor(fill_rate * (now - last_accessed))

   tokens = math.min(capacity, tokens + tokens_to_add)

   -- so we don't have negative tokens
   redis.call("SET", KEYS[1], math.max(tokens - 1, 0))
   redis.call("SET", KEYS[2], now)

   result = tokens

end

if interval ~= 0 then
   redis.call("EXPIRE", KEYS[1], interval)
   redis.call("EXPIRE", KEYS[2], interval)
end

return result
