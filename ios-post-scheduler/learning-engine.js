// Self-Learning Availability Engine for Post Scheduling Reminders
// Stores interaction data in localStorage and calculates peak user availability.

const STORAGE_KEY = 'soil_doctor_agent_events';
const CONFIG_KEY = 'soil_doctor_agent_config';

const EVENT_WEIGHTS = {
  app_open: 2,
  draft_start: 5,
  post_published: 10,
  reminder_clicked: 8,
  reminder_dismissed: -3
};

const DefaultConfig = {
  reminderEnabled: true,
  reminderMode: 'smart', // 'smart' (learned) or 'manual'
  manualTime: '09:00',
  smartTime: '09:00',
  soundEnabled: true,
  lastCalculated: null,
  gptEnabled: true,
  customGptUrl: 'https://chatgpt.com',
  customPromptPrefix: 'Write a high-quality LinkedIn post in my style about the following topic. Maintain a grounded, reflective, first-person voice. Do not use corporate buzzwords like "transforming" or "revolutionary". Focus on last-mile realities and soil-health infrastructure. Topic idea:'
};

const LearningEngine = {
  // Retrieve configuration
  getConfig() {
    const configStr = localStorage.getItem(CONFIG_KEY);
    if (!configStr) {
      this.saveConfig(DefaultConfig);
      return DefaultConfig;
    }
    return JSON.parse(configStr);
  },

  // Save configuration
  saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  },

  // Track a user interaction event
  trackEvent(type) {
    const events = this.getEvents();
    const newEvent = {
      type,
      timestamp: Date.now()
    };
    events.push(newEvent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    
    console.log(`[LearningEngine] Tracked event: ${type} at ${new Date(newEvent.timestamp).toLocaleTimeString()}`);
    
    // Automatically recalculate optimal time if in smart mode
    const config = this.getConfig();
    if (config.reminderMode === 'smart') {
      this.recalculateSmartTime();
    }
    
    return newEvent;
  },

  // Get raw list of tracked events
  getEvents() {
    const eventsStr = localStorage.getItem(STORAGE_KEY);
    return eventsStr ? JSON.parse(eventsStr) : [];
  },

  // Clear all event history (reset learning)
  resetLearning() {
    localStorage.removeItem(STORAGE_KEY);
    const config = this.getConfig();
    config.smartTime = '09:00';
    config.lastCalculated = null;
    this.saveConfig(config);
    console.log('[LearningEngine] Cleared learning database.');
  },

  // Inject dummy mock events for demonstrating/testing the self-learning capability
  injectMockData() {
    this.resetLearning();
    
    const events = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Simulate active scheduling around 14:00 (2:00 PM) for the last 5 days
    for (let i = 1; i <= 5; i++) {
      const dayBase = now - (i * oneDayMs);
      
      // Active posting window: 14:00 - 15:00
      events.push({ type: 'app_open', timestamp: this.createMockTime(dayBase, 13, 45) });
      events.push({ type: 'draft_start', timestamp: this.createMockTime(dayBase, 14, 0) });
      events.push({ type: 'post_published', timestamp: this.createMockTime(dayBase, 14, 15) });
      
      // Some morning activity: 08:30
      events.push({ type: 'app_open', timestamp: this.createMockTime(dayBase, 8, 30) });
      events.push({ type: 'reminder_dismissed', timestamp: this.createMockTime(dayBase, 9, 0) }); // Busy at 9 AM
      
      // Evening checking: 19:30
      events.push({ type: 'app_open', timestamp: this.createMockTime(dayBase, 19, 30) });
      events.push({ type: 'draft_start', timestamp: this.createMockTime(dayBase, 19, 45) });
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    this.recalculateSmartTime();
    console.log('[LearningEngine] Injected mock activity history.');
  },

  // Helper to construct a timestamp on a target day at specific hour/minute
  createMockTime(dayTimestamp, hour, minute) {
    const d = new Date(dayTimestamp);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  },

  // Calculate the smart reminder time based on weights and recency
  recalculateSmartTime() {
    const events = this.getEvents();
    const config = this.getConfig();
    
    if (events.length === 0) {
      config.smartTime = '09:00';
      this.saveConfig(config);
      return;
    }
    
    const hourlyScores = this.calculateHourlyScores(events);
    
    // Find the peak hour
    let peakHour = 9; // Default starting hour
    let maxScore = -Infinity;
    
    for (let hour = 0; hour < 24; hour++) {
      if (hourlyScores[hour] > maxScore) {
        maxScore = hourlyScores[hour];
        peakHour = hour;
      }
    }
    
    // Format peakHour as HH:00 or HH:30 depending on sub-hour activity
    // For simplicity, let's target the exact hour, e.g. "14:00"
    const formattedHour = String(peakHour).padStart(2, '0');
    config.smartTime = `${formattedHour}:00`;
    config.lastCalculated = Date.now();
    this.saveConfig(config);
    
    console.log(`[LearningEngine] Recalculated. Peak availability hour is ${formattedHour}:00 with score ${maxScore.toFixed(1)}`);
  },

  // Calculate the weighting scores for each hour of the day
  calculateHourlyScores(events) {
    const hourlyScores = new Array(24).fill(0);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    
    events.forEach(event => {
      const eventDate = new Date(event.timestamp);
      const hour = eventDate.getHours();
      
      // Calculate recency factor (linear decay: weight decreases as event gets older, min 0.2)
      const ageMs = now - event.timestamp;
      let recencyWeight = 1 - (ageMs / thirtyDaysMs);
      if (recencyWeight < 0.2) recencyWeight = 0.2;
      if (recencyWeight > 1.0) recencyWeight = 1.0;
      
      // Event-type score
      const baseScore = EVENT_WEIGHTS[event.type] || 0;
      
      hourlyScores[hour] += baseScore * recencyWeight;
    });
    
    // Smooth the scores using a basic 3-point moving average to avoid spiky artifacts
    const smoothedScores = new Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      const prev = hourlyScores[(h - 1 + 24) % 24];
      const curr = hourlyScores[h];
      const next = hourlyScores[(h + 1) % 24];
      // Weighted average: current hour gets 60%, neighbors get 20% each
      smoothedScores[h] = (0.2 * prev) + (0.6 * curr) + (0.2 * next);
    }
    
    return smoothedScores;
  },

  // Get learning completion status / confidence rating (0 to 100)
  getLearningConfidence() {
    const events = this.getEvents();
    if (events.length === 0) return 0;
    
    // We consider 15 quality interactions (posts, drafts, reminder clicks) to reach 100% confidence
    const qualityEvents = events.filter(e => 
      e.type === 'post_published' || 
      e.type === 'draft_start' || 
      e.type === 'reminder_clicked'
    ).length;
    
    const confidence = Math.min(100, Math.round((qualityEvents / 15) * 100));
    return confidence;
  }
};
