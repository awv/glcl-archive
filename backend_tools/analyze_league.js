const path = require('path');

// Mock window object so node can execute data.js
global.window = {};

// Load data.js directly
require(path.join(__dirname, '../data.js'));

const results = global.window.glclResults || [];

const stats = {
    totalFinishes: results.length,
    seasons: {},
    clubs: {},
    veterans: {}
};

results.forEach(r => {
    if (!r.season || !r.name || r.name === 'Unknown Runner') return;

    // 1. Field sizes per season
    if (!stats.seasons[r.season]) {
        stats.seasons[r.season] = { total: 0, xc: 0, road: 0, clubs: new Set() };
    }
    stats.seasons[r.season].total++;
    if ((r.discipline || '').toLowerCase() === 'xc') stats.seasons[r.season].xc++;
    else stats.seasons[r.season].road++;
    if (r.club) stats.seasons[r.season].clubs.add(r.club);

    // 2. Club totals over time
    if (!stats.clubs[r.club]) {
        stats.clubs[r.club] = { totalFinishes: 0, seasonsActive: new Set() };
    }
    stats.clubs[r.club].totalFinishes++;
    stats.clubs[r.club].seasonsActive.add(r.season);

    // 3. Runner longevity & wins
    if (!stats.veterans[r.name]) {
        stats.veterans[r.name] = { 
            races: 0, 
            seasons: new Set(), 
            catWins: 0, 
            overallWins: 0, 
            club: r.club 
        };
    }
    stats.veterans[r.name].races++;
    stats.veterans[r.name].seasons.add(r.season);
    if (parseInt(r.cat_pos, 10) === 1) stats.veterans[r.name].catWins++;
    if (parseInt(r.gender_pos, 10) === 1) stats.veterans[r.name].overallWins++;
});

// Format Sets to counts for clean JSON printing
const summary = {
    totalRecords: stats.totalFinishes,
    seasonBreakdown: Object.keys(stats.seasons).map(s => ({
        season: s,
        finishers: stats.seasons[s].total,
        xc: stats.seasons[s].xc,
        road: stats.seasons[s].road,
        activeClubs: stats.seasons[s].clubs.size
    })),
    topClubsByTurnout: Object.keys(stats.clubs)
        .map(c => ({ club: c, finishes: stats.clubs[c].totalFinishes, seasons: stats.clubs[c].seasonsActive.size }))
        .sort((a, b) => b.finishes - a.finishes)
        .slice(0, 10),
    mostLoyalRunners: Object.keys(stats.veterans)
        .map(v => ({
            name: v,
            races: stats.veterans[v].races,
            spanYears: stats.veterans[v].seasons.size,
            overallWins: stats.veterans[v].overallWins,
            catWins: stats.veterans[v].catWins,
            club: stats.veterans[v].club
        }))
        .sort((a, b) => b.races - a.races)
        .slice(0, 15)
};

console.log(JSON.stringify(summary, null, 2));