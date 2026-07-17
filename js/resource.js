// --- Configuration ---
const RES_SHEET_ID = "1jjp2XBOEo3Mmd0BI691GEsQPH4tJsQWmt8w6bFqtvb4";
const RES_GID = "1800080155";
const RES_CSV_URL = `https://docs.google.com/spreadsheets/d/${RES_SHEET_ID}/export?format=csv&gid=${RES_GID}`;

async function loadResourceDashboard() {
    try {
        // 1. Fetch raw CSV text
        const response = await fetch(RES_CSV_URL);
        const rawText = await response.text();

        // 2. Skip the top title row
        let csvLines = rawText.split('\n');
        csvLines = csvLines.slice(1); 

        // 3. Fix duplicate 'STATUS' headers automatically
        let headers = csvLines[0].split(',');
        let statusCount = 0;
        for (let i = 0; i < headers.length; i++) {
            let h = headers[i].trim();
            if (h === 'STATUS') {
                statusCount++;
                headers[i] = statusCount === 1 ? 'UNIT STATUS' : 'MISSION STATUS';
            }
        }
        csvLines[0] = headers.join(',');

        // 4. Parse the cleaned text using D3
        const cleanedCsvText = csvLines.join('\n');
        const data = d3.csvParse(cleanedCsvText);

        // 5. Clean data and drop empty rows
        const cleanedData = data.map(row => {
            let newRow = {};
            for (let key in row) { newRow[key.trim()] = row[key]; }
            if (!newRow['UNIT STATUS']) newRow['UNIT STATUS'] = 'Unknown';
            return newRow;
        }).filter(row => row['RESOURCES'] && row['RESOURCES'].trim() !== ""); 

        // 6. Tally statuses for the chart
        let statusCounts = {};
        cleanedData.forEach(row => {
            const rawStatus = row['UNIT STATUS'].trim();
            statusCounts[rawStatus] = (statusCounts[rawStatus] || 0) + 1;
        });

        // --- Interactive Grid Rendering Logic ---
        function renderCards(filterStatus = null) {
            const resListDiv = document.getElementById('resList');
            const panelTitle = document.getElementById('resource-panel-title');
            
            // Default to 'Available' if no specific slice was clicked
            let activeFilter = filterStatus ? filterStatus : 'Available';
            
            // Update panel title to show current filter
            panelTitle.innerHTML = `Resources <span style="font-size: 0.85rem; color: #64748b; font-weight: 500;">(${activeFilter})</span>`;
            
            // Filter the data
            let displayData = cleanedData.filter(row => row['UNIT STATUS'].trim().toLowerCase() === activeFilter.toLowerCase());

            // Render cards
            if (displayData.length > 0) {
                resListDiv.innerHTML = displayData.map(row => {
                    let st = row['UNIT STATUS'].trim();
                    let badgeClass = 'resource-badge';
                    
                    if (st.toLowerCase() === 'available') badgeClass += ' badge-available';
                    else if (st.toLowerCase() === 'assigned') badgeClass += ' badge-assigned';
                    else if (st.toLowerCase() === 'not available' || st.toLowerCase() === 'out-of-order') badgeClass += ' badge-unavailable';
                    else badgeClass += ' badge-default';

                    return `
                        <div class="resource-card">
                            <div class="resource-card-header">${row['RESOURCES']}</div>
                            <div class="${badgeClass}">${st}</div>
                            <div class="resource-card-body">
                                <b>Fuel:</b> ${row['FUEL'] || 'N/A'}<br>
                                <b>Base:</b> ${row['BASE STATION'] || 'N/A'}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                resListDiv.innerHTML = `<p style="color:#94a3b8; grid-column: 1 / -1; text-align: center; margin-top: 20px;">No resources found for this status.</p>`;
            }
        }

        // Render initial view (Available)
        renderCards();

        // --- Donut Chart Generation ---
        const labels = Object.keys(statusCounts);
        const values = Object.values(statusCounts);
        
        const colorMap = {
            'Available': '#28a745',
            'Assigned': '#fd7e14',
            'Not available': '#dc3545',
            'Out-of-order': '#6c757d',
            'Unknown': '#adb5bd'
        };
        const colors = labels.map(l => colorMap[l] || '#adb5bd');

        const trace = {
            values: values,
            labels: labels,
            type: 'pie',
            hole: 0.75,
            marker: { colors: colors },
            textinfo: 'percent',
            hoverinfo: 'label+value',
            textposition: 'inside',
            showlegend: true
        };

        const layout = {
            margin: { t: 20, b: 20, l: 20, r: 20 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { 
                orientation: 'v', 
                y: 0.5, 
                x: 1.05,
                yanchor: 'middle',
                font: { size: 12, color: '#475569' }
            } 
        };

        const chartDiv = document.getElementById('resChartDiv');
        Plotly.newPlot(chartDiv, [trace], layout, {responsive: true});

        // --- CLICK INTERACTIVITY ---
        chartDiv.on('plotly_click', function(data) {
            if (data.points && data.points.length > 0) {
                const clickedStatus = data.points[0].label; // e.g., "Not available"
                renderCards(clickedStatus);
            }
        });

        // Clear loading text
        document.getElementById('resLegend').innerHTML = ""; 

    } catch (error) {
        console.error("Error loading resources:", error);
        document.getElementById('resChartDiv').innerHTML = `<p style="color:#dc3545;">Unable to load resource data.</p>`;
    }
}

// Initialize on page load
window.onload = loadResourceDashboard;