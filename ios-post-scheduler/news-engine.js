// News & Topic Discovery Engine
// Explores current agriculture news (India + Global) and prioritises topics
// that are relevant to Ekosight's work: soil health, soil testing, agritech,
// IoT sensors, precision agriculture, fertilizer efficiency and rural enterprise.
//
// Because this is a client-side PWA, live RSS feeds are fetched through a
// public CORS proxy and parsed in the browser. If the network is unavailable
// (offline / iOS standalone / proxy down) the engine gracefully falls back to
// a curated set of evergreen topics so the feature always works.

const NewsEngine = (() => {

  // ---- Relevance model -----------------------------------------------------
  // Keywords that describe "our work". Higher weight = higher priority.
  // A headline's relevance score is the sum of the weights of the keywords it
  // matches, so news closest to Ekosight's focus bubbles to the top.
  const PRIORITY_KEYWORDS = {
    // Core focus (highest priority)
    'soil health': 10, 'soil test': 10, 'soil card': 9, 'soil doctor': 10,
    'organic carbon': 9, 'soil carbon': 8, 'soil quality': 8, 'soil degradation': 8,
    // Agritech & our tooling
    'agritech': 8, 'agri-tech': 8, 'agtech': 8, 'precision agriculture': 9,
    'precision farming': 9, 'iot': 8, 'sensor': 7, 'smart farming': 8,
    'digital agriculture': 7, 'agri startup': 6, 'agri drone': 6, 'drone': 4,
    // Inputs & economics
    'fertilizer': 7, 'fertiliser': 7, 'nutrient': 6, 'subsidy': 5, 'urea': 5,
    'micronutrient': 6, 'nitrogen': 5, 'phosphorus': 4, 'potassium': 4,
    // People & systems we serve
    'women in agriculture': 7, 'rural entrepreneur': 6, 'farmer producer': 6,
    'fpo': 6, 'self help group': 5, 'shg': 5, 'kisan': 5, 'smallholder': 6,
    // Sustainability angle
    'climate resilience': 6, 'regenerative': 6, 'sustainable farming': 6,
    'carbon credit': 6, 'water retention': 5, 'crop productivity': 5,
    // General agriculture (lower priority, still relevant)
    'agriculture': 3, 'farming': 3, 'crop': 3, 'harvest': 2, 'monsoon': 3,
    'irrigation': 4, 'yield': 3, 'food security': 4
  };

  // RSS sources (Google News search feeds — free, reliable, no key required).
  const SOURCES = [
    {
      region: 'India',
      url: 'https://news.google.com/rss/search?q=' +
        encodeURIComponent('soil health OR agritech OR precision agriculture OR fertilizer India when:14d') +
        '&hl=en-IN&gl=IN&ceid=IN:en'
    },
    {
      region: 'Global',
      url: 'https://news.google.com/rss/search?q=' +
        encodeURIComponent('soil health OR precision agriculture OR agtech OR "IoT agriculture" when:14d') +
        '&hl=en-US&gl=US&ceid=US:en'
    }
  ];

  // Public CORS proxies (tried in order). Keeps the feature resilient.
  const CORS_PROXIES = [
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u)
  ];

  // ---- Curated fallback topics (always available, fully offline) -----------
  const FALLBACK_TOPICS = [
    { title: 'Soil Health Cards: from paper to real farm decisions', region: 'India', score: 19, source: 'Curated', link: '' },
    { title: 'Why IoT soil sensors struggle in real Indian fields', region: 'India', score: 18, source: 'Curated', link: '' },
    { title: 'Precision agriculture and fertilizer-use efficiency', region: 'Global', score: 17, source: 'Curated', link: '' },
    { title: 'Organic carbon: the number that predicts long-term yield', region: 'Global', score: 16, source: 'Curated', link: '' },
    { title: 'Women-led rural enterprises in soil diagnostics', region: 'India', score: 15, source: 'Curated', link: '' },
    { title: 'Carbon credits for smallholder regenerative farming', region: 'Global', score: 14, source: 'Curated', link: '' },
    { title: 'Cutting the urea subsidy bill with decentralised soil testing', region: 'India', score: 14, source: 'Curated', link: '' },
    { title: 'Climate-resilient soils and water retention', region: 'Global', score: 12, source: 'Curated', link: '' }
  ];

  // ---- Scoring -------------------------------------------------------------
  function scoreHeadline(text) {
    const lower = (text || '').toLowerCase();
    let score = 0;
    const matched = [];
    for (const [kw, weight] of Object.entries(PRIORITY_KEYWORDS)) {
      if (lower.includes(kw)) {
        score += weight;
        matched.push(kw);
      }
    }
    return { score, matched };
  }

  // Turn a raw headline into a clean, LinkedIn-ready topic angle.
  function toTopicAngle(headline) {
    // Google News titles often end with " - Publisher". Strip that.
    return (headline || '').replace(/\s+-\s+[^-]+$/, '').trim();
  }

  // ---- Fetch + parse -------------------------------------------------------
  // Fetch with a hard timeout so a slow/blocked proxy can never hang the UI.
  function fetchWithTimeout(url, ms = 7000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { cache: 'no-store', signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  async function fetchFeed(source) {
    let lastErr = null;
    for (const proxy of CORS_PROXIES) {
      try {
        const res = await fetchWithTimeout(proxy(source.url));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const xml = await res.text();
        return parseRss(xml, source.region);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('All proxies failed');
  }

  function parseRss(xmlString, region) {
    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item')).slice(0, 25);
    return items.map(item => {
      const title = item.querySelector('title')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const { score, matched } = scoreHeadline(title);
      return {
        title: toTopicAngle(title),
        rawTitle: title,
        link,
        region,
        pubDate,
        score,
        matched
      };
    });
  }

  // ---- Public API ----------------------------------------------------------
  // Returns a prioritised, de-duplicated list of topic suggestions.
  async function getTrendingTopics({ limit = 12, onlyRelevant = true } = {}) {
    try {
      const results = await Promise.allSettled(SOURCES.map(fetchFeed));
      let all = [];
      results.forEach(r => { if (r.status === 'fulfilled') all = all.concat(r.value); });

      if (all.length === 0) throw new Error('No headlines fetched');

      // Keep only headlines that match at least one priority keyword.
      let filtered = onlyRelevant ? all.filter(a => a.score > 0) : all;
      if (filtered.length === 0) filtered = all; // safety

      // De-dupe by normalised title.
      const seen = new Set();
      filtered = filtered.filter(a => {
        const key = a.title.toLowerCase().slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Highest relevance first, then most recent.
      filtered.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.pubDate) - new Date(a.pubDate);
      });

      return { live: true, topics: filtered.slice(0, limit) };
    } catch (e) {
      console.warn('[NewsEngine] Falling back to curated topics:', e.message);
      return { live: false, topics: FALLBACK_TOPICS.slice(0, limit), error: e.message };
    }
  }

  return {
    getTrendingTopics,
    scoreHeadline,
    FALLBACK_TOPICS,
    PRIORITY_KEYWORDS
  };
})();
