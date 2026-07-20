// Vision / Image Topic Suggestion Engine
// Runs entirely on-device: the user uploads a picture and the engine analyses
// it on a <canvas> to extract simple visual cues (dominant colour, greenness,
// soil/brown tones, water/blue tones, brightness, colour variety). It then maps
// those cues to a ranked list of LinkedIn post topics tailored to Ekosight's
// soil-health / agritech focus.
//
// No image ever leaves the device — analysis is pixel-based heuristics, so it
// works offline and preserves privacy.

const VisionEngine = (() => {

  // Downscale target — enough detail for colour stats, cheap to process.
  const SAMPLE_SIZE = 64;

  // Load an uploaded File into an <img> element.
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve({ img, url }); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
      img.src = url;
    });
  }

  // Extract colour / brightness statistics from an image.
  function analyzePixels(img) {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    let greenPx = 0, brownPx = 0, bluePx = 0, brightPx = 0, darkPx = 0;
    const hueBuckets = new Array(12).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      rSum += r; gSum += g; bSum += b; count++;

      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 175) brightPx++;
      if (lum < 70) darkPx++;

      // Vegetation: green clearly dominant.
      if (g > r + 12 && g > b + 12) greenPx++;
      // Soil / earth: warm mid-tones, red >= green > blue, not too bright.
      if (r > b + 15 && r >= g && g > b && lum > 40 && lum < 190) brownPx++;
      // Water / sky: blue dominant.
      if (b > r + 12 && b > g + 6) bluePx++;

      // Hue bucket for colour variety.
      const hue = rgbToHue(r, g, b, max, min);
      if (hue >= 0) hueBuckets[Math.floor(hue / 30) % 12]++;
    }

    const variety = hueBuckets.filter(h => h > count * 0.03).length; // # of notable hues
    return {
      avg: { r: rSum / count, g: gSum / count, b: bSum / count },
      greenRatio: greenPx / count,
      brownRatio: brownPx / count,
      blueRatio: bluePx / count,
      brightRatio: brightPx / count,
      darkRatio: darkPx / count,
      variety
    };
  }

  function rgbToHue(r, g, b, max, min) {
    if (max === min) return -1; // grey, no meaningful hue
    const d = max - min;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return h;
  }

  // Human-readable interpretation of the scene.
  function describe(stats) {
    const tags = [];
    if (stats.greenRatio > 0.28) tags.push('crops / vegetation');
    if (stats.brownRatio > 0.25) tags.push('soil / earth');
    if (stats.blueRatio > 0.22) tags.push('water / sky');
    if (stats.brightRatio > 0.45) tags.push('bright / outdoor');
    if (stats.darkRatio > 0.4) tags.push('low light');
    if (stats.variety >= 6) tags.push('busy / detailed scene');
    if (tags.length === 0) tags.push('neutral / studio');
    return tags;
  }

  // Topic library keyed by visual cue. Each cue contributes weighted topics.
  const TOPIC_BANK = {
    green: [
      'What a healthy green canopy hides: the soil chemistry underneath',
      'Crop vigour starts below ground — reading soil before you read leaves',
      'From lush fields to nutrient balance: closing the last-mile data gap'
    ],
    soil: [
      'A handful of soil, a full diagnostic: organic carbon, pH and EC explained',
      'Why soil colour and texture are the first (imperfect) field test',
      'Building decentralised Soil Doctor Clinics closer to the field'
    ],
    water: [
      'Irrigation and soil water retention: the numbers that matter',
      'Salinity, EC and water quality — the silent yield killers',
      'Climate resilience begins with how soil holds water'
    ],
    field: [
      'Designing hardware for dusty, real Indian fields — not clean labs',
      'Field-first product design: robustness over lab-grade perfection',
      'What five days in the field taught us about soil diagnostics'
    ],
    people: [
      'Soil Didis: rural women running local soil-diagnostic enterprises',
      'Empowering local entrepreneurs with portable diagnostic technology',
      'The trusted human link between soil labs and farmers'
    ],
    generic: [
      'Turning soil data into a farm-level decision',
      'Technology is step one; translation and last-mile is the real work',
      'Soil health is India’s critical agricultural infrastructure'
    ]
  };

  // Map stats → ranked topic suggestions.
  function suggestTopics(stats) {
    const weighted = [];
    const push = (bank, w) => bank.forEach((t, i) => weighted.push({ topic: t, weight: w - i * 0.1 }));

    if (stats.greenRatio > 0.28) push(TOPIC_BANK.green, 5 + stats.greenRatio * 3);
    if (stats.brownRatio > 0.2) push(TOPIC_BANK.soil, 5 + stats.brownRatio * 4);
    if (stats.blueRatio > 0.2) push(TOPIC_BANK.water, 4 + stats.blueRatio * 3);
    if (stats.brightRatio > 0.4 || stats.variety >= 5) push(TOPIC_BANK.field, 3.5);
    // If the picture looks like a person / portrait-ish (low variety, mid brightness, low green)
    if (stats.greenRatio < 0.18 && stats.brownRatio < 0.2 && stats.variety <= 5) push(TOPIC_BANK.people, 4);

    // Always include a couple of evergreen anchors so there's never an empty list.
    push(TOPIC_BANK.generic, 2.5);

    // De-dupe keeping the highest weight, then sort.
    const best = new Map();
    weighted.forEach(({ topic, weight }) => {
      if (!best.has(topic) || best.get(topic) < weight) best.set(topic, weight);
    });
    return Array.from(best.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([topic]) => topic);
  }

  // Full pipeline for an uploaded File.
  async function analyzeFile(file) {
    const { img, url } = await loadImage(file);
    const stats = analyzePixels(img);
    URL.revokeObjectURL(url);
    return {
      stats,
      tags: describe(stats),
      topics: suggestTopics(stats)
    };
  }

  return { analyzeFile, analyzePixels, suggestTopics, describe, loadImage };
})();
