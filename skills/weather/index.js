const process = require('process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const location = args.filter(a => !a.startsWith('--')).join(' ');

const CACHE_FILE = path.resolve(__dirname, '../../memory/weather_geo_cache.json');

function getGeoCache(loc) {
    if (!fs.existsSync(CACHE_FILE)) return null;
    try {
        const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        return cache[loc.toLowerCase().trim()] || null;
    } catch (e) { return null; }
}

function saveGeoCache(loc, data) {
    let cache = {};
    if (fs.existsSync(CACHE_FILE)) {
        try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) {}
    }
    cache[loc.toLowerCase().trim()] = data;
    try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2)); } catch (e) {}
}

if (!location) {
    if (jsonMode) {
        console.log(JSON.stringify({ error: "Location required" }));
        process.exit(1);
    }
    console.error("Usage: node index.js <location> [--json]");
    process.exit(1);
}

async function getWttr(loc) {
    try {
        const url = `https://wttr.in/${encodeURIComponent(loc)}?format=j1`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        
        const current = data.current_condition[0];
        
        return {
            source: 'wttr.in',
            location: loc, // wttr.in doesn't return clean location name in j1 easily
            temp_c: parseFloat(current.temp_C),
            condition: current.weatherDesc[0].value,
            humidity: parseInt(current.humidity),
            wind_kmh: parseFloat(current.windspeedKmph)
        };
    } catch (e) {
        return null;
    }
}

async function getOpenMeteo(loc) {
    try {
        // 1. Geocode (Cache First)
        let geo = getGeoCache(loc);
        
        if (!geo) {
            if (!jsonMode) console.error(`[Weather] Geocoding '${loc}' via API...`);
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1&language=en&format=json`;
            const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });
            const geoData = await geoRes.json();
            
            if (!geoData.results || geoData.results.length === 0) {
                throw new Error("Location not found");
            }
            
            const result = geoData.results[0];
            geo = {
                latitude: result.latitude,
                longitude: result.longitude,
                name: result.name,
                country: result.country
            };
            saveGeoCache(loc, geo);
        } else {
            if (!jsonMode) console.error(`[Weather] Using cached coordinates for '${loc}'.`);
        }
        
        const { latitude, longitude, name, country } = geo;
        
        // 2. Weather
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(5000) });
        const weatherData = await weatherRes.json();
        
        const w = weatherData.current_weather;
        
        // Weather Code Interpretation
        const codes = {
            0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
            45: 'Fog', 48: 'Depositing rime fog',
            51: 'Drizzle: Light', 53: 'Drizzle: Moderate', 55: 'Drizzle: Dense',
            61: 'Rain: Slight', 63: 'Rain: Moderate', 65: 'Rain: Heavy',
            71: 'Snow: Slight', 73: 'Snow: Moderate', 75: 'Snow: Heavy',
            80: 'Rain showers: Slight', 81: 'Rain showers: Moderate', 82: 'Rain showers: Violent',
            95: 'Thunderstorm'
        };
        const condition = codes[w.weathercode] || `Code ${w.weathercode}`;
        
        return {
            source: 'open-meteo',
            location: `${name}, ${country}`,
            temp_c: w.temperature,
            condition: condition,
            humidity: null, // Open-Meteo current_weather doesn't have humidity by default
            wind_kmh: w.windspeed
        };
        
    } catch (e) {
        return null;
    }
}

async function run() {
    let result = await getWttr(location);
    
    if (!result) {
        if (!jsonMode) console.log("⚠️ wttr.in failed, switching to Open-Meteo...");
        result = await getOpenMeteo(location);
    }
    
    if (result) {
        if (jsonMode) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(`🌦️ **Weather for ${result.location} (${result.source})**`);
            console.log(`- Temp: ${result.temp_c}°C`);
            console.log(`- Condition: ${result.condition}`);
            if (result.humidity !== null) console.log(`- Humidity: ${result.humidity}%`);
            console.log(`- Wind: ${result.wind_kmh} km/h`);
        }
    } else {
        if (jsonMode) {
            console.log(JSON.stringify({ error: "All weather services failed" }));
        } else {
            console.error("❌ All weather services failed.");
        }
        process.exit(1);
    }
}

run();
