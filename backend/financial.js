import { createHash } from 'node:crypto';

export function businessDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(value);
}
export function paise(value) {
  const text = String(value ?? '0').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Amount must be nonnegative with at most two decimal places');
  const [whole, fraction = ''] = text.split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result > 9999999999n) throw new Error('Amount exceeds supported range');
  return Number(result);
}
export function amount(value) { return (value / 100).toFixed(2); }
export function requestIdentity(data) {
  const key = data.idempotency_key || data.client_reference;
  if (typeof key !== 'string' || !/^[A-Za-z0-9:_-]{8,128}$/.test(key)) throw new Error('A valid idempotency key is required');
  const clean = { ...data };
  delete clean.idempotency_key;
  delete clean.client_reference;
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return { key, hash: createHash('sha256').update(JSON.stringify(canonical(clean))).digest('hex') };
}
export function credential(value, role) {
  const text = String(value ?? '');
  if (['OWNER', 'STORE_KEEPER'].includes(role)) {
    if (text.length < 8 || Buffer.byteLength(text) > 72) throw new Error('Password must be 8 to 72 bytes');
  } else if (!/^\d{4,12}$/.test(text)) throw new Error('Driver PIN must contain 4 to 12 digits');
  return text;
}
export async function retryTransaction(work) {
  for(let attempt=0;attempt<3;attempt++) {
    try { return await work(); }
    catch(error) {
      if(attempt===2 || !['40P01','40001'].includes(error.code)) throw error;
      await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)));
    }
  }
}

