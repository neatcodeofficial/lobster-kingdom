const fs = require('fs');
const path = require('path');
const config = require('../config.json');

// Channel name mapping
let channelNames = {};
const namesFile = path.join(__dirname, '..', 'channel-names.json');
try {
  channelNames = JSON.parse(fs.readFileSync(namesFile, 'utf8'));
  console.log(`[session-parser] Loaded ${Object.keys(channelNames).length} channel names`);
} catch (e) {
  console.log('[session-parser] No channel-names.json found');
}

// Session ID -> Topic ID mapping (from sessions.json)
let sessionTopicMap = {};
let sessionsJsonMtime = 0;

function loadSessionTopicMap() {
  const sessionsFile = path.join(config.sessionsDir, 'sessions.json');
  try {
    const stat = fs.statSync(sessionsFile);
    if (stat.mtimeMs === sessionsJsonMtime) return; // unchanged
    sessionsJsonMtime = stat.mtimeMs;
    
    const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
    sessionTopicMap = {};
    for (const [key, val] of Object.entries(data)) {
      if (typeof val !== 'object' || !val.sessionId) continue;
      if (key.includes('discord:channel:')) {
        const topic = key.split('discord:channel:')[1];
        sessionTopicMap[val.sessionId] = topic;
      }
    }
    console.log(`[session-parser] Loaded ${Object.keys(sessionTopicMap).length} session->topic mappings`);
  } catch (e) {
    console.log('[session-parser] Failed to load sessions.json:', e.message);
  }
}
loadSessionTopicMap();

// Persistent cache with incremental parsing
// topicId -> { tokens, messages, lastActiveTs, mtime, size (bytes read so far) }
let lobsterCache = {};
let resultCache = { data: null, ts: 0 };
const RESULT_TTL = 15000;

// Parse stats
let parseStats = { fullParses: 0, incrementalParses: 0, cacheHits: 0 };

function getLevel(tokens) {
  const levels = config.levels;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (tokens >= levels[i].minTokens) return i;
  }
  return 0;
}

// Parse a chunk of content (full file or incremental tail)
function parseChunk(content) {
  let totalTokens = 0, msgCount = 0, lastActiveTs = 0;
  let pos = 0;
  while (pos < content.length) {
    const nl = content.indexOf('\n', pos);
    const line = nl === -1 ? content.slice(pos) : content.slice(pos, nl);
    pos = nl === -1 ? content.length : nl + 1;
    if (!line) continue;
    if (line.indexOf('"type":"message"') === -1) continue;
    try {
      const d = JSON.parse(line);
      if (d.type === 'message' && d.message) {
        const msg = d.message;
        if (msg.usage && msg.usage.totalTokens) totalTokens += msg.usage.totalTokens;
        const ts = msg.timestamp || d.timestamp;
        if (ts) {
          const tsNum = typeof ts === 'number' ? ts : new Date(ts).getTime();
          if (tsNum > lastActiveTs) lastActiveTs = tsNum;
        }
        if (msg.role === 'user') msgCount++;
      }
    } catch (e) {}
  }
  return { tokens: totalTokens, messages: msgCount, lastActiveTs };
}

// Incremental file parsing: only read new bytes since last parse
function parseFileIncremental(fp, topicId) {
  const stat = fs.statSync(fp);
  const mtime = stat.mtimeMs;
  const fileSize = stat.size;
  const cached = lobsterCache[topicId];

  // No change at all
  if (cached && cached.mtime === mtime) {
    parseStats.cacheHits++;
    return;
  }

  // File shrunk or new file → full parse
  if (!cached || !cached.bytesRead || fileSize < cached.bytesRead) {
    const content = fs.readFileSync(fp, 'utf8');
    const parsed = parseChunk(content);
    lobsterCache[topicId] = { ...parsed, mtime, bytesRead: fileSize };
    parseStats.fullParses++;
    return;
  }

  // File grew → incremental parse (read only new bytes)
  const newBytes = fileSize - cached.bytesRead;
  if (newBytes > 0) {
    const fd = fs.openSync(fp, 'r');
    const buf = Buffer.alloc(newBytes);
    fs.readSync(fd, buf, 0, newBytes, cached.bytesRead);
    fs.closeSync(fd);
    
    const newContent = buf.toString('utf8');
    const parsed = parseChunk(newContent);
    
    // Merge with existing cache
    cached.tokens += parsed.tokens;
    cached.messages += parsed.messages;
    if (parsed.lastActiveTs > cached.lastActiveTs) {
      cached.lastActiveTs = parsed.lastActiveTs;
    }
    cached.mtime = mtime;
    cached.bytesRead = fileSize;
    parseStats.incrementalParses++;
  }
}

function updateCache() {
  const dir = config.sessionsDir;
  if (!fs.existsSync(dir)) return;

  loadSessionTopicMap();

  const files = fs.readdirSync(dir).filter(f =>
    f.endsWith('.jsonl') && !f.includes('.deleted') && !f.includes('.reset') && !f.includes('.bak')
  );

  const seen = new Set();
  for (const file of files) {
    const fp = path.join(dir, file);
    let topicId = null;
    
    const topicMatch = file.match(/-topic-(\d+)\.jsonl$/);
    if (topicMatch) {
      topicId = topicMatch[1];
    } else {
      const uuidMatch = file.match(/^([a-f0-9-]+)\.jsonl$/);
      if (uuidMatch) {
        const sessionId = uuidMatch[1];
        if (sessionTopicMap[sessionId]) {
          topicId = sessionTopicMap[sessionId];
        } else {
          continue;
        }
      } else {
        continue;
      }
    }
    seen.add(topicId);

    try {
      parseFileIncremental(fp, topicId);
    } catch (e) {
      console.error(`[session-parser] Error parsing ${file}:`, e.message);
    }
  }

  // Remove deleted files from cache
  for (const id of Object.keys(lobsterCache)) {
    if (!seen.has(id)) delete lobsterCache[id];
  }
}

function getData() {
  if (resultCache.data && Date.now() - resultCache.ts < RESULT_TTL) return resultCache.data;

  const t0 = Date.now();
  refreshChannelNames(); // auto-refresh names (1min cooldown)
  updateCache();

  const now = Date.now();
  const thirtyMinAgo = now - 30 * 60 * 1000;
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  const lobsters = [];
  for (const [topicId, c] of Object.entries(lobsterCache)) {
    if (topicId.startsWith('dm-')) continue;
    
    let zone = 'idle';
    if (c.lastActiveTs >= thirtyMinAgo) zone = 'working';
    else if (c.lastActiveTs >= twentyFourHoursAgo) zone = 'resting';

    const level = getLevel(c.tokens);
    const displayName = channelNames[topicId] || `频道 #${topicId}`;
    
    lobsters.push({
      id: topicId,
      name: displayName,
      tokens: c.tokens,
      messages: c.messages,
      level,
      levelName: config.levels[level].name,
      zone,
      lastActive: c.lastActiveTs ? new Date(c.lastActiveTs).toISOString() : null,
      size: config.levels[level].size,
      color: config.levels[level].color
    });
  }

  lobsters.sort((a, b) => b.tokens - a.tokens);
  const stats = {
    total: lobsters.length,
    working: lobsters.filter(l => l.zone === 'working').length,
    resting: lobsters.filter(l => l.zone === 'resting').length,
    idle: lobsters.filter(l => l.zone === 'idle').length,
    totalTokens: lobsters.reduce((sum, l) => sum + l.tokens, 0),
    avgLevel: lobsters.length > 0 ? (lobsters.reduce((sum, l) => sum + l.level, 0) / lobsters.length).toFixed(1) : 0
  };

  const elapsed = Date.now() - t0;
  console.log(`[session-parser] ${lobsters.length} lobsters in ${elapsed}ms (full:${parseStats.fullParses} incr:${parseStats.incrementalParses} cache:${parseStats.cacheHits})`);
  // Reset stats for next cycle
  parseStats = { fullParses: 0, incrementalParses: 0, cacheHits: 0 };
  
  resultCache = { data: { lobsters, stats }, ts: Date.now() };
  return resultCache.data;
}

// Pre-warm cache on startup
console.log('[session-parser] Pre-warming cache...');
const t0 = Date.now();
updateCache();
console.log(`[session-parser] Cache warmed: ${Object.keys(lobsterCache).length} sessions in ${Date.now() - t0}ms`);

// Extract channel name from session file content (first 20KB, first 50 lines)
function extractNameFromFile(fp) {
  try {
    const fd = fs.openSync(fp, 'r');
    const buf = Buffer.alloc(Math.min(20480, fs.fstatSync(fd).size));
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n').slice(0, 50);
    for (const line of lines) {
      if (!line.includes('"role":"user"')) continue;
      // Pattern 1: [Thread starter - for context]\nName
      const ts = line.match(/\[Thread starter - for context\]\\n(.*?)(?:\\n|$)/);
      if (ts && ts[1].trim()) return ts[1].trim();
      // Pattern 2: "conversation_label": "Guild #Name channel id:xxx"
      const cl = line.match(/"conversation_label":\s*"Guild #([^"]+?)\s+channel id:\d+"/);
      if (cl) return cl[1].trim();
      // Pattern 3: "thread_label": "Discord thread # › Name"
      const tl = line.match(/"thread_label":\s*"Discord thread #[^›]*›\s*([^"]+)"/);
      if (tl) return tl[1].trim();
    }
  } catch (e) {}
  return null;
}

// Refresh channel names from all session files (topic-based + UUID-based)
let lastNameRefresh = 0;
const NAME_REFRESH_INTERVAL = 60000; // 1 minute cooldown

function refreshChannelNames(force) {
  const now = Date.now();
  if (!force && now - lastNameRefresh < NAME_REFRESH_INTERVAL) return;
  lastNameRefresh = now;

  const dir = config.sessionsDir;
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).filter(f =>
    f.endsWith('.jsonl') && !f.includes('.deleted') && !f.includes('.reset') && !f.includes('.bak')
  );

  let updated = 0;
  for (const file of files) {
    let topicId = null;

    // Try topic-based filename first
    const topicMatch = file.match(/-topic-(\d+)\.jsonl$/);
    if (topicMatch) {
      topicId = topicMatch[1];
    } else {
      // Try UUID-based filename via sessions.json mapping
      const uuidMatch = file.match(/^([a-f0-9-]+)\.jsonl$/);
      if (uuidMatch && sessionTopicMap[uuidMatch[1]]) {
        topicId = sessionTopicMap[uuidMatch[1]];
      }
    }

    if (!topicId || channelNames[topicId]) continue;

    const fp = path.join(dir, file);
    const name = extractNameFromFile(fp);
    if (name) {
      channelNames[topicId] = name;
      updated++;
    }
  }

  if (updated > 0) {
    fs.writeFileSync(namesFile, JSON.stringify(channelNames, null, 2));
    console.log(`[session-parser] Updated ${updated} new channel names (total: ${Object.keys(channelNames).length})`);
  }
}
refreshChannelNames(true);

module.exports = { getData };
