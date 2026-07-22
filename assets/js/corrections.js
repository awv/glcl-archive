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
            { club: "Parc Bryn Bach Rc", seasons: "2024/2025 — Present" }
        ]
    },

    // 3. CLUB ALIASES & REBRANDING MAPPING
    // Maps legacy, shorthand, or misspelled names to the master canonical name
    clubAliases: {
        "pont-y-pwl": "Pont-Y-Pwl & District Runners",
        "pont-y-pwl & district runners": "Pont-Y-Pwl & District Runners",
        "pontypool": "Pont-Y-Pwl & District Runners",
        
        "parc bryn bach": "Parc Bryn Bach RC",
        "parc bryn bach rc": "Parc Bryn Bach RC",
        "pbb": "Parc Bryn Bach RC",
        
        "lliswerry": "Lliswerry Runners",
        "lliswerry runners": "Lliswerry Runners",
        
        "chepstow": "Chepstow Harriers",
        "chepstow harriers": "Chepstow Harriers",
        
        "fairwater": "Fairwater Runners",
        "fairwater runners": "Fairwater Runners",
        
        "monmouth": "Monmouth Harriers",
        "caerleon": "Caerleon RC"
    }
};

// Global helper utility to resolve any club variation to its canonical name
window.getCanonicalClub = function(rawClubName) {
    if (!rawClubName) return "Unattached";
    
    const cleanKey = rawClubName.trim().toLowerCase();
    const aliases = window.glclCorrections?.clubAliases || {};
    
    return aliases[cleanKey] || rawClubName.trim();
};