const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function load(name) {
  const fp = path.join(DATA_DIR, name + '.json');
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function save(name, data) {
  const fp = path.join(DATA_DIR, name + '.json');
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

module.exports = { load, save };
