/* =========================================================
   STORAGE — تنها جایی که به localStorage دست می‌زند
   ========================================================= */

export const STORAGE = {
  localUsers: "scene-local-users",
  deletedIds: "scene-deleted-ids",
  serverEdits: "scene-server-edits",
  recentSearches: "scene-recent-searches",
  comments: "scene-comments",
  posts: "scene-posts",
  pages: "scene-pages",
  media: "scene-media",
  settings: "scene-settings",
};

export function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

/** مطمئن می‌شود مقدار خوانده‌شده آرایه است (داده خراب = مقدار پیش‌فرض) */
export function loadArray(key, fallback = []) {
  const value = loadJSON(key, fallback);
  return Array.isArray(value) ? value : fallback;
}

/** true = ذخیره شد، false = ناموفق (حافظه پر یا حالت خصوصی) */
export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearAllData() {
  Object.values(STORAGE).forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
}

export function createId(prefix = "local") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}