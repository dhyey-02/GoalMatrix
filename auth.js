// Authentication, Security, and Session Management for GoalMatrix

export function initializeUsers() {
    // If user database is empty, seed the default admin account
    let users = JSON.parse(localStorage.getItem('gm_users')) || [];
    const adminExists = users.some(u => u.email === 'admin@goalmatrix.com');
    
    if (!adminExists) {
        users.push({
            name: "Creator Admin",
            email: "admin@goalmatrix.com",
            password: "admin123", // Stored in plain text for this local prototype
            isAdmin: true,
            createdDate: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        });
        localStorage.setItem('gm_users', JSON.stringify(users));
    }
}

export function registerUser(name, email, password) {
    let users = JSON.parse(localStorage.getItem('gm_users')) || [];
    email = email.toLowerCase().trim();
    
    if (users.some(u => u.email === email)) {
        throw new Error("Email is already registered.");
    }
    
    const newUser = {
        name: name.trim(),
        email: email,
        password: password,
        isAdmin: email === 'admin@goalmatrix.com',
        createdDate: new Date().toISOString(),
        lastLogin: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem('gm_users', JSON.stringify(users));
    
    // Initialize user-specific storage structure
    initializeUserData(email);
    
    return newUser;
}

export function loginUser(email, password) {
    let users = JSON.parse(localStorage.getItem('gm_users')) || [];
    email = email.toLowerCase().trim();
    
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        throw new Error("Invalid email or password.");
    }
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    localStorage.setItem('gm_users', JSON.stringify(users));
    
    // Set active session
    localStorage.setItem('gm_session', JSON.stringify({
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
    }));
    
    // Initialize data if not existing
    initializeUserData(email);
    
    return user;
}

export function logoutUser() {
    localStorage.removeItem('gm_session');
    // We do not clear the PIN unlock state of the session here, but let it reset on next login.
    sessionStorage.removeItem('gm_unlocked');
}

export function getSession() {
    const session = localStorage.getItem('gm_session');
    return session ? JSON.parse(session) : null;
}

function initializeUserData(email) {
    const key = `gm_user_data_${email}`;
    if (!localStorage.getItem(key)) {
        const initialData = {
            goals: [],
            reflections: {},
            planner: {}, // Keyed by YYYY-MM-DD
            settings: {
                darkMode: true,
                pinLockEnabled: false,
                pinCode: "",
                bgPhoto: ""
            },
            streak: 0,
            lastReflectionDate: null,
            activityLog: []
        };
        localStorage.setItem(key, JSON.stringify(initialData));
    }
}

export function getUserData(email) {
    const key = `gm_user_data_${email}`;
    const data = localStorage.getItem(key);
    if (!data) {
        initializeUserData(email);
        return JSON.parse(localStorage.getItem(key));
    }
    return JSON.parse(data);
}

export function saveUserData(email, data) {
    const key = `gm_user_data_${email}`;
    localStorage.setItem(key, JSON.stringify(data));
}

// Log action for Creator Admin audit trailing
export function logUserActivity(email, action) {
    const data = getUserData(email);
    if (!data.activityLog) data.activityLog = [];
    data.activityLog.push({
        action,
        timestamp: new Date().toISOString()
    });
    saveUserData(email, data);
}

// PIN Lock Security
export function isAppLocked(email) {
    const data = getUserData(email);
    if (data && data.settings && data.settings.pinLockEnabled && data.settings.pinCode) {
        // If it's enabled, check if user has already unlocked it in the current session
        const isUnlocked = sessionStorage.getItem('gm_unlocked') === 'true';
        return !isUnlocked;
    }
    return false;
}

export function verifyPIN(email, pin) {
    const data = getUserData(email);
    if (data && data.settings && data.settings.pinCode === pin) {
        sessionStorage.setItem('gm_unlocked', 'true');
        return true;
    }
    return false;
}
