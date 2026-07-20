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

  // ========================================================
        // --- Chart Generation (Modern Smooth Area Chart) ---
        // ========================================================
        const chartData = cleanedData
            .map(row => {
                const secs = timeToSeconds(row['AVERAGED TURN AROUND TIME']);
                return {
                    x: row['TIMESTAMP'] ? new Date(row['TIMESTAMP']) : null,
                    y: secs !== null ? secs / 60 : null // Convert to minutes
                };
            })
            .filter(d => d.x && !isNaN(d.x.getTime()) && d.y !== null)
            .sort((a, b) => a.x - b.x); // Ensure chronological order

        if (chartData.length > 0) {
            const traceArea = {
                x: chartData.map(d => d.x),
                y: chartData.map(d => d.y),
                mode: 'lines', // Removed markers (dots) for a much cleaner look
                type: 'scatter',
                fill: 'tozeroy', // Creates the filled "Area Chart" aesthetic
                fillcolor: 'rgba(79, 70, 229, 0.15)', // Soft translucent indigo fill
                line: { 
                    shape: 'spline', // Smooth curving lines
                    smoothing: 1.2,
                    color: '#4f46e5', // Bright indigo line
                    width: 3 
                },
                name: 'Turn Around',
                // Formats the hover tool to show "Jul 20, 02:09 PM"
                hovertemplate: '<b>%{y:.1f} mins</b><br>%{x|%b %d, %I:%M %p}<extra></extra>' 
            };
            
            const layout = {
                margin: { t: 20, r: 20, l: 50, b: 40 },
                paper_bgcolor: 'rgba(0,0,0,0)', 
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { family: 'inherit', color: '#64748b' },
                hovermode: 'x unified', 
                yaxis: { 
                    title: 'Minutes',
                    gridcolor: '#e2e8f0', // Faint horizontal lines
                    zerolinecolor: '#cbd5e1',
                    zerolinewidth: 2
                },
                xaxis: { 
                    title: '',
                    showgrid: false, // Turned off vertical lines to make it look clean
                    zeroline: false
                }
            };

            Plotly.newPlot('chartDiv', [traceArea], layout, {responsive: true, displayModeBar: false});
            
        } else {
            document.getElementById('chartDiv').innerHTML = "<p style='color:gray; text-align:center; padding-top:20px;'>No numeric records available.</p>";
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
                    zoom: 12.5 // <-- INCREASED from 11 to zoom in default view
                },
                margin: { t: 0, b: 0, l: 0, r: 0 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)'
            };

            Plotly.newPlot('mapDiv', [traceMap], mapLayout, {responsive: true});
        } else {
            document.getElementById('mapDiv').innerHTML = "<p style='color:red;'>Failed to load Boundary.json</p>";
        }

// ========================================================
        // --- 25% Column: Stacked Pie Charts Generation ---
        // ========================================================
        
        let radiusCounts = {};
        let typeCounts = {};

        // 1. Tally the data from the E-Log
        cleanedData.forEach(row => {
            let radius = row['KM RADIUS'];
            if(radius && radius.trim() !== "") {
                radiusCounts[radius.trim()] = (radiusCounts[radius.trim()] || 0) + 1;
            }
            
            let type = row['INCIDENT TYPE'];
            if(type && type.trim() !== "") {
                typeCounts[type.trim()] = (typeCounts[type.trim()] || 0) + 1;
            }
        });

        // --- Common Legend Settings ---
        // Positions legend to the right side and shrinks font to maximize chart size
        const sideLegend = {
            orientation: 'v',
            y: 0.5,            // Vertically center the legend
            yanchor: 'middle',
            font: { size: 9, color: '#64748b' } // Small font to fit narrow column
        };

        // 2. Render KM Radius Chart (Top)
        const radiusDataObj = [{
            values: Object.values(radiusCounts),
            labels: Object.keys(radiusCounts),
            type: 'pie',
            hole: 0.6, 
            marker: { colors: ['#4f46e5', '#94a3b8'] }, 
            textinfo: 'none', // Hides text on the slice itself to prevent clutter
            hoverinfo: 'label+value+percent'
        }];

        const radiusLayout = {
            margin: { t: 10, b: 10, l: 0, r: 0 }, // 0 side margins to push chart to the edges
            showlegend: true,
            legend: sideLegend,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        };

        Plotly.newPlot('radiusChartDiv', radiusDataObj, radiusLayout, {responsive: true, displayModeBar: false});

        // 3. Render Incident Types Chart (Bottom)
        const typeColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#64748b'];

        // Truncate long labels so they don't crush the chart in the narrow 25% column
        const originalTypeLabels = Object.keys(typeCounts);
        const shortTypeLabels = originalTypeLabels.map(label => 
            label.length > 22 ? label.substring(0, 22) + "..." : label
        );

        const typeDataObj = [{
            values: Object.values(typeCounts),
            labels: shortTypeLabels, // Uses short text for the side legend
            hovertext: originalTypeLabels, // Uses full text for the hover popup
            type: 'pie',
            hole: 0.6,
            marker: { colors: typeColors },
            textinfo: 'none', 
            hoverinfo: 'text+percent' // Triggers the full hovertext
        }];

        const typeLayout = {
            margin: { t: 10, b: 10, l: 0, r: 0 },
            showlegend: true,
            legend: sideLegend,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        };

        Plotly.newPlot('typeChartDiv', typeDataObj, typeLayout, {responsive: true, displayModeBar: false});
    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}



// Initialize
window.onload = loadDashboard;