export interface ProductTemplateItem {
  code: string;
  name: string;
  description: string;
  productType: 'division' | 'offering';
  parentCode?: string;
}

export interface ProductPriceTemplate {
  productCode: string;
  priceUnit: string;
  pricingModel: 'fixed' | 'range' | 'percentage' | 'quote';
  minimumRate?: string;
  maximumRate?: string;
  currency: string | null;
  sourceNote: string;
}

export interface ProductTargetTemplate {
  productCode: string;
  planYearIndex: number;
  revenueTarget: string;
}

const sourcePrefix = 'Reference: EthioLife Enterprise strategic plan dated 30 June 2025; market examples are cited as 2023 estimates. Draft guidance only, not current market research or a checkout price. Validate current labor, tax, supplies, transport, licensing, and market costs before approval.';

export const ethioLifeProducts: ProductTemplateItem[] = [
  { code: 'ETHIOCARE', name: 'EthioCare', description: 'Home health service division.', productType: 'division' },
  { code: 'CARE_BASIC', name: 'Basic non-medical care', description: 'Personal hygiene, mobility, meal support, and transportation support.', productType: 'offering', parentCode: 'ETHIOCARE' },
  { code: 'CARE_NURSING', name: 'Nursing services', description: 'Physician-prescribed wound care, medication management, and health monitoring.', productType: 'offering', parentCode: 'ETHIOCARE' },
  { code: 'CARE_ELDER', name: 'Elder care', description: 'Companionship, cognitive stimulation, and home safety assessment.', productType: 'offering', parentCode: 'ETHIOCARE' },
  { code: 'CARE_POST_SURGICAL', name: 'Post-surgical recovery', description: 'Short-term specialized care and support after surgery.', productType: 'offering', parentCode: 'ETHIOCARE' },
  { code: 'CARE_PALLIATIVE', name: 'End-of-life and palliative care', description: 'Comfort care and emotional support.', productType: 'offering', parentCode: 'ETHIOCARE' },
  { code: 'CARE_HOURLY_REFERENCE', name: 'EthioCare hourly reference rate', description: 'Shared historical rate band; set a service-specific approved rate before quoting.', productType: 'offering', parentCode: 'ETHIOCARE' },
  { code: 'CARE_VISIT_REFERENCE', name: 'EthioCare home-visit reference rate', description: 'Shared historical visit-rate band; set a service-specific approved rate before quoting.', productType: 'offering', parentCode: 'ETHIOCARE' },

  { code: 'BRIGHT_SPACES', name: 'Bright Spaces', description: 'Cleaning and hygiene division.', productType: 'division' },
  { code: 'CLEAN_RESIDENTIAL', name: 'Residential cleaning', description: 'Weekly, biweekly, deep, pre-event, and post-event cleaning.', productType: 'offering', parentCode: 'BRIGHT_SPACES' },
  { code: 'CLEAN_COMMERCIAL', name: 'Commercial cleaning', description: 'Office, shop, and hotel cleaning contracts.', productType: 'offering', parentCode: 'BRIGHT_SPACES' },
  { code: 'CLEAN_SPECIALIZED', name: 'Specialized cleaning', description: 'Carpet, window, and exterior-surface cleaning.', productType: 'offering', parentCode: 'BRIGHT_SPACES' },
  { code: 'CLEAN_PEST_CONTROL', name: 'Pest control', description: 'Residential and commercial pest-control service.', productType: 'offering', parentCode: 'BRIGHT_SPACES' },
  { code: 'CLEAN_ECO', name: 'Eco-friendly cleaning', description: 'Cleaning using green products and methods.', productType: 'offering', parentCode: 'BRIGHT_SPACES' },
  { code: 'CLEAN_SQM_REFERENCE', name: 'Cleaning per-square-metre reference rate', description: 'Historical reference band; validate the surface and service scope before quoting.', productType: 'offering', parentCode: 'BRIGHT_SPACES' },
  { code: 'CLEAN_HOURLY_REFERENCE', name: 'Cleaning hourly reference rate', description: 'Historical reference band; validate the service scope before quoting.', productType: 'offering', parentCode: 'BRIGHT_SPACES' },

  { code: 'DLS', name: 'Domestic and Lifestyle Support', description: 'Home and lifestyle support division.', productType: 'division' },
  { code: 'DLS_CHILDCARE', name: 'Nanny and childcare', description: 'Certified nanny and childcare services.', productType: 'offering', parentCode: 'DLS' },
  { code: 'DLS_MEAL_PREP', name: 'In-home meal preparation', description: 'Meal preparation based on client requirements and preferences.', productType: 'offering', parentCode: 'DLS' },
  { code: 'DLS_LAUNDRY', name: 'Laundry and housework', description: 'Laundry and general household work.', productType: 'offering', parentCode: 'DLS' },
  { code: 'DLS_DRIVER', name: 'Driver services', description: 'Personal or commercial driver services.', productType: 'offering', parentCode: 'DLS' },
  { code: 'DLS_HOUSE_HELP', name: 'House helpers', description: 'General household management support.', productType: 'offering', parentCode: 'DLS' },
  { code: 'DLS_FULL_TIME_REFERENCE', name: 'Full-time DLS monthly reference rate', description: 'Historical monthly service-rate band; do not treat as employee wage guidance.', productType: 'offering', parentCode: 'DLS' },
  { code: 'DLS_PART_TIME_REFERENCE', name: 'Part-time DLS hourly reference rate', description: 'Historical hourly service-rate band; validate role and service scope.', productType: 'offering', parentCode: 'DLS' },

  { code: 'RPM', name: 'Rental and Property Management', description: 'Rental and property management division.', productType: 'division' },
  { code: 'RPM_TENANT_PLACEMENT', name: 'Tenant placement and screening', description: 'Find and screen prospective tenants.', productType: 'offering', parentCode: 'RPM' },
  { code: 'RPM_RENT_COLLECTION', name: 'Rent collection', description: 'Track and collect rent payments.', productType: 'offering', parentCode: 'RPM' },
  { code: 'RPM_MAINTENANCE', name: 'Property maintenance coordination', description: 'Coordinate routine and emergency property repairs.', productType: 'offering', parentCode: 'RPM' },
  { code: 'RPM_LEASE_ADMIN', name: 'Lease administration', description: 'Prepare, renew, and administer lease records.', productType: 'offering', parentCode: 'RPM' },
  { code: 'RPM_OWNER_REPORTS', name: 'Owner financial reporting', description: 'Provide regular property-owner financial reports.', productType: 'offering', parentCode: 'RPM' },
  { code: 'RPM_MANAGEMENT_FEE', name: 'Property management fee reference', description: 'Percentage of gross monthly rent; confirm the contract scope and fee base.', productType: 'offering', parentCode: 'RPM' },
  { code: 'RPM_PLACEMENT_FEE', name: 'Tenant placement fee', description: 'Tenant placement fee; the plan does not specify an amount.', productType: 'offering', parentCode: 'RPM' },

  { code: 'SKS', name: 'Shared Kitchen Service', description: 'Shared kitchen and food-business support division.', productType: 'division' },
  { code: 'SKS_HOURLY', name: 'Commercial kitchen rental by the hour', description: 'Hourly rental of an equipped commercial kitchen.', productType: 'offering', parentCode: 'SKS' },
  { code: 'SKS_DAILY', name: 'Commercial kitchen rental by the day', description: 'Daily rental of an equipped commercial kitchen.', productType: 'offering', parentCode: 'SKS' },
  { code: 'SKS_MONTHLY', name: 'Commercial kitchen monthly rental', description: 'Monthly rental agreement for an equipped commercial kitchen.', productType: 'offering', parentCode: 'SKS' },
  { code: 'SKS_INCUBATION', name: 'Food-business incubation', description: 'Advice and support for small food businesses.', productType: 'offering', parentCode: 'SKS' },
  { code: 'SKS_FOOD_SAFETY', name: 'Food safety support', description: 'Food safety training and certification support for clients.', productType: 'offering', parentCode: 'SKS' },
  { code: 'SKS_STORAGE', name: 'Shared warehouse and storage', description: 'Shared storage space for food-business products.', productType: 'offering', parentCode: 'SKS' },

  { code: 'TRAINING', name: 'Training Center', description: 'Internal capability-building and external training division.', productType: 'division' },
  { code: 'TRAINING_INTERNAL', name: 'Internal workforce training', description: 'Staff development, customer service, health and safety, and technology use.', productType: 'offering', parentCode: 'TRAINING' },
  { code: 'TRAINING_DOMESTIC', name: 'Domestic assistant training', description: 'External domestic assistant training, including childcare, food preparation, and household management.', productType: 'offering', parentCode: 'TRAINING' },
  { code: 'TRAINING_CLEANING', name: 'Cleaning professional training', description: 'External training in modern cleaning techniques and hygiene standards.', productType: 'offering', parentCode: 'TRAINING' },
  { code: 'TRAINING_ELDER_CARE', name: 'Basic elderly-care training', description: 'External training for family members and private caregivers.', productType: 'offering', parentCode: 'TRAINING' },
  { code: 'TRAINING_FOOD_SAFETY', name: 'Food safety and hygiene training', description: 'External food safety training for shared-kitchen clients and small food businesses.', productType: 'offering', parentCode: 'TRAINING' },
  { code: 'TRAINING_PROPERTY', name: 'Basic property-management training', description: 'External lease management, maintenance, and financial-reporting training.', productType: 'offering', parentCode: 'TRAINING' },
];

export const ethioLifePrices: ProductPriceTemplate[] = [
  { productCode: 'CARE_HOURLY_REFERENCE', priceUnit: 'hour', pricingModel: 'range', minimumRate: '1330.00', maximumRate: '2660.00', currency: 'ETB', sourceNote: `${sourcePrefix} The document states this range varies by care type.` },
  { productCode: 'CARE_VISIT_REFERENCE', priceUnit: 'visit', pricingModel: 'range', minimumRate: '3990.00', maximumRate: '6650.00', currency: 'ETB', sourceNote: `${sourcePrefix} The document states this range varies by care type.` },
  { productCode: 'CLEAN_SQM_REFERENCE', priceUnit: 'sqm', pricingModel: 'range', minimumRate: '66.50', maximumRate: '266.00', currency: 'ETB', sourceNote: sourcePrefix },
  { productCode: 'CLEAN_HOURLY_REFERENCE', priceUnit: 'hour', pricingModel: 'range', minimumRate: '1064.00', maximumRate: '1995.00', currency: 'ETB', sourceNote: sourcePrefix },
  { productCode: 'DLS_FULL_TIME_REFERENCE', priceUnit: 'month', pricingModel: 'range', minimumRate: '19950.00', maximumRate: '53200.00', currency: 'ETB', sourceNote: `${sourcePrefix} This is a customer-facing service price example, not a wage or payroll rate.` },
  { productCode: 'DLS_PART_TIME_REFERENCE', priceUnit: 'hour', pricingModel: 'range', minimumRate: '1064.00', maximumRate: '1995.00', currency: 'ETB', sourceNote: sourcePrefix },
  { productCode: 'RPM_MANAGEMENT_FEE', priceUnit: 'percentage_of_gross_monthly_rent', pricingModel: 'percentage', minimumRate: '8.0000', maximumRate: '12.0000', currency: null, sourceNote: `${sourcePrefix} The percentage base and tenant-placement fees require contract-specific review.` },
  { productCode: 'RPM_PLACEMENT_FEE', priceUnit: 'quote', pricingModel: 'quote', currency: 'ETB', sourceNote: `${sourcePrefix} The document mentions placement fees but provides no amount.` },
  { productCode: 'SKS_HOURLY', priceUnit: 'hour', pricingModel: 'range', minimumRate: '1995.00', maximumRate: '3990.00', currency: 'ETB', sourceNote: sourcePrefix },
  { productCode: 'SKS_DAILY', priceUnit: 'day', pricingModel: 'range', minimumRate: '13300.00', maximumRate: '26600.00', currency: 'ETB', sourceNote: sourcePrefix },
  { productCode: 'SKS_MONTHLY', priceUnit: 'month', pricingModel: 'range', minimumRate: '133000.00', maximumRate: '332500.00', currency: 'ETB', sourceNote: sourcePrefix },
  { productCode: 'TRAINING_DOMESTIC', priceUnit: 'course', pricingModel: 'fixed', minimumRate: '15000.00', maximumRate: '15000.00', currency: 'ETB', sourceNote: `${sourcePrefix} Example: one-month domestic assistant training.` },
  { productCode: 'TRAINING_FOOD_SAFETY', priceUnit: 'course', pricingModel: 'fixed', minimumRate: '3000.00', maximumRate: '3000.00', currency: 'ETB', sourceNote: `${sourcePrefix} Example: one-day food safety training.` },
];

export const ethioLifeRevenueTargets: ProductTargetTemplate[] = [
  { productCode: 'ETHIOCARE', planYearIndex: 1, revenueTarget: '6650000.00' },
  { productCode: 'ETHIOCARE', planYearIndex: 2, revenueTarget: '19950000.00' },
  { productCode: 'ETHIOCARE', planYearIndex: 3, revenueTarget: '39900000.00' },
  { productCode: 'BRIGHT_SPACES', planYearIndex: 1, revenueTarget: '10640000.00' },
  { productCode: 'BRIGHT_SPACES', planYearIndex: 2, revenueTarget: '26600000.00' },
  { productCode: 'BRIGHT_SPACES', planYearIndex: 3, revenueTarget: '53200000.00' },
  { productCode: 'DLS', planYearIndex: 1, revenueTarget: '9310000.00' },
  { productCode: 'DLS', planYearIndex: 2, revenueTarget: '23940000.00' },
  { productCode: 'DLS', planYearIndex: 3, revenueTarget: '46550000.00' },
  { productCode: 'RPM', planYearIndex: 1, revenueTarget: '3990000.00' },
  { productCode: 'RPM', planYearIndex: 2, revenueTarget: '13300000.00' },
  { productCode: 'RPM', planYearIndex: 3, revenueTarget: '33250000.00' },
  { productCode: 'SKS', planYearIndex: 1, revenueTarget: '2660000.00' },
  { productCode: 'SKS', planYearIndex: 2, revenueTarget: '9310000.00' },
  { productCode: 'SKS', planYearIndex: 3, revenueTarget: '19950000.00' },
  { productCode: 'TRAINING', planYearIndex: 1, revenueTarget: '2000000.00' },
  { productCode: 'TRAINING', planYearIndex: 2, revenueTarget: '5000000.00' },
  { productCode: 'TRAINING', planYearIndex: 3, revenueTarget: '10000000.00' },
];

export const ethioLifePlanScenario = {
  code: 'ethiolife-strategic-plan-2018-2022-ec',
  name: 'EthioLife strategic plan (historical reference)',
  sourceNote: 'Annual revenue projections from the attached Ethio Life Enterprise strategic plan dated 30 June 2025. Amounts stated in millions of Birr were converted to ETB. Plan years are relative scenario years, not calendar years or approved current budgets.',
};

export const ethioLifeTemplateCaveat = `${sourcePrefix} Revenue targets are historical scenario references, not current budgets, audited forecasts, commitments, or financial advice.`;
