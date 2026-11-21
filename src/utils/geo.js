const fs = require('fs');
const { Reader } = require('@maxmind/geoip2-node');
const { GEOIP_DB_PATH } = require('../config');

// Local MaxMind GeoLite2-City database: lookups take < 1 ms and no IP leaves the server.
// Without the file, IP lookup is skipped and only browser GPS (if shared) is stored.
let reader = null;

const EMPTY_IP_GEO = { country: null, city: null, lat: null, lng: null, accuracyM: null };

const initGeo = async () => {
  if (!fs.existsSync(GEOIP_DB_PATH)) {
    console.warn(`GeoIP database not found at ${GEOIP_DB_PATH}: IP location lookup is disabled.`);
    return false;
  }
  reader = await Reader.open(GEOIP_DB_PATH);
  console.log('GeoIP database loaded');
  return true;
};

// For tests: inject a reader-like object ({ city(ip) }) or null
const setGeoReader = (value) => {
  reader = value;
};

const lookupIp = (ip) => {
  if (!reader || !ip) return { ...EMPTY_IP_GEO };
  try {
    const r = reader.city(ip);
    return {
      country: r.country?.isoCode ?? null,
      city: r.city?.names?.en ?? null,
      lat: r.location?.latitude ?? null,
      lng: r.location?.longitude ?? null,
      accuracyM: r.location ? (r.location.accuracyRadius ?? 100) * 1000 : null, // MaxMind gives km
    };
  } catch {
    return { ...EMPTY_IP_GEO }; // private / unknown IP (e.g. 127.0.0.1 in development)
  }
};

// Browser GPS is used only when its values are sane (it can still be spoofed)
const isValidGps = (gps) =>
  Boolean(gps) &&
  Number.isFinite(gps.lat) && Number.isFinite(gps.lng) && Number.isFinite(gps.accuracy) &&
  Math.abs(gps.lat) <= 90 && Math.abs(gps.lng) <= 180 &&
  gps.accuracy > 0 && gps.accuracy < 5000;

const pickLocation = (ipGeo, gps) => {
  if (isValidGps(gps)) {
    return { lat: gps.lat, lng: gps.lng, accuracyM: Math.round(gps.accuracy), source: 'gps' };
  }
  return { lat: ipGeo.lat, lng: ipGeo.lng, accuracyM: ipGeo.accuracyM, source: 'ip' };
};

module.exports = { initGeo, setGeoReader, lookupIp, pickLocation, isValidGps };
