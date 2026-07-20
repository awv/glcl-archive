// backend_tools/parse_fixtures.js
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'results_source');
const rootDataPath = path.join(__dirname, '../data.js');

// 1. Current format regex (with Bib, Age, Time, etc.)
const standardRowRegex = /^(\d+)\s+(\d+)\s+(.+?)\s+(\d+)\s+([MF])\s+(Senior|V\d+\+?)\s+(.+?)\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\d+)\r?$/;

// 2. Legacy pre-COVID format regex (Place, Bib, Name, Legacy Cat, Gender, Gen Pos, Cat Pos, Points...)
const legacyRowRegex = /^(\d+)\s+(\d+)\s+(.+?)\s+([MF]\d{4})\s+(MEN|LADIES)\s+(\d+)\s+(\d+)/i;

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

    const parsedResults = [];

    lines.forEach((line) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        if (cleanLine.startsWith('#')) {
            if (cleanLine.toUpperCase().startsWith('# VENUE:')) venue = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# DATE:')) date = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# DISTANCE:')) distance = cleanLine.split(':')[1].trim();
            if (cleanLine.toUpperCase().startsWith('# STATUS:')) status = cleanLine.split(':')[1].trim();
            return;
        }

        // TRY STANDARD TIMED FORMAT FIRST
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
                race_number, discipline, season, venue, date, distance, status
            });
            return;
        }

        // TRY LEGACY TIMINGless FORMAT SECOND
        const legacyMatch = cleanLine.match(legacyRowRegex);
        if (legacyMatch) {
            const [_, overallPos, rawBib, nameAndClub, rawCat, rawGender, genderPos, catPos] = legacyMatch;

            // Separate Name and Club by picking out known variations
            const words = nameAndClub.trim().split(' ');
            let name = "";
            let club = "";

            if (nameAndClub.includes("Parc Bryn Bach")) {
                club = "Parc Bryn Bach Rc";
                name = nameAndClub.replace("Parc Bryn Bach", "").trim();
            } else if (nameAndClub.includes("Pont-y-Pwl")) {
                club = "Pont-Y-Pwl & District Runners";
                name = nameAndClub.replace("Pont-y-Pwl", "").trim();
            } else if (nameAndClub.includes("Lliswerry")) {
                club = "Lliswerry Runners";
                name = nameAndClub.replace("Lliswerry", "").trim();
            } else if (nameAndClub.includes("Chepstow")) {
                club = "Chepstow Harriers";
                name = nameAndClub.replace("Chepstow", "").trim();
            } else {
                // Fallback for single word or unhandled clubs
                club = words[words.length - 1];
                name = words.slice(0, -1).join(' ');
            }

            // Normalise legacy category structures to match your standard look
            let ageCat = "Senior";
            const catDigits = rawCat.match(/\d+/);
            if (catDigits) {
                const ageNum = catDigits[0].substring(0, 2);
                if (ageNum !== '17' && ageNum !== '14') {
                    ageCat = `V${ageNum}`;
                }
            }

            parsedResults.push({
                pos: parseInt(overallPos, 10),
                bib: rawBib, 
                name: name,
                age: 0, 
                sex: rawGender.toUpperCase() === 'MEN' ? 'M' : 'F',
                age_cat: ageCat,
                club: club,
                time: "N/A", // Changed from 00:00:00 to N/A for clean rendering
                gender_pos: parseInt(genderPos, 10),
                cat_pos: parseInt(catPos, 10),
                race_number, discipline, season, venue, date, distance, status
            });
        }
    });

    if (status.toLowerCase() === 'cancelled' && parsedResults.length === 0) {
        parsedResults.push({
            race_number, discipline, season, venue, date, distance, status: "Cancelled",
            pos: 0, club: "", name: "", sex: "", age_cat: "", cat_pos: 0, gender_pos: 0
        });
    }

    console.log(`Parsed ${filename}: ${status === 'Cancelled' ? 'CANCELLED' : 'Found ' + parsedResults.length + ' finishers'} at ${venue}`);
    allCompiledResults = allCompiledResults.concat(parsedResults);
});

allCompiledResults.sort((a, b) => {
    if (a.season !== b.season) return b.season.localeCompare(a.season);
    if (a.discipline !== b.discipline) return a.discipline.localeCompare(b.discipline);
    if (a.race_number !== b.race_number) return a.race_number - b.race_number;
    return a.pos - b.pos;
});

const jsContent = `// This file is auto-generated by backend_tools/parse_fixtures.js. Do not edit manually.\nwindow.glclResults = ${JSON.stringify(allCompiledResults, null, 4)};\n`;
fs.writeFileSync(rootDataPath, jsContent, 'utf8');

console.log(`\nAutomated Build Success: Compiled ${allCompiledResults.length} total rows into root 'data.js'.`);