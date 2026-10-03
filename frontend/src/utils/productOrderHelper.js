/**
 * Custom Business Product Display Sorter
 * 
 * Order specified:
 * 1. Milk 120ml
 * 2. Milk 500ml
 * 3. Curd 120ml
 * 4. Curd 500ml
 * 5. Curd 1L / 1000ml
 * 6. FCM / Milk 1L
 * 7. Cooldrinks / Soft Drinks
 * 8. Water 300ml
 * 9. Water 500ml
 * 10. Water 1L / 1000ml
 * 11. Water 2L / 2000ml
 * 12. Badam
 * 13. Other products (Curd 5000ml, Bulk, etc.)
 */

export function getProductDisplayRank(product) {
  if (!product) return 999;
  const name = ((product.display_name || product.name || '') + ' ' + (product.sku || '')).toLowerCase();
  const cat = (product.category_name || product.category || '').toLowerCase();

  // 1. Milk 120ml (Rank 1)
  if (name.includes('milk') && (name.includes('120') || name.includes('120ml'))) {
    return 10;
  }

  // 2. Milk 500ml (Rank 2)
  if (name.includes('milk') && (name.includes('500') || name.includes('500ml'))) {
    return 20;
  }

  // Butter Milk 200ml / General milk variant
  if (name.includes('butter milk') || name.includes('buttermilk') || (name.includes('milk') && name.includes('200'))) {
    return 25;
  }

  // 3. Curd 120ml (Rank 3)
  if (name.includes('curd') && (name.includes('120') || name.includes('120ml'))) {
    return 30;
  }

  // 4. Curd 500ml (Rank 4)
  if (name.includes('curd') && (name.includes('500') || name.includes('500ml')) && !name.includes('5000')) {
    return 40;
  }

  // 5. Curd 1L / 1000ml (Rank 5)
  if (name.includes('curd') && (name.includes('1000') || name.includes('1l') || name.includes('1 ltr') || name.includes('1000ml') || name.includes('1 l')) && !name.includes('5000')) {
    return 50;
  }

  // 6. FCM / Milk 1L (Rank 6)
  if (name.includes('fcm') || (name.includes('milk') && (name.includes('1000') || name.includes('1l') || name.includes('1 ltr') || name.includes('1000ml') || name.includes('1 l')))) {
    return 60;
  }

  // 7. Cooldrinks / Soft Drinks / Juice (Rank 7)
  if (
    name.includes('cool') ||
    name.includes('drink') ||
    name.includes('coccola') ||
    name.includes('coke') ||
    name.includes('soda') ||
    name.includes('bovonto') ||
    name.includes('juice') ||
    name.includes('tata') ||
    cat.includes('bev') ||
    cat.includes('juice')
  ) {
    return 70;
  }

  // 8. Water 300ml (Rank 8)
  if ((name.includes('water') || name.includes('aqua')) && (name.includes('300') || name.includes('300ml'))) {
    return 80;
  }

  // 9. Water 500ml (Rank 9)
  if ((name.includes('water') || name.includes('aqua')) && (name.includes('500') || name.includes('500ml'))) {
    return 90;
  }

  // 10. Water 1L / 1000ml (Rank 10)
  if ((name.includes('water') || name.includes('aqua')) && (name.includes('1000') || name.includes('1l') || name.includes('1 ltr') || name.includes('1000ml') || name.includes('1 l')) && !name.includes('2')) {
    return 100;
  }

  // 11. Water 2L / 2000ml (Rank 11)
  if ((name.includes('water') || name.includes('aqua')) && (name.includes('2000') || name.includes('2l') || name.includes('2 ltr') || name.includes('2000ml') || name.includes('2 l'))) {
    return 110;
  }

  // 12. Badam (Rank 12)
  if (name.includes('badam')) {
    return 120;
  }

  // Other milk products if any
  if (name.includes('milk') || cat.includes('milk') || cat.includes('dairy')) {
    return 130;
  }

  // Other curd products (e.g. Curd 200ml, Curd 5000ml)
  if (name.includes('curd') || cat.includes('curd')) {
    return 140;
  }

  // Other water products
  if (name.includes('water') || name.includes('aqua') || cat.includes('water')) {
    return 150;
  }

  // 13. Remaining items
  return 200;
}

export function sortProductsCustom(productsList) {
  if (!Array.isArray(productsList)) return [];
  return [...productsList].sort((a, b) => {
    const rankA = getProductDisplayRank(a);
    const rankB = getProductDisplayRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return (a.display_name || a.name || '').localeCompare(b.display_name || b.name || '');
  });
}
