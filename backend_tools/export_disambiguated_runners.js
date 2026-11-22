const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.resolve(__dirname, '..');
const dataJsPath = path.join(baseDir, 'data.js');
const corrJsPath = path.join(baseDir, 'assets', 'js', 'corrections.js');
const outJsonPath = path.join(baseDir, 'assets', 'data', 'disambiguated_runners.json');

const sandbox = { window: {}, console: console };
vm.createContext(sandbox);

const dataCode = fs.readFileSync(dataJsPath, 'utf-8');
vm.runInContext(dataCode, sandbox);

const corrCode = fs.readFileSync(corrJsPath, 'utf-8');
vm.runInContext(corrCode, sandbox);

const allRecords = sandbox.window.glclResults || [];
console.log(`Loaded ${allRecords.length} raw results from data.js`);

const correctedRecords = allRecords.map(row => {
    if (sandbox.window.resolveRowAthlete && row.name) {
        const resolved = sandbox.window.resolveRowAthlete(row);
        return {
            ...row,
            name: resolved.name,
            club: resolved.club,
            age_cat: resolved.age_cat || row.age_cat,
            nameKey: resolved.nameKey,
            baseNameKey: resolved.baseNameKey,
            clubGroupKey: resolved.clubGroupKey,
            profileKey: resolved.profileKey
        };
    }
    const nameKey = (row.name || '').replace(/,/g, '').toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
    return {
        ...row,
        nameKey: nameKey,
        baseNameKey: nameKey,
        clubGroupKey: '',
        profileKey: nameKey
    };
});

// Group by profileKey
const profiles = new Map();

correctedRecords.forEach(r => {
    if (!r.name || r.pos <= 0) return;
    const pKey = r.profileKey || r.nameKey;
    if (!profiles.has(pKey)) {
        profiles.set(pKey, {
            profileKey: pKey,
            nameKey: r.nameKey,
            displayName: r.name,
            clubGroupKey: r.clubGroupKey || '',
            records: [],
            clubs: {}
        });
    }
    const prof = profiles.get(pKey);
    prof.records.push(r);
    if (r.club) {
        prof.clubs[r.club] = (prof.clubs[r.club] || 0) + 1;
    }
});

console.log(`Grouped into ${profiles.size} disambiguated runner profiles`);

const slugify = (text) => (text || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const outputList = [];

profiles.forEach((prof) => {
    const recs = prof.records;
    
    // Determine Current Club (Priority: clubHistory Present entry > latest season race > frequency)
    let primaryClub = null;
    const clubHistory = sandbox.window.glclCorrections?.clubHistory || {};
    const key = prof.nameKey;
    for (const [histKey, histList] of Object.entries(clubHistory)) {
        const [hName] = histKey.split('|');
        const hKey = sandbox.window.getAthleteNameKey ? sandbox.window.getAthleteNameKey(hName) : hName.toLowerCase();
        if (hKey === key && Array.isArray(histList)) {
            const presentEntry = histList.find(h => h.seasons && h.seasons.toLowerCase().includes('present'));
            if (presentEntry && presentEntry.club) {
                primaryClub = presentEntry.club;
                break;
            }
        }
    }

    if (!primaryClub) {
        const sortedBySeason = [...recs].sort((a, b) => (b.season || '').localeCompare(a.season || ''));
        const latestClub = sortedBySeason[0]?.club;
        if (latestClub && latestClub.toLowerCase() !== 'unattached') {
            primaryClub = latestClub;
        }
    }

    if (!primaryClub) {
        const sortedClubs = Object.entries(prof.clubs).sort((a, b) => b[1] - a[1]);
        primaryClub = sortedClubs.length > 0 ? sortedClubs[0][0] : 'GLCL Competitor';
    }

    const totalRaces = recs.length;
    const seasons = Array.from(new Set(recs.map(r => r.season).filter(Boolean))).sort();
    const totalSeasons = seasons.length;

    let catWins = 0;
    let podiums = 0;
    let totalMiles = 0;
    let bestXc = 999;
    let bestRoad = 999;
    const venues = new Set();

    recs.forEach(r => {
        const catPos = parseInt(r.cat_pos, 10);
        if (!isNaN(catPos)) {
            if (catPos === 1) catWins++;
            if (catPos <= 3) podiums++;
        }
        const disc = (r.discipline || '').toLowerCase();
        const pos = parseInt(r.pos, 10);
        if (disc.includes('xc')) {
            totalMiles += 4.8;
            if (!isNaN(pos) && pos > 0 && pos < bestXc) bestXc = pos;
        } else {
            totalMiles += 5.2;
            if (!isNaN(pos) && pos > 0 && pos < bestRoad) bestRoad = pos;
        }
        if (r.venue) venues.add(r.venue);
    });

    let yearsSpanText = '';
    if (seasons.length > 0) {
        try {
            const firstY = parseInt(seasons[0].split('/')[0], 10);
            const lastParts = seasons[seasons.length - 1].split('/');
            const lastY = parseInt(lastParts[1] || lastParts[0], 10);
            const spanYrs = (lastY - firstY) + 1;
            yearsSpanText = `${firstY} – ${lastY} (${spanYrs} YEARS ACTIVE)`;
        } catch (e) {
            yearsSpanText = `${seasons[0]} – ${seasons[seasons.length - 1]}`;
        }
    }

    const latestRec = recs[0] || {};

    outputList.push({
        profileKey: prof.profileKey,
        nameKey: prof.nameKey,
        displayName: prof.displayName,
        nameSlug: slugify(prof.displayName),
        primaryClub: primaryClub,
        clubSlug: slugify(primaryClub),
        primaryCat: latestRec.age_cat || latestRec.category || 'Competitor',
        totalRaces: totalRaces,
        totalSeasons: totalSeasons,
        seasons: seasons,
        yearsSpanText: yearsSpanText,
        catWins: catWins,
        podiums: podiums,
        bestXc: bestXc < 999 ? bestXc : null,
        bestRoad: bestRoad < 999 ? bestRoad : null,
        uniqueVenues: venues.size,
        miles: Math.round(totalMiles)
    });
});

fs.writeFileSync(outJsonPath, JSON.stringify(outputList, null, 2), 'utf-8');
console.log(`Saved ${outputList.length} disambiguated runner profiles to ${outJsonPath}`);
