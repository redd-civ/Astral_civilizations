window.VA = window.VA || {};

VA.Storage = {
  KEY: 'va_game_state',

  save(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('Save error', e);
      return false;
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Load error', e);
      return null;
    }
  },

  has() { return !!localStorage.getItem(this.KEY); },

  clear() { localStorage.removeItem(this.KEY); },

  export(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `va-save-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  import(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try { resolve(JSON.parse(e.target.result)); }
        catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
};