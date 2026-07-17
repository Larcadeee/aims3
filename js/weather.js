const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather?lat=8.9515&lon=125.5277&appid=969ca531fbd4c3fb820d95765b142485";

async function fetchWeatherData() {
    try {
        const response = await fetch(WEATHER_API_URL);
        const data = await response.json();

        const tempC = Math.round(data.main.temp - 273.15);
        const feelsLikeC = Math.round(data.main.feels_like - 273.15);
        
        const now = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const formatTime = (unixTs) => new Date(unixTs * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        document.getElementById('curr-date').innerText = `Last synced: ${now.toLocaleDateString('en-US', dateOptions)}`;
        
        document.getElementById('loc-name').innerText = `${data.name}, ${data.sys.country}`;
        document.getElementById('curr-temp').innerText = `${tempC}°C`;
        document.getElementById('feels-like').innerText = `${feelsLikeC}°C`;
        document.getElementById('w-desc').innerText = data.weather[0].description;
        
        const iconImg = document.getElementById('w-icon');
        iconImg.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
        iconImg.style.display = 'block';

        document.getElementById('m-humidity').innerText = `${data.main.humidity}%`;
        document.getElementById('m-wind').innerText = `${data.wind.speed} m/s`;
        document.getElementById('m-vis').innerText = `${(data.visibility / 1000).toFixed(1)} km`;
        document.getElementById('m-clouds').innerText = `${data.clouds.all}%`;
        document.getElementById('m-pressure').innerText = `${data.main.pressure} hPa`;
        document.getElementById('m-gust').innerText = data.wind.gust ? `${data.wind.gust} m/s` : "0 m/s";

        document.getElementById('m-sunrise').innerText = formatTime(data.sys.sunrise);
        document.getElementById('m-sunset').innerText = formatTime(data.sys.sunset);

        // Update Dynamic Soft Background (using the unified CSS classes)
        updateBackgroundOverlay(data.weather[0].id, data.weather[0].icon);

        generateOperationalImpact(data.weather[0].id, tempC, data.wind.speed, feelsLikeC);

    } catch (error) {
        console.error("Failed to fetch weather data:", error);
        document.getElementById('curr-date').innerText = "System Offline: Unable to reach servers.";
    }
}

function updateBackgroundOverlay(weatherId, icon) {
    const bg = document.getElementById('weather-bg');
    bg.className = 'weather-bg'; // reset
    const isNight = icon.includes('n');

    if (weatherId >= 200 && weatherId < 300) {
        bg.classList.add('bg-thunderstorm');
    } else if (weatherId >= 300 && weatherId < 600) {
        bg.classList.add('bg-rain');
    } else if (weatherId >= 700 && weatherId < 800) {
        bg.classList.add('bg-fog');
    } else if (weatherId === 800) {
        bg.classList.add(isNight ? 'bg-clear-night' : 'bg-clear-day');
    } else if (weatherId > 800) {
        bg.classList.add(isNight ? 'bg-clouds-night' : 'bg-clouds-day');
    }
}

function generateOperationalImpact(weatherId, temp, wind, feelsLike) {
    const content = document.getElementById('impact-content');
    let insightHTML = "";
    let isNormal = true;

    if (feelsLike >= 38) {
        isNormal = false;
        insightHTML += `<div class="impact-alert severe"><i class="fa-solid fa-triangle-exclamation"></i> <b>Extreme Heat Warning:</b> Heat index is ${feelsLike}°C. High risk of heatstroke for deployed field personnel.</div>`;
    }

    if (weatherId >= 200 && weatherId < 600) {
        isNormal = false;
        insightHTML += `<div class="impact-alert severe"><i class="fa-solid fa-cloud-showers-heavy"></i> <b>Precipitation Alert:</b> Active rainfall detected. Monitor low-lying areas for flash flooding.</div>`;
    }

    if (wind > 10) {
        isNormal = false;
        insightHTML += `<div class="impact-alert moderate"><i class="fa-solid fa-wind"></i> <b>Wind Advisory:</b> Speeds exceeding 10m/s. Secure loose assets. Marine operations affected.</div>`;
    }

    if (isNormal) {
        insightHTML = `<div class="impact-alert normal"><i class="fa-solid fa-check-circle"></i> <b>Optimal Conditions:</b> Weather is currently stable. Standard dispatch protocols apply.</div>`;
    } 

    content.innerHTML = insightHTML;
}

document.getElementById('btn-refresh').addEventListener('click', () => {
    document.getElementById('curr-date').innerText = "Syncing live meteorological data...";
    fetchWeatherData();
});

window.onload = fetchWeatherData;
setInterval(fetchWeatherData, 300000); // 5 mins