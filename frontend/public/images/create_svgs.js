import fs from 'fs';
import path from 'path';

const dir = 'd:/Startup/AVS/frontend/public/images';

const createSVG = (title, subtitle, sizeBadge, bgGradient, primaryColor, accentColor, shapeType) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradient[0]}"/>
      <stop offset="100%" stop-color="${bgGradient[1]}"/>
    </linearGradient>
    <linearGradient id="bottle" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="${primaryColor}"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Background Card -->
  <rect width="400" height="400" rx="32" fill="url(#bg)"/>
  
  <!-- Outer Glow Circle -->
  <circle cx="200" cy="180" r="110" fill="#ffffff" opacity="0.6" filter="url(#shadow)"/>

  <!-- Product Graphics -->
  <g transform="translate(200, 175)" filter="url(#shadow)">
    ${shapeType === 'pouch' ? `
      <!-- Pouch Graphic -->
      <path d="M-60,-80 L60,-80 L75,80 L-75,80 Z" fill="${primaryColor}" rx="12"/>
      <path d="M-55,-75 L55,-75 L65,75 L-65,75 Z" fill="#ffffff" opacity="0.95"/>
      <!-- Header Band -->
      <rect x="-55" y="-75" width="110" height="35" fill="${accentColor}" rx="4"/>
      <text x="0" y="-52" font-family="Arial, sans-serif" font-weight="900" font-size="16" fill="#ffffff" text-anchor="middle" letter-spacing="1">${title.toUpperCase()}</text>
      <!-- Center Graphic -->
      <circle cx="0" cy="0" r="28" fill="${bgGradient[0]}"/>
      <text x="0" y="8" font-family="Arial, sans-serif" font-weight="900" font-size="22" fill="${accentColor}" text-anchor="middle">${sizeBadge}</text>
      <text x="0" y="45" font-family="Arial, sans-serif" font-weight="800" font-size="12" fill="#333333" text-anchor="middle">${subtitle}</text>
    ` : shapeType === 'cup' ? `
      <!-- Cup / Tub Graphic -->
      <path d="M-65,-60 L65,-60 L50,70 L-50,70 Z" fill="#ffffff"/>
      <rect x="-70" y="-70" width="140" height="15" fill="${accentColor}" rx="6"/>
      <rect x="-60" y="-30" width="120" height="60" fill="${primaryColor}" opacity="0.15" rx="4"/>
      <text x="0" y="-8" font-family="Arial, sans-serif" font-weight="900" font-size="18" fill="${accentColor}" text-anchor="middle">${title}</text>
      <rect x="-40" y="10" width="80" height="24" fill="${accentColor}" rx="12"/>
      <text x="0" y="27" font-family="Arial, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">${sizeBadge}</text>
      <text x="0" y="55" font-family="Arial, sans-serif" font-weight="800" font-size="11" fill="#666666" text-anchor="middle">${subtitle}</text>
    ` : `
      <!-- Bottle Graphic -->
      <rect x="-15" y="-105" width="30" height="20" fill="${accentColor}" rx="4"/>
      <path d="M-20,-85 L20,-85 L35,-55 L35,80 L-35,80 L-35,-55 Z" fill="${primaryColor}" opacity="0.9"/>
      <path d="M-30,-50 L30,-50 L30,60 L-30,60 Z" fill="#ffffff" opacity="0.95"/>
      <rect x="-30" y="-40" width="60" height="40" fill="${accentColor}" rx="4"/>
      <text x="0" y="-18" font-family="Arial, sans-serif" font-weight="900" font-size="13" fill="#ffffff" text-anchor="middle">${title.toUpperCase()}</text>
      <text x="0" y="32" font-family="Arial, sans-serif" font-weight="900" font-size="16" fill="${accentColor}" text-anchor="middle">${sizeBadge}</text>
      <text x="0" y="50" font-family="Arial, sans-serif" font-weight="800" font-size="10" fill="#444444" text-anchor="middle">${subtitle}</text>
    `}
  </g>

  <!-- Title Badge Footer -->
  <rect x="40" y="320" width="320" height="52" rx="16" fill="#ffffff" filter="url(#shadow)"/>
  <text x="200" y="348" font-family="Arial, sans-serif" font-weight="900" font-size="18" fill="#1e293b" text-anchor="middle">${title} ${sizeBadge ? `- ${sizeBadge}` : ''}</text>
  <text x="200" y="364" font-family="Arial, sans-serif" font-weight="700" font-size="11" fill="#64748b" text-anchor="middle">${subtitle}</text>
</svg>`;
};

const items = [
  // MILK
  { name: 'milk_cat.svg', title: 'Amirtha Milk', subtitle: 'Fresh Pure Milk (200ml, 500ml, 1L)', size: '', bg: ['#e0f2fe', '#bae6fd'], primary: '#0284c7', accent: '#0369a1', shape: 'pouch' },
  { name: 'milk_200ml.svg', title: 'Amirtha Milk', subtitle: '200ml Small Pouch', size: '200ml', bg: ['#f0f9ff', '#e0f2fe'], primary: '#38bdf8', accent: '#0284c7', shape: 'pouch' },
  { name: 'milk_500ml.svg', title: 'Amirtha Milk', subtitle: '500ml Medium Pouch', size: '500ml', bg: ['#e0f2fe', '#bae6fd'], primary: '#0284c7', accent: '#0369a1', shape: 'pouch' },
  { name: 'milk_1l.svg', title: 'Amirtha Milk', subtitle: '1 Liter Large Pack', size: '1L', bg: ['#bae6fd', '#7dd3fc'], primary: '#0369a1', accent: '#075985', shape: 'pouch' },

  // CURD
  { name: 'curd_cat.svg', title: 'Amirtha Curd', subtitle: 'Thick Fresh Curd (200ml, 500ml, 1L)', size: '', bg: ['#f7fee7', '#d9f99d'], primary: '#65a30d', accent: '#4d7c0f', shape: 'cup' },
  { name: 'curd_200ml.svg', title: 'Amirtha Curd', subtitle: '200ml Fresh Cup', size: '200ml', bg: ['#fefce8', '#fef08a'], primary: '#ca8a04', accent: '#854d0e', shape: 'cup' },
  { name: 'curd_500ml.svg', title: 'Amirtha Curd', subtitle: '500ml Tub', size: '500ml', bg: ['#f7fee7', '#d9f99d'], primary: '#65a30d', accent: '#4d7c0f', shape: 'cup' },
  { name: 'curd_1l.svg', title: 'Amirtha Curd', subtitle: '1 Liter Pack', size: '1L', bg: ['#ecfccb', '#a3e635'], primary: '#4d7c0f', accent: '#3f6212', shape: 'cup' },

  // COLA
  { name: 'cola_cat.svg', title: 'Coccola Cola', subtitle: 'Refreshing Cola (200ml, 500ml, 1L)', size: '', bg: ['#fff1f2', '#fecdd3'], primary: '#e11d48', accent: '#9f1239', shape: 'bottle' },
  { name: 'cola_200ml.svg', title: 'Coccola Cola', subtitle: '200ml Small Bottle', size: '200ml', bg: ['#fff1f2', '#ffe4e6'], primary: '#fb7185', accent: '#e11d48', shape: 'bottle' },
  { name: 'cola_500ml.svg', title: 'Coccola Cola', subtitle: '500ml Bottle', size: '500ml', bg: ['#ffe4e6', '#fecdd3'], primary: '#e11d48', accent: '#be123c', shape: 'bottle' },
  { name: 'cola_1l.svg', title: 'Coccola Cola', subtitle: '1 Liter Jumbo Bottle', size: '1L', bg: ['#fecdd3', '#fda4af'], primary: '#be123c', accent: '#881337', shape: 'bottle' },

  // JUICE
  { name: 'juice_cat.svg', title: 'Fresh Juice', subtitle: 'Fruit Refreshment (200ml, 500ml, 1L)', size: '', bg: ['#fff7ed', '#ffedd5'], primary: '#f97316', accent: '#c2410c', shape: 'bottle' },
  { name: 'juice_200ml.svg', title: 'Fresh Juice', subtitle: '200ml Fruit Drink', size: '200ml', bg: ['#fff7ed', '#ffedd5'], primary: '#fb923c', accent: '#ea580c', shape: 'bottle' },
  { name: 'juice_500ml.svg', title: 'Fresh Juice', subtitle: '500ml Fruit Drink', size: '500ml', bg: ['#ffedd5', '#fed7aa'], primary: '#f97316', accent: '#c2410c', shape: 'bottle' },
  { name: 'juice_1l.svg', title: 'Fresh Juice', subtitle: '1 Liter Family Bottle', size: '1L', bg: ['#fed7aa', '#fdba74'], primary: '#ea580c', accent: '#9a3412', shape: 'bottle' },

  // TATA
  { name: 'tata_cat.svg', title: 'Tata Drink', subtitle: 'Gluco Plus & Drinks (200ml, 500ml, 1L)', size: '', bg: ['#f0fdf4', '#dcfce7'], primary: '#16a34a', accent: '#15803d', shape: 'bottle' },
  { name: 'tata_200ml.svg', title: 'Tata Drink', subtitle: '200ml Gluco Plus', size: '200ml', bg: ['#f0fdf4', '#dcfce7'], primary: '#4ade80', accent: '#16a34a', shape: 'bottle' },
  { name: 'tata_500ml.svg', title: 'Tata Drink', subtitle: '500ml Energy Drink', size: '500ml', bg: ['#dcfce7', '#bbf7d0'], primary: '#16a34a', accent: '#15803d', shape: 'bottle' },
  { name: 'tata_1l.svg', title: 'Tata Drink', subtitle: '1 Liter Bottle', size: '1L', bg: ['#bbf7d0', '#86efac'], primary: '#15803d', accent: '#166534', shape: 'bottle' },

  // WATER BOTTLE
  { name: 'water_cat.svg', title: 'Mineral Water', subtitle: 'Pure Water (300ml, 500ml, 1L)', size: '', bg: ['#ecfeff', '#cffafe'], primary: '#0891b2', accent: '#0e7490', shape: 'bottle' },
  { name: 'water_300ml.svg', title: 'Mineral Water', subtitle: '300ml Mini Bottle', size: '300ml', bg: ['#f0fdfa', '#ccfbf1'], primary: '#2dd4bf', accent: '#0d9488', shape: 'bottle' },
  { name: 'water_500ml.svg', title: 'Mineral Water', subtitle: '500ml Handy Bottle', size: '500ml', bg: ['#ecfeff', '#cffafe'], primary: '#06b6d4', accent: '#0891b2', shape: 'bottle' },
  { name: 'water_1l.svg', title: 'Mineral Water', subtitle: '1 Liter Pure Mineral', size: '1L', bg: ['#cffafe', '#a5f3fc'], primary: '#0891b2', accent: '#155e75', shape: 'bottle' }
];

items.forEach(item => {
  const content = createSVG(item.title, item.subtitle, item.size, item.bg, item.primary, item.accent, item.shape);
  fs.writeFileSync(path.join(dir, item.name), content, 'utf8');
  console.log(`Generated ${item.name}`);
});
