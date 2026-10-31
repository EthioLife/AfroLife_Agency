export const PUBLIC_SUBSCRIPTION_SERVICES = Object.freeze([
  Object.freeze({ key: 'accounting', name: 'Accounting & Finance', monthlyEtb: 1000 }),
  Object.freeze({ key: 'property_management', name: 'Property Management', monthlyEtb: 1000 }),
  Object.freeze({ key: 'workforce_management', name: 'Workforce Management', monthlyEtb: 1000 }),
  Object.freeze({ key: 'super_agent', name: 'Super Agent', monthlyEtb: 1000 }),
  Object.freeze({ key: 'edir', name: 'Edir', monthlyEtb: 1000 }),
  Object.freeze({ key: 'insurance_brokerage', name: 'Insurance Brokerage', monthlyEtb: 1000 }),
  Object.freeze({ key: 'agent', name: 'Agent', monthlyEtb: 1000 }),
  Object.freeze({ key: 'landlord', name: 'Landlord', monthlyEtb: 1000 }),
  Object.freeze({ key: 'seller', name: 'Seller', monthlyEtb: 1000 }),
]);

export function normalizeSubscriptionCatalog(payload) {
  const records = Array.isArray(payload) ? payload : payload?.services;
  if (!Array.isArray(records)) return null;
  return PUBLIC_SUBSCRIPTION_SERVICES.flatMap((service) => {
    const record = records.find((item) => {
      const key = item?.service_key ?? item?.key ?? item?.id;
      return key === service.key || item?.name === service.name || item?.label === service.name;
    });
    if (!record || record.enabled === false || record.available === false) return [];
    return [{
      ...service,
      requestKey: String(record.service_key ?? record.key ?? record.id ?? service.key),
    }];
  });
}

export function normalizeMySubscriptions(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.requests)) return payload.requests;
  if (Array.isArray(payload?.subscriptions)) return payload.subscriptions;
  return [];
}

export function subscriptionRequestPayload(selectedServices) {
  return { services: [...new Set(selectedServices)] };
}
