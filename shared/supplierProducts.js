export function companyProductActive(rates,productId) {
  if(!Object.hasOwn(rates||{},String(productId)))return false;
  const value=rates[productId];
  return !value||typeof value!=='object'||value.is_active!==false;
}
