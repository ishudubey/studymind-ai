/**
 * StudyMind AI - Main Application Controller
 */

// --- GLOBAL APPLICATION STATE ---
const state = {
  tasks: [],
  apiKey: '',
  theme: 'light',
  onboarded: false,
  sessions: {},      // { subject: count }
  moods: [],         // Array of { energy: 1-5, date: 'YYYY-MM-DD' }
  streak: 0,
  lastStudiedDate: '',
  hoursStudied: 0.0
};

// --- POMODORO TIMER CONFIG & STATE ---
let timerInterval = null;
let timerTimeRemaining = 25 * 60; // 25 mins in seconds
let timerTotalDuration = 25 * 60;
let timerActiveMode = 'work'; // 'work' or 'break'
let timerIsRunning = false;
let selectedMoodBeforeStart = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  loadDataFromStorage();
  initTheme();
  initAppRouter();
  initOnboarding();
  initTaskForm();
  initTimer();
  initMoodModal();
  initSettingsView();
  initAIStudio();
  initChatConcierge();
  initAboutModal();
  
  // Render primary views
  renderAll();
});

// --- STATE STORAGE HANDLERS ---
function loadDataFromStorage() {
  // Key setting
  const savedSettings = localStorage.getItem('studymind_settings');
  if (savedSettings) {
    const parsed = JSON.parse(savedSettings);
    state.apiKey = parsed.apiKey || '';
    state.theme = parsed.theme || 'light';
    state.onboarded = parsed.onboarded || false;
  }
  
  // Tasks list
  const savedTasks = localStorage.getItem('studymind_tasks');
  state.tasks = savedTasks ? JSON.parse(savedTasks) : [];
  
  // Study sessions & hours
  state.hoursStudied = parseFloat(localStorage.getItem('studymind_hours')) || 0.0;
  
  const savedSessions = localStorage.getItem('studymind_sessions');
  state.sessions = savedSessions ? JSON.parse(savedSessions) : {};
  
  const savedMoods = localStorage.getItem('studymind_moods');
  state.moods = savedMoods ? JSON.parse(savedMoods) : [];
  
  // Streak calculations
  state.streak = parseInt(localStorage.getItem('studymind_streak')) || 0;
  state.lastStudiedDate = localStorage.getItem('studymind_last_studied_date') || '';
  
  verifyStreakIntegrity();
}

function saveDataToStorage() {
  localStorage.setItem('studymind_settings', JSON.stringify({
    apiKey: state.apiKey,
    theme: state.theme,
    onboarded: state.onboarded
  }));
  localStorage.setItem('studymind_tasks', JSON.stringify(state.tasks));
  localStorage.setItem('studymind_hours', state.hoursStudied.toFixed(2));
  localStorage.setItem('studymind_sessions', JSON.stringify(state.sessions));
  localStorage.setItem('studymind_moods', JSON.stringify(state.moods));
  localStorage.setItem('studymind_streak', state.streak.toString());
  localStorage.setItem('studymind_last_studied_date', state.lastStudiedDate);
}

function verifyStreakIntegrity() {
  if (!state.lastStudiedDate) return;
  
  const todayStr = getLocalDateString();
  const yesterdayStr = getLocalDateString(-1);
  
  // If last study date was before yesterday, the streak is broken
  if (state.lastStudiedDate !== todayStr && state.lastStudiedDate !== yesterdayStr) {
    state.streak = 0;
    saveDataToStorage();
  }
}

function logStudySession(subject) {
  // Log count
  const subjName = subject || 'General Study';
  state.sessions[subjName] = (state.sessions[subjName] || 0) + 1;
  
  // Log hours (25 mins Pomodoro = ~0.42 hours)
  if (timerActiveMode === 'work') {
    state.hoursStudied += (25 / 60);
  }
  
  // Streak Update
  const todayStr = getLocalDateString();
  const yesterdayStr = getLocalDateString(-1);
  
  if (state.lastStudiedDate !== todayStr) {
    if (state.lastStudiedDate === yesterdayStr) {
      state.streak += 1;
    } else {
      state.streak = 1; // reset streak or start new
    }
    state.lastStudiedDate = todayStr;
  }
  
  saveDataToStorage();
  renderAll();
}

// --- CORE UTILITIES ---
function getLocalDateString(offsetDays = 0) {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysRemaining(dateStr) {
  const deadline = new Date(dateStr + 'T00:00:00');
  const today = new Date(getLocalDateString() + 'T00:00:00');
  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// --- THEME ENGINE ---
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcons();
  
  document.getElementById('btn-toggle-theme').addEventListener('click', toggleTheme);
  document.getElementById('btn-theme-selector').addEventListener('click', toggleTheme);
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcons();
  saveDataToStorage();
}

function updateThemeIcons() {
  const sunIcons = document.querySelectorAll('.theme-sun-icon');
  const moonIcons = document.querySelectorAll('.theme-moon-icon');
  
  if (state.theme === 'dark') {
    sunIcons.forEach(i => i.classList.add('hidden'));
    moonIcons.forEach(i => i.classList.remove('hidden'));
  } else {
    sunIcons.forEach(i => i.classList.remove('hidden'));
    moonIcons.forEach(i => i.classList.add('hidden'));
  }
}

// --- NAVIGATION & ROUTER ---
function initAppRouter() {
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
  
  // Handle initial tab display (defaults to Settings if key missing, else Home)
  const defaultTab = state.apiKey ? 'home' : 'settings';
  switchTab(defaultTab);
}

function switchTab(tabId) {
  // Hide all sections
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.remove('active');
  });
  
  // Show target section
  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) {
    targetView.classList.add('active');
  }
  
  // Update sidebar active class
  document.querySelectorAll('.menu-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Set page header title
  const headerTitle = document.getElementById('view-title');
  if (headerTitle) {
    headerTitle.textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
  }
  
  // Render relevant components upon tab enter
  if (tabId === 'home') renderDashboard();
  if (tabId === 'tasks') renderTaskList();
  if (tabId === 'planner') resetPlannerTimeline();
  if (tabId === 'timer') renderTimerActiveTaskDropdown();
  if (tabId === 'progress') renderProgressDashboard();
}

// --- ONBOARDING ENGINE ---
function initOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  
  if (!state.onboarded) {
    overlay.classList.remove('hidden');
  }
  
  document.getElementById('btn-save-onboarding').addEventListener('click', () => {
    const keyInput = document.getElementById('onboarding-api-key').value.trim();
    if (keyInput) {
      state.apiKey = keyInput;
    }
    state.onboarded = true;
    saveDataToStorage();
    overlay.classList.add('hidden');
    switchTab('home');
    renderAll();
  });
  
  document.getElementById('btn-skip-onboarding').addEventListener('click', () => {
    state.onboarded = true;
    saveDataToStorage();
    overlay.classList.add('hidden');
    switchTab('home');
    renderAll();
  });
}

function togglePasswordVisibility(fieldId) {
  const input = document.getElementById(fieldId);
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

// --- SETTINGS VIEW CONTROLS ---
function initSettingsView() {
  const keyInput = document.getElementById('settings-api-key');
  if (state.apiKey) {
    keyInput.value = state.apiKey;
  }
  
  document.getElementById('btn-save-settings').addEventListener('click', () => {
    state.apiKey = keyInput.value.trim();
    saveDataToStorage();
    alert('Settings saved successfully!');
    renderAll();
  });
  
  document.getElementById('btn-reset-data').addEventListener('click', () => {
    if (confirm('Are you absolutely sure you want to reset all local data? This deletes your tasks, focus hours, streak details, and API key. This action is permanent.')) {
      localStorage.clear();
      location.reload();
    }
  });
}

// --- TASK MANAGER ---
function initTaskForm() {
  const form = document.getElementById('add-task-form');
  // Set default minimum date to today
  document.getElementById('task-deadline').min = getLocalDateString();
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const subject = document.getElementById('task-subject').value.trim();
    const topic = document.getElementById('task-topic').value.trim();
    const deadline = document.getElementById('task-deadline').value;
    const priority = document.getElementById('task-priority').value;
    
    const newTask = {
      id: generateUUID(),
      subject,
      topic,
      deadline,
      priority,
      completed: false,
      dateCreated: new Date().toISOString()
    };
    
    state.tasks.push(newTask);
    saveDataToStorage();
    form.reset();
    document.getElementById('task-deadline').min = getLocalDateString(); // restore min
    
    renderTaskList();
    renderAll();
  });
}

function getSortedTasks() {
  const activeTasks = state.tasks.filter(t => !t.completed);
  const completedTasks = state.tasks.filter(t => t.completed);
  
  // Sort Active Tasks: Overdue first -> deadline ascending -> priority descending
  activeTasks.sort((a, b) => {
    const diffA = getDaysRemaining(a.deadline);
    const diffB = getDaysRemaining(b.deadline);
    const isOverdueA = diffA < 0;
    const isOverdueB = diffB < 0;
    
    if (isOverdueA && !isOverdueB) return -1;
    if (!isOverdueA && isOverdueB) return 1;
    
    // Sort by deadline date
    if (a.deadline !== b.deadline) {
      return new Date(a.deadline) - new Date(b.deadline);
    }
    
    // Sort by priority weight
    const weight = { 'high': 3, 'medium': 2, 'low': 1 };
    return weight[b.priority] - weight[a.priority];
  });
  
  return [...activeTasks, ...completedTasks];
}

function getUrgencyClass(task) {
  if (task.completed) return 'urgency-green';
  
  const days = getDaysRemaining(task.deadline);
  if (days < 0) return 'urgency-red'; // Overdue
  if (days <= 3) return 'urgency-amber'; // Due in <= 3 days
  return 'urgency-green'; // Safe
}

function renderTaskList() {
  const container = document.getElementById('tasks-container');
  const countBadge = document.getElementById('task-count-badge');
  const sorted = getSortedTasks();
  
  const pendingCount = state.tasks.filter(t => !t.completed).length;
  countBadge.textContent = `${pendingCount} pending task${pendingCount !== 1 ? 's' : ''}`;
  
  if (sorted.length === 0) {
    container.innerHTML = `<p class="empty-state">Your study board is clean! Add a task to get started.</p>`;
    return;
  }
  
  container.innerHTML = '';
  sorted.forEach(task => {
    const urgencyClass = getUrgencyClass(task);
    const daysRemaining = getDaysRemaining(task.deadline);
    let remainingText = '';
    
    if (task.completed) {
      remainingText = 'Completed';
    } else if (daysRemaining < 0) {
      remainingText = `OVERDUE (${Math.abs(daysRemaining)}d ago)`;
    } else if (daysRemaining === 0) {
      remainingText = 'Due Today';
    } else if (daysRemaining === 1) {
      remainingText = 'Due Tomorrow';
    } else {
      remainingText = `${daysRemaining} days left`;
    }
    
    const item = document.createElement('div');
    item.className = `task-card-item ${urgencyClass} ${task.completed ? 'completed-task' : ''}`;
    
    item.innerHTML = `
      <div class="task-item-content">
        <div class="task-checkbox" onclick="toggleTaskCompleted('${task.id}')"></div>
        <div class="task-info-block">
          <span class="task-subject-tag">${escapeHTML(task.subject)}</span>
          <span class="task-title">${escapeHTML(task.topic)}</span>
          <div class="task-meta-row">
            <span>📅 ${task.deadline}</span>
            <span>•</span>
            <span>Priority: ${task.priority.toUpperCase()}</span>
            <span>•</span>
            <span class="task-countdown">${remainingText}</span>
          </div>
        </div>
      </div>
      <div class="task-actions-block">
        <button class="btn-explain-task" onclick="explainTopicAI('${escapeHTML(task.topic)}')">Explain</button>
        <button class="btn-delete-task" onclick="deleteTask('${task.id}')" title="Delete Task">✕</button>
      </div>
    `;
    
    container.appendChild(item);
  });
}

function toggleTaskCompleted(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    saveDataToStorage();
    renderTaskList();
    renderAll();
  }
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  saveDataToStorage();
  renderTaskList();
  renderAll();
}

// --- DAILY PLANNER DISTRIBUTOR ---
function resetPlannerTimeline() {
  document.getElementById('planner-schedule-wrapper').classList.add('hidden');
  document.getElementById('timeline-container').innerHTML = '';
}

document.getElementById('btn-generate-plan').addEventListener('click', () => {
  const hours = parseFloat(document.getElementById('planner-hours').value);
  if (isNaN(hours) || hours <= 0) return;
  
  generateDailyPlan(hours);
});

function generateDailyPlan(availableHours) {
  const container = document.getElementById('timeline-container');
  const wrapper = document.getElementById('planner-schedule-wrapper');
  
  const pendingTasks = state.tasks.filter(t => !t.completed);
  // Sort tasks in study sequence order (same as task list sorting)
  pendingTasks.sort((a, b) => {
    const diffA = getDaysRemaining(a.deadline);
    const diffB = getDaysRemaining(b.deadline);
    const isOverdueA = diffA < 0;
    const isOverdueB = diffB < 0;
    if (isOverdueA && !isOverdueB) return -1;
    if (!isOverdueA && isOverdueB) return 1;
    if (a.deadline !== b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    const weight = { 'high': 3, 'medium': 2, 'low': 1 };
    return weight[b.priority] - weight[a.priority];
  });
  
  if (pendingTasks.length === 0) {
    container.innerHTML = `<p class="empty-state">No pending tasks to schedule. Take a break or add new tasks!</p>`;
    wrapper.classList.remove('hidden');
    return;
  }
  
  // Construct timeline blocks
  const availableMinutes = availableHours * 60;
  let remainingMinutes = availableMinutes;
  
  // Formulate blocks: 45 min focus, 15 min break
  const blocks = [];
  let taskIndex = 0;
  
  while (remainingMinutes > 0 && (taskIndex < pendingTasks.length || blocks.length > 0)) {
    // Determine study size
    const studyBlockSize = Math.min(45, remainingMinutes);
    if (studyBlockSize <= 0) break;
    
    // Assign task
    const activeTask = pendingTasks[taskIndex % pendingTasks.length];
    blocks.push({
      type: 'study',
      duration: studyBlockSize,
      subject: activeTask.subject,
      topic: activeTask.topic
    });
    remainingMinutes -= studyBlockSize;
    taskIndex++;
    
    // Add break block if minutes remain
    if (remainingMinutes > 0) {
      const breakBlockSize = Math.min(15, remainingMinutes);
      blocks.push({
        type: 'break',
        duration: breakBlockSize,
        subject: 'Break Time',
        topic: 'Recharge & stretch'
      });
      remainingMinutes -= breakBlockSize;
    }
  }
  
  // Render timeline schedule starting from current time
  let currentBlockTime = new Date();
  container.innerHTML = '';
  
  blocks.forEach(block => {
    const blockEnd = new Date(currentBlockTime.getTime() + block.duration * 60 * 1000);
    
    const startTimeStr = formatTimeAMPM(currentBlockTime);
    const endTimeStr = formatTimeAMPM(blockEnd);
    
    const item = document.createElement('div');
    item.className = 'timeline-item';
    
    const isBreak = block.type === 'break';
    
    item.innerHTML = `
      <div class="timeline-badge" style="border-color: ${isBreak ? 'var(--text-muted)' : 'var(--primary-teal)'}"></div>
      <div class="timeline-card" style="border-left: 4px solid ${isBreak ? 'var(--text-muted)' : 'var(--primary-teal)'}">
        <div class="timeline-time">${startTimeStr} - ${endTimeStr} (${block.duration} mins)</div>
        <div class="timeline-task-title">${escapeHTML(block.topic)}</div>
        <div class="timeline-task-subj">${escapeHTML(block.subject)}</div>
      </div>
    `;
    
    container.appendChild(item);
    currentBlockTime = blockEnd;
  });
  
  wrapper.classList.remove('hidden');
}

function formatTimeAMPM(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hours should be 12
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutes} ${ampm}`;
}

// --- POMODORO TIMER CORE ---
function initTimer() {
  document.getElementById('timer-mode-work').addEventListener('click', () => setTimerMode('work'));
  document.getElementById('timer-mode-break').addEventListener('click', () => setTimerMode('break'));
  document.getElementById('btn-timer-toggle').addEventListener('click', handleTimerToggle);
  document.getElementById('btn-timer-reset').addEventListener('click', resetTimer);
  
  updateTimerUI();
}

function renderTimerActiveTaskDropdown() {
  const select = document.getElementById('timer-active-task');
  const activeTasks = state.tasks.filter(t => !t.completed);
  
  // Preserve current selection if still valid
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- General Study Session --</option>';
  
  activeTasks.forEach(task => {
    const opt = document.createElement('option');
    opt.value = task.id;
    opt.textContent = `${task.subject}: ${task.topic}`;
    if (task.id === currentVal) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function setTimerMode(mode) {
  if (timerIsRunning) return; // Prevent switching while counting down
  
  timerActiveMode = mode;
  
  if (mode === 'work') {
    timerTotalDuration = 25 * 60;
    document.getElementById('timer-mode-work').classList.add('active');
    document.getElementById('timer-mode-break').classList.remove('active');
  } else {
    timerTotalDuration = 5 * 60;
    document.getElementById('timer-mode-work').classList.remove('active');
    document.getElementById('timer-mode-break').classList.add('active');
  }
  
  timerTimeRemaining = timerTotalDuration;
  updateTimerUI();
}

function updateTimerUI() {
  const minutes = Math.floor(timerTimeRemaining / 60);
  const seconds = timerTimeRemaining % 60;
  
  document.getElementById('timer-time-text').textContent = 
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
  // Circular Progress
  const circle = document.getElementById('timer-progress-ring');
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  
  const fraction = timerTimeRemaining / timerTotalDuration;
  const offset = circumference * (1 - fraction);
  circle.style.strokeDashoffset = offset;
}

function handleTimerToggle() {
  if (timerIsRunning) {
    // Pause Timer
    clearInterval(timerInterval);
    timerIsRunning = false;
    document.getElementById('btn-timer-toggle').textContent = 'Resume Session';
  } else {
    // Check-in mood if starting a focus block from scratch
    if (timerActiveMode === 'work' && timerTimeRemaining === timerTotalDuration) {
      showMoodCheckin();
    } else {
      startTimerCountdown();
    }
  }
}

function startTimerCountdown() {
  timerIsRunning = true;
  document.getElementById('btn-timer-toggle').textContent = 'Pause Focus';
  
  timerInterval = setInterval(() => {
    timerTimeRemaining--;
    if (timerTimeRemaining <= 0) {
      clearInterval(timerInterval);
      timerIsRunning = false;
      playTimerBeepSound();
      
      alert(timerActiveMode === 'work' ? 'Focus Session Completed! Take a short break.' : 'Break completed! Ready to focus?');
      
      if (timerActiveMode === 'work') {
        const picker = document.getElementById('timer-active-task');
        const selectedTaskId = picker.value;
        const task = state.tasks.find(t => t.id === selectedTaskId);
        logStudySession(task ? task.subject : 'General Study');
        
        // Auto transition to break
        setTimerMode('break');
      } else {
        // Auto transition to work
        setTimerMode('work');
      }
      document.getElementById('btn-timer-toggle').textContent = 'Start Session';
    }
    updateTimerUI();
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);
  timerIsRunning = false;
  timerTimeRemaining = timerTotalDuration;
  document.getElementById('btn-timer-toggle').textContent = 'Start Session';
  updateTimerUI();
}

// Generate synthesizer sound offline using Web Audio API
function playTimerBeepSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, audioCtx.currentTime); // A5 note
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    
    oscillator.start();
    // Beep for 500ms
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.error('AudioContext is blocked or not supported:', e);
  }
}

// --- MOOD MODAL CHECK-IN CONTROL ---
function initMoodModal() {
  const moodButtons = document.querySelectorAll('.mood-btn');
  const confirmBtn = document.getElementById('btn-confirm-mood');
  const cancelBtn = document.getElementById('btn-cancel-timer');
  
  moodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      moodButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMoodBeforeStart = parseInt(btn.getAttribute('data-mood'));
      confirmBtn.removeAttribute('disabled');
    });
  });
  
  confirmBtn.addEventListener('click', () => {
    if (selectedMoodBeforeStart) {
      // Save Mood Check-in
      state.moods.push({
        energy: selectedMoodBeforeStart,
        date: getLocalDateString()
      });
      saveDataToStorage();
      
      // Reset Modal & Start Timer
      closeModal('mood-modal');
      startTimerCountdown();
    }
  });
  
  cancelBtn.addEventListener('click', () => {
    closeModal('mood-modal');
  });
}

function showMoodCheckin() {
  // Clear previous selections
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-confirm-mood').setAttribute('disabled', 'true');
  selectedMoodBeforeStart = null;
  
  openModal('mood-modal');
}

// --- DASHBOARD (HOME) RENDERS ---
function renderDashboard() {
  // Check API setup status
  const apiStatusBanner = document.getElementById('api-status-banner');
  if (state.apiKey) {
    apiStatusBanner.className = 'api-badge badge-success';
    apiStatusBanner.innerHTML = '<span>⚡ AI Concierge Enabled</span>';
  } else {
    apiStatusBanner.className = 'api-badge badge-warning';
    apiStatusBanner.innerHTML = '<span>⚠️ Setup Gemini Key in Settings</span>';
  }
  
  // Pending Tasks count
  const pendingCount = state.tasks.filter(t => !t.completed).length;
  document.getElementById('stat-pending-tasks').textContent = pendingCount;
  
  // Completed count
  const completedCount = state.tasks.filter(t => t.completed).length;
  document.getElementById('stat-completed-tasks').textContent = completedCount;
  
  // Streak
  const streakText = state.streak === 1 ? '1 day' : `${state.streak} days`;
  document.getElementById('stat-streak').textContent = state.streak > 0 ? `🔥 ${streakText}` : '0 days';
  
  // Streak message update
  updateStreakMotivation();
  
  // Weekly hours studied
  document.getElementById('stat-hours').textContent = `${state.hoursStudied.toFixed(1)}h`;
  
  // Urgent List Section & Top Banner Countdown
  renderUrgentSectionAndBanners();
}

function updateStreakMotivation() {
  const quoteEl = document.getElementById('motivational-quote');
  
  if (state.streak === 0) {
    quoteEl.textContent = '"Focus starts with a single step. Power up a study timer block today to establish a study streak!"';
  } else if (state.streak <= 2) {
    quoteEl.textContent = '"Awesome! You\'re building momentum. Your study streak is active. Keep the flame burning!"';
  } else if (state.streak <= 5) {
    quoteEl.textContent = '"You are in the study zone! High-efficiency scheduling and daily discipline are forming strong habits. Keep going!"';
  } else {
    quoteEl.textContent = '"Incredible, you have locked in a legendary streak! The Study Concierge is inspired by your commitment. Keep it up!"';
  }
}

function renderUrgentSectionAndBanners() {
  const urgentContainer = document.getElementById('dashboard-urgent-list');
  const alertBanner = document.getElementById('home-alert-banner');
  const alertContent = document.getElementById('alert-banner-content');
  
  const pendingTasks = state.tasks.filter(t => !t.completed);
  
  // Check for overdue or due soon tasks
  const overdueTasks = [];
  const dueSoonTasks = [];
  
  pendingTasks.forEach(task => {
    const days = getDaysRemaining(task.deadline);
    if (days < 0) {
      overdueTasks.push(task);
    } else if (days <= 3) {
      dueSoonTasks.push(task);
    }
  });
  
  // Show/Hide top notification banner
  if (overdueTasks.length > 0 || dueSoonTasks.length > 0) {
    alertBanner.classList.remove('hidden');
    let message = '';
    if (overdueTasks.length > 0) {
      message += `<strong>${overdueTasks.length} task${overdueTasks.length !== 1 ? 's are' : ' is'} overdue!</strong> `;
    }
    if (dueSoonTasks.length > 0) {
      message += `${message ? ' Also, ' : ''}<strong>${dueSoonTasks.length} task${dueSoonTasks.length !== 1 ? 's are' : ' is'} due within 3 days.</strong>`;
    }
    alertContent.innerHTML = message + ' Review your schedule and prioritize these items.';
  } else {
    alertBanner.classList.add('hidden');
  }
  
  // Fill in the dashboard list
  const urgentMerged = [...overdueTasks, ...dueSoonTasks];
  if (urgentMerged.length === 0) {
    urgentContainer.innerHTML = `<p class="empty-state">No urgent deadlines. Good job staying on track!</p>`;
    return;
  }
  
  // Sort urgent list
  urgentMerged.sort((a,b) => getDaysRemaining(a.deadline) - getDaysRemaining(b.deadline));
  
  urgentContainer.innerHTML = '';
  urgentMerged.slice(0, 5).forEach(task => {
    const days = getDaysRemaining(task.deadline);
    let remainingLabel = '';
    let badgeClass = 'urgency-badge';
    
    if (days < 0) {
      remainingLabel = `Overdue ${Math.abs(days)}d`;
      badgeClass += ' urgency-red';
    } else if (days === 0) {
      remainingLabel = 'Due Today';
      badgeClass += ' urgency-amber';
    } else {
      remainingLabel = `Due in ${days}d`;
      badgeClass += ' urgency-amber';
    }
    
    const row = document.createElement('div');
    row.className = 'dashboard-list-item';
    row.innerHTML = `
      <div>
        <span style="font-weight:600; color: var(--primary-accent); font-size:0.75rem;">${escapeHTML(task.subject)}</span>: 
        <strong>${escapeHTML(task.topic)}</strong>
      </div>
      <span class="${badgeClass}">${remainingLabel}</span>
    `;
    urgentContainer.appendChild(row);
  });
}

// --- PROGRESS VIEW CONTROLS ---
function renderProgressDashboard() {
  const container = document.getElementById('progress-bars-container');
  
  // Map tasks to subjects
  const subjectMap = {}; // { subjectName: { completed: 0, total: 0 } }
  
  state.tasks.forEach(task => {
    if (!subjectMap[task.subject]) {
      subjectMap[task.subject] = { completed: 0, total: 0 };
    }
    subjectMap[task.subject].total++;
    if (task.completed) {
      subjectMap[task.subject].completed++;
    }
  });
  
  const subjects = Object.keys(subjectMap);
  
  if (subjects.length === 0) {
    container.innerHTML = `<p class="empty-state">Create and complete tasks under subjects to view your completion rates.</p>`;
    return;
  }
  
  container.innerHTML = '';
  subjects.forEach(subject => {
    const stats = subjectMap[subject];
    const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    
    const item = document.createElement('div');
    item.className = 'subject-progress-item';
    
    item.innerHTML = `
      <div class="subj-progress-meta">
        <span>${escapeHTML(subject)}</span>
        <span>${stats.completed}/${stats.total} Topics Done (${percentage}%)</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
      </div>
    `;
    
    container.appendChild(item);
  });
  
  // Focus sessions checklist tally
  const tallyContainer = document.getElementById('timer-subject-tally');
  const sessionSubjects = Object.keys(state.sessions);
  
  if (sessionSubjects.length === 0) {
    tallyContainer.innerHTML = `<li class="empty-state">No sessions completed yet. Let's study!</li>`;
  } else {
    tallyContainer.innerHTML = '';
    sessionSubjects.forEach(sub => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>📚 ${escapeHTML(sub)}</span>
        <strong>${state.sessions[sub]} session${state.sessions[sub] !== 1 ? 's' : ''}</strong>
      `;
      tallyContainer.appendChild(li);
    });
  }
}

// Download weekly reports locally
document.getElementById('btn-export-report').addEventListener('click', () => {
  const pending = state.tasks.filter(t => !t.completed);
  const completed = state.tasks.filter(t => t.completed);
  
  let reportText = `=======================================\n`;
  reportText += `   STUDYMIND AI WEEKLY STUDY REPORT   \n`;
  reportText += `   Generated: ${new Date().toLocaleString()}\n`;
  reportText += `=======================================\n\n`;
  
  reportText += `--- METRICS OVERVIEW ---\n`;
  reportText += `* Focus Hours Studied: ${state.hoursStudied.toFixed(2)} hours\n`;
  reportText += `* Current Study Streak: ${state.streak} consecutive days\n`;
  reportText += `* Total Completed Tasks: ${completed.length}\n`;
  reportText += `* Total Pending Tasks: ${pending.length}\n\n`;
  
  reportText += `--- FOCUS SESSIONS LOG ---\n`;
  const sessionSubjects = Object.keys(state.sessions);
  if (sessionSubjects.length === 0) {
    reportText += `No custom Pomodoro focus sessions logged.\n`;
  } else {
    sessionSubjects.forEach(s => {
      reportText += `* Subject [${s}]: ${state.sessions[s]} sessions logged\n`;
    });
  }
  reportText += `\n`;
  
  reportText += `--- RECENT MOOD & ENERGY LEVELS ---\n`;
  if (state.moods.length === 0) {
    reportText += `No energy level records logged.\n`;
  } else {
    state.moods.slice(-10).forEach(m => {
      reportText += `* Date: ${m.date} | Energy level: ${m.energy}/5\n`;
    });
  }
  reportText += `\n`;
  
  reportText += `--- COMPLETED TOPICS ---\n`;
  if (completed.length === 0) {
    reportText += `No tasks marked as completed yet.\n`;
  } else {
    completed.forEach(t => {
      reportText += `- [${t.subject}] Topic: ${t.topic} (Finished: ${new Date(t.dateCreated).toLocaleDateString()})\n`;
    });
  }
  reportText += `\n`;
  
  reportText += `--- PENDING TOPICS & DEADLINES ---\n`;
  if (pending.length === 0) {
    reportText += `All tasks finished!\n`;
  } else {
    pending.forEach(t => {
      reportText += `- [${t.subject}] Topic: ${t.topic} | Deadline: ${t.deadline} | Priority: ${t.priority.toUpperCase()}\n`;
    });
  }
  reportText += `\n=======================================\n`;
  
  // Download action
  const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `StudyMind_Weekly_Report_${getLocalDateString()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// --- AI STUDIO & GEMINI ACTIONS ---
function initAIStudio() {
  // Syllabus Planner Action
  const btnParse = document.getElementById('btn-parse-syllabus');
  const syllabusInput = document.getElementById('ai-syllabus-text');
  const syllabusSpinner = document.getElementById('syllabus-loading');
  
  btnParse.addEventListener('click', async () => {
    const text = syllabusInput.value.trim();
    if (!text) {
      alert("Please paste your syllabus text first.");
      return;
    }
    
    if (!state.apiKey) {
      alert("Please setup your free Gemini API Key in the Settings view to use AI Features.");
      switchTab('settings');
      return;
    }
    
    btnParse.disabled = true;
    syllabusSpinner.classList.remove('hidden');
    
    try {
      const newTasks = await parseSyllabusToTasks(text, state.apiKey);
      
      if (newTasks && Array.isArray(newTasks)) {
        newTasks.forEach(item => {
          state.tasks.push({
            id: generateUUID(),
            subject: item.subject || 'Syllabus Course',
            topic: item.topic || 'Syllabus Topic',
            deadline: getLocalDateString(item.deadlineDays || 5),
            priority: item.priority || 'medium',
            completed: false,
            dateCreated: new Date().toISOString()
          });
        });
        
        saveDataToStorage();
        syllabusInput.value = '';
        alert(`Success! Generated and added ${newTasks.length} topics to your study tasks list.`);
        renderTaskList();
        renderAll();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      btnParse.disabled = false;
      syllabusSpinner.classList.add('hidden');
    }
  });
  
  // Quiz Generator Action
  const btnQuiz = document.getElementById('btn-generate-quiz');
  const quizInput = document.getElementById('ai-quiz-topic');
  const quizSpinner = document.getElementById('quiz-loading');
  const quizPanel = document.getElementById('quiz-quiz-panel');
  const quizQuestionsContainer = document.getElementById('quiz-questions-container');
  const btnSubmitQuiz = document.getElementById('btn-submit-quiz');
  const quizScoreBadge = document.getElementById('quiz-score-badge');
  
  let activeQuizQuestions = [];
  
  btnQuiz.addEventListener('click', async () => {
    const notes = quizInput.value.trim();
    if (!notes) {
      alert("Please provide a topic name or study notes text first.");
      return;
    }
    
    if (!state.apiKey) {
      alert("Please setup your free Gemini API Key in the Settings view to use AI Features.");
      switchTab('settings');
      return;
    }
    
    btnQuiz.disabled = true;
    quizSpinner.classList.remove('hidden');
    quizPanel.classList.add('hidden');
    quizScoreBadge.classList.add('hidden');
    
    try {
      activeQuizQuestions = await generateStudyQuiz(notes, state.apiKey);
      
      if (activeQuizQuestions && Array.isArray(activeQuizQuestions) && activeQuizQuestions.length > 0) {
        // Render Questions
        quizQuestionsContainer.innerHTML = '';
        activeQuizQuestions.forEach((q, qIdx) => {
          const block = document.createElement('div');
          block.className = 'quiz-question-block';
          
          let optionsHtml = '';
          q.options.forEach((opt, oIdx) => {
            optionsHtml += `
              <label class="quiz-option-label" id="lbl-q-${qIdx}-opt-${oIdx}">
                <input type="radio" name="q-${qIdx}" value="${oIdx}">
                <span>${escapeHTML(opt)}</span>
              </label>
            `;
          });
          
          block.innerHTML = `
            <div class="quiz-q-num">Question ${qIdx + 1}</div>
            <div class="quiz-q-text">${escapeHTML(q.question)}</div>
            <div class="quiz-options-list">
              ${optionsHtml}
            </div>
          `;
          quizQuestionsContainer.appendChild(block);
        });
        
        quizPanel.classList.remove('hidden');
        btnSubmitQuiz.disabled = false;
      }
    } catch (err) {
      alert(err.message);
    } finally {
      btnQuiz.disabled = false;
      quizSpinner.classList.add('hidden');
    }
  });
  
  // Submit Quiz Action
  btnSubmitQuiz.addEventListener('click', () => {
    let score = 0;
    
    activeQuizQuestions.forEach((q, qIdx) => {
      const selected = document.querySelector(`input[name="q-${qIdx}"]:checked`);
      const correctIdx = q.answerIndex;
      
      // Style options
      q.options.forEach((_, oIdx) => {
        const label = document.getElementById(`lbl-q-${qIdx}-opt-${oIdx}`);
        label.classList.remove('correct-option', 'incorrect-option');
        
        if (oIdx === correctIdx) {
          label.classList.add('correct-option');
        }
      });
      
      if (selected) {
        const userVal = parseInt(selected.value);
        if (userVal === correctIdx) {
          score++;
        } else {
          const userLabel = document.getElementById(`lbl-q-${qIdx}-opt-${userVal}`);
          userLabel.classList.add('incorrect-option');
        }
      }
    });
    
    // Display score
    quizScoreBadge.textContent = `Score: ${score} / 5`;
    quizScoreBadge.className = `badge ${score >= 3 ? 'badge-success' : 'badge-warning'}`;
    quizScoreBadge.classList.remove('hidden');
    btnSubmitQuiz.disabled = true;
    
    // Scroll to panel bottom
    quizPanel.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
}

// --- TOPIC EXPLAINER ACTION ---
async function explainTopicAI(topicName) {
  if (!state.apiKey) {
    alert("Please setup your free Gemini API Key in the Settings view to use AI Features.");
    switchTab('settings');
    return;
  }
  
  const modal = document.getElementById('explain-modal');
  const spinner = document.getElementById('explain-loading');
  const content = document.getElementById('explain-content');
  
  document.getElementById('explain-topic-title').textContent = `AI Explains: ${topicName}`;
  spinner.classList.remove('hidden');
  content.classList.add('hidden');
  openModal('explain-modal');
  
  try {
    const explanation = await getTopicExplanation(topicName, state.apiKey);
    
    // Parse formatting into simple lines
    const lines = explanation.split('\n').filter(l => l.trim().length > 0);
    let html = '<ul>';
    lines.forEach(l => {
      // Strip bullet characters like * or -
      const cleanLine = l.replace(/^\s*[-*•]\s*/, '');
      html += `<li>${escapeHTML(cleanLine)}</li>`;
    });
    html += '</ul>';
    
    content.innerHTML = html;
    content.classList.remove('hidden');
  } catch (err) {
    content.innerHTML = `<p class="warning-text">${escapeHTML(err.message)}</p>`;
    content.classList.remove('hidden');
  } finally {
    spinner.classList.add('hidden');
  }
}

// --- CHAT CONCIERGE PANEL CONTROLLER ---
function initChatConcierge() {
  const toggleBtn = document.getElementById('btn-chat-toggle');
  const closeBtn = document.getElementById('btn-chat-close');
  const windowEl = document.getElementById('chat-window');
  const sendBtn = document.getElementById('btn-chat-send');
  const textInput = document.getElementById('chat-user-input');
  
  toggleBtn.addEventListener('click', () => {
    windowEl.classList.toggle('hidden');
    document.querySelector('.chat-badge').classList.add('hidden');
    if (!windowEl.classList.contains('hidden')) {
      textInput.focus();
    }
  });
  
  closeBtn.addEventListener('click', () => {
    windowEl.classList.add('hidden');
  });
  
  sendBtn.addEventListener('click', handleChatSend);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleChatSend();
    }
  });
}

async function handleChatSend() {
  const inputEl = document.getElementById('chat-user-input');
  const message = inputEl.value.trim();
  if (!message) return;
  
  // Append user message
  appendChatMessage(message, 'user');
  inputEl.value = '';
  
  if (!state.apiKey) {
    appendChatMessage('Please setup your free Gemini API Key in the Settings page to consult with your AI Concierge.', 'assistant');
    return;
  }
  
  // Render loading bubble
  const loaderId = appendChatLoaderBubble();
  
  try {
    const response = await getConciergeResponse(message, state.tasks, state.moods, [], state.apiKey);
    removeChatLoaderBubble(loaderId);
    appendChatMessage(response, 'assistant');
  } catch (err) {
    removeChatLoaderBubble(loaderId);
    appendChatMessage(err.message, 'assistant');
  }
}

function triggerQuickChat(promptText) {
  document.getElementById('chat-user-input').value = promptText;
  handleChatSend();
}

function appendChatMessage(text, sender) {
  const container = document.getElementById('chat-messages-container');
  const bubble = document.createElement('div');
  bubble.className = `chat-message ${sender}`;
  bubble.innerHTML = escapeHTML(text).replace(/\n/g, '<br>');
  
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function appendChatLoaderBubble() {
  const container = document.getElementById('chat-messages-container');
  const bubble = document.createElement('div');
  const uniqueId = 'loader-' + Date.now();
  bubble.id = uniqueId;
  bubble.className = 'chat-message assistant';
  bubble.innerHTML = `<div class="spinner" style="width:12px; height:12px; border-width:2px; display:inline-block; margin-right:5px;"></div> <em>Thinking...</em>`;
  
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return uniqueId;
}

function removeChatLoaderBubble(id) {
  const el = document.getElementById(id);
  if (el) {
    el.parentNode.removeChild(el);
  }
}

// --- ABOUT KAGGE DEET CONTROLS ---
function initAboutModal() {
  document.getElementById('btn-about-trigger').addEventListener('click', () => {
    openModal('about-modal');
  });
}

// --- HELPER COMPONENT DISPATCHERS ---
function renderAll() {
  renderDashboard();
  renderTimerActiveTaskDropdown();
  renderProgressDashboard();
}

function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function generateUUID() {
  return 'task-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
