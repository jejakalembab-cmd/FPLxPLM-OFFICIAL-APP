// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const FPL_BASE = 'https://fantasy.premierleague.com/api';

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = Number(process.env.CACHE_TTL || 30000);

async function cachedGet(url) {
  const now = Date.now();
  const item = cache.get(url);
  if (item && (now - item.ts) < CACHE_TTL) return item.data;
  const res = await axios.get(url, { headers: { Accept: 'application/json' } });
  cache.set(url, { ts: now, data: res.data });
  return res.data;
}

// Proxy: league standings
app.get('/api/league-standings', async (req, res) => {
  const leagueId = req.query.league_id;
  if (!leagueId) return res.status(400).json({ error: 'missing league_id' });
  const url = `${FPL_BASE}/leagues-classic/${encodeURIComponent(leagueId)}/standings/`;
  try {
    const data = await cachedGet(url);
    res.json(data);
  } catch (err) {
    console.error('FPL fetch error', err?.message || err);
    res.status(502).json({ error: 'FPL fetch failed' });
  }
});

// Proxy: bootstrap (optional)
app.get('/api/bootstrap', async (req, res) => {
  try {
    const data = await cachedGet(`${FPL_BASE}/bootstrap-static/`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'FPL bootstrap fetch failed' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));