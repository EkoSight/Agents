// Core application logic for the iOS Post Scheduler & Agent PWA
// Connects UI, state, templates, and the self-learning engine.

// Theme-based templates pre-populated from Dhiraj's LinkedIn Agent Knowledge Base
const POST_TEMPLATES = [
  {
    id: 'didis',
    title: 'Soil Didis',
    theme: 'Women in Agritech',
    text: `Rural women are not just beneficiaries of development programs—they are skilled agricultural professionals and local entrepreneurs.

In our Soil Doctor Clinics, Soil Didis are building local enterprises, running soil-health tests, translating scientific parameters (like organic carbon, pH, and electrical conductivity), and serving as the trusted link between labs and fields. 

When you empower a local woman with portable diagnostic technology, you don't just change her household; you upgrade the agricultural infrastructure of the entire village.

#SoilHealth #WomenInAgriculture #RuralEntrepreneurship #Ekosight`
  },
  {
    id: 'decisions',
    title: 'Decisions over Data',
    theme: 'Actionable Science',
    text: `A laboratory report or soil health card is useless if it does not change a farm-level decision. 

Farmers don't just need values for N, P, or K. They need to know:
- Which nutrient is actually deficient?
- Which fertilizer should be reduced to save input cost?
- Exactly how much should be applied, and at what crop stage?

Technology is only the first step. The real work is translation and last-mile implementation. That is why we are building decentralized Soil Doctor Clinics to turn data into clear agricultural decisions closer to the farm.

#Agritech #SustainableFarming #SoilTesting #Ekosight`
  },
  {
    id: 'hardware',
    title: 'Field vs Lab',
    theme: 'Product Development',
    text: `We learned early on that building hardware for laboratory conditions is easy. Building it for Indian fields is the real test.

A soil testing tool must survive dust, voltage fluctuations, sample transport challenges, and water quality issues. It must convert a complex scientific assay into a simple, robust field workflow that a rural entrepreneur can run reliably.

Every product design failure teaches us one thing: always design around the harsh reality of the field, not the clean comfort of the lab.

#HardwareDevelopment #Agritech #Startups #ProductDesign`
  },
  {
    id: 'infrastructure',
    title: 'Soil Infrastructure',
    theme: 'National Priority',
    text: `We need to stop viewing soil testing as an occasional luxury or a bureaucratic checklist. Soil health is India's critical agricultural infrastructure.

Decentralized, locally accessible soil intelligence impacts everything:
- Fertilizer-use efficiency (saving subsidy bills)
- Climate resilience and soil water retention
- Long-term crop productivity and food quality

If we want to build a resilient agricultural system, we must start from the ground up. Literally.

#Agriculture #SoilDoctor #ClimateResilience #RuralDevelopment`
  }
];

// App State
let appState = {
  currentTab: 'scheduler',
  posts: [],
  config: {},
  activeTemplateId: null,
  logs: []
};

// Audio elements for notifications
let notificationAudio = null;

// Initialize Web Audio API for iOS compliance (needs user gesture)
function initAudio() {
  if (notificationAudio) return;
  
  // Create synth audio context for notification beep
  try {
    notificationAudio = {
      play() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // high tone
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
        
        addLog('[System] Sound alert played');
      }
    };
    addLog('[Audio] Sound initialized successfully');
    const statusEl = document.getElementById('audio-status');
    if (statusEl) statusEl.textContent = '🔊 Audio feedback active';
  } catch (e) {
    console.error('Audio initialization failed', e);
  }
}

// Log utility for the UI console
function addLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const formattedLog = `[${timestamp}] ${message}`;
  appState.logs.unshift(formattedLog);
  if (appState.logs.length > 50) appState.logs.pop();
  
  const logContainer = document.getElementById('debug-logs');
  if (logContainer) {
    logContainer.textContent = appState.logs.join('\n');
  }
}

// Save post database
function savePosts() {
  localStorage.setItem('soil_doctor_posts', JSON.stringify(appState.posts));
}

// Load post database
function loadPosts() {
  const postsStr = localStorage.getItem('soil_doctor_posts');
  appState.posts = postsStr ? JSON.parse(postsStr) : [];
  if (appState.posts.length === 0) {
    // Seed standard initial history
    appState.posts = [
      {
        id: 'seed-1',
        text: 'Soil testing is not just about diagnostic devices. Our focus at Ekosight is the last-mile translation of data into decisions.',
        status: 'published',
        timestamp: Date.now() - (2 * 24 * 60 * 60 * 1000)
      }
    ];
    savePosts();
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Load configuration & posts
  appState.config = LearningEngine.getConfig();
  loadPosts();
  
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => addLog(`[PWA] Service Worker Registered (Scope: ${reg.scope})`))
      .catch(err => addLog(`[PWA] Service Worker Registration Failed: ${err}`));
  }
  
  // Setup UI event listeners
  setupTabNavigation();
  setupTemplates();
  setupSettingsUI();
  setupSchedulerActions();
  setupInsightsUI();
  setupNotificationChecker();
  
  // Log startup
  addLog('[Agent] Post Scheduler Agent initialized');
  addLog(`[Engine] Smart Reminder calculated: ${appState.config.smartTime}`);
  
  // Log first app open event
  LearningEngine.trackEvent('app_open');
  
  // Render initially
  renderAll();
});

// Tab Navigation
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab-bar-item');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = tab.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabName) {
  appState.currentTab = tabName;
  
  // Update Tab buttons
  document.querySelectorAll('.tab-bar-item').forEach(el => {
    if (el.getAttribute('data-tab') === tabName) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
  
  // Update Tab content panels
  document.querySelectorAll('.tab-content').forEach(el => {
    if (el.id === `${tabName}-tab`) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
  
  addLog(`[UI] Switched to tab: ${tabName}`);
  
  // Specific tab actions
  if (tabName === 'insights') {
    renderInsights();
  }
}

// Render templates grid
function setupTemplates() {
  const grid = document.getElementById('templates-grid');
  if (!grid) return;
  
  grid.innerHTML = POST_TEMPLATES.map(t => `
    <div class="template-item" data-id="${t.id}" id="tmpl-${t.id}">
      <div class="template-item-title">${t.title}</div>
      <div class="template-item-desc">${t.theme}</div>
    </div>
  `).join('');
  
  // Click handler
  grid.querySelectorAll('.template-item').forEach(item => {
    item.addEventListener('click', () => {
      const templateId = item.getAttribute('data-id');
      selectTemplate(templateId);
    });
  });
}

function selectTemplate(templateId) {
  const template = POST_TEMPLATES.find(t => t.id === templateId);
  if (!template) return;
  
  // Highlight active
  document.querySelectorAll('.template-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`tmpl-${templateId}`).classList.add('active');
  
  // Load text into editor
  const textarea = document.getElementById('post-editor');
  textarea.value = template.text;
  updateCharCount(template.text);
  
  appState.activeTemplateId = templateId;
  addLog(`[Editor] Loaded template: ${template.title}`);
  
  // Track start of drafting activity
  LearningEngine.trackEvent('draft_start');
}

// Update Character Count
function updateCharCount(text) {
  const counter = document.getElementById('char-count');
  if (counter) counter.textContent = `${text.length} characters`;
}

// Setup Editor Actions
function setupSchedulerActions() {
  const textarea = document.getElementById('post-editor');
  textarea.addEventListener('input', (e) => {
    updateCharCount(e.target.value);
  });
  
  // Clipboard copy and log publication
  const publishBtn = document.getElementById('copy-publish-btn');
  publishBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) {
      alert('Please enter or select some post content first.');
      return;
    }
    
    // Copy to clipboard (works on iOS standalone if triggered by user click)
    navigator.clipboard.writeText(text)
      .then(() => {
        addLog('[Editor] Copied post text to clipboard');
        
        // Save post history
        const newPost = {
          id: 'post-' + Date.now(),
          text: text,
          status: 'published',
          timestamp: Date.now()
        };
        appState.posts.unshift(newPost);
        savePosts();
        
        // Log event for the availability learning engine
        LearningEngine.trackEvent('post_published');
        
        // Clear editor
        textarea.value = '';
        updateCharCount('');
        document.querySelectorAll('.template-item').forEach(el => el.classList.remove('active'));
        
        // Render
        renderHistory();
        
        // Custom Success Alert
        showToastNotification('Post Ready!', 'Text copied to clipboard. Go ahead and publish on LinkedIn!');
        
        // Play success tone
        if (appState.config.soundEnabled && notificationAudio) {
          notificationAudio.play();
        }
      })
      .catch(err => {
        addLog(`[Editor] Copy to clipboard failed: ${err}`);
        alert('Could not copy automatically. Please select text and copy manually.');
      });
  });
  
  // Initialize audio when user clicks editor area (safari security compliance)
  textarea.addEventListener('focus', () => {
    initAudio();
  });

  // ChatGPT integration trigger button
  const gptBtn = document.getElementById('gpt-generate-btn');
  if (gptBtn) {
    gptBtn.addEventListener('click', () => {
      if (!appState.config.gptEnabled) {
        alert('Custom GPT integration is currently disabled. Please enable it in the Settings tab.');
        return;
      }
      
      // Check topic
      let topic = textarea.value.trim();
      
      // If textarea is empty, check if a template is selected
      if (!topic && appState.activeTemplateId) {
        const template = POST_TEMPLATES.find(t => t.id === appState.activeTemplateId);
        if (template) {
          topic = `Theme: ${template.title} (${template.theme})`;
        }
      }
      
      if (!topic) {
        alert('Please type a topic idea in the workspace or select a template first to prompt your Custom GPT.');
        return;
      }
      
      // Construct deep link
      const baseUrl = appState.config.customGptUrl || 'https://chatgpt.com';
      const prefix = appState.config.customPromptPrefix || '';
      
      const prompt = `${prefix} ${topic}`.trim();
      const deepLink = `${baseUrl}?q=${encodeURIComponent(prompt)}`;
      
      addLog(`[GPT] Constructing prompt: "${prompt.substring(0, 50)}..."`);
      addLog(`[GPT] Opening Custom GPT: ${baseUrl}`);
      
      // Open ChatGPT in a new tab/app deep-link
      window.open(deepLink, '_blank');
      
      // Log event for training the learning engine (user actively working/drafting content)
      LearningEngine.trackEvent('draft_start');
      
      showToastNotification('Opening ChatGPT...', 'Drafting initiated. Copy the generated post and paste it back here to publish.');
    });
  }
  
  // Render initial history
  renderHistory();
}

// Render history of scheduled posts
function renderHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;
  
  if (appState.posts.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No scheduling history yet.</div>`;
    return;
  }
  
  container.innerHTML = appState.posts.map(p => `
    <div class="history-item">
      <div class="history-meta">
        <span>${new Date(p.timestamp).toLocaleDateString()} ${new Date(p.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        <span class="history-badge">Copied & Ready</span>
      </div>
      <div class="history-content">${escapeHtml(p.text)}</div>
    </div>
  `).join('');
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Settings Screen UI Management
function setupSettingsUI() {
  const reminderSwitch = document.getElementById('reminder-enable');
  const smartModeSwitch = document.getElementById('reminder-smart-mode');
  const manualTimeInput = document.getElementById('manual-reminder-time');
  const audioSwitch = document.getElementById('sound-enable');
  
  // Initial values setup
  reminderSwitch.checked = appState.config.reminderEnabled;
  smartModeSwitch.checked = appState.config.reminderMode === 'smart';
  manualTimeInput.value = appState.config.manualTime;
  audioSwitch.checked = appState.config.soundEnabled;
  
  // Toggle UI visibility depending on states
  toggleManualTimeVisibility(appState.config.reminderMode === 'manual' && appState.config.reminderEnabled);
  
  // Listeners
  reminderSwitch.addEventListener('change', (e) => {
    appState.config.reminderEnabled = e.target.checked;
    LearningEngine.saveConfig(appState.config);
    toggleManualTimeVisibility(appState.config.reminderMode === 'manual' && appState.config.reminderEnabled);
    addLog(`[Settings] Reminders toggled: ${appState.config.reminderEnabled}`);
    initAudio();
  });
  
  smartModeSwitch.addEventListener('change', (e) => {
    appState.config.reminderMode = e.target.checked ? 'smart' : 'manual';
    LearningEngine.saveConfig(appState.config);
    toggleManualTimeVisibility(appState.config.reminderMode === 'manual' && appState.config.reminderEnabled);
    
    if (appState.config.reminderMode === 'smart') {
      // Recalculate immediately
      LearningEngine.recalculateSmartTime();
      appState.config = LearningEngine.getConfig();
      renderAll();
    }
    
    addLog(`[Settings] Changed mode to: ${appState.config.reminderMode}`);
    initAudio();
  });
  
  manualTimeInput.addEventListener('change', (e) => {
    appState.config.manualTime = e.target.value;
    LearningEngine.saveConfig(appState.config);
    addLog(`[Settings] Manual reminder time updated to: ${appState.config.manualTime}`);
  });
  
  audioSwitch.addEventListener('change', (e) => {
    appState.config.soundEnabled = e.target.checked;
    LearningEngine.saveConfig(appState.config);
    addLog(`[Settings] Sound toggled: ${appState.config.soundEnabled}`);
    if (appState.config.soundEnabled) {
      initAudio();
      setTimeout(() => { if (notificationAudio) notificationAudio.play(); }, 300);
    }
  });
  
  // Debug / Demo action button listeners
  const injectMockBtn = document.getElementById('inject-demo-btn');
  if (injectMockBtn) {
    injectMockBtn.addEventListener('click', () => {
      LearningEngine.injectMockData();
      appState.config = LearningEngine.getConfig();
      renderAll();
      showToastNotification('Demo Data Loaded!', 'Availability model has learned scheduling times around 2:00 PM.');
    });
  }
  
  const resetBtn = document.getElementById('reset-learning-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all learned patterns?')) {
        LearningEngine.resetLearning();
        appState.config = LearningEngine.getConfig();
        renderAll();
        showToastNotification('Model Reset', 'Learned availability scores set back to defaults.');
      }
    });
  }
  
  const simulateAlertBtn = document.getElementById('simulate-alert-btn');
  if (simulateAlertBtn) {
    simulateAlertBtn.addEventListener('click', () => {
      triggerNotificationAlert("Scheduled Reminder", "Hey Dhiraj, ready to schedule a LinkedIn post? Click to draft.");
    });
  }

  // ChatGPT custom GPT inputs binding
  const gptSwitch = document.getElementById('gpt-enable');
  const gptUrlInput = document.getElementById('gpt-url');
  const gptPromptPrefixInput = document.getElementById('gpt-prompt-prefix');
  
  if (gptSwitch && gptUrlInput && gptPromptPrefixInput) {
    gptSwitch.checked = appState.config.gptEnabled;
    gptUrlInput.value = appState.config.customGptUrl || 'https://chatgpt.com';
    gptPromptPrefixInput.value = appState.config.customPromptPrefix || '';
    
    gptSwitch.addEventListener('change', (e) => {
      appState.config.gptEnabled = e.target.checked;
      LearningEngine.saveConfig(appState.config);
      addLog(`[Settings] Custom GPT enabled: ${appState.config.gptEnabled}`);
      renderAll();
    });
    
    gptUrlInput.addEventListener('change', (e) => {
      appState.config.customGptUrl = e.target.value.trim();
      LearningEngine.saveConfig(appState.config);
      addLog(`[Settings] Custom GPT URL updated: ${appState.config.customGptUrl}`);
    });
    
    gptPromptPrefixInput.addEventListener('change', (e) => {
      appState.config.customPromptPrefix = e.target.value;
      LearningEngine.saveConfig(appState.config);
      addLog('[Settings] Custom GPT prompt prefix updated');
    });
  }
}

function toggleManualTimeVisibility(show) {
  const row = document.getElementById('manual-time-row');
  if (row) {
    row.style.display = show ? 'flex' : 'none';
  }
}

// Insights Panel UI Management
function setupInsightsUI() {
  // Insights logic is bundled under renderInsights()
}

function renderInsights() {
  const events = LearningEngine.getEvents();
  const confidence = LearningEngine.getLearningConfidence();
  
  // Update gauge dial
  const fill = document.getElementById('gauge-dial');
  if (fill) {
    // 377 is full circle dashoffset. Formula: 377 - (377 * confidence / 100)
    const offset = 377 - (377 * confidence / 100);
    fill.style.strokeDashoffset = offset;
  }
  
  // Update gauge text
  const valueText = document.getElementById('gauge-value');
  if (valueText) {
    valueText.textContent = `${confidence}%`;
  }
  
  // Render Availability Bar Chart
  const chart = document.getElementById('availability-chart');
  if (!chart) return;
  
  const scores = LearningEngine.calculateHourlyScores(events);
  const maxScore = Math.max(...scores, 1); // Avoid division by zero
  
  // Create 24 bars representing hours of day
  // To keep UI tight on mobile, we can group into 2-hour blocks or show standard 12 labels
  let html = '';
  for (let h = 0; h < 24; h += 2) {
    // Score is average of the two hours
    const blockScore = (scores[h] + scores[(h + 1) % 24]) / 2;
    const heightPercent = Math.max(5, Math.round((blockScore / maxScore) * 100));
    
    // Highlight the peak block
    const smartHour = parseInt(appState.config.smartTime.split(':')[0]);
    const isPeakBlock = (smartHour === h || smartHour === h + 1);
    
    const label = `${String(h).padStart(2, '0')}`;
    
    html += `
      <div class="chart-bar-wrapper">
        <div class="chart-bar ${isPeakBlock ? 'highlight' : ''}" style="height: ${heightPercent}%;"></div>
        <div class="chart-label">${label}</div>
      </div>
    `;
  }
  chart.innerHTML = html;
  
  // Update status summary text
  const summaryEl = document.getElementById('insights-summary-text');
  if (summaryEl) {
    if (events.length === 0) {
      summaryEl.textContent = "No scheduling activity logged yet. Start drafting or scheduling posts to train the engine.";
    } else {
      const activeCount = events.length;
      summaryEl.textContent = `Analyzed ${activeCount} interactions. The agent detected high productivity windows. Currently targeting ${appState.config.smartTime} daily.`;
    }
  }
}

// Daily Notification Scheduler logic (Check every 10 seconds)
let lastNotificationDateStr = '';

function setupNotificationChecker() {
  setInterval(() => {
    checkAndTriggerReminder();
  }, 10000); // Check every 10 seconds
}

function checkAndTriggerReminder() {
  if (!appState.config.reminderEnabled) return;
  
  const now = new Date();
  const currentDateStr = now.toDateString(); // e.g. "Thu Jul 16 2026"
  
  // Only trigger once per day
  if (lastNotificationDateStr === currentDateStr) return;
  
  const targetTimeStr = appState.config.reminderMode === 'smart' 
    ? appState.config.smartTime 
    : appState.config.manualTime;
    
  const [targetHour, targetMinute] = targetTimeStr.split(':').map(Number);
  
  if (now.getHours() === targetHour && now.getMinutes() === targetMinute) {
    lastNotificationDateStr = currentDateStr;
    triggerNotificationAlert("Scheduled Reminder", "Hey Dhiraj, ready to schedule a LinkedIn post? Click to draft.");
  }
}

// Push notification / Banner alert presentation (iOS style top drawer banner)
function triggerNotificationAlert(title, message) {
  // Play sound
  if (appState.config.soundEnabled && notificationAudio) {
    notificationAudio.play();
  }
  
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-body').textContent = message;
  
  // Slide down
  toast.classList.add('show');
  addLog(`[Agent Alert] Notification popped: ${message}`);
  
  // Auto slide up after 8 seconds if ignored
  const autoDismiss = setTimeout(() => {
    dismissNotification(false);
  }, 8000);
  
  // Store reference to clear if clicked
  toast.dataset.timeoutId = autoDismiss;
}

// User responds to the notification banner
function handleNotificationClick() {
  const toast = document.getElementById('toast-notification');
  const timeoutId = toast.dataset.timeoutId;
  if (timeoutId) clearTimeout(Number(timeoutId));
  
  toast.classList.remove('show');
  
  // Track positive event
  LearningEngine.trackEvent('reminder_clicked');
  
  // Direct user to scheduler tab
  switchTab('scheduler');
  
  addLog('[Agent Alert] Reminder opened by user');
  renderAll();
}

function dismissNotification(manuallyDismissed = true) {
  const toast = document.getElementById('toast-notification');
  const timeoutId = toast.dataset.timeoutId;
  if (timeoutId) clearTimeout(Number(timeoutId));
  
  toast.classList.remove('show');
  
  if (manuallyDismissed) {
    // Dismissing is a negative indication (user was busy/not available)
    LearningEngine.trackEvent('reminder_dismissed');
    addLog('[Agent Alert] Reminder dismissed by user');
    renderAll();
  }
}

// Toast info banner utility
function showToastNotification(title, message) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-body').textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// Global render update
function renderAll() {
  // Sync text displays
  const timeLabels = document.querySelectorAll('.display-reminder-time');
  const targetTimeStr = appState.config.reminderMode === 'smart' 
    ? appState.config.smartTime 
    : appState.config.manualTime;
    
  timeLabels.forEach(el => {
    el.textContent = targetTimeStr;
  });
  
  const modeLabels = document.querySelectorAll('.display-reminder-mode');
  modeLabels.forEach(el => {
    el.textContent = appState.config.reminderMode === 'smart' ? 'Smart (Auto-learned)' : 'Manual';
  });
  
  // Update GPT button state
  const gptBtn = document.getElementById('gpt-generate-btn');
  if (gptBtn) {
    if (appState.config.gptEnabled) {
      gptBtn.style.opacity = '1';
    } else {
      gptBtn.style.opacity = '0.5';
    }
  }

  // Render tab-specific elements
  if (appState.currentTab === 'insights') {
    renderInsights();
  }
}

// Bind custom actions to notifications
document.getElementById('toast-notification').addEventListener('click', (e) => {
  if (e.target.classList.contains('toast-close')) {
    e.stopPropagation();
    dismissNotification(true);
  } else {
    handleNotificationClick();
  }
});
