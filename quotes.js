// Quotes and Affirmations database for GoalMatrix

export const DAILY_QUOTES = [
    { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
    { text: "Do not wait to strike till the iron is hot; but make it hot by striking.", author: "William Butler Yeats" },
    { text: "Great things are done by a series of small things brought together.", author: "Vincent Van Gogh" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "An obstacle is often a stepping stone.", author: "Prescott" },
    { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
    { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
    { text: "Act as if what you do makes a difference. It does.", author: "William James" },
    { text: "Consistency is what transforms average into excellence.", author: "Unknown" },
    { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" }
];

export const GOAL_AFFIRMATIONS = [
    "You are great. You can achieve anything you set your mind to!",
    "Every day is a step closer to your 10-year vision. Keep pushing!",
    "Your future self will thank you for the effort you put in today.",
    "Do not fear going slowly, fear only standing still.",
    "The best way to predict the future is to create it.",
    "Your dreams are valid, achievable, and worth the grind.",
    "Focus on progress, not perfection. You've got this!",
    "Small daily improvements over time lead to stunning results.",
    "You possess the strength and resilience to conquer any hurdle.",
    "Dream big. Start small. Act now.",
    "Your potential is endless. Believe in your vision.",
    "Stay committed to your goals, but flexible in your approach."
];

export function getRandomDailyQuote() {
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const index = dayOfYear % DAILY_QUOTES.length;
    return DAILY_QUOTES[index];
}

export function getRandomGoalAffirmation() {
    const index = Math.floor(Math.random() * GOAL_AFFIRMATIONS.length);
    return GOAL_AFFIRMATIONS[index];
}
