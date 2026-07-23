// backend_tools/parse_fixtures.js
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'results_source');
const rootDataPath = path.join(__dirname, '../data.js');

// --- MASTER CLUB ALIAS MAPPER ---
const clubAliases = {
    "pontypool": "Pont-Y-Pwl & District Runners",
    "pont-y-pwl": "Pont-Y-Pwl & District Runners",
    "pont-y-pwl & district runners": "Pont-Y-Pwl & District Runners",
    "pont-y-pwl rc": "Pont-Y-Pwl & District Runners",

    "parc bryn bach": "Parc Bryn Bach RC",
    "parc bryn bach rc": "Parc Bryn Bach RC",
    "pbb": "Parc Bryn Bach RC",

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
    "islwyn rc": "Islwyn RC"
};

function normalizeClub(rawClub) {
    if (!rawClub) return "Unattached";
    const key = rawClub.trim().toLowerCase();
    return clubAliases[key] || rawClub.trim();
}

// Shared extraction helper for legacy Name and Club combinations
function extractNameAndClub(rawStr) {
    let cleanStr = rawStr.replace(/,/g, '').trim();

    let rawClub = "";
    let name = "";

    if (cleanStr.includes("Parc Bryn Bach")) { rawClub = "Parc Bryn Bach RC"; name = cleanStr.replace("Parc Bryn Bach", "").trim(); }
    else if (cleanStr.includes("Pont-y-Pwl") || cleanStr.includes("Pont-Y-Pwl")) { rawClub = "Pont-Y-Pwl & District Runners"; name = cleanStr.replace(/Pont-[yY]-Pwl/g, "").trim(); }
    else if (cleanStr.includes("Lliswerry")) { rawClub = "Lliswerry Runners"; name = cleanStr.replace("Lliswerry", "").trim(); }
    else if (cleanStr.includes("Chepstow")) { rawClub = "Chepstow Harriers"; name = cleanStr.replace("Chepstow", "").trim(); }
    else if (cleanStr.includes("Spirit of Monmouth")) { rawClub = "Spirit of Monmouth RC"; name = cleanStr.replace("Spirit of Monmouth", "").trim(); }
    else if (cleanStr.includes("Monmouth")) { rawClub = "Spirit of Monmouth RC"; name = cleanStr.replace("Monmouth", "").trim(); }
    else if (cleanStr.includes("Caerleon")) { rawClub = "Caerleon RC"; name = cleanStr.replace("Caerleon", "").trim(); }
    else if (cleanStr.includes("Fairwater")) { rawClub = "Fairwater Runners"; name = cleanStr.replace("Fairwater", "").trim(); }
    else if (cleanStr.includes("Griffithstown")) { rawClub = "Griffithstown Harriers"; name = cleanStr.replace("Griffithstown", "").trim(); }
    else if (cleanStr.includes("Islwyn")) { rawClub = "Islwyn RC"; name = cleanStr.replace("Islwyn", "").trim(); }
    else {
        const words = cleanStr.split(/\s+/);
        rawClub = words[words.length - 1] || "";
        name = words.slice(0, -1).join(' ');
    }

    return { name: name.trim(), rawClub: rawClub.trim() };
}

// REGEX MATCHERS
// 1. Current format regex
const standardRowRegex = /^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+([MF])\s+(Senior|V\d+\+?)\s+(.+?)\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\d+)/i;

// 2. Legacy pre-COVID format regex (with explicit gender place)
const legacyRowRegex = /^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+([MF]\d{4}|[MF]\d+)\s+(MEN|LADIES)\s+(\d+)\s+(\d+)/i;

// 3. Legacy format with Points at end: Pos Token Bib NameAndClub Cat CatPos Points Score
// Example: "1 24 4603 Jamie PARRY Parc Bryn Bach M1739 1 1000 100"
const legacyPointsRegex = /^(\d+)\s+(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+([MF]\d{4}|[MF]\d+|\b[MF]\b)\s+(\d+)(?:\s+\d+)+/i;

const unknownRowRegex = /^\s*(\d+)\s+([A-Z0-9]+)?\s*(UNKNOWN|GUEST|ANON)\b/i;

let allCompiledResults = [];

if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory ${sourceDir} does not exist.`);
    process.exit(1);
}

const files = fs.readdirSync(sourceDir);

files.forEach(filename => {
    if (!filename.endsWith('.txt')) return;

    const parts = filename.replace('.txt', '').split('_');
    if (parts.length < 4) return;

    const discipline = parts[0];
    const season = `${parts[1]}/${parts[2]}`;
    const race_number = parseInt(parts[3], 10);

    const filePath = path.join(sourceDir, filename);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    let venue = "Unknown Venue";
    let date = "";
    let distance = "";
    let status = "Confirmed";
    let notes = "";
    let race_section = "Main";

    const parsedResults = [];

    let maleCount = 0;
    let femaleCount = 0;

    lines.forEach((line) => {
        let cleanLine = line.trim();
        if (!cleanLine) return;

        if (cleanLine.startsWith('#')) {
            if (cleanLine.toUpperCase().startsWith('# VENUE:')) venue = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# DATE:')) date = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# DISTANCE:')) distance = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# STATUS:')) status = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# NOTES:')) notes = cleanLine.split(':').slice(1).join(':').trim();
            if (cleanLine.toUpperCase().startsWith('# SECTION:')) {
                race_section = cleanLine.split(':')[1].trim();
                maleCount = 0;
                femaleCount = 0;
            }
            return;
        }

        // RULE 0: UNKNOWN ATHLETES
        const unknownMatch = cleanLine.match(unknownRowRegex);
        if (unknownMatch) {
            parsedResults.push({
                pos: parseInt(unknownMatch[1], 10),
                bib: unknownMatch[2] || '-',
                name: 'Unknown Runner',
                age: 0,
                sex: 'N/A',
                age_cat: 'N/A',
                club: 'Unknown',
                time: 'N/A',
                gender_pos: 0,
                cat_pos: 0,
                race_number, discipline, season, venue, date, distance, status, notes, race_section
            });
            return;
        }

        // RULE 1: STANDARD TIMED FORMAT
        const standardMatch = cleanLine.match(standardRowRegex);
        if (standardMatch) {
            parsedResults.push({
                pos: parseInt(standardMatch[1], 10),
                bib: standardMatch[2],
                name: standardMatch[3].replace(/,/g, '').trim(),
                age: parseInt(standardMatch[4], 10),
                sex: standardMatch[5],
                age_cat: standardMatch[6],
                club: normalizeClub(standardMatch[7]),
                time: standardMatch[8],
                gender_pos: parseInt(standardMatch[9], 10),
                cat_pos: parseInt(standardMatch[10], 10),
                race_number, discipline, season, venue, date, distance, status, notes, race_section
            });
            return;
        }

        // RULE 2: LEGACY FORMAT WITH EXPLICIT GENDER PLACE
        const legacyMatch = cleanLine.match(legacyRowRegex);
        if (legacyMatch) {
            const [_, overallPos, rawBib, rawNameAndClub, rawCat, rawGender, genderPos, catPos] = legacyMatch;
            const { name, rawClub } = extractNameAndClub(rawNameAndClub);

            let ageCat = "Senior";
            const catDigits = rawCat.match(/\d+/);
            if (catDigits && catDigits[0].substring(0, 2) !== '17' && catDigits[0].substring(0, 2) !== '14') {
                ageCat = `V${catDigits[0].substring(0, 2)}`;
            }

            parsedResults.push({
                pos: parseInt(overallPos, 10),
                bib: rawBib,
                name: name,
                age: 0,
                sex: rawGender.toUpperCase() === 'MEN' ? 'M' : 'F',
                age_cat: ageCat,
                club: normalizeClub(rawClub),
                time: "N/A",
                gender_pos: parseInt(genderPos, 10),
                cat_pos: parseInt(catPos, 10),
                race_number, discipline, season, venue, date, distance, status, notes, race_section
            });
            return;
        }

        // RULE 3: LEGACY WITH SCORE/POINTS AT END
        const pointsMatch = cleanLine.match(legacyPointsRegex);
        if (pointsMatch) {
            const [_, overallPos, finishToken, realBib, rawNameAndClub, rawCat, rawCatPos] = pointsMatch;
            const { name, rawClub } = extractNameAndClub(rawNameAndClub);

            const isFemale = rawCat.toUpperCase().startsWith('F');
            const sex = isFemale ? 'F' : 'M';
            let computedGenderPos = isFemale ? ++femaleCount : ++maleCount;

            let ageCat = "Senior";
            const catDigits = rawCat.match(/\d+/);
            if (catDigits && catDigits[0].substring(0, 2) !== '17' && catDigits[0].substring(0, 2) !== '14') {
                ageCat = `V${catDigits[0].substring(0, 2)}`;
            }

            parsedResults.push({
                pos: parseInt(overallPos, 10),
                bib: realBib,
                name: name,
                age: 0,
                sex: sex,
                age_cat: ageCat,
                club: normalizeClub(rawClub),
                time: "N/A",
                gender_pos: computedGenderPos,
                cat_pos: parseInt(rawCatPos, 10),
                race_number, discipline, season, venue, date, distance, status, notes, race_section
            });
            return;
        }

        // RULE 4: GENERAL TOKEN-BASED FALLBACK
        const tokenSplit = cleanLine.split(/\s+/);
        if (tokenSplit.length >= 4 && !isNaN(tokenSplit[0])) {
            const overallPos = parseInt(tokenSplit[0], 10);
            
            let realBib = tokenSplit[1];
            let nameClubStartIdx = 2;

            if (tokenSplit.length >= 5 && !isNaN(tokenSplit[1]) && !isNaN(tokenSplit[2])) {
                realBib = tokenSplit[2];
                nameClubStartIdx = 3;
            }

            // Find category token (e.g., M1739, M4044, F5054, Senior)
            let catIndex = -1;
            for (let i = tokenSplit.length - 1; i >= nameClubStartIdx; i--) {
                if (/^([MF]\d+|\b[MF]\b|Senior|V\d+)/i.test(tokenSplit[i])) {
                    catIndex = i;
                    break;
                }
            }

            let rawCat = "Senior";
            let rawCatPos = "0";
            let nameClubEndIdx = tokenSplit.length;

            if (catIndex !== -1) {
                rawCat = tokenSplit[catIndex];
                nameClubEndIdx = catIndex;
                if (catIndex + 1 < tokenSplit.length && !isNaN(tokenSplit[catIndex + 1])) {
                    rawCatPos = tokenSplit[catIndex + 1];
                }
            }

            const rawNameAndClub = tokenSplit.slice(nameClubStartIdx, nameClubEndIdx).join(' ');
            const { name, rawClub } = extractNameAndClub(rawNameAndClub);

            const isFemale = rawCat.toUpperCase().startsWith('F');
            const sex = isFemale ? 'F' : 'M';

            let computedGenderPos = isFemale ? ++femaleCount : ++maleCount;

            let ageCat = "Senior";
            const catDigits = rawCat.match(/\d+/);
            if (catDigits && catDigits[0].substring(0, 2) !== '17' && catDigits[0].substring(0, 2) !== '14') {
                ageCat = `V${catDigits[0].substring(0, 2)}`;
            }

            parsedResults.push({
                pos: overallPos,
                bib: realBib,
                name: name || "Unknown Runner",
                age: 0,
                sex: sex,
                age_cat: ageCat,
                club: normalizeClub(rawClub),
                time: "N/A",
                gender_pos: computedGenderPos,
                cat_pos: parseInt(rawCatPos, 10) || 0,
                race_number, discipline, season, venue, date, distance, status, notes, race_section
            });
            return;
        }
    });

    const statusLower = status.toLowerCase();
    if ((statusLower === 'cancelled' || statusLower === 'results missing') && parsedResults.length === 0) {
        parsedResults.push({
            race_number, discipline, season, venue, date, distance,
            status: statusLower === 'results missing' ? 'Results Missing' : 'Cancelled',
            notes, pos: 0, club: "", name: "", sex: "", age_cat: "", cat_pos: 0, gender_pos: 0, race_section
        });
    }

    let logStatus = 'Found ' + parsedResults.length + ' finishers';
    if (statusLower === 'cancelled') logStatus = 'CANCELLED';
    if (statusLower === 'results missing') logStatus = 'RESULTS MISSING';

    console.log(`Parsed ${filename}: ${logStatus} at ${venue}`);
    allCompiledResults = allCompiledResults.concat(parsedResults);
});

allCompiledResults.sort((a, b) => {
    if (a.season !== b.season) return b.season.localeCompare(a.season);
    if (a.discipline !== b.discipline) return a.discipline.localeCompare(b.discipline);
    if (a.race_number !== b.race_number) return a.race_number - b.race_number;
    return a.pos - b.pos;
});

const jsContent = `// Auto-generated by backend_tools/parse_fixtures.js\nwindow.glclResults = ${JSON.stringify(allCompiledResults, null, 4)};\n`;
fs.writeFileSync(rootDataPath, jsContent, 'utf8');

console.log(`\nAutomated Build Success: Compiled ${allCompiledResults.length} total rows into root 'data.js'.`);