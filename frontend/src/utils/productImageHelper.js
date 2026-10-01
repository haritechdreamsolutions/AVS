/**
 * Product Image Resolution Helper for AVS
 * Resolves the appropriate product image using:
 * 1. Explicit `prod.image_url` or `prod.image`
 * 2. Static Product ID Mapping (for existing registered master products)
 * 3. Smart Name & Category Matching (matching Milk, Curd, Butter Milk, Cool/Coccola, Water, Juice, Tata Gluco by volume 200ml, 500ml, 1L, 2L)
 */

export const STATIC_PRODUCT_IMAGES_BY_ID = {
  1: '/images/amirthaa_milk_200ml.png',
  5: '/images/amirthaa_milk_500ml.png',
  6: '/images/amirthaa_milk_1l.jpg',
  7: '/images/amirthaa_curd_200ml.jpg',
  8: '/images/amirthaa_curd_500ml.jpg',
  9: '/images/amirthaa_curd_1l.jpg',
  10: '/images/coccola_200ml.png',
  3: '/images/coccola_500ml.png',
  11: '/images/coccola_1l.png',
  12: '/images/juice_hero.jpg',
  15: '/images/tata_hero.jpg',
  18: '/images/aquafresh_water_200ml.png',
  19: '/images/aquafresh_water_500ml.png',
  2: '/images/aquafresh_water_1l.png',
  20: '/images/aquafresh_water_2l.png'
};

export const resolveProductImageUrl = (prod) => {
  if (!prod) return '';
  if (prod.image_url) return prod.image_url;
  if (prod.image) return prod.image;
  if (prod.id && STATIC_PRODUCT_IMAGES_BY_ID[prod.id]) {
    return STATIC_PRODUCT_IMAGES_BY_ID[prod.id];
  }

  const name = String(prod.display_name || prod.name || prod.product_name || '').toLowerCase();
  const cat = String(prod.category || prod.category_name || '').toLowerCase();

  // 1. Butter Milk / Moru / Curd
  if (name.includes('butter') || name.includes('moru') || name.includes('curd') || cat.includes('curd')) {
    if (name.includes('200')) return '/images/amirthaa_curd_200ml.jpg';
    if (name.includes('500')) return '/images/amirthaa_curd_500ml.jpg';
    if (name.includes('1l') || name.includes('1 l') || name.includes('1000') || name.includes('1 litre')) return '/images/amirthaa_curd_1l.jpg';
    return '/images/amirthaa_curd_200ml.jpg';
  }

  // 2. Milk (Amirthaa Milk)
  if (name.includes('milk') || cat.includes('milk')) {
    if (name.includes('200')) return '/images/amirthaa_milk_200ml.png';
    if (name.includes('500')) return '/images/amirthaa_milk_500ml.png';
    if (name.includes('1l') || name.includes('1 l') || name.includes('1000') || name.includes('1 litre')) return '/images/amirthaa_milk_1l.jpg';
    return '/images/amirthaa_milk_500ml.png';
  }

  // 3. Cool / Coccola / Cola / Soda / Soft Drink
  if (name.includes('cool') || name.includes('coccola') || name.includes('cola') || name.includes('soda') || cat.includes('cool') || cat.includes('beverage')) {
    if (name.includes('200')) return '/images/coccola_200ml.png';
    if (name.includes('500')) return '/images/coccola_500ml.png';
    if (name.includes('1l') || name.includes('1 l') || name.includes('1000')) return '/images/coccola_1l.png';
    return '/images/coccola_200ml.png';
  }

  // 4. Water / Aquafresh
  if (name.includes('water') || name.includes('aqua') || cat.includes('water')) {
    if (name.includes('200') || name.includes('300')) return '/images/aquafresh_water_200ml.png';
    if (name.includes('500')) return '/images/aquafresh_water_500ml.png';
    if (name.includes('2l') || name.includes('2 l') || name.includes('2000') || name.includes('2 litre')) return '/images/aquafresh_water_2l.png';
    if (name.includes('1l') || name.includes('1 l') || name.includes('1000') || name.includes('1 litre')) return '/images/aquafresh_water_1l.png';
    return '/images/aquafresh_water_1l.png';
  }

  // 5. Juice / Fresh Pack
  if (name.includes('juice') || name.includes('fruit') || cat.includes('juice')) {
    return '/images/juice_hero.jpg';
  }

  // 6. Tata / Gluco
  if (name.includes('tata') || name.includes('gluco') || name.includes('energy')) {
    return '/images/tata_hero.jpg';
  }

  return '';
};
