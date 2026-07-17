// --- Configuration ---
const ELOG_SHEET_ID = "1dAXks7FBX-LN130hMCEWBz5JcSqM1lijBhxAejuNgco";
const ELOG_GID = "1297922850";
const ELOG_CSV_URL = `https://docs.google.com/spreadsheets/d/${ELOG_SHEET_ID}/export?format=csv&gid=${ELOG_GID}`;

let globalElogData = [];
let tableHeaders = [];
let currentFilteredData = []; // Store current view for printing

async function loadElogData() {
    try {
        const response = await fetch(ELOG_CSV_URL);
        const rawText = await response.text();

        // 1. Smart Header Detection
        let csvLines = rawText.split('\n');
        let headerIndex = 0;
        
        for (let i = 0; i < csvLines.length; i++) {
            if (csvLines[i].toLowerCase().includes('date') || csvLines[i].toLowerCase().includes('time')) {
                headerIndex = i;
                break;
            }
        }
        
        const cleanedCsvText = csvLines.slice(headerIndex).join('\n');
        const rawData = d3.csvParse(cleanedCsvText);

        // 2. Clean data and extract headers
        tableHeaders = rawData.columns.map(col => col.trim()).filter(col => col.length > 0);

        globalElogData = rawData.map(row => {
            let newRow = {};
            for (let key in row) { 
                if (key.trim()) {
                    newRow[key.trim()] = row[key]; 
                }
            }
            return newRow;
        }).filter(row => Object.values(row).some(val => val && val.trim() !== "")); 

        currentFilteredData = globalElogData;
        renderTable(currentFilteredData);

    } catch (error) {
        console.error("Error loading E-Log data:", error);
        document.getElementById('table-body').innerHTML = `
            <tr><td colspan="100%" style="text-align:center; color:#dc3545;">Failed to load E-Log data.</td></tr>
        `;
    }
}

function renderTable(data) {
    const thead = document.getElementById('table-header-row');
    const tbody = document.getElementById('table-body');
    const countDiv = document.getElementById('record-count');

    // Render Headers (adding the Action column)
    if (thead.innerHTML.trim() === "") {
        let headersHtml = tableHeaders.map(header => `<th>${header}</th>`).join('');
        headersHtml += `<th style="position: sticky; right: 0; background-color: #f8fafc; text-align: center; border-left: 2px solid #e2e8f0;">Action</th>`;
        thead.innerHTML = headersHtml;
    }

    // Render Body
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${tableHeaders.length + 1}" style="text-align:center; color:#94a3b8;">No records match your filters.</td></tr>`;
    } else {
        tbody.innerHTML = data.map((row, index) => {
            let rowHtml = tableHeaders.map(header => `<td>${row[header] || '-'}</td>`).join('');
            
            // Add Print Button Column (Sticky to the right side of the scrollable table)
            rowHtml += `
                <td style="position: sticky; right: 0; background-color: #ffffff; text-align: center; border-left: 1px solid #e2e8f0;">
                    <button class="btn-print-sm" onclick="printRow(${index})">🖨️ Print</button>
                </td>
            `;
            return `<tr>${rowHtml}</tr>`;
        }).join('');
    }

    countDiv.innerText = `Showing ${data.length} record(s)`;
}

// --- FILTERING LOGIC ---
function applyFilters() {
    const dateInput = document.getElementById('filter-date').value; 
    const timeInput = document.getElementById('filter-time').value.toLowerCase().trim();
    const searchInput = document.getElementById('filter-search').value.toLowerCase().trim();

    let filteredData = globalElogData.filter(row => {
        let matches = true;

        if (dateInput) {
            const [y, m, d] = dateInput.split('-');
            const sheetDateFormats = [`${m}/${d}/${y}`, `${parseInt(m)}/${parseInt(d)}/${y}`, dateInput];
            const dateKey = tableHeaders.find(h => h.toLowerCase().includes('date'));
            const rowDate = dateKey && row[dateKey] ? row[dateKey].trim() : "";
            if (!sheetDateFormats.some(format => rowDate.includes(format))) matches = false;
        }

        if (timeInput) {
            const timeKey = tableHeaders.find(h => h.toLowerCase().includes('time') || h.toLowerCase().includes('notification'));
            const rowTime = timeKey && row[timeKey] ? row[timeKey].toLowerCase() : "";
            if (!rowTime.includes(timeInput)) matches = false;
        }

        if (searchInput) {
            const rowString = Object.values(row).join(' ').toLowerCase();
            if (!rowString.includes(searchInput)) matches = false;
        }

        return matches;
    });

    currentFilteredData = filteredData; // Update active state
    renderTable(currentFilteredData);
}

// --- PRINTING LOGIC ---
function printRow(index) {
    const row = currentFilteredData[index];
    
    // Helper to safely get values
    const getVal = (keyStr) => {
        const key = tableHeaders.find(h => h.toLowerCase().includes(keyStr.toLowerCase()));
        return (key && row[key] && row[key].trim() !== "") ? row[key] : "N/A";
    };

    // Format HTML to match the provided image reference
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>E-LOG REPORT</title>
            <style>
                body { font-family: "Times New Roman", Times, serif; margin: 40px; color: #000; font-size: 12px; }
                .header-container { text-align: center; margin-bottom: 20px; line-height: 1.2; }
                .header-container p { margin: 2px 0; }
                .doc-title { font-size: 18px; font-weight: bold; margin-top: 25px; margin-bottom: 15px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; vertical-align: top; }
                .bg-gray { background-color: #e2e2e2; font-weight: bold; text-align: center; }
                .lbl { font-weight: bold; width: 25%; }
                .val { width: 25%; }
                .signature-box { margin-top: 40px; display: flex; justify-content: space-between; }
                .sig-line { width: 200px; border-bottom: 1px solid #000; margin-bottom: 5px; text-align: center; height: 30px; }
            </style>
        </head>
        <body>
            <div class="header-container">
                <p>Republic of the Philippines</p>
                <p style="font-weight: bold; font-size: 14px;">CITY GOVERNMENT OF BUTUAN</p>
                <p>City Disaster Risk Reduction and Management Department</p>
                <p style="font-weight: bold;">(CDRRMD)</p>
                <div class="doc-title">E-LOG REPORT</div>
            </div>

            <table>
                <tr>
                    <td class="lbl">INCIDENT ID:</td><td class="val">${getVal("INCIDENT ID")}</td>
                    <td class="lbl">DATE:</td><td class="val">${getVal("DATE")}</td>
                </tr>
                <tr>
                    <td class="lbl">PRIORITY DISPATCH:</td><td class="val">${getVal("PRIORITY DISPATCH")}</td>
                    <td class="lbl">USER:</td><td class="val">${getVal("USER")}</td>
                </tr>
            </table>

            <table>
                <tr><td colspan="4" class="bg-gray">INCIDENT DETAILS</td></tr>
                <tr>
                    <td class="lbl">TYPE OF CALL:</td><td class="val">${getVal("TYPE OF CALL")}</td>
                    <td class="lbl">INCIDENT TYPE:</td><td class="val">${getVal("INCIDENT TYPE")}</td>
                </tr>
                <tr>
                    <td class="lbl">LOCATION / BRGY:</td><td colspan="3">${getVal("BARANGAY")}</td>
                </tr>
                <tr>
                    <td class="lbl">BASED LOCATION:</td><td class="val">${getVal("BASED LOCATION")}</td>
                    <td class="lbl">KM RADIUS:</td><td class="val">${getVal("KM RADIUS")}</td>
                </tr>
                <tr>
                    <td class="lbl">RESOURCE TEAM:</td><td colspan="3">${getVal("RESOURCE TEAM")}</td>
                </tr>
            </table>

            <table>
                <tr><td colspan="4" class="bg-gray">TIME TRACKING</td></tr>
                <tr>
                    <td class="lbl">NOTIFICATION TIME:</td><td class="val">${getVal("NOTIFICATION TIME")}</td>
                    <td class="lbl">ARRIVAL TO FACILITY:</td><td class="val">${getVal("ARRIVAL TO HIGHER FACILITY")}</td>
                </tr>
                <tr>
                    <td class="lbl">DISPATCH TIME:</td><td class="val">${getVal("DISPATCH TIME")}</td>
                    <td class="lbl">ENDORSEMENT TIME:</td><td class="val">${getVal("ENDORSEMENT TIME")}</td>
                </tr>
                <tr>
                    <td class="lbl">RUN TIME:</td><td class="val">${getVal("RUN TIME")}</td>
                    <td class="lbl">ARRIVAL AT BASE TIME:</td><td class="val">${getVal("ARRIVAL AT BASE TIME")}</td>
                </tr>
                <tr>
                    <td class="lbl">SCENE TIME:</td><td class="val">${getVal("SCENE TIME")}</td>
                    <td class="lbl">COMPUTED RESPONSE:</td><td class="val">${getVal("COMPUTED RESPONSE TIME")}</td>
                </tr>
                <tr>
                    <td class="lbl">EN ROUTE TO HIGHER FACILITY:</td><td class="val">${getVal("EN ROUTE TO HIGHER FACILITY")}</td>
                    <td class="lbl">COMPUTED DISPATCH:</td><td class="val">${getVal("COMPUTED DISPATCH TIME")}</td>
                </tr>
            </table>

            <div class="signature-box">
                <div>
                    <p>Prepared by:</p>
                    <div class="sig-line"></div>
                    <p style="text-align: center; margin: 0; font-weight: bold;">${getVal("USER") || "__________________"}</p>
                    <p style="text-align: center; margin: 0; font-size: 10px;">Dispatcher</p>
                </div>
                <div>
                    <p>Noted by:</p>
                    <div class="sig-line"></div>
                    <p style="text-align: center; margin: 0; font-weight: bold;">__________________</p>
                    <p style="text-align: center; margin: 0; font-size: 10px;">Operations Officer / CDRRMO</p>
                </div>
            </div>
        </body>
        </html>
    `;

    // Inject into the hidden iframe and trigger print
    const printFrame = document.getElementById('print-frame');
    printFrame.srcdoc = printHTML;
    
    // Wait for the iframe content to load before calling print()
    printFrame.onload = function() {
        printFrame.contentWindow.print();
    };
}

// --- Event Listeners ---
document.getElementById('filter-date').addEventListener('input', applyFilters);
document.getElementById('filter-time').addEventListener('input', applyFilters);
document.getElementById('filter-search').addEventListener('input', applyFilters);

document.getElementById('btn-clear').addEventListener('click', () => {
    document.getElementById('filter-date').value = "";
    document.getElementById('filter-time').value = "";
    document.getElementById('filter-search').value = "";
    applyFilters();
});

// Initialize on page load
window.onload = loadElogData;