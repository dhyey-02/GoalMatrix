// GoalMatrix Core Application Logic
import { 
    initializeUsers, 
    loginUser, 
    registerUser, 
    logoutUser, 
    getSession, 
    getUserData, 
    saveUserData, 
    logUserActivity, 
    isAppLocked, 
    verifyPIN 
} from './auth.js';
import { 
    getAdminMetrics, 
    exportEntireDatabase, 
    importEntireDatabase 
} from './admin.js';
import { 
    getRandomDailyQuote, 
    getRandomGoalAffirmation 
} from './quotes.js';

// Global App State
let state = {
    session: null,
    userData: null,
    activeTab: 'goals', // goals, reflection, planner, settings, admin
    currentReflectionDate: getLocalDateString(),
    currentPlannerDate: getLocalDateString(),
    activePINInput: "",
    pinLockCallback: null
};

// Preset lists for goal backgrounds
const COLOR_PRESETS = [
    { name: "Neon Violet", value: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" },
    { name: "Cyberpunk Pink", value: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)" },
    { name: "Ocean Breeze", value: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)" },
    { name: "Sunset Orange", value: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" },
    { name: "Emerald Forest", value: "linear-gradient(135deg, #10b981 0%, #047857 100%)" }
];

const PHOTO_PRESETS = [
    { name: "Starry Night", value: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=600&q=80" },
    { name: "Mountain Goal", value: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80" },
    { name: "Deep Space", value: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80" },
    { name: "Aesthetic Desk", value: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=600&q=80" }
];

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
    initializeUsers();
    initApp();
    setupNotificationWorker();
});

// Setup Simulated Background Notification
function setupNotificationWorker() {
    if ('Notification' in window && Notification.permission === 'default') {
        // We will ask for permissions on user interaction in Settings, not automatically.
    }
    
    // Check local time to simulate 9 PM reminder
    setInterval(() => {
        const now = new Date();
        // Trigger notification at 9 PM (21:00)
        if (now.getHours() === 21 && now.getMinutes() === 0 && now.getSeconds() === 0) {
            triggerSystemNotification("GoalMatrix Reflection", "Write your daily reflection! Keep your self-improvement streak alive. 🔥");
        }
    }, 1000);
}

function triggerSystemNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/1067/1067357.png'
        });
    } else {
        // Fallback to in-app toast
        showToast(body, "info");
    }
}

// Helper to get local date string YYYY-MM-DD
function getLocalDateString(date = new Date()) {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
}

// Toast helper
function showToast(message, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} glass-panel`;
    
    let icon = "✓";
    if (type === "info") icon = "ℹ";
    if (type === "warning") icon = "⚠";
    
    toast.innerHTML = `
        <span style="font-weight: bold; font-size: 16px;">${icon}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function initApp() {
    state.session = getSession();
    
    if (!state.session) {
        showAuthScreen();
        return;
    }

    // Check if security lock is active
    if (isAppLocked(state.session.email)) {
        showLockScreen();
        return;
    }

    loadDashboard();
}

function showAuthScreen() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('app-main').classList.add('hidden');
    document.getElementById('lock-screen-overlay').classList.add('hidden');
    
    setupAuthListeners();
}

function showLockScreen() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-main').classList.add('hidden');
    document.getElementById('lock-screen-overlay').classList.remove('hidden');
    
    state.activePINInput = "";
    updatePINDots();
    setupPINPadListeners();
}

function loadDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('lock-screen-overlay').classList.add('hidden');
    document.getElementById('app-main').classList.remove('hidden');
    
    // Load data
    state.userData = getUserData(state.session.email);
    
    // Refresh name in UI
    document.getElementById('user-display-name').textContent = state.session.name;
    
    // Enable/disable admin tab
    const adminTab = document.getElementById('tab-admin');
    if (state.session.isAdmin) {
        adminTab.classList.remove('hidden');
    } else {
        adminTab.classList.add('hidden');
    }
    
    // Check theme
    const isDark = state.userData.settings ? state.userData.settings.darkMode : true;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    
    calculateStreak();
    renderHeader();
    switchTab(state.activeTab);
    setupAppListeners();
}

function renderHeader() {
    const streakVal = state.userData.streak || 0;
    const streakDisplay = document.getElementById('streak-count-display');
    streakDisplay.textContent = streakVal;
    
    if (streakVal > 0) {
        document.getElementById('streak-badge-container').style.display = 'flex';
    } else {
        document.getElementById('streak-badge-container').style.display = 'none';
    }
}

// Calculate consistency streaks
function calculateStreak() {
    const reflections = state.userData.reflections || {};
    let streak = 0;
    let checkDate = new Date();
    
    // If reflection exists for today, start counting from today
    // If not, but exists for yesterday, start counting from yesterday
    // Otherwise streak is 0.
    const todayStr = getLocalDateString(checkDate);
    
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = getLocalDateString(checkDate);
    
    let startingDate = null;
    if (reflections[todayStr] && (reflections[todayStr].good || reflections[todayStr].bad)) {
        startingDate = new Date();
    } else if (reflections[yesterdayStr] && (reflections[yesterdayStr].good || reflections[yesterdayStr].bad)) {
        startingDate = new Date();
        startingDate.setDate(startingDate.getDate() - 1);
    }
    
    if (startingDate) {
        let currentDateStr = getLocalDateString(startingDate);
        while (reflections[currentDateStr] && (reflections[currentDateStr].good || reflections[currentDateStr].bad)) {
            streak++;
            startingDate.setDate(startingDate.getDate() - 1);
            currentDateStr = getLocalDateString(startingDate);
        }
    }
    
    state.userData.streak = streak;
    saveUserData(state.session.email, state.userData);
}

// Switch between tabs
function switchTab(tabId) {
    state.activeTab = tabId;
    
    // Update navigation active class
    document.querySelectorAll('.nav-tab').forEach(tab => {
        if (tab.id === `tab-${tabId}`) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Update view panels visibility
    document.querySelectorAll('.view-panel').forEach(panel => {
        if (panel.id === `view-${tabId}`) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });
    
    // Load content for active tab
    if (tabId === 'goals') {
        renderGoals();
    } else if (tabId === 'reflection') {
        renderReflection();
    } else if (tabId === 'planner') {
        renderPlanner();
    } else if (tabId === 'settings') {
        renderSettings();
    } else if (tabId === 'admin') {
        renderAdmin();
    }
}

/* ================== authentication pages listeners ================== */
function setupAuthListeners() {
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    const toSignup = document.getElementById('to-signup');
    const toLogin = document.getElementById('to-login');
    const signupDiv = document.getElementById('signup-div');
    const loginDiv = document.getElementById('login-div');

    toSignup.onclick = () => {
        loginDiv.classList.add('hidden');
        signupDiv.classList.remove('hidden');
    };

    toLogin.onclick = () => {
        signupDiv.classList.add('hidden');
        loginDiv.classList.remove('hidden');
    };

    signupForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const pass = document.getElementById('signup-password').value;
        
        try {
            registerUser(name, email, pass);
            showToast("Registration successful! Logging you in.");
            loginUser(email, pass);
            logUserActivity(email, "Registered and logged in");
            state.activeTab = 'goals';
            initApp();
        } catch (err) {
            showToast(err.message, "warning");
        }
    };

    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        
        try {
            loginUser(email, pass);
            showToast("Welcome back!");
            logUserActivity(email, "Logged in");
            state.activeTab = 'goals';
            initApp();
        } catch (err) {
            showToast(err.message, "warning");
        }
    };
}

/* ================== PIN Lock Overlay logic ================== */
function setupPINPadListeners() {
    const buttons = document.querySelectorAll('.pin-btn[data-value]');
    buttons.forEach(btn => {
        btn.onclick = () => {
            const val = btn.getAttribute('data-value');
            if (state.activePINInput.length < 4) {
                state.activePINInput += val;
                updatePINDots();
            }
            
            if (state.activePINInput.length === 4) {
                // Short timeout to show the last filled dot
                setTimeout(() => {
                    if (state.pinLockCallback) {
                        state.pinLockCallback(state.activePINInput);
                    } else {
                        // Default app unlock
                        if (verifyPIN(state.session.email, state.activePINInput)) {
                            showToast("App unlocked!");
                            logUserActivity(state.session.email, "Unlocked app with PIN");
                            loadDashboard();
                        } else {
                            showToast("Invalid PIN. Try again.", "warning");
                            state.activePINInput = "";
                            updatePINDots();
                        }
                    }
                }, 200);
            }
        };
    });
    
    document.getElementById('pin-clear').onclick = () => {
        state.activePINInput = "";
        updatePINDots();
    };
}

function updatePINDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, index) => {
        if (index < state.activePINInput.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

/* ================== Header actions listener ================== */
function setupAppListeners() {
    // Nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.onclick = (e) => {
            e.preventDefault();
            const tabId = tab.id.replace('tab-', '');
            switchTab(tabId);
        };
    });
    
    // Theme toggle (header)
    document.getElementById('theme-toggle').onclick = () => {
        const settings = state.userData.settings || {};
        settings.darkMode = !settings.darkMode;
        state.userData.settings = settings;
        saveUserData(state.session.email, state.userData);
        document.documentElement.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
        showToast(`Switched to ${settings.darkMode ? 'Dark' : 'Light'} theme`);
    };
    
    // Logout btn (header)
    document.getElementById('logout-btn').onclick = () => {
        if (confirm("Are you sure you want to log out?")) {
            logUserActivity(state.session.email, "Logged out");
            logoutUser();
            showToast("Logged out successfully");
            initApp();
        }
    };
}

/* ================== GOALS SECTION ================== */
function renderGoals() {
    const container = document.getElementById('goals-list');
    container.innerHTML = '';
    
    const goals = state.userData.goals || [];
    
    if (goals.length === 0) {
        container.innerHTML = `
            <div class="glass-panel text-center" style="grid-column: 1 / -1; padding: 40px;">
                <p style="color: var(--text-secondary); margin-bottom: 16px;">No 10-year goals created yet. Let's design your future self!</p>
                <button class="btn-primary" id="first-goal-btn">+ Create First Goal</button>
            </div>
        `;
        document.getElementById('first-goal-btn').onclick = () => showGoalModal();
        return;
    }
    
    goals.forEach((goal, index) => {
        const card = document.createElement('div');
        
        // Define background aesthetics based on user selections
        let bgStyle = "";
        let themeClass = "default-theme";
        
        if (goal.backgroundType === "color" && goal.backgroundVal) {
            bgStyle = `background: ${goal.backgroundVal}; border: 1px solid rgba(255,255,255,0.15);`;
            themeClass = "";
        } else if (goal.backgroundType === "photo" && goal.backgroundVal) {
            bgStyle = `background-image: url('${goal.backgroundVal}'); border: 1px solid rgba(255,255,255,0.15);`;
            themeClass = "";
        }
        
        card.className = `goal-card glass-panel glow-effect ${themeClass}`;
        if (bgStyle) card.setAttribute('style', bgStyle);
        
        // Use a default motivational affirmation if no title is specified or just showing aesthetic view
        const displayTitle = goal.title ? goal.title : "New Vision Goal";
        const displayAffirmation = goal.affirmation ? goal.affirmation : getRandomGoalAffirmation();
        
        let statusClass = "status-not-started";
        if (goal.status === "In Progress") statusClass = "status-in-progress";
        if (goal.status === "Achieved") statusClass = "status-achieved";
        
        card.innerHTML = `
            <div class="goal-header-row">
                <span class="goal-category">${goal.category || 'Personal'}</span>
                <span class="goal-status ${statusClass}">${goal.status || 'Not Started'}</span>
            </div>
            <div class="goal-body">
                <h3 class="goal-title">${displayTitle}</h3>
                <p class="goal-affirmation">"${displayAffirmation}"</p>
            </div>
            <div class="goal-footer">
                <span class="goal-timeline">Target: ${goal.targetYear || '10 Years'}</span>
                <button class="icon-btn" style="width: 28px; height: 28px; font-size: 12px;" onclick="window.editGoal(${index})">✎</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Make editGoal available globally for click handlers
window.editGoal = function(index) {
    showGoalModal(index);
};

// Open Goal Modal (Create or Edit)
function showGoalModal(index = null) {
    const modal = document.getElementById('goal-modal');
    const titleInput = document.getElementById('goal-modal-title');
    const categorySelect = document.getElementById('goal-modal-category');
    const yearInput = document.getElementById('goal-modal-year');
    const statusSelect = document.getElementById('goal-modal-status');
    const affirmationInput = document.getElementById('goal-modal-affirmation');
    const deleteBtn = document.getElementById('goal-modal-delete');
    
    // Set default target year to 10 years from now (2036)
    const defaultFutureYear = new Date().getFullYear() + 10;
    
    let bgType = "default";
    let bgVal = "";
    
    if (index !== null) {
        // Edit existing goal
        const goal = state.userData.goals[index];
        titleInput.value = goal.title || '';
        categorySelect.value = goal.category || 'Personal';
        yearInput.value = goal.targetYear || defaultFutureYear;
        statusSelect.value = goal.status || 'Not Started';
        affirmationInput.value = goal.affirmation || '';
        bgType = goal.backgroundType || 'default';
        bgVal = goal.backgroundVal || '';
        
        deleteBtn.classList.remove('hidden');
        document.getElementById('goal-modal-header').textContent = "Edit 10-Year Goal";
    } else {
        // Create new goal
        titleInput.value = '';
        categorySelect.value = 'Personal';
        yearInput.value = defaultFutureYear;
        statusSelect.value = 'Not Started';
        affirmationInput.value = getRandomGoalAffirmation();
        bgType = 'default';
        bgVal = '';
        
        deleteBtn.classList.add('hidden');
        document.getElementById('goal-modal-header').textContent = "Add 10-Year Goal";
    }
    
    // Set up presets selection in modal
    renderGoalBGPresetOptions(bgType, bgVal);
    
    modal.style.display = 'flex';
    
    // Handle Save
    document.getElementById('goal-modal-form').onsubmit = (e) => {
        e.preventDefault();
        
        // Gather selected background
        const selectedPresetBtn = document.querySelector('.preset-selected');
        let finalBgType = 'default';
        let finalBgVal = '';
        if (selectedPresetBtn) {
            finalBgType = selectedPresetBtn.getAttribute('data-bg-type');
            finalBgVal = selectedPresetBtn.getAttribute('data-bg-val');
        }
        
        const goalData = {
            title: titleInput.value.trim(),
            category: categorySelect.value,
            targetYear: yearInput.value,
            status: statusSelect.value,
            affirmation: affirmationInput.value.trim() || getRandomGoalAffirmation(),
            backgroundType: finalBgType,
            backgroundVal: finalBgVal,
            updatedAt: new Date().toISOString()
        };
        
        if (index !== null) {
            state.userData.goals[index] = { ...state.userData.goals[index], ...goalData };
            logUserActivity(state.session.email, `Edited goal: ${goalData.title}`);
            showToast("Goal updated!");
        } else {
            goalData.createdAt = new Date().toISOString();
            state.userData.goals.push(goalData);
            logUserActivity(state.session.email, `Created goal: ${goalData.title}`);
            showToast("Goal created successfully!");
        }
        
        saveUserData(state.session.email, state.userData);
        modal.style.display = 'none';
        renderGoals();
    };
    
    // Handle Delete
    deleteBtn.onclick = () => {
        if (confirm("Delete this goal vision?")) {
            const deleted = state.userData.goals.splice(index, 1);
            logUserActivity(state.session.email, `Deleted goal: ${deleted[0].title}`);
            saveUserData(state.session.email, state.userData);
            modal.style.display = 'none';
            renderGoals();
            showToast("Goal vision deleted", "warning");
        }
    };
    
    // Handle Close
    document.getElementById('goal-modal-close').onclick = () => {
        modal.style.display = 'none';
    };
}

function renderGoalBGPresetOptions(activeType, activeVal) {
    const colorPresetsContainer = document.getElementById('goal-presets-colors');
    const photoPresetsContainer = document.getElementById('goal-presets-photos');
    
    colorPresetsContainer.innerHTML = '';
    photoPresetsContainer.innerHTML = '';
    
    // Default glass option
    const defaultOption = document.createElement('div');
    defaultOption.className = `color-preset ${activeType === 'default' ? 'preset-selected active' : ''}`;
    defaultOption.style.background = 'rgba(255, 255, 255, 0.05)';
    defaultOption.style.border = '1px solid var(--panel-border)';
    defaultOption.setAttribute('data-bg-type', 'default');
    defaultOption.setAttribute('data-bg-val', '');
    defaultOption.title = "Default Quote Glass";
    defaultOption.onclick = () => selectPreset(defaultOption);
    colorPresetsContainer.appendChild(defaultOption);
    
    // Colors preset
    COLOR_PRESETS.forEach(color => {
        const item = document.createElement('div');
        const isActive = activeType === 'color' && activeVal === color.value;
        item.className = `color-preset ${isActive ? 'preset-selected active' : ''}`;
        item.style.background = color.value;
        item.setAttribute('data-bg-type', 'color');
        item.setAttribute('data-bg-val', color.value);
        item.title = color.name;
        item.onclick = () => selectPreset(item);
        colorPresetsContainer.appendChild(item);
    });
    
    // Photos preset
    PHOTO_PRESETS.forEach(photo => {
        const item = document.createElement('div');
        const isActive = activeType === 'photo' && activeVal === photo.value;
        item.className = `img-preset ${isActive ? 'preset-selected active' : ''}`;
        item.style.backgroundImage = `url('${photo.value}')`;
        item.setAttribute('data-bg-type', 'photo');
        item.setAttribute('data-bg-val', photo.value);
        item.title = photo.name;
        item.onclick = () => selectPreset(item);
        photoPresetsContainer.appendChild(item);
    });
    
    // Custom photo URL setup
    const customPhotoInput = document.getElementById('goal-modal-custom-photo');
    customPhotoInput.value = activeType === 'photo' && !PHOTO_PRESETS.some(p => p.value === activeVal) ? activeVal : '';
    
    customPhotoInput.oninput = () => {
        const val = customPhotoInput.value.trim();
        if (val) {
            // Unselect others
            document.querySelectorAll('.color-preset, .img-preset').forEach(el => el.classList.remove('active', 'preset-selected'));
            
            // Assign custom attributes to input
            customPhotoInput.setAttribute('data-bg-type', 'photo');
            customPhotoInput.setAttribute('data-bg-val', val);
            customPhotoInput.classList.add('preset-selected');
        }
    };
    
    function selectPreset(selectedEl) {
        document.querySelectorAll('.color-preset, .img-preset, #goal-modal-custom-photo').forEach(el => {
            el.classList.remove('active', 'preset-selected');
        });
        selectedEl.classList.add('active', 'preset-selected');
        customPhotoInput.value = ''; // Reset custom input text
    }
}

// Make showGoalModal available globally
window.showGoalModal = function() {
    showGoalModal();
};


/* ================== DAILY REFLECTION ================== */
function renderReflection() {
    const dateStr = state.currentReflectionDate;
    
    // Display formatted date
    const displayDate = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('reflection-date-display').textContent = displayDate.toLocaleDateString('en-US', options);
    
    // Refresh Daily Quote
    const quoteObj = getRandomDailyQuote();
    document.getElementById('reflection-quote-text').textContent = `"${quoteObj.text}"`;
    document.getElementById('reflection-quote-author').textContent = `— ${quoteObj.author}`;
    
    // Load existing reflection
    const reflections = state.userData.reflections || {};
    const ref = reflections[dateStr] || { good: "", bad: "", rating: 0 };
    
    document.getElementById('ref-good-input').value = ref.good || '';
    document.getElementById('ref-bad-input').value = ref.bad || '';
    
    // Render ratings
    renderStarRatings(ref.rating || 0);
    
    // Navigation listeners
    document.getElementById('ref-prev-day').onclick = () => {
        changeReflectionDate(-1);
    };
    
    document.getElementById('ref-next-day').onclick = () => {
        changeReflectionDate(1);
    };
    
    document.getElementById('ref-today-btn').onclick = () => {
        state.currentReflectionDate = getLocalDateString();
        renderReflection();
    };
    
    // Handle Save Reflection
    document.getElementById('reflection-form').onsubmit = (e) => {
        e.preventDefault();
        saveCurrentReflection();
    };
}

function changeReflectionDate(days) {
    const d = new Date(state.currentReflectionDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    state.currentReflectionDate = getLocalDateString(d);
    renderReflection();
}

function renderStarRatings(rating) {
    const container = document.getElementById('ref-rating-stars');
    container.innerHTML = '';
    
    const emojis = ["😞", "😐", "🙂", "😀", "🔥"];
    
    for (let i = 1; i <= 5; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `star-rating-btn ${i <= rating ? 'active' : ''}`;
        btn.innerHTML = emojis[i-1];
        btn.title = `Rating: ${i}`;
        
        btn.onclick = () => {
            renderStarRatings(i);
            container.setAttribute('data-selected-rating', i);
        };
        
        container.appendChild(btn);
    }
    
    container.setAttribute('data-selected-rating', rating);
}

function saveCurrentReflection() {
    const dateStr = state.currentReflectionDate;
    const goodVal = document.getElementById('ref-good-input').value.trim();
    const badVal = document.getElementById('ref-bad-input').value.trim();
    const ratingVal = parseInt(document.getElementById('ref-rating-stars').getAttribute('data-selected-rating')) || 0;
    
    if (!state.userData.reflections) state.userData.reflections = {};
    
    state.userData.reflections[dateStr] = {
        good: goodVal,
        bad: badVal,
        rating: ratingVal,
        updatedAt: new Date().toISOString()
    };
    
    saveUserData(state.session.email, state.userData);
    calculateStreak();
    renderHeader();
    showToast("Daily reflection saved successfully!");
    logUserActivity(state.session.email, `Saved reflection for ${dateStr}`);
}


/* ================== DAILY PLANNER ================== */
function renderPlanner() {
    const dateStr = state.currentPlannerDate;
    
    // Display formatted date
    const displayDate = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    document.getElementById('planner-date-display').textContent = displayDate.toLocaleDateString('en-US', options);
    
    // Navigation listeners
    document.getElementById('plan-prev-day').onclick = () => {
        changePlannerDate(-1);
    };
    
    document.getElementById('plan-next-day').onclick = () => {
        changePlannerDate(1);
    };
    
    document.getElementById('plan-today-btn').onclick = () => {
        state.currentPlannerDate = getLocalDateString();
        renderPlanner();
    };
    
    // Load planner tasks
    const planner = state.userData.planner || {};
    const tasks = planner[dateStr] || [];
    
    const container = document.getElementById('planner-tasks-list');
    container.innerHTML = '';
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="glass-panel text-center" style="padding: 30px; border-style: dashed;">
                <p style="color: var(--text-secondary);">No tasks planned for this day.</p>
            </div>
        `;
        updatePlannerProgress(0);
        return;
    }
    
    let completedCount = 0;
    tasks.forEach((task, index) => {
        if (task.completed) completedCount++;
        
        const item = document.createElement('div');
        item.className = 'task-item glass-panel glow-effect';
        
        const priorityClass = `priority-${task.priority.toLowerCase()}`;
        
        item.innerHTML = `
            <div class="task-left">
                <div class="task-checkbox-container" onclick="window.toggleTaskStatus(${index})">
                    <div class="task-checkbox ${task.completed ? 'checked' : ''}"></div>
                </div>
                <span class="task-text ${task.completed ? 'completed' : ''}">${task.text}</span>
            </div>
            <div class="task-actions">
                <span class="priority-tag ${priorityClass}">${task.priority}</span>
                <button class="icon-btn" style="width: 26px; height: 26px; color: var(--danger-color); font-size: 11px;" onclick="window.deleteTask(${index})">✕</button>
            </div>
        `;
        
        container.appendChild(item);
    });
    
    const percent = Math.round((completedCount / tasks.length) * 100) || 0;
    updatePlannerProgress(percent);
}

function changePlannerDate(days) {
    const d = new Date(state.currentPlannerDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    state.currentPlannerDate = getLocalDateString(d);
    renderPlanner();
}

function updatePlannerProgress(percent) {
    document.getElementById('planner-progress-fill').style.width = `${percent}%`;
    document.getElementById('planner-progress-pct').textContent = `${percent}%`;
}

// Toggle checklist completed status
window.toggleTaskStatus = function(index) {
    const dateStr = state.currentPlannerDate;
    const tasks = state.userData.planner[dateStr];
    tasks[index].completed = !tasks[index].completed;
    
    saveUserData(state.session.email, state.userData);
    renderPlanner();
};

// Delete planner checklist item
window.deleteTask = function(index) {
    const dateStr = state.currentPlannerDate;
    const tasks = state.userData.planner[dateStr];
    const removed = tasks.splice(index, 1);
    
    saveUserData(state.session.email, state.userData);
    renderPlanner();
    showToast("Task removed", "warning");
    logUserActivity(state.session.email, `Removed task: ${removed[0].text}`);
};

// Open Planner Modals
window.showTaskModal = function() {
    const modal = document.getElementById('task-modal');
    const taskInput = document.getElementById('task-modal-text');
    const prioritySelect = document.getElementById('task-modal-priority');
    
    taskInput.value = '';
    prioritySelect.value = 'Medium';
    modal.style.display = 'flex';
    
    document.getElementById('task-modal-form').onsubmit = (e) => {
        e.preventDefault();
        const textVal = taskInput.value.trim();
        const prioVal = prioritySelect.value;
        const dateStr = state.currentPlannerDate;
        
        if (!textVal) return;
        
        if (!state.userData.planner) state.userData.planner = {};
        if (!state.userData.planner[dateStr]) state.userData.planner[dateStr] = [];
        
        state.userData.planner[dateStr].push({
            text: textVal,
            priority: prioVal,
            completed: false,
            createdAt: new Date().toISOString()
        });
        
        saveUserData(state.session.email, state.userData);
        modal.style.display = 'none';
        renderPlanner();
        showToast("Task added to schedule!");
        logUserActivity(state.session.email, `Added planner task: ${textVal}`);
    };
    
    document.getElementById('task-modal-close').onclick = () => {
        modal.style.display = 'none';
    };
};


/* ================== SETTINGS & EXTRA CONTROLS ================== */
function renderSettings() {
    const settings = state.userData.settings || {};
    
    // Theme toggle matching state
    document.getElementById('settings-theme-toggle').checked = !settings.darkMode;
    
    // PIN lock switch state
    const pinLockSwitch = document.getElementById('settings-pin-toggle');
    pinLockSwitch.checked = settings.pinLockEnabled;
    
    document.getElementById('settings-pin-btn').style.display = settings.pinLockEnabled ? 'inline-block' : 'none';
    
    // Theme switch trigger
    document.getElementById('settings-theme-toggle').onchange = () => {
        document.getElementById('theme-toggle').click(); // trigger header theme switch
    };
    
    // Lock switch toggle
    pinLockSwitch.onchange = () => {
        if (pinLockSwitch.checked) {
            // Prompt to set a PIN
            promptToConfigurePIN();
        } else {
            // Disable PIN
            settings.pinLockEnabled = false;
            settings.pinCode = "";
            state.userData.settings = settings;
            saveUserData(state.session.email, state.userData);
            document.getElementById('settings-pin-btn').style.display = 'none';
            showToast("PIN app lock disabled", "warning");
            logUserActivity(state.session.email, "Disabled PIN security");
        }
    };
    
    document.getElementById('settings-pin-btn').onclick = () => {
        promptToConfigurePIN();
    };
    
    // Custom Weekly reminder simulator (Notifications button)
    document.getElementById('request-notif-btn').onclick = () => {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showToast("Notification permissions granted!");
                    triggerSystemNotification("GoalMatrix Active", "Weekly reminders & reflections notifications enabled! 🚀");
                } else {
                    showToast("Notifications blocked. Enable in browser settings.", "warning");
                }
            });
        } else {
            showToast("Notifications not supported in this browser.", "warning");
        }
    };
    
    document.getElementById('simulate-notif-btn').onclick = () => {
        showToast("Simulating 9 PM reflection alert in 3 seconds...");
        setTimeout(() => {
            triggerSystemNotification("Reflection Time! 📝", "What did you do GOOD today? What did you do BAD? Update your GoalMatrix streak! 🔥");
        }, 3000);
    };
    
    // Backup and Restore buttons
    document.getElementById('export-backup-btn').onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.userData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `goalmatrix_backup_${state.session.email}_${getLocalDateString()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast("Backup file downloaded!");
        logUserActivity(state.session.email, "Exported personal backup");
    };
    
    document.getElementById('import-file-input').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                // Basic validation
                if (!parsed.goals && !parsed.reflections) {
                    throw new Error("Invalid format");
                }
                
                state.userData = { ...state.userData, ...parsed };
                saveUserData(state.session.email, state.userData);
                calculateStreak();
                renderHeader();
                showToast("Personal data restored successfully!");
                logUserActivity(state.session.email, "Imported personal backup");
                switchTab('goals');
            } catch (err) {
                showToast("Restore failed. Check file validity.", "warning");
            }
        };
        reader.readAsText(file);
    };
}

function promptToConfigurePIN() {
    const overlay = document.getElementById('lock-screen-overlay');
    overlay.classList.remove('hidden');
    
    state.activePINInput = "";
    updatePINDots();
    
    // Temporary change lock screen header context
    const lockHeader = document.querySelector('#lock-screen-overlay h3');
    const oldText = lockHeader.textContent;
    lockHeader.textContent = "Set 4-Digit Security PIN";
    
    state.pinLockCallback = (pinCodeEntered) => {
        // Set PIN
        const settings = state.userData.settings || {};
        settings.pinLockEnabled = true;
        settings.pinCode = pinCodeEntered;
        state.userData.settings = settings;
        saveUserData(state.session.email, state.userData);
        
        sessionStorage.setItem('gm_unlocked', 'true'); // bypass immediate lock
        
        // Restore overlay state
        overlay.classList.add('hidden');
        lockHeader.textContent = oldText;
        state.pinLockCallback = null;
        
        document.getElementById('settings-pin-btn').style.display = 'inline-block';
        document.getElementById('settings-pin-toggle').checked = true;
        
        showToast("Security PIN set successfully!");
        logUserActivity(state.session.email, "Configured new security PIN");
        renderSettings();
    };
    
    // Bind click cancel setup
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary mt-12';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
        overlay.classList.add('hidden');
        lockHeader.textContent = oldText;
        state.pinLockCallback = null;
        
        // Reset toggle switch if cancel
        const settings = state.userData.settings || {};
        document.getElementById('settings-pin-toggle').checked = settings.pinLockEnabled;
        cancelBtn.remove();
    };
    
    const container = document.querySelector('.pin-pad-container');
    const pinGrid = document.querySelector('.pin-grid');
    container.insertBefore(cancelBtn, pinGrid.nextSibling);
    
    // Clear cancel button on complete
    const originalCallback = state.pinLockCallback;
    state.pinLockCallback = (pin) => {
        cancelBtn.remove();
        originalCallback(pin);
    };
}


/* ================== MAKER ADMIN PANEL ================== */
function renderAdmin() {
    if (!state.session.isAdmin) return;
    
    const metrics = getAdminMetrics();
    
    document.getElementById('admin-total-users').textContent = metrics.totalUsers;
    
    const tableBody = document.getElementById('admin-users-table-body');
    tableBody.innerHTML = '';
    
    metrics.usersList.forEach(user => {
        const tr = document.createElement('tr');
        
        const dateFormatted = new Date(user.createdDate).toLocaleDateString();
        const loginFormatted = new Date(user.lastLogin).toLocaleString();
        
        tr.innerHTML = `
            <td><strong>${user.name}</strong><br><span style="color:var(--text-muted);font-size:11px;">${user.email}</span></td>
            <td>${user.isAdmin ? '👑 Admin' : '👤 User'}</td>
            <td>${dateFormatted}</td>
            <td>${user.goalsCount} goals</td>
            <td>${user.reflectionsCount} reflections</td>
            <td>🔥 ${user.streak} days</td>
            <td>${user.tasksSummary}</td>
            <td>
                <button class="btn-primary" style="padding: 6px 12px; font-size:11px; border-radius:6px;" onclick="window.viewUserAuditLogs('${user.email}')">Logs</button>
            </td>
        `;
        
        tableBody.appendChild(tr);
    });
    
    // DB Backup
    document.getElementById('admin-export-db-btn').onclick = () => {
        const dbString = exportEntireDatabase();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(dbString);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `goalmatrix_SYSTEM_DATABASE_${getLocalDateString()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast("System database backup downloaded!");
    };
    
    // DB Restore
    document.getElementById('admin-import-file-input').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                importEntireDatabase(event.target.result);
                showToast("System database restored successfully!");
                initApp();
            } catch (err) {
                showToast(err.message, "warning");
            }
        };
        reader.readAsText(file);
    };
}

window.viewUserAuditLogs = function(email) {
    const metrics = getAdminMetrics();
    const user = metrics.usersList.find(u => u.email === email);
    
    if (!user) return;
    
    const logsBox = document.getElementById('admin-audit-logs');
    document.getElementById('admin-audit-user-title').textContent = `${user.name} - Activity History`;
    
    logsBox.innerHTML = '';
    
    if (!user.activityLog || user.activityLog.length === 0) {
        logsBox.innerHTML = '<p style="color:var(--text-secondary);">No action history found for this user.</p>';
    } else {
        // Reverse array to show recent first
        [...user.activityLog].reverse().forEach(log => {
            const dateStr = new Date(log.timestamp).toLocaleString();
            const logItem = document.createElement('div');
            logItem.className = 'audit-log-item';
            logItem.innerHTML = `<strong>[${dateStr}]</strong>: ${log.action}`;
            logsBox.appendChild(logItem);
        });
    }
    
    document.getElementById('admin-audit-panel').classList.remove('hidden');
};
