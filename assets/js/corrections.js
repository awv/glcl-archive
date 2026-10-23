window.glclCorrections = window.glclCorrections || {
    // 1. MARRIAGE, SURNAME & SUFFIX MERGES WITH EFFECTIVE YEAR
    nameChanges: {
        // The key MUST be the old name that sits in your legacy dataset rows
        "Antoinette Dumayne": {
            primaryName: "Antoinette Rose",
            effectiveSeason: "2024/2025",
            note: "Formerly competed as Antoinette Dumayne"
        },
        "Nicola Gething": {
            primaryName: "Nicola Jukes",
            effectiveSeason: "2016/2017",
            note: "Formerly competed as Nicola Gething"
        },
        "Sam Lewis-Jones": {
            primaryName: "Sam Jones",
            effectiveSeason: "2017/2018",
            note: "Formerly competed as Sam Lewis Jones"
        },
        "Nicola Smith": {
            primaryName: "Nicola Brunnock",
            effectiveSeason: "2021/2022",
            note: "Formerly competed as Nicola Smith"
        },
        "Tom Henry": {
            primaryName: "Thomas Henry",
            effectiveSeason: "2021/2022",
            note: "Formerly competed as Tom Henry"
        },
        "Richard PRICE(JNR)": {
            primaryName: "Richard Price",
            effectiveSeason: "2021/2022",
            note: "Competed as Richard Price (Jnr) until 2018/2019"
        },
        "Richard Price (Jnr)": {
            primaryName: "Richard Price",
            effectiveSeason: "2021/2022",
            note: "Competed as Richard Price (Jnr) until 2018/2019"
        },
        "Richard PRICE(SNR)": {
            primaryName: "Richard Price (Snr)",
            effectiveSeason: "2017/2018",
            note: "Recorded as Richard PRICE(SNR) in league results"
        },
        "Mark HARVEY(jnr)": {
            primaryName: "Mark Harvey",
            effectiveSeason: "2016/2017",
            note: "Competed with (Jnr) suffix while Mark Harvey (Snr) was active"
        },
        "Mark HARVEY (jr)": {
            primaryName: "Mark Harvey",
            effectiveSeason: "2016/2017",
            note: "Competed with (Jr) suffix while Mark Harvey (Snr) was active"
        },
        "Mark HARVEY (jun)": {
            primaryName: "Mark Harvey",
            effectiveSeason: "2016/2017",
            note: "Competed with (Jun) suffix while Mark Harvey (Snr) was active"
        },
        "ChristopherJONES": {
            primaryName: "Christopher Jones (Snr)",
            effectiveSeason: "2010/2011",
            note: "Corrected spacing from ChristopherJONES"
        },
        "Mark HARVEY(snr)": {
            primaryName: "Mark Harvey (Snr)",
            effectiveSeason: "2014/2015",
            note: "Recorded as Mark HARVEY(snr) in league results"
        },
        "Mark HARVEY (sr)": {
            primaryName: "Mark Harvey (Snr)",
            effectiveSeason: "2014/2015",
            note: "Recorded as Mark HARVEY (sr) in league results"
        },
        "Steve WILLIAMS(SNR)": {
            primaryName: "Steve Williams (Snr)",
            effectiveSeason: "2018/2019",
            note: "Recorded as Steve WILLIAMS(SNR) in league results"
        },
        "Steve WILLIAMS(JNR)": {
            primaryName: "Steve Williams (Jnr)",
            effectiveSeason: "2017/2018",
            note: "Recorded as Steve WILLIAMS(JNR) in league results"
        }
    },

    // 2. HISTORICAL CLUB TRANSITIONS TRACKING
    // Keys can be athlete name OR "Athlete Name|Club" when disambiguating a cross-club namesake
    clubHistory: {
        "Lloyd COTTRELL": [
            { club: "Lliswerry Runners", seasons: "Debut — 2023/2024" },
            { club: "Parc Bryn Bach RC", seasons: "2024/2025 — Present" }
        ],
        "Lee AHERNE": [
            { club: "Club 69", seasons: "Debut — 2007/2008" },
            { club: "Parc Bryn Bach RC", seasons: "2012/2013 — Present" }
        ],
        "Huw EVANS|Parc Bryn Bach RC": [
            { club: "San Domenico RC", seasons: "Prior — 2021" },
            { club: "Parc Bryn Bach RC", seasons: "2021/2022 — Present" }
        ],
        "Michael LEWIS": [
            { club: "Fairwater Runners", seasons: "Debut — 2022/2023" },
            { club: "Parc Bryn Bach RC", seasons: "2023/2024 — Present" }
        ],
        "Jane LEWIS": [
            { club: "Fairwater Runners", seasons: "Debut — 2023/2024" },
            { club: "Lliswerry Runners", seasons: "2024/2025 — Present" }
        ],
        "Helen WILLIAMS": [
            { club: "Islwyn RC", seasons: "Debut — 2018/2019" },
            { club: "Parc Bryn Bach RC", seasons: "2019/2020 — Present" }
        ],
        "Steve DAVIES": [
            { club: "Pont-Y-Pwl & District Runners", seasons: "Debut — 2023/2024" },
            { club: "Griffithstown Harriers", seasons: "2023/2024 — Present" }
        ]
    },

    // 3. CROSS-CLUB NAMESAKES (Same name at different clubs = Different people, unless linked in clubHistory above)
    separateClubRunners: [
        "huw evans",
        "richard jones",
        "bethan williams",
        "brian evans",
        "chris baker",
        "claire orford",
        "david brown",
        "gareth jones",
        "gary jones",
        "grace williams",
        "helen williams",
        "ian davies",
        "james brown",
        "jane lewis",
        "keith davies",
        "owen davies",
        "rhys williams",
        "sian jones",
        "stephen smith",
        "steve davies",
        "andrew lawrence",
        "calvin thomas",
        "peter davies",
        "laura mcloughlin",
        "john evans",
        "paul morris",
        "neil smith",
        "andrew davies",
        "ceri williams",
        "chris davies",
        "chris morgan"
    ],

    // 4. CLUB ALIASES & REBRANDING MAPPING
    clubAliases: {
        "pontypool": "Pont-Y-Pwl & District Runners",
        "pont-y-pwl": "Pont-Y-Pwl & District Runners",
        "pont-y-pwl & district runners": "Pont-Y-Pwl & District Runners",
        "pont-y-pwl and district runners": "Pont-Y-Pwl & District Runners",
        "pont-y-pwl rc": "Pont-Y-Pwl & District Runners",

        "caldicot": "Caldicot Running Club",
        "caldicot running club": "Caldicot Running Club",
        "caldicot rc": "Caldicot Running Club",

        "usk": "Usk Runners",
        "usk runners": "Usk Runners",

        "parc bryn bach": "Parc Bryn Bach RC",
        "parc bryn bach rc": "Parc Bryn Bach RC",
        "pbb": "Parc Bryn Bach RC",
        "parcbrynbach": "Parc Bryn Bach RC",

        "lliswerry": "Lliswerry Runners",
        "lliswerry runners": "Lliswerry Runners",

        "chepstow": "Chepstow Harriers",
        "chepstow harriers": "Chepstow Harriers",

        "fairwater": "Fairwater Runners",
        "fairwater runners": "Fairwater Runners",

        "monmouth": "Spirit of Monmouth RC",
        "monmouth harriers": "Spirit of Monmouth RC",
        "spirit of monmouth": "Spirit of Monmouth RC",
        "spirit of monmouth rc": "Spirit of Monmouth RC",

        "caerleon": "Caerleon RC",
        "caerleon running club": "Caerleon RC",

        "islwyn": "Islwyn RC",
        "islwyn rc": "Islwyn RC",

        "abertillery": "Abertillery AC",
        "abertillery ac": "Abertillery AC",

        "gfiffithstown": "Griffithstown Harriers",
        "griffithstown": "Griffithstown Harriers",
        "griffithstown harriers": "Griffithstown Harriers",

        "club 69": "Club 69",
        "club69": "Club 69",
        "69": "Club 69"
    }
};

// Global helper utility to resolve any club variation to its canonical name
window.getCanonicalClub = function(rawClubName) {
    if (!rawClubName) return "Unattached";
    const cleanKey = String(rawClubName).trim().toLowerCase();
    const aliases = window.glclCorrections?.clubAliases || {};
    return aliases[cleanKey] || String(rawClubName).trim();
};

// Order-independent name key generator (e.g., "AHERNE Lee" & "Lee Aherne" -> "aherne lee")
// Preserves (Snr)/(Jnr) tokens as "snr"/"jnr" so disambiguated runners have distinct keys
window.getAthleteNameKey = function(str) {
    if (!str) return '';
    return String(str)
        .replace(/^†+\s*/, '')
        .replace(/([a-zA-Z])\((snr|jnr|sr|jr)\)/gi, '$1 ($2)')
        .replace(/[(),.]/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map(tok => {
            if (tok === 'sr') return 'snr';
            if (tok === 'jr') return 'jnr';
            return tok;
        })
        .sort()
        .join(' ');
};

// Base name key that strips snr/jnr and known middle-name disambiguations so namesakes can find each other
window.getAthleteBaseNameKey = function(str) {
    if (!str) return '';
    const rawKey = window.getAthleteNameKey(str);
    if (rawKey === 'jones richard thomas') return 'jones richard';
    return rawKey
        .split(/\s+/)
        .filter(tok => tok !== 'snr' && tok !== 'jnr')
        .join(' ');
};

// Title-case formatter that preserves (Snr) / (Jnr) suffixes cleanly
window.formatDisambiguatedName = function(str) {
    if (!str) return '';
    let clean = String(str)
        .replace(/^†+\s*/, '')
        .replace(/([a-zA-Z])\((snr|jnr|sr|jr)\)/gi, '$1 ($2)')
        .trim();

    return clean.split(/\s+/).map(part => {
        const lower = part.toLowerCase().replace(/[()]/g, '');
        if (lower === 'snr' || lower === 'sr') return '(Snr)';
        if (lower === 'jnr' || lower === 'jr') return '(Jnr)';
        if (part.includes('-')) {
            return part.split('-').map(p => p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '').join('-');
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
};

// Row-level disambiguation resolver: inspects { name, club, age_cat, bib, season } and returns resolved name & club
window.resolveRowAthlete = function(row) {
    if (!row || !row.name) return { name: '', club: 'Unattached', nameKey: '', profileKey: '' };

    const rawName = String(row.name).trim();
    const hadDagger = /^†+/.test(rawName);
    const canonClub = window.getCanonicalClub(row.club);
    const cat = String(row.age_cat || row.category || '').trim().toUpperCase();
    const bib = row.bib !== undefined && row.bib !== null ? String(row.bib).trim() : '';

    // Check explicit nameChanges first (for exact raw string or key match)
    const nameChanges = window.glclCorrections?.nameChanges || {};
    let workingName = rawName.replace(/^†+\s*/, '');

    if (nameChanges[rawName] && nameChanges[rawName].primaryName) {
        workingName = nameChanges[rawName].primaryName;
    } else {
        const rawKey = window.getAthleteNameKey(workingName);
        for (const [legacy, data] of Object.entries(nameChanges)) {
            if (data && data.primaryName && window.getAthleteNameKey(legacy) === rawKey) {
                workingName = data.primaryName;
                break;
            }
        }
    }

    const baseKey = window.getAthleteBaseNameKey(workingName);
    const currentKey = window.getAthleteNameKey(workingName);

    let resolvedAgeCat = row.age_cat;

    // INTRA-CLUB / SAME-NAME DISAMBIGUATION RULES
    // 1. Richard Jones at Lliswerry Runners:
    //    - Elite V45/V50 runner (+ 2024/25 Rogerstone XC#2 bib 1048) -> "Richard Jones (Snr)"
    //    - Mid-pack Senior runner (Richard Thomas JONES / †† Richard JONES / Senior bib 1153) -> "Richard Thomas Jones"
    if (baseKey === 'jones richard' && canonClub === 'Lliswerry Runners') {
        if (currentKey === 'jones richard thomas' || hadDagger) {
            workingName = 'Richard Thomas Jones';
        } else if (cat === 'SENIOR' && bib !== '1048') {
            workingName = 'Richard Thomas Jones';
        } else {
            workingName = 'Richard Jones (Snr)';
            if (bib === '1048' && cat === 'SENIOR') {
                resolvedAgeCat = 'V50';
            }
        }
    }
    // 2. Michael Lewis at Parc Bryn Bach RC & Fairwater Runners:
    //    - Older V70/V80+ runner always at Parc Bryn Bach RC (bibs 4595, 4581, 1046) -> "Michael Lewis (Snr)"
    //    - Younger Senior runner (Fairwater Runners -> Parc Bryn Bach RC) -> "Michael Lewis"
    else if (baseKey === 'lewis michael' && canonClub === 'Parc Bryn Bach RC') {
        if (/^V[678]\d/.test(cat) || ['4595', '4581', '1046'].includes(bib)) {
            workingName = 'Michael Lewis (Snr)';
        } else {
            workingName = 'Michael Lewis';
        }
    }
    // 3. Christopher Jones at Lliswerry Runners:
    //    - V40 runner (bibs 285, 501 in 2021/22–2024/25) -> "Christopher Jones (Jnr)"
    //    - V45->V65 veteran (91 races from 2005–2027, bibs 350..6099) -> "Christopher Jones (Snr)"
    else if (baseKey === 'christopher jones' && (canonClub === 'Lliswerry Runners' || canonClub === 'Unattached')) {
        if (['285', '501'].includes(bib) || (cat === 'V40' && String(row.season || '') >= '2021')) {
            workingName = 'Christopher Jones (Jnr)';
        } else {
            workingName = 'Christopher Jones (Snr)';
        }
    }
    // 4. Tracy Davies at Parc Bryn Bach RC:
    //    - V50 runner (†† Tracy DAVIES, bib 1113) -> "Tracy Davies (Snr)"
    //    - V40 runner (bib 1117) -> "Tracy Davies"
    else if (baseKey === 'davies tracy' && canonClub === 'Parc Bryn Bach RC') {
        if (hadDagger || cat === 'V50' || bib === '1113') {
            workingName = 'Tracy Davies (Snr)';
        } else {
            workingName = 'Tracy Davies';
        }
    }
    // 5. Mark Harvey at Chepstow Harriers:
    //    - V45/V50/V60 runner (bibs 403, 1603, 1605, 1017 or (sr)/(snr)) -> "Mark Harvey (Snr)"
    //    - V18/Senior runner (bibs 194, 1595, 1606 or (jr)/(jnr)) -> "Mark Harvey"
    else if (baseKey === 'harvey mark' && (canonClub === 'Chepstow Harriers' || canonClub === 'Unattached')) {
        if (currentKey.includes('snr') || /^V[456]\d/.test(cat) || ['403', '1603', '1605', '1017'].includes(bib)) {
            workingName = 'Mark Harvey (Snr)';
        } else {
            workingName = 'Mark Harvey';
        }
    }
    // 6. Steve Williams at Lliswerry Runners:
    //    - V50/V55/V60 runner (bibs 368, 3565, 3753, 3873 or (SNR)) -> "Steve Williams (Snr)"
    //    - V40/V45 runner (bibs 3843, 3874 or (JNR)) -> "Steve Williams (Jnr)"
    else if (baseKey === 'steve williams' && canonClub === 'Lliswerry Runners') {
        if (currentKey.includes('jnr') || ['3843', '3874'].includes(bib) || cat === 'V40' || cat === 'V45') {
            workingName = 'Steve Williams (Jnr)';
        } else {
            workingName = 'Steve Williams (Snr)';
        }
    }

    const finalDisplay = window.formatDisambiguatedName(workingName);
    const finalNameKey = window.getAthleteNameKey(finalDisplay);
    const clubGroupKey = window.getAthleteClubGroupKey(finalNameKey, canonClub);
    const profileKey = clubGroupKey ? `${finalNameKey}|${clubGroupKey}` : finalNameKey;

    return {
        name: finalDisplay,
        club: canonClub,
        age_cat: resolvedAgeCat,
        nameKey: finalNameKey,
        baseNameKey: window.getAthleteBaseNameKey(finalDisplay),
        clubGroupKey: clubGroupKey,
        profileKey: profileKey
    };
};

// Determines if a runner's identity should be scoped to their club (or clubHistory transfer group)
window.getAthleteClubGroupKey = function(nameKey, canonClub) {
    if (!nameKey) return '';
    const club = window.getCanonicalClub(canonClub);
    const clubLower = club.toLowerCase();
    const baseKey = window.getAthleteBaseNameKey(nameKey);

    const separateList = window.glclCorrections?.separateClubRunners || [];
    const isSeparate = separateList.some(n => window.getAthleteNameKey(n) === nameKey || window.getAthleteBaseNameKey(n) === baseKey);

    if (!isSeparate) {
        return ''; // Unified across all clubs (sequential transfer or single-club runner)
    }

    if (!club || clubLower === 'unattached' || clubLower === 'guest' || clubLower === 'independent') {
        return '';
    }

    // Check if this club belongs to a multi-club transfer group in clubHistory
    const clubHistory = window.glclCorrections?.clubHistory || {};
    for (const [histKey, histList] of Object.entries(clubHistory)) {
        const [histNamePart, histClubFilter] = histKey.split('|');
        if (window.getAthleteNameKey(histNamePart) === nameKey) {
            if (histClubFilter && window.getCanonicalClub(histClubFilter).toLowerCase() !== clubLower) {
                continue;
            }
            const clubsInGroup = histList.map(h => window.getCanonicalClub(h.club).toLowerCase());
            if (clubsInGroup.includes(clubLower)) {
                // Return the present/latest club in this transfer group as the canonical group key
                const presentClub = histList[histList.length - 1].club;
                return window.getCanonicalClub(presentClub).toLowerCase();
            }
        }
    }

    return clubLower;
};

// Resolves URL query params (?name=...&club=...) on athlete.html to the canonical profile identity
window.resolveTargetProfile = function(rawTargetName, rawTargetClub) {
    const canonClub = rawTargetClub ? window.getCanonicalClub(rawTargetClub) : '';
    const hadDagger = /^†+/.test(String(rawTargetName || '').trim());

    // First run through nameChanges
    const nameChanges = window.glclCorrections?.nameChanges || {};
    let resolvedName = String(rawTargetName || '').replace(/^†+\s*/, '').trim();

    if (nameChanges[resolvedName] && nameChanges[resolvedName].primaryName) {
        resolvedName = nameChanges[resolvedName].primaryName;
    } else {
        const targetKey = window.getAthleteNameKey(resolvedName);
        for (const [legacy, data] of Object.entries(nameChanges)) {
            if (data && data.primaryName && window.getAthleteNameKey(legacy) === targetKey) {
                resolvedName = data.primaryName;
                break;
            }
        }
    }

    const key = window.getAthleteNameKey(resolvedName);
    const baseKey = window.getAthleteBaseNameKey(resolvedName);

    // Handle URL shortcuts where suffix wasn't in URL (e.g. ?name=Richard%20JONES&club=Lliswerry%20Runners)
    if (baseKey === 'jones richard' && canonClub === 'Lliswerry Runners') {
        if (hadDagger || key === 'jones richard thomas') {
            resolvedName = 'Richard Thomas Jones';
        } else {
            resolvedName = 'Richard Jones (Snr)';
        }
    } else if (baseKey === 'christopher jones' && canonClub === 'Lliswerry Runners' && !key.includes('snr') && !key.includes('jnr')) {
        resolvedName = 'Christopher Jones (Snr)';
    } else if (baseKey === 'steve williams' && canonClub === 'Lliswerry Runners' && !key.includes('snr') && !key.includes('jnr')) {
        resolvedName = 'Steve Williams (Snr)';
    } else if (baseKey === 'davies tracy' && canonClub === 'Parc Bryn Bach RC' && hadDagger) {
        resolvedName = 'Tracy Davies (Snr)';
    }

    resolvedName = window.formatDisambiguatedName(resolvedName);
    const finalNameKey = window.getAthleteNameKey(resolvedName);
    const clubGroupKey = window.getAthleteClubGroupKey(finalNameKey, canonClub);

    // Find matching clubHistory entry (supports both "Name" and "Name|Club" keys)
    const clubHistory = window.glclCorrections?.clubHistory || {};
    let matchedClubHistory = null;
    for (const [histKey, histList] of Object.entries(clubHistory)) {
        const [histNamePart, histClubFilter] = histKey.split('|');
        if (window.getAthleteNameKey(histNamePart) === finalNameKey) {
            if (histClubFilter) {
                if (canonClub && window.getCanonicalClub(histClubFilter).toLowerCase() === canonClub.toLowerCase()) {
                    matchedClubHistory = histList;
                    break;
                }
            } else {
                // Ensure that if runner is club-scoped, the targetClub is actually part of this clubHistory group
                if (!clubGroupKey || !canonClub || histList.some(h => window.getCanonicalClub(h.club).toLowerCase() === canonClub.toLowerCase())) {
                    matchedClubHistory = histList;
                }
            }
        }
    }

    return {
        displayName: resolvedName,
        nameKey: finalNameKey,
        baseNameKey: window.getAthleteBaseNameKey(resolvedName),
        targetClub: canonClub,
        clubGroupKey: clubGroupKey,
        profileKey: clubGroupKey ? `${finalNameKey}|${clubGroupKey}` : finalNameKey,
        clubHistoryList: matchedClubHistory
    };
};
