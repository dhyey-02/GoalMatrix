// Admin Panel Logic for Website Owner/Creator

import { getUserData } from './auth.js';

export function getAdminMetrics() {
    const users = JSON.parse(localStorage.getItem('gm_users')) || [];
    const metrics = {
        totalUsers: users.length,
        usersList: []
    };

    users.forEach(user => {
        const userData = getUserData(user.email);
        
        // Count reflections
        const reflectionsCount = userData.reflections ? Object.keys(userData.reflections).length : 0;
        
        // Count goals
        const goalsCount = userData.goals ? userData.goals.length : 0;
        
        // Count planner tasks
        let totalTasks = 0;
        let completedTasks = 0;
        if (userData.planner) {
            Object.values(userData.planner).forEach(dayTasks => {
                if (Array.isArray(dayTasks)) {
                    totalTasks += dayTasks.length;
                    completedTasks += dayTasks.filter(t => t.completed).length;
                }
            });
        }

        metrics.usersList.push({
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin || false,
            createdDate: user.createdDate,
            lastLogin: user.lastLogin,
            reflectionsCount,
            goalsCount,
            streak: userData.streak || 0,
            tasksSummary: `${completedTasks}/${totalTasks} completed`,
            activityLog: userData.activityLog || []
        });
    });

    return metrics;
}

export function exportEntireDatabase() {
    const backup = {
        timestamp: new Date().toISOString(),
        users: JSON.parse(localStorage.getItem('gm_users')) || [],
        userData: {}
    };

    backup.users.forEach(user => {
        backup.userData[user.email] = getUserData(user.email);
    });

    return JSON.stringify(backup, null, 2);
}

export function importEntireDatabase(backupString) {
    try {
        const backup = JSON.parse(backupString);
        if (!backup.users || !backup.userData) {
            throw new Error("Invalid database schema.");
        }

        localStorage.setItem('gm_users', JSON.stringify(backup.users));
        Object.entries(backup.userData).forEach(([email, data]) => {
            localStorage.setItem(`gm_user_data_${email}`, JSON.stringify(data));
        });
        
        return true;
    } catch (err) {
        console.error("Database import error:", err);
        throw new Error("Import failed. Make sure it is a valid GoalMatrix export file.");
    }
}
