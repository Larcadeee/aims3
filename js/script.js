// ========================================================
// --- 1. Configuration & Global Variables ---
// ========================================================
const SHEET_ID = "1dAXks7FBX-LN130hMCEWBz5JcSqM1lijBhxAejuNgco";
const GID = "1297922850";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

// Local Map Data
const GEOJSON_URL = "data/Boundary.json"; 

let globalCleanedData = [];
let globalGeoJson = null;

// ========================================================
// --- 2. Helper Functions ---
// ========================================================
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

// ========================================================
// --- 3. Main Initialization ---
// ========================================================
async function initDashboard() {
    try {
        // Fetch Data from Google Sheets & Local Map File
        const [data, rawMapData] = await Promise.all([
            d3.csv(CSV_URL),
            d3.json(GEOJSON_URL).catch(() => null) 
        ]);

        // Clean headers
        globalCleanedData = data.map(row => {
            let newRow = {};
            for (let key in row) { newRow[key.trim()] = row[key]; }
            return newRow;
        });

        // Unpack GeoJson once
        if (rawMapData) {
            if (rawMapData.type === "Topology") {
                const objectKey = Object.keys(rawMapData.objects)[0];
                globalGeoJson = topojson.feature(rawMapData, rawMapData.objects[objectKey]);
            } else {
                globalGeoJson = rawMapData;
            }
        }

        populateFilters();
        
        // Listeners for Filters (Safe checks to prevent crashes)
        const prioFilter = document.getElementById('filter-priority');
        const teamFilter = document.getElementById('filter-team');
        const dateFilter = document.getElementById('filter-date');
        
        if (prioFilter) prioFilter.addEventListener('change', applyFilters);
        if (teamFilter) teamFilter.addEventListener('change', applyFilters);
        if (dateFilter) dateFilter.addEventListener('change', applyFilters);

        // Initial Render
        applyFilters();

    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}

// ========================================================
// --- 4. Filter Logic ---
// ========================================================
function populateFilters() {
    const teams = new Set();

    globalCleanedData.forEach(row => {
        if (row['RESOURCE TEAM'] && row['RESOURCE TEAM'].trim() !== "") {
            teams.add(row['RESOURCE TEAM'].trim());
        }
    });

    const teamSelect = document.getElementById('filter-team');
    if (teamSelect) {
        teamSelect.innerHTML = '<option value="All">All Teams</option>';
        [...teams].sort().forEach(t => teamSelect.add(new Option(t, t)));
    }
}

function applyFilters() {
    const prioVal = document.getElementById('filter-priority') ? document.getElementById('filter-priority').value : 'All';
    const teamVal = document.getElementById('filter-team') ? document.getElementById('filter-team').value : 'All';
    const dateVal = document.getElementById('filter-date') ? document.getElementById('filter-date').value : '';

    const p1Regex = /Priority 1|ABC|Cardiac Arrest|DOB|Motor Vehicular Accident|MVA/i;
    const p2Regex = /Priority 2/i;

    const filteredData = globalCleanedData.filter(row => {
        
        // 1. Smart Priority Matching
        let matchPrio = true;
        const dispatch = row['PRIORITY DISPATCH'] || '';
        if (prioVal === 'Priority 1') {
            matchPrio = p1Regex.test(dispatch);
        } else if (prioVal === 'Priority 2') {
            matchPrio = p2Regex.test(dispatch);
        }

        // 2. Team Matching
        let matchTeam = teamVal === 'All' || (row['RESOURCE TEAM'] && row['RESOURCE TEAM'].trim() === teamVal);

        // 3. Exact Date Matching
        let matchDate = true;
        if (dateVal) { 
            if (row['TIMESTAMP']) {
                const d = new Date(row['TIMESTAMP']);
                if (!isNaN(d)) {
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    matchDate = (`${yyyy}-${mm}-${dd}` === dateVal);
                } else {
                    matchDate = false;
                }
            } else {
                matchDate = false;
            }
        }

        return matchPrio && matchTeam && matchDate;
    });

    renderDashboard(filteredData);
}

// ========================================================
// --- 5. Render UI ---
// ========================================================
function renderDashboard(dataToRender) {
    // --- Update Numeric Metrics ---
    const totalCalls = dataToRender.length;
    let priority1 = 0, priority2 = 0, disregarded = 0;
    
    const p1Regex = /Priority 1|ABC|Cardiac Arrest|DOB|Motor Vehicular Accident|MVA/i;
    const p2Regex = /Priority 2/i;
    const disRegex = /Not Applicable|Disregarded/i;

    dataToRender.forEach(row => {
        const dispatch = row['PRIORITY DISPATCH'] || '';
        if (p1Regex.test(dispatch)) priority1++;
        if (p2Regex.test(dispatch)) priority2++;
        if (disRegex.test(dispatch)) disregarded++;
    });

    const incidentCalls = totalCalls - disregarded;

    // Update Top Metric DOM
    if(document.getElementById('val-total-calls')) document.getElementById('val-total-calls').innerText = totalCalls.toLocaleString();
    if(document.getElementById('val-incident-calls')) document.getElementById('val-incident-calls').innerText = incidentCalls.toLocaleString();
    if(document.getElementById('val-p1-calls')) document.getElementById('val-p1-calls').innerText = priority1.toLocaleString();
    if(document.getElementById('val-p2-calls')) document.getElementById('val-p2-calls').innerText = priority2.toLocaleString();
    if(document.getElementById('val-disregarded')) document.getElementById('val-disregarded').innerText = disregarded.toLocaleString();

    // Update Average Metrics
    if(document.getElementById('val-avg-dispatch')) document.getElementById('val-avg-dispatch').innerText = getAverageTime(dataToRender, 'COMPUTED DISPATCH TIME');
    if(document.getElementById('val-avg-run')) document.getElementById('val-avg-run').innerText = getAverageTime(dataToRender, 'COMPUTED RUN TIME');
    if(document.getElementById('val-avg-response')) document.getElementById('val-avg-response').innerText = getAverageTime(dataToRender, 'COMPUTED RESPONSE TIME');


    // --- Render Trend Chart ---
    const chartData = dataToRender
        .map(row => {
            const secs = timeToSeconds(row['AVERAGED TURN AROUND TIME']);
            return {
                x: row['TIMESTAMP'] ? new Date(row['TIMESTAMP']) : null,
                y: secs !== null ? secs / 60 : null 
            };
        })
        .filter(d => d.x && !isNaN(d.x.getTime()) && d.y !== null)
        .sort((a, b) => a.x - b.x); 

    if (chartData.length > 0) {
        document.getElementById('chartDiv').innerHTML = ''; 
        const traceArea = {
            x: chartData.map(d => d.x),
            y: chartData.map(d => d.y),
            mode: 'lines', 
            type: 'scatter',
            fill: 'tozeroy', 
            fillcolor: 'rgba(79, 70, 229, 0.15)',
            line: { shape: 'spline', smoothing: 1.2, color: '#4f46e5', width: 3 },
            name: 'Turn Around',
            hovertemplate: '<b>%{y:.1f} mins</b><br>%{x|%b %d, %I:%M %p}<extra></extra>' 
        };
        const layout = {
            margin: { t: 20, r: 20, l: 50, b: 40 },
            paper_bgcolor: 'rgba(0,0,0,0)', 
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { family: 'inherit', color: '#64748b' },
            hovermode: 'x unified', 
            yaxis: { title: 'Minutes', gridcolor: '#e2e8f0', zerolinecolor: '#cbd5e1', zerolinewidth: 2 },
            xaxis: { title: '', showgrid: false, zeroline: false }
        };
        Plotly.newPlot('chartDiv', [traceArea], layout, {responsive: true, displayModeBar: false});
    } else {
        Plotly.purge('chartDiv');
        document.getElementById('chartDiv').innerHTML = "<div style='display:flex; align-items:center; justify-content:center; height:100%; color:#64748b; font-weight:500;'>No timeline data available for these filters.</div>";
    }

    // --- Render Heat Map ---
    if (globalGeoJson) {
        let incidentCounts = {};
        dataToRender.forEach(row => {
            if (row['BARANGAY']) {
                let bg = row['BARANGAY'].toUpperCase().trim();
                bg = bg.replace(/\s*POBLACION\s*\(BARANGAY\s*\d+.*?\)\s*/g, '');
                bg = bg.replace('PORT POYOHON', 'FORT POYOHON');
                bg = bg.replace('JOSE RIZAL', 'J.P. RIZAL');
                incidentCounts[bg] = (incidentCounts[bg] || 0) + 1;
            }
        });

        const locations = [];
        const zValues = [];
        
        globalGeoJson.features.forEach(feature => {
            const bgName = feature.properties.BRANGAY;
            if (bgName) {
                locations.push(bgName);
                zValues.push(incidentCounts[bgName] || 0);
            }
        });

        const traceMap = {
            type: "choroplethmapbox",
            geojson: globalGeoJson,
            locations: locations,
            z: zValues,
            featureidkey: "properties.BRANGAY", 
            colorscale: "Reds",
            hoverinfo: "location+z",
            marker: { opacity: 0.75 }
        };

        const mapLayout = {
            mapbox: { style: "carto-positron", center: { lat: 8.94, lon: 125.54 }, zoom: 12.5 },
            margin: { t: 0, b: 0, l: 0, r: 0 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        };

        Plotly.newPlot('mapDiv', [traceMap], mapLayout, {responsive: true});
    }

    // --- Render Pie Charts ---
    let radiusCounts = {};
    let typeCounts = {};

    dataToRender.forEach(row => {
        let radius = row['KM RADIUS'];
        if(radius && radius.trim() !== "") {
            radiusCounts[radius.trim()] = (radiusCounts[radius.trim()] || 0) + 1;
        }
        let type = row['INCIDENT TYPE'];
        if(type && type.trim() !== "") {
            typeCounts[type.trim()] = (typeCounts[type.trim()] || 0) + 1;
        }
    });

    const sideLegend = { orientation: 'v', y: 0.5, yanchor: 'middle', font: { size: 9, color: '#64748b' }};

    // 1. Radius Chart (with empty state handler)
    if (Object.keys(radiusCounts).length > 0) {
        document.getElementById('radiusChartDiv').innerHTML = ''; 
        const radiusDataObj = [{
            values: Object.values(radiusCounts),
            labels: Object.keys(radiusCounts),
            type: 'pie',
            hole: 0.6, 
            marker: { colors: ['#4f46e5', '#94a3b8'] }, 
            textinfo: 'none', 
            hoverinfo: 'label+value+percent'
        }];
        Plotly.newPlot('radiusChartDiv', radiusDataObj, {
            margin: { t: 10, b: 10, l: 0, r: 0 },
            showlegend: true,
            legend: sideLegend,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, {responsive: true, displayModeBar: false});
    } else {
        Plotly.purge('radiusChartDiv');
        document.getElementById('radiusChartDiv').innerHTML = "<div style='display:flex; align-items:center; justify-content:center; height:100%; color:#64748b; font-size: 0.85rem;'>No data available</div>";
    }

    // 2. Incident Types Chart (with empty state handler)
    if (Object.keys(typeCounts).length > 0) {
        document.getElementById('typeChartDiv').innerHTML = '';
        const typeColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#64748b'];
        const originalTypeLabels = Object.keys(typeCounts);
        const shortTypeLabels = originalTypeLabels.map(l => l.length > 22 ? l.substring(0, 22) + "..." : l);

        const typeDataObj = [{
            values: Object.values(typeCounts),
            labels: shortTypeLabels, 
            hovertext: originalTypeLabels, 
            type: 'pie',
            hole: 0.6,
            marker: { colors: typeColors },
            textinfo: 'none', 
            hoverinfo: 'text+percent' 
        }];
        Plotly.newPlot('typeChartDiv', typeDataObj, {
            margin: { t: 10, b: 10, l: 0, r: 0 },
            showlegend: true,
            legend: sideLegend,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, {responsive: true, displayModeBar: false});
    } else {
        Plotly.purge('typeChartDiv');
        document.getElementById('typeChartDiv').innerHTML = "<div style='display:flex; align-items:center; justify-content:center; height:100%; color:#64748b; font-size: 0.85rem;'>No data available</div>";
    }
}

// Start
window.onload = initDashboard;