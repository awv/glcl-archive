window.glclCorrections = window.glclCorrections || {
    // 1. MARRIAGE & SURNAME MERGES WITH EFFECTIVE YEAR
    nameChanges: {
        // The key MUST be the old name that sits in your legacy dataset rows
        "Antoinette Dumayne": {
            primaryName: "Antoinette Rose", // The new master profile name
            effectiveSeason: "2024/2025", 
            note: "Formerly competed as Antoinette Dumayne"
        },
        "Nicola Gething": {
            primaryName: "Nicola Jukes", // The new master profile name
            effectiveSeason: "2016/2017", 
            note: "Formerly competed as Nicola Gething"
        },
        "Sam Lewis-Jones": {
            primaryName: "Sam Jones", // The new master profile name
            effectiveSeason: "2017/2018", 
            note: "Formerly competed as Sam Lewis Jones"
        }
    },
    
    // 2. HISTORICAL CLUB TRANSITIONS TRACKING
    // (Used to display a clean career timeline on athlete.html)
    clubHistory: {
        "lloyd COTTRELL": [
            { club: "Lliswerry Runners", seasons: "Debut — 2023/2024" },
            { club: "Parc Bryn Bach RC", seasons: "2024/2025 — Present" }
        ],
        "Lee AHERNE": [
            { club: "Club 69", seasons: "Debut — 2007/2008" },
            { club: "Parc Bryn Bach RC", seasons: "2008/2009 — Present" }
        ]
    },

    // 3. CLUB ALIASES & REBRANDING MAPPING
    // Maps legacy, shorthand, or misspelled names to the master canonical name
    clubAliases: {
        "pontypool": "Pont-Y-Pwl & District Runners",
        "pont-y-pwl": "Pont-Y-Pwl & District Runners",
        "pont-y-pwl & district runners": "Pont-Y-Pwl & District Runners",
        "pont-y-pwl rc": "Pont-Y-Pwl & District Runners",

        "caldicot": "Caldicot Running Club",
        "caldicot running club": "Caldicot Running Club",

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

        "club 69": "Club 69",
        "club69": "Club 69",
        "69": "Club 69"
    }
};

// Global helper utility to resolve any club variation to its canonical name
window.getCanonicalClub = function(rawClubName) {
    if (!rawClubName) return "Unattached";
    
    const cleanKey = rawClubName.trim().toLowerCase();
    const aliases = window.glclCorrections?.clubAliases || {};
    
    return aliases[cleanKey] || rawClubName.trim();
};