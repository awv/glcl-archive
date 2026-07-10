window.glclCorrections = {
    // 1. MARRIAGE & SURNAME MERGES WITH EFFECTIVE YEAR
        nameChanges: {
        // The key MUST be the old name that sits in your legacy dataset rows
        "Antoinette Dumayne": {
            primaryName: "Antoinette Rose", // The new master profile name
            effectiveSeason: "2024/2025", 
            note: "Formerly competed as Antoinette Dumayne"
        }
    },
    
    // 2. HISTORICAL CLUB TRANSITIONS TRACKING
    // (Used to display a clean career timeline on athlete.html)
    clubHistory: {
        "lloyd COTTRELL": [
            { club: "Lliswerry Runners", seasons: "Debut — 2023/2024" },
            { club: "Parc Bryn Bach Rc", seasons: "2024/2025 — Present" }
        ]
    }
};