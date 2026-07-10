const fs = require('fs');
const path = require('path');

/**
 * Centralised Club Dictionary
 * Maps raw legacy text tokens directly to your master platform names
 */
const CLUB_DICTIONARY = {
    "Parc Bryn Bach": "Parc Bryn Bach Rc",
    "Lliswerry": "Lliswerry Runners",
    "Chepstow": "Chepstow Harriers",
    "Pont-y-Pwl": "Pont-y-Pwl & District Runners",
    "Monmouth": "Spirit of Monmouth",
    "Islwyn": "Islwyn Running Club",
    "Fairwater": "Fairwater Runners Cwmbran",
    "Griffithstown": "Griffithstown Harriers"
};

function parseAllLegacyFiles() {
    const sourceFolder = path.join(__dirname, '..', 'backend_tools', 'results_source');
    const outputFolder = path.join(__dirname, '..', 'backend_tools', 'processed_json');

    if (!fs.existsSync(sourceFolder)) {
        console.error(`Error: Source folder not found at ${sourceFolder}`);
        return;
    }

    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    // 1. Find all legacy cross-country files in the source directory
    // This targets files starting with 'xc_' to avoid touching your modern road files
    const files = fs.readdirSync(sourceFolder).filter(file => file.startsWith('xc_') && file.endsWith('.txt'));

    if (files.length === 0) {
        console.log("No legacy cross-country (.txt) files found to parse.");
        return;
    }

    console.log(`Found ${files.length} legacy file(s) to process...`);

    // 2. Loop through every file and parse it
    files.forEach(filename => {
        const filePath = path.join(sourceFolder, filename);
        
        // Extract meta from filename (e.g., xc_2019_2020_1.txt)
        const nameParts = filename.replace('.txt', '').split('_');
        const discipline = nameParts[0].toUpperCase();
        const season = `${nameParts[1]}/${nameParts[2]}`;
        const raceNumber = parseInt(nameParts[3], 10);

        const rawText = fs.readFileSync(filePath, 'utf-8');
        const lines = rawText.split('\n');
        
        let venue = "Unknown";
        let date = "Unknown";

        // Extract header metadata
        lines.forEach(line => {
            if (line.startsWith('# VENUE:')) venue = line.replace('# VENUE:', '').trim();
            if (line.startsWith('# DATE:')) date = line.replace('# DATE:', '').trim();
        });

        const knownClubs = Object.keys(CLUB_DICTIONARY);

        const results = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return null;

            const tokens = trimmed.split(/\s+/);
            if (tokens.length < 7 || isNaN(tokens[0])) return null;

            const pos = parseInt(tokens[0], 10);
            const bib = tokens[1];
            
            const catIdx = tokens.findIndex(t => /^[MF]\d{4}$/.test(t));
            if (catIdx === -1) return null;

            const middleText = tokens.slice(2, catIdx).join(' ');

            let rawClub = "";
            let name = middleText;

            for (const knownClub of knownClubs) {
                if (middleText.endsWith(knownClub)) {
                    rawClub = knownClub;
                    name = middleText.substring(0, middleText.length - knownClub.length).trim();
                    break;
                }
            }

            const club = CLUB_DICTIONARY[rawClub] || rawClub;

            const rawCat = tokens[catIdx];       
            const rawGender = tokens[catIdx + 1]; 
            const genderPos = parseInt(tokens[catIdx + 2], 10);
            const catPos = parseInt(tokens[catIdx + 3], 10);
            
            const sex = rawGender === 'LADIES' ? 'F' : 'M';
            
            let ageCat = 'SENIOR';
            if (rawCat) {
                const ageGroup = rawCat.substring(1); 
                if (ageGroup !== '1739' && ageGroup !== '1734') {
                    ageCat = 'V' + ageGroup.substring(0, 2); 
                }
            }

            return {
                season: season,
                discipline: discipline,
                race_number: raceNumber,
                venue: venue,
                date: date,
                pos: pos,
                bib: bib,
                name: name,
                sex: sex,
                age_cat: ageCat,
                club: club,
                gender_pos: genderPos,
                cat_pos: catPos,
                time: "" 
            };
        }).filter(Boolean);

        // Save the JSON output matching the source name
        const outputFilename = filename.replace('.txt', '.json');
        const outputPath = path.join(outputFolder, outputFilename);
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
        console.log(`  ✔ Processed ${filename} -> ${results.length} records saved.`);
    });

    console.log("All legacy files updated successfully.");
}

parseAllLegacyFiles();