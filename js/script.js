// --- Configuration ---
const SHEET_ID = "1dAXks7FBX-LN130hMCEWBz5JcSqM1lijBhxAejuNgco";
const GID = "1297922850";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

// Local Map Data (Make sure Boundary.json is in your /data/ folder)
const GEOJSON_URL = "data/Boundary.json"; 

// --- Helper Functions ---
function timeToSeconds(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(':');
    if (parts.length === 3) {
        return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    }
    return null;
}

function secondsToHMS(totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds)) return "00:00:00";
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function getAverageTime(data, colName) {
    let sum = 0;
    let count = 0;
    data.forEach(row => {
        const secs = timeToSeconds(row[colName]);
        if (secs !== null) { sum += secs; count++; }
    });
    return count === 0 ? "00:00:00" : secondsToHMS(sum / count);
}

// --- Main Data Processing ---
async function loadDashboard() {
    try {
        // Fetch Data from Google Sheets & Local Map File
        const [data, rawMapData] = await Promise.all([
            d3.csv(CSV_URL),
            d3.json(GEOJSON_URL).catch(() => null) 
        ]);

        // Clean headers (trim whitespace)
        const cleanedData = data.map(row => {
            let newRow = {};
            for (let key in row) { newRow[key.trim()] = row[key]; }
            return newRow;
        });

        // --- Metrics Calculations ---
        const totalCalls = cleanedData.length;
        
        let priority1 = 0, priority2 = 0, disregarded = 0;
        const p1Regex = /Priority 1|ABC|Cardiac Arrest|DOB|Motor Vehicular Accident|MVA/i;
        const p2Regex = /Priority 2/i;
        const disRegex = /Not Applicable|Disregarded/i;

        cleanedData.forEach(row => {
            const dispatch = row['PRIORITY DISPATCH'] || '';
            if (p1Regex.test(dispatch)) priority1++;
            if (p2Regex.test(dispatch)) priority2++;
            if (disRegex.test(dispatch)) disregarded++;
        });

        const incidentCalls = totalCalls - disregarded;

        // Update DOM Metrics
        document.getElementById('val-total-calls').innerText = totalCalls.toLocaleString();
        document.getElementById('val-incident-calls').innerText = incidentCalls.toLocaleString();
        document.getElementById('val-p1-calls').innerText = priority1.toLocaleString();
        document.getElementById('val-p2-calls').innerText = priority2.toLocaleString();
        document.getElementById('val-disregarded').innerText = disregarded.toLocaleString();

        document.getElementById('val-avg-dispatch').innerText = getAverageTime(cleanedData, 'COMPUTED DISPATCH TIME');
        document.getElementById('val-avg-run').innerText = getAverageTime(cleanedData, 'COMPUTED RUN TIME');
        document.getElementById('val-avg-response').innerText = getAverageTime(cleanedData, 'COMPUTED RESPONSE TIME');

        // --- Chart Generation (Modern Deep Indigo Spline) ---
        const chartData = cleanedData
            .map(row => {
                const secs = timeToSeconds(row['AVERAGED TURN AROUND TIME']);
                return {
                    x: row['TIMESTAMP'] ? new Date(row['TIMESTAMP']) : null,
                    y: secs !== null ? secs / 60 : null // Convert to minutes
                };
            })
            .filter(d => d.x && d.x.getTime() && d.y !== null)
            .sort((a, b) => a.x - b.x);

        if (chartData.length > 0) {
            const traceLine = {
                x: chartData.map(d => d.x),
                y: chartData.map(d => d.y),
                mode: 'lines+markers', 
                type: 'scatter',
                line: { 
                    shape: 'spline', // Smooth curves
                    color: '#312e81', // Deep indigo/purple matching the image
                    width: 2 
                },
                marker: {
                    size: 6,
                    color: '#ffffff', // White interior dots
                    line: {
                        color: '#312e81', // Indigo border on dots
                        width: 2
                    }
                },
                name: 'Turn Around',
                hovertemplate: '<b>%{y:.1f} mins</b><br>%{x}<extra></extra>' 
            };
            
            const layout = {
                margin: { t: 10, r: 20, l: 40, b: 40 },
                paper_bgcolor: 'rgba(0,0,0,0)', 
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { family: 'inherit', color: '#64748b' },
                hovermode: 'x unified', 
                yaxis: { 
                    title: '',
                    gridcolor: '#f1f5f9', // Very faint dashed-looking grid
                    zerolinecolor: '#e2e8f0'
                },
                xaxis: { 
                    title: '',
                    gridcolor: 'transparent', // No vertical lines
                    zerolinecolor: '#e2e8f0'
                }
            };

            Plotly.newPlot('chartDiv', [traceLine], layout, {responsive: true});
            
        } else {
            document.getElementById('chartDiv').innerHTML = "<p style='color:gray;'>No matching numeric records available.</p>";
        }

        // --- Map Generation ---
        if (rawMapData) {
            let geojson = rawMapData;
            
            // Unpack TopoJSON to standard GeoJSON
            if (rawMapData.type === "Topology") {
                const objectKey = Object.keys(rawMapData.objects)[0];
                geojson = topojson.feature(rawMapData, rawMapData.objects[objectKey]);
            }

            // Process Barangay incidents
            let incidentCounts = {};
            cleanedData.forEach(row => {
                if (row['BARANGAY']) {
                    let bg = row['BARANGAY'].toUpperCase().trim();
                    bg = bg.replace(/\s*POBLACION\s*\(BARANGAY\s*\d+.*?\)\s*/g, '');
                    bg = bg.replace('PORT POYOHON', 'FORT POYOHON');
                    bg = bg.replace('JOSE RIZAL', 'J.P. RIZAL');
                    incidentCounts[bg] = (incidentCounts[bg] || 0) + 1;
                }
            });

            // Extract matching features
            const locations = [];
            const zValues = [];
            
            geojson.features.forEach(feature => {
                const bgName = feature.properties.BRANGAY;
                if (bgName) {
                    locations.push(bgName);
                    zValues.push(incidentCounts[bgName] || 0);
                }
            });

            const traceMap = {
                type: "choroplethmapbox",
                geojson: geojson,
                locations: locations,
                z: zValues,
                featureidkey: "properties.BRANGAY", 
                colorscale: "Reds",
                hoverinfo: "location+z",
                marker: { opacity: 0.75 }
            };

            const mapLayout = {
                mapbox: {
                    style: "carto-positron",
                    center: { lat: 8.94, lon: 125.54 },
                    zoom: 11
                },
                margin: { t: 0, b: 0, l: 0, r: 0 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)'
            };

            Plotly.newPlot('mapDiv', [traceMap], mapLayout, {responsive: true});
        } else {
            document.getElementById('mapDiv').innerHTML = "<p style='color:red;'>Failed to load Boundary.json</p>";
        }

    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}



// Initialize
window.onload = loadDashboard;