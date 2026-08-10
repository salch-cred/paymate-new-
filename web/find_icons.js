const icons = require('hugeicons-react');

const searchTerms = [
  'Arrow', 'Spark', 'Wallet', 'Shield', 'Bolt', 'Lightning', 'Flash',
  'Link', 'Chart', 'Check', 'Tick', 'Copy', 'Invoice', 'Receipt',
  'User', 'Globe', 'Send', 'Airplane', 'Menu', 'Close', 'Cancel', 'Cross',
  'Lock', 'Network', 'Node', 'Chevron'
];

const found = {};
for (const term of searchTerms) {
  found[term] = Object.keys(icons).filter(k => k.toLowerCase().includes(term.toLowerCase())).slice(0, 10);
}

console.log(JSON.stringify(found, null, 2));
