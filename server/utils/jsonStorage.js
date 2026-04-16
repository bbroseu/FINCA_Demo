const fs = require('fs');
const path = require('path');

class JSONStorage {
  constructor(filename) {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.filePath = path.join(this.dataDir, filename);
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error('Error loading JSON storage:', error.message);
      return {};
    }
  }

  save(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving JSON storage:', error.message);
      return false;
    }
  }

  get(key) {
    const data = this.load();
    return data[key];
  }

  set(key, value) {
    const data = this.load();
    data[key] = value;
    return this.save(data);
  }

  has(key) {
    const data = this.load();
    return key in data;
  }

  delete(key) {
    const data = this.load();
    if (key in data) {
      delete data[key];
      return this.save(data);
    }
    return false;
  }

  getAll() {
    return this.load();
  }

  clear() {
    return this.save({});
  }
}

module.exports = JSONStorage;