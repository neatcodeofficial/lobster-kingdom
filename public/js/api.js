// api.js - Frontend API calls
const LobsterAPI = {
  data: null,
  failCount: 0,
  async fetch() {
    try {
      const res = await fetch('api/lobsters');
      this.data = await res.json();
      this.failCount = 0;
      return this.data;
    } catch (e) {
      this.failCount++;
      console.error('API fetch failed:', e);
      return this.data; // return cached data
    }
  }
};
