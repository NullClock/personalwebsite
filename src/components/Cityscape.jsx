import { memo } from "react";
import "../styles/Cityscape.css";

// A tiny deterministic PRNG so the skyline is the same on every load (no
// "random stock photo" feel, and no hydration/layout surprises).
function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WINDOW_COLORS = [
  "255, 255, 255", // white
  "200, 220, 240", // cool white
  "255, 236, 200", // warm white
  "255, 214, 170", // sodium-lamp amber
];

// Each layer is a row of flat building silhouettes. Heights are a percentage
// of the layer's own height, so the whole city scales cleanly on phones.
// Buildings are split into three "bands" that retract at different speeds.
// That keeps the staggered effect while only nine elements get a transform
// update per scroll frame instead of every building.
function makeLayer({ seed, count, minHeight, maxHeight, antennaChance = 0.16, signChance = 0 }) {
  const rand = mulberry32(seed);
  const segment = 100 / count;

  return Array.from({ length: count }, (_, i) => {
    const width = segment * (0.56 + rand() * 0.48);
    const left = i * segment - segment * 0.14 + rand() * segment * 0.28;
    const landmark = rand() < 0.15;
    const height = landmark ? maxHeight : minHeight + rand() * (maxHeight - minHeight);

    return {
      id: `${seed}-${i}`,
      left,
      width,
      height,
      win: WINDOW_COLORS[Math.floor(rand() * WINDOW_COLORS.length)],
      winOpacity: +(0.24 + rand() * 0.5).toFixed(2),
      antenna: rand() < antennaChance,
      antennaHeight: +(8 + rand() * 18).toFixed(1),
      sign: rand() < signChance,
      signColor: rand() < 0.5 ? "255, 255, 255" : "200, 220, 240",
      flicker: rand() < 0.1,
      winDelay: +(rand() * 7).toFixed(2),
    };
  });
}

// Nine composited layers total (3 rows × 3 height bands). Short blocks sink
// first, tall towers last, and slow/old phones only pay for nine transforms
// while scrolling instead of one per building.
const LAYERS = [
  {
    key: "far",
    className: "skyline--far",
    speeds: [1.3, 1.18, 1.06],
    buildings: makeLayer({
      seed: 11,
      count: 15,
      minHeight: 28,
      maxHeight: 88,
      antennaChance: 0.08,
    }),
  },
  {
    key: "mid",
    className: "skyline--mid",
    speeds: [1.22, 1.12, 1.02],
    buildings: makeLayer({
      seed: 29,
      count: 11,
      minHeight: 30,
      maxHeight: 92,
      antennaChance: 0.12,
      signChance: 0.12,
    }),
  },
  {
    key: "near",
    className: "skyline--near",
    speeds: [1.15, 1.07, 1.0],
    buildings: makeLayer({
      seed: 47,
      count: 8,
      minHeight: 26,
      maxHeight: 100,
      antennaChance: 0.2,
      signChance: 0.24,
    }),
  },
].map((layer) => {
  const sorted = [...layer.buildings].sort((a, b) => a.height - b.height);
  const bands = [[], [], []];
  sorted.forEach((building, index) => {
    bands[Math.min(2, Math.floor((index * 3) / sorted.length))].push(building);
  });

  return {
    ...layer,
    bands: bands.map((buildings) => ({
      height: Math.max(...buildings.map((building) => building.height)),
      buildings,
    })),
  };
});

function makeStars(seed, count) {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: +(rand() * 100).toFixed(2),
    top: +(rand() * 56).toFixed(2),
    size: +(1 + rand() * 1.8).toFixed(2),
    opacity: +(0.25 + rand() * 0.65).toFixed(2),
    group: i % 3,
  }));
}

// Grouping the stars lets three wrapper animations do the work of 48.
const STAR_GROUPS = [[], [], []];
makeStars(7, 48).forEach((star) => STAR_GROUPS[star.group].push(star));

function Cityscape() {
  return (
    <div
      className="city"
      aria-hidden="true"
      onAnimationEnd={(event) => {
        // The city intro only runs once; clearing it lets the hero safely drop
        // the city from the render tree and show it again without re-fading.
        if (event.target === event.currentTarget) {
          event.currentTarget.style.animation = "none";
        }
      }}
    >
      <div className="city__sky" />

      <div className="city__stars" data-p>
        {STAR_GROUPS.map((group, groupIndex) => (
          <span className={`city__star-group city__star-group--${groupIndex}`} key={groupIndex}>
            {group.map((star) => (
              <span
                className="city__star"
                key={star.id}
                style={{
                  left: `${star.left}%`,
                  top: `${star.top}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  "--star-opacity": star.opacity,
                }}
              />
            ))}
          </span>
        ))}
      </div>

      <div className="city__moon" data-p />

      <div className="city__beam city__beam--a" />
      <div className="city__beam city__beam--b" />

      {/* Fades the sky (but not the buildings) to black as you scroll. */}
      <div className="city__dark" data-p />

      {LAYERS.map((layer) => (
        <div className={`skyline ${layer.className}`} key={layer.key}>
          {layer.bands.map((band, bandIndex) => (
            <div
              className="skyline__band"
              key={bandIndex}
              data-p
              style={{ "--k": layer.speeds[bandIndex], height: `${band.height}%` }}
            >
              {band.buildings.map((b) => (
                <div
                  className={`bld${b.flicker ? " bld--flicker" : ""}`}
                  key={b.id}
                  style={{
                    left: `${b.left}%`,
                    width: `${b.width}%`,
                    height: `${(b.height / band.height) * 100}%`,
                    "--win": b.win,
                    "--win-opacity": b.winOpacity,
                    "--win-delay": `${b.winDelay}s`,
                  }}
                >
                  <span className="bld__windows" />
                  {b.antenna && (
                    <span
                      className="bld__antenna"
                      style={{ "--ah": `${b.antennaHeight}%` }}
                    />
                  )}
                  {b.sign && (
                    <span className="bld__sign" style={{ "--sign": b.signColor }} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      <div className="city__haze" data-p />
      <div className="city__street" data-p />
      <div className="city__vignette" />
    </div>
  );
}

export default memo(Cityscape);
