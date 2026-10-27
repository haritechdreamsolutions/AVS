const idValue = (value) => value != null && String(value).trim() !== '' && Number(value) > 0 ? String(value) : null;
const inactive = (value) => [false,0,'0','false'].includes(value);
const recordName = (record) => String(record.driver_name || record.employee_name || '').trim();
const counterNames = new Set(['store keeper','storekeeper','store keeper pos','storekeeper pos','store keeper (counter direct)','counter','counter direct']);

export function isStoreBalanceRecord(record) {
  const employeeId = idValue(record.driver_id) || idValue(record.employee_id);
  const name = recordName(record).toLowerCase();
  if (employeeId) return record.is_store_direct_sale === true && counterNames.has(name);
  return !name || counterNames.has(name) || record.is_store_direct_sale === true;
}

export function getBalanceRecordKey(record) {
  if (!idValue(record.employee_id) && !idValue(record.driver_id) && record.expense_date) return 'STORE';
  if (isStoreBalanceRecord(record)) return 'STORE';
  const employeeId = idValue(record.driver_id) || idValue(record.employee_id);
  if (employeeId) return employeeId;
  // Name-only legacy history stays separate from newly created users with that name.
  return `NAME_${recordName(record).toLowerCase()}`;
}

export function buildBalanceUsers({employees=[],drivers=[],users=[],sales=[],expenses=[],damages=[],shortages=[]}) {
  const map = new Map([['STORE',{id:'STORE',name:'Store Keeper (Counter Direct)',vehicleNumber:'Counter',icon:'🏬',isHistorical:false}]]);
  const accounts = new Map(users.map(user => [String(user.id),user]));
  const employeeAccounts = new Map();
  for (const user of users) {
    const id = idValue(user.employee_id);
    if (!id) continue;
    if (!employeeAccounts.has(id)) employeeAccounts.set(id,[]);
    employeeAccounts.get(id).push(user);
  }
  const addCurrent = (key,person) => {
    if (!key) return;
    const previous = map.get(key);
    map.set(key,{id:key,name:person.full_name || person.employee_name || person.name || person.driver_name || previous?.name || `Employee #${key}`,
      vehicleNumber:person.vehicle_number || person.vehicle_no || previous?.vehicleNumber || '',icon:'🚚',isHistorical:false});
  };
  for (const employee of employees) {
    const linked = employeeAccounts.get(idValue(employee.id));
    const onlyInactiveAccounts = linked?.length && linked.every(user => user.account_status && user.account_status !== 'ACTIVE');
    if (!inactive(employee.is_active) && !onlyInactiveAccounts) addCurrent(idValue(employee.id),employee);
  }
  for (const driver of drivers) {
    if (inactive(driver.is_active) || (driver.account_status && driver.account_status !== 'ACTIVE')) continue;
    const account = accounts.get(String(driver.user_account_id));
    const key = account ? idValue(account.employee_id) || `USER_${account.id}` : idValue(driver.employee_id) || idValue(driver.id);
    addCurrent(key,driver);
  }
  for (const user of users) {
    if (!['OWNER','STORE_KEEPER','DRIVER','EMPLOYEE','ADMINISTRATOR'].includes(String(user.role || user.role_name || '').toUpperCase())) continue;
    if (user.account_status && user.account_status !== 'ACTIVE') continue;
    addCurrent(idValue(user.employee_id) || `USER_${user.id}`,user);
  }
  for (const record of [...sales,...expenses,...damages,...shortages]) {
    const key = getBalanceRecordKey(record);
    if (!map.has(key)) map.set(key,{id:key,name:recordName(record) || `Former employee #${key}`,
      vehicleNumber:record.vehicle_number || '',icon:'🚚',isHistorical:true});
  }
  return [...map.values()];
}
