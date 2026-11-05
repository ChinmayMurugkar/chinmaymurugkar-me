// Lua scripts run atomically inside Redis (Upstash supports EVAL with cjson).

// KEYS: cats, claims:<cat>  ARGV: catId, slot ("open" | "1".."N"), claimJson, openKey
// Returns "OK:<slotKey>" | "NOCAT" | "BADSLOT" | "TAKEN" | "FULL"
export const CLAIM = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
if not raw then return 'NOCAT' end
local cat = cjson.decode(raw)
local slots = tonumber(cat.slots) or 0
if ARGV[2] == 'open' then
  if slots ~= 0 then return 'BADSLOT' end
  if redis.call('HLEN', KEYS[2]) >= 80 then return 'FULL' end
  redis.call('HSET', KEYS[2], ARGV[4], ARGV[3])
  return 'OK:' .. ARGV[4]
end
local n = tonumber(ARGV[2])
if slots == 0 or not n or n < 1 or n > slots or n ~= math.floor(n) then return 'BADSLOT' end
if redis.call('HSETNX', KEYS[2], tostring(n), ARGV[3]) == 1 then return 'OK:' .. tostring(n) end
for i = 1, slots do
  if redis.call('HEXISTS', KEYS[2], tostring(i)) == 0 then return 'TAKEN' end
end
return 'FULL'
`;

// KEYS: claims:<cat>  ARGV: slotKey, tokenHash, mode ("release" | "update"), dish, name
// Returns "OK" | "GONE" | "NOTYOURS"
export const MINE = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
if not raw then return 'GONE' end
local c = cjson.decode(raw)
if c.th ~= ARGV[2] then return 'NOTYOURS' end
if ARGV[3] == 'release' then
  redis.call('HDEL', KEYS[1], ARGV[1])
else
  c.dish = ARGV[4]
  c.name = ARGV[5]
  redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(c))
end
return 'OK'
`;

// KEYS: cats, claims:<cat>  ARGV: catId, newSlots (0 = open-ended)
// Moves existing claims into free numbered slots when needed. Returns "OK" | "NOCAT" | "TOOMANY"
export const SET_SLOTS = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
if not raw then return 'NOCAT' end
local cat = cjson.decode(raw)
local new = tonumber(ARGV[2])
if new > 0 then
  local all = redis.call('HGETALL', KEYS[2])
  local used, extra = {}, {}
  for i = 1, #all, 2 do
    local n = tonumber(all[i])
    if n and n >= 1 and n <= new and n == math.floor(n) then used[n] = true
    else table.insert(extra, { all[i], all[i + 1] }) end
  end
  local free = {}
  for i = 1, new do if not used[i] then table.insert(free, i) end end
  if #extra > #free then return 'TOOMANY' end
  for j, e in ipairs(extra) do
    redis.call('HDEL', KEYS[2], e[1])
    redis.call('HSET', KEYS[2], tostring(free[j]), e[2])
  end
end
cat.slots = new
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(cat))
return 'OK'
`;

// KEYS: cats, claims:<from>, claims:<to>  ARGV: fromId, toId
// Moves every claim from one category into another (growing its slot count if needed), then deletes the source.
export const MERGE = `
local fr = redis.call('HGET', KEYS[1], ARGV[1])
local tr = redis.call('HGET', KEYS[1], ARGV[2])
if not fr or not tr then return 'NOCAT' end
local to = cjson.decode(tr)
local slots = tonumber(to.slots) or 0
local all = redis.call('HGETALL', KEYS[2])
for i = 1, #all, 2 do
  if slots == 0 then
    redis.call('HSET', KEYS[3], 'm' .. ARGV[1] .. '-' .. all[i], all[i + 1])
  else
    local n = 1
    while redis.call('HEXISTS', KEYS[3], tostring(n)) == 1 do n = n + 1 end
    if n > slots then slots = n end
    redis.call('HSET', KEYS[3], tostring(n), all[i + 1])
  end
end
to.slots = slots
redis.call('HSET', KEYS[1], ARGV[2], cjson.encode(to))
redis.call('HDEL', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2])
return 'OK'
`;
