// The whole lot fit check for one location: parcel outline -> buildings and streets -> buildable area ->
// slope across the buildable spot -> fire / flood / city overlays -> transit. Used by /api/site and by the
// validation harness, so both run exactly the same code. Never throws; missing pieces are reported as missing.
"use strict";
const data = require("./lot-data");
const geo = require("./lot-geometry");
const { poolsIn } = require("./pool-detect");

const RING_M = 15;
function ringAround(lat, lng) {
  const mLat = 111320, mLng = 111320 * Math.cos(lat * Math.PI / 180), pts = [[lng, lat]];
  for (let i = 0; i < 8; i++) pts.push([lng + RING_M * Math.cos(i * Math.PI / 4) / mLng, lat + RING_M * Math.sin(i * Math.PI / 4) / mLat]);
  return pts;
}
const inLACounty = (lat, lng) => lat > 33.65 && lat < 34.85 && lng > -118.95 && lng < -117.6;

async function siteCheck({ lat, lng, address, streetPoint, debug }) {
  const dbg = {};
  const t0 = Date.now(), sources = [], missing = [];
  // City of LA overlays only apply inside the city, which the LA County record tells us (its tax-rate city)
  const parcelP = data.parcelAt(lat, lng);
  const overlaysP = inLACounty(lat, lng) ? parcelP.then((p) => data.overlaysAt(lat, lng, !!(p && p.attrs && p.attrs.cityOfLA))) : data.overlaysAt(lat, lng, false);
  const [parcel, overlays] = await Promise.all([parcelP, overlaysP]);
  let g = null, buildingsSrc = null, poolRes = null;
  if (parcel && parcel.failed) { missing.push("parcel outline (county map didn't answer)"); }
  else if (parcel) {
    sources.push(parcel.source + " parcel outline");
    const bbox = data.ringsBBox(parcel.rings, 0.0004);
    const [bl, neighbors, pl, sp] = await Promise.all([data.buildingsAround(bbox, parcel.county), data.parcelsInBBox(parcel.src, data.ringsBBox(parcel.rings, 0.00025)), poolsIn(data.ringsBBox(parcel.rings, 0.00005)), streetPoint ? Promise.resolve(streetPoint) : address ? data.censusPoint(address).then((c) => c && [c.lng, c.lat]) : null]);
    if (bl && bl.buildings) buildingsSrc = bl.source;
    if (bl && bl.buildings && bl.buildings.length) {
      poolRes = pl;
      const input = { parcel: parcel.rings, buildings: bl.buildings, roads: [], neighbors: neighbors || [], streetPoint: sp || null, obstacles: pl ? pl.pools.map((p) => p.ring) : [] };
      if (debug) Object.assign(dbg, { parcel: parcel.rings, buildings: bl.buildings, neighbors: neighbors || [], streetPoint: sp, pools: pl ? pl.pools.map((p) => p.ring) : [] });
      g = geo.analyzeLot(input);
      // A home lot always has a building. If the map shows none on this parcel, its outlines are missing or out of
      // date here, so the open-land answer can't be trusted: fall back to the estimate instead.
      if (g.ok && !g.buildingsFound) { missing.push("building outlines on this parcel"); g = null; }
      if (g && g.ok && g.maxFit < 300) {
        const fy = geo.analyzeLot(input, { FRONT_SETBACK: 4, BEHIND_HOUSE: false });  // California may allow the front yard when nothing else fits
        g.frontYardMaxFit = fy.ok ? fy.maxFit : null;
      }
      if (g) sources.push(bl.source + " building outlines");
      if (g && pl) sources.push("USGS aerial imagery (pool check)"); else if (g) missing.push("pool check");

    } else missing.push("building outlines");
  } else if (!parcel || !parcel.failed) missing.push("parcel outline");
  // Slope: across the buildable spot when we found one, otherwise around the home
  let slope = null;
  if (g && g.ok && g.rect) { slope = await data.slopeAcross(data.gridIn(g.rect.corners, 3)); if (slope) slope.where = "buildable area"; }
  if (!slope) { slope = await data.slopeAcross(ringAround(lat, lng)); if (slope) slope.where = "around the home"; }
  if (slope) sources.push("USGS 3DEP ground elevation"); else missing.push("slope");
  const ov = overlays || {};
  if (ov.fire) sources.push(ov.fire.area === "state" ? ov.sources.fireSRA.src : ov.sources.fireLRA.src); else missing.push("fire zone");
  if (ov.flood) sources.push(ov.sources.flood.src); else missing.push("flood zone");
  if (ov.hillside !== undefined && ov.hillside !== null) sources.push("City of LA Hillside, historic and specific plan maps (LA GeoHub)");
  if (ov.transit) sources.push(ov.sources.transit.src); else missing.push("transit");
  if (ov.sources) delete ov.sources;
  return {
    found: true, ms: Date.now() - t0,
    slope, slopePct: slope ? slope.avgPct : null, reliefFt: slope ? slope.reliefFt : null,   // older pages read these two
    geo: g && g.ok ? { ok: true, lotArea: g.lotArea, buildableArea: g.buildableArea, maxFit: g.maxFit, frontYardMaxFit: g.frontYardMaxFit,
      rect: g.rect ? { w: g.rect.w, h: g.rect.h } : null, pools: g.obstaclesOnLot, poolCheck: !!poolRes, mainFootprint: g.mainFootprint, accessory: g.accessory, buildingsFound: g.buildingsFound,
      cornerLot: g.cornerLot, frontMethod: g.frontMethod, rules: g.rules, drawing: g.drawing, rectCorners: g.rect ? g.rect.corners : null } : null,
    parcel: parcel && !parcel.failed ? Object.assign({ source: parcel.source, county: parcel.county }, parcel.attrs) : null,
    buildingsSource: buildingsSrc, overlays: ov, sources, missing,
    debug: debug ? Object.assign(dbg, { frontLine: g && g.frontLine, rect: g && g.rect ? g.rect.corners : null }) : undefined
  };
}
module.exports = { siteCheck };
