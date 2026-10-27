// API responses use booleans; existing forms also use numeric status values.
export const isCategoryActive = (value) => ![false, 0, '0', 'false'].includes(value);
