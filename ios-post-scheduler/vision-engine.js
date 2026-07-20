// Vision / Image Topic Suggestion Engine
// Runs entirely on-device: the user uploads a picture and the engine analyses
// it on a <canvas> to extract visual cues (colour make-up, brightness,
// saturation, skin tones, detail/variety). It classifies the photo into a
// likely SCENE (crops, soil, water, sky, people, document/chart, lab/indoor)
// with a confidence score, then suggests LinkedIn post topics AND ready-to-use
// captions tailored to Ekosight's soil-health / agritech focus.
//
// No image ever leaves the device — this is heuristic pixel analysis, so it is
// private and works offline. It detects the *type* of scene, not exact objects.

const VisionEngine = (() => {

  const SAMPLE_SIZE = 72;

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
      img.src = url;
    });
  }

  // Extract colour / brightness / saturation statistics from an image.
  function analyzePixels(img) {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    let rSum = 0, gSum = 0, bSum = 0, satSum = 0, count = 0;
    let greenPx = 0, brownPx = 0, bluePx = 0, brightPx = 0, darkPx = 0;
    let skinPx = 0, whitePx = 0, grayPx = 0;
    const hueBuckets = new Array(12).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      rSum += r; gSum += g; bSum += b; count++;

      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = max === 0 ? 0 : (max - min) / max;
      satSum += sat;

      if (lum > 175) brightPx++;
      if (lum < 70) darkPx++;
      if (r > 200 && g > 200 && b > 200) whitePx++;
      if (sat < 0.12 && lum > 60 && lum < 230) grayPx++;

      // Vegetation: green clearly dominant.
      if (g > r + 12 && g > b + 12) greenPx++;
      // Soil / earth: warm mid-tones, red >= green > blue, not too bright.
      if (r > b + 15 && r >= g && g > b && lum > 40 && lum < 190) brownPx++;
      // Water / sky: blue dominant.
      if (b > r + 12 && b > g + 6) bluePx++;
      // Skin tone (rough): warm, reasonably bright, r>g>b with spread, but
      // NOT as saturated as raw soil/earth (that guard keeps brown soil from
      // reading as people).
      if (r > 95 && g > 40 && b > 20 && r > g && g > b && (r - b) > 15 &&
          lum > 60 && sat > 0.15 && sat < 0.58) skinPx++;

      const hue = rgbToHue(r, g, b, max, min);
      if (hue >= 0) hueBuckets[Math.floor(hue / 30) % 12]++;
    }

    const variety = hueBuckets.filter(h => h > count * 0.03).length;
    return {
      avg: { r: rSum / count, g: gSum / count, b: bSum / count },
      greenRatio: greenPx / count,
      brownRatio: brownPx / count,
      blueRatio: bluePx / count,
      brightRatio: brightPx / count,
      darkRatio: darkPx / count,
      skinRatio: skinPx / count,
      whiteRatio: whitePx / count,
      grayRatio: grayPx / count,
      saturation: satSum / count,
      variety
    };
  }

  function rgbToHue(r, g, b, max, min) {
    if (max === min) return -1;
    const d = max - min;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return h;
  }

  // Scene definitions: each has a scoring function plus tailored topics/captions.
  const SCENES = [
    {
      id: 'crops', label: 'Crops / green field', emoji: '🌾',
      score: s => (s.greenRatio * 9) + (s.brightRatio > 0.3 ? 1 : 0),
      topics: [
        'What a healthy green canopy hides: the soil chemistry underneath',
        'Crop vigour starts below ground — reading soil before you read leaves',
        'From lush fields to nutrient balance: closing the last-mile data gap'
      ],
      captions: [
        'The green you see above the ground is a receipt for the chemistry below it.',
        'A good canopy is the reward for good soil decisions made months earlier.',
        'Behind every healthy field is a soil test someone actually acted on.'
      ]
    },
    {
      id: 'soil', label: 'Soil / earth', emoji: '🪱',
      score: s => (s.brownRatio * 10) + (s.greenRatio < 0.2 ? 1.5 : 0),
      topics: [
        'A handful of soil, a full diagnostic: organic carbon, pH and EC explained',
        'Why soil colour and texture are the first (imperfect) field test',
        'Building decentralised Soil Doctor Clinics closer to the field'
      ],
      captions: [
        'This is where every yield number actually begins.',
        'You can’t manage what you don’t measure — starting with the soil itself.',
        'A handful of soil holds more decisions than most dashboards.'
      ]
    },
    {
      id: 'water', label: 'Water / irrigation', emoji: '💧',
      score: s => (s.blueRatio * 8) + (s.brightRatio > 0.4 ? 0.5 : 0) - (s.greenRatio > 0.3 ? 1 : 0),
      topics: [
        'Irrigation and soil water retention: the numbers that matter',
        'Salinity, EC and water quality — the silent yield killers',
        'Climate resilience begins with how soil holds water'
      ],
      captions: [
        'Every drop counts twice when the soil can actually hold it.',
        'Water quality is a soil-health question in disguise.',
        'Irrigation without soil data is just expensive guessing.'
      ]
    },
    {
      id: 'sky', label: 'Outdoor / landscape', emoji: '🌤️',
      score: s => (s.blueRatio * 5) + (s.brightRatio * 4) + (s.greenRatio > 0.15 && s.greenRatio < 0.4 ? 1 : 0),
      topics: [
        'Climate, weather and the case for resilient soils',
        'Field-first realities: designing for dust, heat and the open sky',
        'Landscape-scale thinking, farm-scale decisions'
      ],
      captions: [
        'Big-picture climate goals still come down to what happens in one field.',
        'Resilience is built one plot, one season, one soil test at a time.',
        'The weather we can’t control; the soil we can prepare.'
      ]
    },
    {
      id: 'people', label: 'People / team', emoji: '🧑‍🌾',
      // Require a meaningful amount of skin before calling it "people", so
      // small warm patches in a field/soil shot don't trigger it.
      score: s => (s.skinRatio > 0.08 ? s.skinRatio * 9 : 0) + (s.greenRatio < 0.25 && s.brownRatio < 0.3 ? 1 : 0),
      topics: [
        'Soil Didis: rural women running local soil-diagnostic enterprises',
        'Empowering local entrepreneurs with portable diagnostic technology',
        'The trusted human link between soil labs and farmers'
      ],
      captions: [
        'Technology earns adoption through people, not dashboards.',
        'Meet the human layer that makes soil data trusted in the village.',
        'Behind the hardware is a person a farmer actually believes.'
      ]
    },
    {
      id: 'document', label: 'Document / chart / screenshot', emoji: '📊',
      score: s => (s.whiteRatio * 6) + (s.grayRatio * 4) + (s.saturation < 0.25 ? 2 : 0) - (s.greenRatio * 3) - (s.brownRatio * 2) - (s.skinRatio * 5),
      topics: [
        'Turning a soil health card into a farm-level decision',
        'Reading N-P-K: what the numbers should actually change',
        'From lab report to input savings: the translation gap'
      ],
      captions: [
        'A report a farmer doesn’t trust is just paper.',
        'Data is step one; the decision it drives is the whole point.',
        'Numbers on a page only matter when they change what goes on the field.'
      ]
    },
    {
      id: 'lab', label: 'Lab / equipment / indoor', emoji: '🔬',
      score: s => (s.grayRatio * 4) + (s.darkRatio > 0.35 ? 1.5 : 0) + (s.greenRatio < 0.15 && s.brownRatio < 0.2 && s.blueRatio < 0.2 ? 2 : 0),
      topics: [
        'Designing hardware for dusty Indian fields, not clean labs',
        'Field-first product design: robustness over lab-grade perfection',
        'What the lab gets right and the field gets real'
      ],
      captions: [
        'Building for the lab is easy; building for the field is the real test.',
        'Every design that survives the field started by failing in one.',
        'Robustness beats precision when the power keeps cutting out.'
      ]
    }
  ];

  const GENERIC = {
    topics: [
      'Turning soil data into a farm-level decision',
      'Technology is step one; translation and last-mile is the real work',
      'Soil health is India’s critical agricultural infrastructure'
    ],
    captions: [
      'Soil health is infrastructure, not an afterthought.',
      'The real work is the last mile between data and decision.'
    ]
  };

  // Classify + rank scenes.
  function classify(stats) {
    const ranked = SCENES
      .map(sc => ({ id: sc.id, label: sc.label, emoji: sc.emoji, s: Math.max(0, sc.score(stats)), ref: sc }))
      .sort((a, b) => b.s - a.s);

    const total = ranked.reduce((sum, r) => sum + r.s, 0) || 1;
    const top = ranked[0];
    const confidence = Math.round((top.s / total) * 100);
    return { ranked, top, confidence };
  }

  // Human-readable descriptor tags.
  function describe(stats) {
    const tags = [];
    if (stats.greenRatio > 0.28) tags.push('vegetation');
    if (stats.brownRatio > 0.25) tags.push('soil / earth');
    if (stats.blueRatio > 0.22) tags.push('water / sky');
    if (stats.skinRatio > 0.06) tags.push('people');
    if (stats.whiteRatio > 0.35 && stats.saturation < 0.25) tags.push('document / chart');
    if (stats.brightRatio > 0.45) tags.push('bright / outdoor');
    if (stats.darkRatio > 0.4) tags.push('low light');
    if (stats.variety >= 6) tags.push('detailed');
    if (tags.length === 0) tags.push('neutral');
    return tags;
  }

  // Build topic + caption suggestions from the top-scoring scenes.
  function suggest(stats) {
    const { ranked, top, confidence } = classify(stats);
    const topScenes = ranked.filter(r => r.s > 0).slice(0, 2);

    const topics = [];
    const captions = [];
    const pushUnique = (arr, items) => items.forEach(it => { if (!arr.includes(it)) arr.push(it); });

    topScenes.forEach((sc, idx) => {
      // Take more from the strongest scene.
      const take = idx === 0 ? 3 : 2;
      pushUnique(topics, sc.ref.topics.slice(0, take));
      pushUnique(captions, sc.ref.captions.slice(0, take));
    });

    // Always anchor with a couple of evergreen options.
    pushUnique(topics, GENERIC.topics.slice(0, 2));
    pushUnique(captions, GENERIC.captions.slice(0, 1));

    return {
      identified: { label: top.label, emoji: top.emoji, confidence },
      alternatives: topScenes.map(s => `${s.emoji} ${s.label}`),
      topics: topics.slice(0, 6),
      captions: captions.slice(0, 5)
    };
  }

  // Backwards-compatible helper.
  function suggestTopics(stats) {
    return suggest(stats).topics;
  }

  async function analyzeFile(file) {
    const { img, url } = await loadImage(file);
    const stats = analyzePixels(img);
    URL.revokeObjectURL(url);
    const s = suggest(stats);
    return {
      stats,
      tags: describe(stats),
      identified: s.identified,
      alternatives: s.alternatives,
      topics: s.topics,
      captions: s.captions
    };
  }

  return { analyzeFile, analyzePixels, classify, suggest, suggestTopics, describe, loadImage };
})();
