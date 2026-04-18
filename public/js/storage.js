// Local storage and session management

class Storage {
  constructor() {
    this.prefix = 'soundtracker_';
  }

  setUser(userId, userName) {
    localStorage.setItem(this.prefix + 'user_id', userId);
    localStorage.setItem(this.prefix + 'user_name', userName);
  }

  getUser() {
    const id = localStorage.getItem(this.prefix + 'user_id');
    const name = localStorage.getItem(this.prefix + 'user_name');
    return { id, name };
  }

  clearUser() {
    localStorage.removeItem(this.prefix + 'user_id');
    localStorage.removeItem(this.prefix + 'user_name');
  }

  setAdminToken(token) {
    sessionStorage.setItem(this.prefix + 'admin_token', token);
  }

  getAdminToken() {
    return sessionStorage.getItem(this.prefix + 'admin_token');
  }

  clearAdminToken() {
    sessionStorage.removeItem(this.prefix + 'admin_token');
  }

  isAdminLoggedIn() {
    return !!this.getAdminToken();
  }

  setCache(key, data, ttl = 5 * 60 * 1000) {
    const cached = {
      data,
      timestamp: Date.now(),
      ttl
    };
    localStorage.setItem(this.prefix + 'cache_' + key, JSON.stringify(cached));
  }

  getCache(key) {
    const cached = localStorage.getItem(this.prefix + 'cache_' + key);
    if (!cached) return null;

    const { data, timestamp, ttl } = JSON.parse(cached);
    if (Date.now() - timestamp > ttl) {
      localStorage.removeItem(this.prefix + 'cache_' + key);
      return null;
    }

    return data;
  }

  clearCache(key) {
    localStorage.removeItem(this.prefix + 'cache_' + key);
  }

  clearAllCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes(this.prefix + 'cache_')) {
        localStorage.removeItem(key);
      }
    });
  }
}

const storage = new Storage();
