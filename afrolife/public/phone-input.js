function normalizeFullPhone(value) {
  const phone = String(value ?? '').trim().replace(/[\s\-().]/g, '');
  if (/^\+251[1-579]\d{8}$/.test(phone)) return phone;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function normalizePhoneParts(countryCallingCode, nationalNumber) {
  const code = String(countryCallingCode ?? '').trim().replace(/[\s()-]/g, '');
  const local = String(nationalNumber ?? '').trim().replace(/[\s\-().]/g, '');
  const fullPhone = normalizeFullPhone(local);
  if (fullPhone) return fullPhone;
  if (!/^\+[1-9]\d{0,2}$/.test(code) || !/^\d{6,14}$/.test(local)) return null;
  const national = code === '+251' && /^0\d{9}$/.test(local) ? local.slice(1) : local;
  const phone = `${code}${national}`;
  if (code === '+251') return /^\+251[1-579]\d{8}$/.test(phone) ? phone : null;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function phonePayload(form) {
  const countryCode = form.elements.namedItem('phone_country_code')?.value ?? '';
  const nationalNumber = form.elements.namedItem('phone')?.value ?? '';
  const canonical = normalizePhoneParts(countryCode, nationalNumber);
  if (!canonical) {
    throw new Error('Enter a valid country calling code and phone number.');
  }
  if (normalizeFullPhone(nationalNumber)) return { phone: canonical };
  return {
    phone_country_code: countryCode.trim(),
    phone_national_number: nationalNumber.trim(),
  };
}
