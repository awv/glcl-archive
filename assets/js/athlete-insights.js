/**
 * GLCL Archive - Universal Athlete Insights Generator
 * Processes an athlete's race history to compute trends, charts, and course progress.
 */

function generateAthleteInsights(athleteResults) {
    // 1. Define thresholds
    const MIN_RACES_FOR_TREND = 3;

    // Ensure chronologically oldest to newest for trend tracking
    const chronologicalResults = [...athleteResults].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Fallback/Empty State if the runner doesn't have enough data
    if (chronologicalResults.length < MIN_RACES_FOR_TREND) {
        return {
            hasEnoughData: false,
            summaryCard: {
                title: "League Status",
                value: "Rising Star",
                subtext: `Debuted on ${chronologicalResults[0]?.date || 'Unknown'}`
            },
            svgPath: "",
            venueProgress: []
        };
    }

    // 2. Calculate Macro Summary Card Data (Gender Position Trend)
    // We use Gender Position as it is the most accurate reflection of pure form
    const validGenderPositions = chronologicalResults
        .map(r => parseInt(r.gender_pos, 10))
        .filter(pos => !isNaN(pos));

    let summaryCard = { title: "Overall Progress", value: "Stable", subtext: "Consistent form across seasons" };
    
    if (validGenderPositions.length >= 2) {
        const firstPos = validGenderPositions[0];
        const lastPos = validGenderPositions[validGenderPositions.length - 1];
        const delta = firstPos - lastPos; // Positive means they moved closer to 1st place

        if (delta > 0) {
            summaryCard = {
                title: "Overall Progress",
                value: `↑ ${delta} Places`,
                subtext: `Climbed since debut (Pos ${firstPos} to Pos ${lastPos})`
            };
        } else if (delta < 0) {
            summaryCard = {
                title: "Overall Progress",
                value: `↓ ${Math.abs(delta)} Places`,
                subtext: `Positions shifted over time`
            };
        } else if (firstPos <= 5) {
            summaryCard = {
                title: "League Status",
                value: "Elite Tier",
                subtext: "Consistently dominating the front field"
            };
        }
    }

    // 3. Generate Inverted SVG Sparkline Path
    // Maps gender positions to an SVG bounding box of 300x60
    let svgPath = "";
    if (validGenderPositions.length >= 2) {
        const width = 300;
        const height = 60;
        const padding = 5;
        
        const minPos = Math.min(...validGenderPositions);
        const maxPos = Math.max(...validGenderPositions);
        const posRange = maxPos - minPos || 1;

        const points = validGenderPositions.map((pos, index) => {
            const x = padding + (index / (validGenderPositions.length - 1)) * (width - padding * 2);
            // Invert Y-axis: Best position (minPos) gets lowest Y coordinate (top of chart)
            const y = padding + ((pos - minPos) / posRange) * (height - padding * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        });

        svgPath = `M ${points.join(' L ')}`;
    }

    // 4. Calculate Granular Venue Progress (Repeating Courses)
    const venueGroups = {};
    chronologicalResults.forEach(race => {
        if (!race.venue || race.venue === "Unknown") return;
        if (!venueGroups[race.venue]) {
            venueGroups[race.venue] = [];
        }
        venueGroups[race.venue].push(race);
    });

    const venueProgress = [];
    Object.keys(venueGroups).forEach(venueName => {
        const races = venueGroups[venueName];
        if (races.length >= 2) {
            const debutRace = races[0];
            const recentRace = races[races.length - 1];
            
            const debutPos = parseInt(debutRace.overall_pos || debutRace.pos, 10);
            const recentPos = parseInt(recentRace.overall_pos || recentRace.pos, 10);
            const delta = debutPos - recentPos; // Positive means improvement

            if (!isNaN(debutPos) && !isNaN(recentPos)) {
                venueProgress.push({
                    venue: venueName,
                    discipline: debutRace.discipline,
                    debutStr: `Pos ${debutPos} (${debutRace.season.split('/')[0]})`,
                    recentStr: `Pos ${recentPos} (${recentRace.season.split('/')[0]})`,
                    delta: delta,
                    progressStr: delta > 0 ? `↑ ${delta} places` : delta < 0 ? `↓ ${Math.abs(delta)} places` : "Stable"
                });
            }
        }
    });

    // Sort venue table by biggest improvement first
    venueProgress.sort((a, b) => b.delta - a.delta);

    return {
        hasEnoughData: true,
        summaryCard,
        svgPath,
        venueProgress
    };
}