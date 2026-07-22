// backend_tools/parse_fixtures.js
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'results_source');
const rootDataPath = path.join(__dirname, '../data.js');

// 1. Current format regex (with Bib, Age, Time, etc.)
const standardRowRegex = /^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+([MF])\s+(Senior|V\d+\+?)\s+(.+?)\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\d+)\r?$/i;

// 2. Legacy pre-COVID format regex (with explicit gender place column)
const legacyRowRegex = /^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+([MF]\d{4})\s+(MEN|LADIES)\s+(\d+)\s+(\d+)/i;

// 3. Legacy pre-COVID format regex WITHOUT explicit gender place column
// Matches: Pos Bib Name Club Cat CatPos
const legacyNoGenderPosRegex = /^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+([MF]\d{4}|\b[MF]\b)\s+(\d+)/i;

// 4. Legacy format with ignored Finish Token: Pos Token Bib NameAndClub Cat CatPos
// Matches: "1 11 952 Matthew SYMES Pont-Y-Pwl M1739 1"
const legacyTokenRegex = /^(\d+)\s+(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+([MF]\d{4}|\b[MF]\b)\s+(\d+)/i;

// Unknown runners
const unknownRowRegex = /^\s*(\d+)\s+(\d+)\s+(UNKNOWN|GUEST|ANON)\b/i;

let allCompiledResults = [];

if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory ${sourceDir} does not exist.`);
    process.exit(1);
}

// Read all source text files
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
    let status = "Confirmed"; // Default status
    let notes = ""; // Optional historical notes
    let race_section = "Main"; // Default section title

    const parsedResults = [];

    // Track gender places dynamically for files missing the explicit column
    let maleCount = 0;
    let femaleCount = 0;

    lines.forEach((line) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        if (cleanLine.startsWith('#')) {
            if (cleanLine.toUpperCase().startsWith('# VENUE:')) venue = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# DATE:')) date = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# DISTANCE:')) distance = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# STATUS:')) status = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# NOTES:')) notes = cleanLine.split(':').slice(1).join(':').trim();
            if (cleanLine.toUpperCase().startsWith('# SECTION:')) {
                race_section = cleanLine.split(':')[1].trim();
                // Reset gender counters for each new race section
                maleCount = 0;
                femaleCount = 0;
            }
            return;
        }

        // RULE 0: TRY UNKNOWN / GUEST ATHLETE FORMAT
        const unknownMatch = cleanLine.match(unknownRowRegex);
        if (unknownMatch) {
            const overallPos = parseInt(unknownMatch[1], 10);
            const rawBib = unknownMatch[2];
            const nameLabel = unknownMatch[3].toUpperCase();

            parsedResults.push({
                pos: overallPos,
                bib: (rawBib && rawBib !== '0') ? rawBib : '-',
                name: nameLabel === 'UNKNOWN' ? 'Unknown Runner' : nameLabel,
                age: 0,
                sex: 'N/A',
                age_cat: 'N/A',
                club: 'Unknown',
                time: 'N/A',
                gender_pos: 0,
                cat_pos: 0,
                race_number,
                discipline,
                season,
                venue,
                date,
                distance,
                status,
                notes,
                race_section
            });
            return;
        }

        // RULE 1: TRY STANDARD TIMED FORMAT
        const standardMatch = cleanLine.match(standardRowRegex);
        if (standardMatch) {
            parsedResults.push({
                pos: parseInt(standardMatch[1], 10),
                bib: standardMatch[2],
                name: standardMatch[3].trim(),
                age: parseInt(standardMatch[4], 10),
                sex: standardMatch[5],
                age_cat: standardMatch[6],
                club: standardMatch[7].trim(),
                time: standardMatch[8],
                gender_pos: parseInt(standardMatch[9], 10),
                cat_pos: parseInt(standardMatch[10], 10),
                race_number,
                discipline,
                season,
                venue,
                date,
                distance,
                status,
                notes,
                race_section
            });
            return;
        }

        // RULE 2: TRY LEGACY FORMAT WITH EXPLICIT GENDER PLACE
        const legacyMatch = cleanLine.match(legacyRowRegex);
        if (legacyMatch) {
            const [_, overallPos, rawBib, nameAndClub, rawCat, rawGender, genderPos, catPos] = legacyMatch;
            
            const words = nameAndClub.trim().split(' ');
            let name = "";
            let club = "";

            if (nameAndClub.includes("Parc Bryn Bach")) { club = "Parc Bryn Bach Rc"; name = nameAndClub.replace("Parc Bryn Bach", "").trim(); }
            else if (nameAndClub.includes("Pont-y-Pwl")) { club = "Pont-Y-Pwl & District Runners"; name = nameAndClub.replace("Pont-y-Pwl", "").trim(); }
            else if (nameAndClub.includes("Lliswerry")) { club = "Lliswerry Runners"; name = nameAndClub.replace("Lliswerry", "").trim(); }
            else if (nameAndClub.includes("Chepstow")) { club = "Chepstow Harriers"; name = nameAndClub.replace("Chepstow", "").trim(); }
            else { club = words[words.length - 1]; name = words.slice(0, -1).join(' '); }

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
                club: club,
                time: "N/A",
                gender_pos: parseInt(genderPos, 10),
                cat_pos: parseInt(catPos, 10),
                race_number,
                discipline,
                season,
                venue,
                date,
                distance,
                status,
                notes,
                race_section
            });
            return;
        }

        // RULE 4: TRY LEGACY FORMAT WITH FINISH TOKEN (IGNORED) - TEST BEFORE RULE 3 TO PREVENT OVERLAP
        const legacyTokenMatch = cleanLine.match(legacyTokenRegex);
        if (legacyTokenMatch) {
            const [_, overallPos, finishToken, realBib, nameAndClub, rawCat, rawCatPos] = legacyTokenMatch;

            const words = nameAndClub.trim().split(' ');
            let name = "";
            let club = "";

            if (nameAndClub.includes("Parc Bryn Bach")) { club = "Parc Bryn Bach Rc"; name = nameAndClub.replace("Parc Bryn Bach", "").trim(); }
            else if (nameAndClub.includes("Pont-Y-Pwl")) { club = "Pont-Y-Pwl & District Runners"; name = nameAndClub.replace("Pont-Y-Pwl", "").trim(); }
            else if (nameAndClub.includes("Pont-y-Pwl")) { club = "Pont-Y-Pwl & District Runners"; name = nameAndClub.replace("Pont-y-Pwl", "").trim(); }
            else if (nameAndClub.includes("Lliswerry")) { club = "Lliswerry Runners"; name = nameAndClub.replace("Lliswerry", "").trim(); }
            else if (nameAndClub.includes("Chepstow")) { club = "Chepstow Harriers"; name = nameAndClub.replace("Chepstow", "").trim(); }
            else if (nameAndClub.includes("Monmouth")) { club = "Monmouth Harriers"; name = nameAndClub.replace("Monmouth", "").trim(); }
            else if (nameAndClub.includes("Caerleon")) { club = "Caerleon RC"; name = nameAndClub.replace("Caerleon", "").trim(); }
            else if (nameAndClub.includes("Fairwater")) { club = "Fairwater Runners"; name = nameAndClub.replace("Fairwater", "").trim(); }
            else { club = words[words.length - 1]; name = words.slice(0, -1).join(' '); }

            const isFemale = rawCat.toUpperCase().startsWith('F');
            const sex = isFemale ? 'F' : 'M';

            let computedGenderPos = 0;
            if (isFemale) {
                femaleCount++;
                computedGenderPos = femaleCount;
            } else {
                maleCount++;
                computedGenderPos = maleCount;
            }

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
                club: club,
                time: "N/A",
                gender_pos: computedGenderPos,
                cat_pos: parseInt(rawCatPos, 10),
                race_number,
                discipline,
                season,
                venue,
                date,
                distance,
                status,
                notes,
                race_section
            });
            return;
        }

        // RULE 3: TRY LEGACY FORMAT WITHOUT EXPLICIT GENDER PLACE (2 NUMBERS AT START)
        const legacyNoGenMatch = cleanLine.match(legacyNoGenderPosRegex);
        if (legacyNoGenMatch) {
            const [_, overallPos, realBib, nameAndClub, rawCat, rawCatPos] = legacyNoGenMatch;

            const words = nameAndClub.trim().split(' ');
            let name = "";
            let club = "";

            if (nameAndClub.includes("Parc Bryn Bach")) { club = "Parc Bryn Bach Rc"; name = nameAndClub.replace("Parc Bryn Bach", "").trim(); }
            else if (nameAndClub.includes("Pont-y-Pwl")) { club = "Pont-Y-Pwl & District Runners"; name = nameAndClub.replace("Pont-y-Pwl", "").trim(); }
            else if (nameAndClub.includes("Lliswerry")) { club = "Lliswerry Runners"; name = nameAndClub.replace("Lliswerry", "").trim(); }
            else if (nameAndClub.includes("Chepstow")) { club = "Chepstow Harriers"; name = nameAndClub.replace("Chepstow", "").trim(); }
            else if (nameAndClub.includes("Monmouth")) { club = "Monmouth Harriers"; name = nameAndClub.replace("Monmouth", "").trim(); }
            else if (nameAndClub.includes("Caerleon")) { club = "Caerleon RC"; name = nameAndClub.replace("Caerleon", "").trim(); }
            else { club = words[words.length - 1]; name = words.slice(0, -1).join(' '); }

            const isFemale = rawCat.toUpperCase().startsWith('F');
            const sex = isFemale ? 'F' : 'M';

            let computedGenderPos = 0;
            if (isFemale) {
                femaleCount++;
                computedGenderPos = femaleCount;
            } else {
                maleCount++;
                computedGenderPos = maleCount;
            }

            let ageCat = "Senior";
            const catDigits = rawCat.match(/\d+/);
            if (catDigits && catDigits[0].substring(0, 2) !== '17' && catDigits[0].substring(0, 2) !== '14') {
                ageCat = `V${catDigits[0].substring(0, 2)}`;
            }

            let catPosVal = rawCatPos ? parseInt(rawCatPos, 10) : 0;
            if (catPosVal > 50) {
                catPosVal = parsedResults.filter(r => r.race_section === race_section && r.age_cat === ageCat).length + 1;
            }

            parsedResults.push({
                pos: parseInt(overallPos, 10),
                bib: realBib,
                name: name,
                age: 0,
                sex: sex,
                age_cat: ageCat,
                club: club,
                time: "N/A", // Keeps timing consistent across legacy fixtures
                gender_pos: computedGenderPos,
                cat_pos: catPosVal,
                race_number,
                discipline,
                season,
                venue,
                date,
                distance,
                status,
                notes,
                race_section
            });
            return;
        }
    });

    // Handle cancelled or missing results placeholder state if no runner rows were parsed
    const statusLower = status.toLowerCase();
    if ((statusLower === 'cancelled' || statusLower === 'results missing') && parsedResults.length === 0) {
        parsedResults.push({
            race_number,
            discipline,
            season,
            venue,
            date,
            distance,
            status: statusLower === 'results missing' ? 'Results Missing' : 'Cancelled',
            notes,
            pos: 0, 
            club: "", 
            name: "", 
            sex: "", 
            age_cat: "", 
            cat_pos: 0, 
            gender_pos: 0,
            race_section
        });
    }

    // Dynamic terminal log reporting
    let logStatus = 'Found ' + parsedResults.length + ' finishers';
    if (statusLower === 'cancelled') logStatus = 'CANCELLED';
    if (statusLower === 'results missing') logStatus = 'RESULTS MISSING';

    console.log(`Parsed ${filename}: ${logStatus} at ${venue}`);
    allCompiledResults = allCompiledResults.concat(parsedResults);
});

// Sort the compiled results globally by season, discipline, race number, then position
allCompiledResults.sort((a, b) => {
    if (a.season !== b.season) return b.season.localeCompare(a.season);
    if (a.discipline !== b.discipline) return a.discipline.localeCompare(b.discipline);
    if (a.race_number !== b.race_number) return a.race_number - b.race_number;
    return a.pos - b.pos;
});

// Write directly out to root data.js
const jsContent = `// This file is auto-generated by backend_tools/parse_fixtures.js. Do not edit manually.\nwindow.glclResults = ${JSON.stringify(allCompiledResults, null, 4)};\n`;
fs.writeFileSync(rootDataPath, jsContent, 'utf8');

console.log(`\nAutomated Build Success: Compiled ${allCompiledResults.length} total rows into root 'data.js'.`);