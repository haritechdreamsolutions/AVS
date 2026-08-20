import fs from 'fs';
import path from 'path';

const dir = 'd:/Startup/AVS/frontend/public/images';

const createWaterSVG = (title, sizeBadge, subtitle) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ecfeff"/>
      <stop offset="100%" stop-color="#cffafe"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="400" height="400" rx="32" fill="url(#bg)"/>
  
  <!-- Outer Glow Circle -->
  <circle cx="200" cy="180" r="115" fill="#ffffff" opacity="0.8" filter="url(#shadow)"/>

  <!-- Water Bottle Graphic -->
  <g transform="translate(200, 175)" filter="url(#shadow)">
    <!-- Cap -->
    <rect x="-18" y="-115" width="36" height="22" fill="#0284c7" rx="5"/>
    <!-- Neck -->
    <rect x="-14" y="-93" width="28" height="18" fill="#e0f2fe"/>
    <!-- Bottle Body -->
    <path d="M-28,-75 L28,-75 L45,-40 L45,85 C45,95 35,100 25,100 L-25,100 C-35,100 -45,95 -45,85 L-45,-40 Z" fill="#38bdf8" opacity="0.85"/>
    <path d="M-38,-40 L38,-40 L38,80 L-38,80 Z" fill="#ffffff" opacity="0.95"/>
    <!-- Label Band -->
    <rect x="-38" y="-25" width="76" height="60" fill="#0284c7" rx="6"/>
    <text x="0" y="-5" font-family="Arial, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">PURE</text>
    <text x="0" y="15" font-family="Arial, sans-serif" font-weight="900" font-size="12" fill="#e0f2fe" text-anchor="middle">MINERAL WATER</text>
    <rect x="-28" y="22" width="56" height="20" fill="#0369a1" rx="10"/>
    <text x="0" y="36" font-family="Arial, sans-serif" font-weight="900" font-size="13" fill="#ffffff" text-anchor="middle">${sizeBadge}</text>
  </g>

  <!-- Title Footer -->
  <rect x="40" y="325" width="320" height="50" rx="16" fill="#ffffff" filter="url(#shadow)"/>
  <text x="200" y="352" font-family="Arial, sans-serif" font-weight="900" font-size="18" fill="#0f172a" text-anchor="middle">${title} - ${sizeBadge}</text>
  <text x="200" y="367" font-family="Arial, sans-serif" font-weight="700" font-size="11" fill="#0284c7" text-anchor="middle">${subtitle}</text>
</svg>`;
};

const waterItems = [
  { name: 'water_200ml.svg', title: 'Mineral Water', size: '200ml', sub: 'Small Pocket Bottle' },
  { name: 'water_500ml.svg', title: 'Mineral Water', size: '500ml', sub: 'Medium Bottle' },
  { name: 'water_1l.svg', title: 'Mineral Water', size: '1L', sub: '1 Liter Bottle' },
  { name: 'water_2l.svg', title: 'Mineral Water', size: '2L', sub: '2 Liter Family Pack' }
];

waterItems.forEach(item => {
  fs.writeFileSync(path.join(dir, item.name), createWaterSVG(item.title, item.size, item.sub), 'utf8');
  console.log(`Generated ${item.name}`);
});
