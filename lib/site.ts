function resolveSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelProductionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const vercelDeploymentDomain = process.env.VERCEL_URL?.trim();
  const candidate =
    configuredUrl ||
    (vercelProductionDomain ? `https://${vercelProductionDomain}` : '') ||
    (vercelDeploymentDomain ? `https://${vercelDeploymentDomain}` : '') ||
    'https://ruffneck-exchange.vercel.app';

  try {
    const normalized = candidate.startsWith('http://') || candidate.startsWith('https://')
      ? candidate
      : `https://${candidate}`;
    return new URL(normalized).origin;
  } catch {
    return 'https://ruffneck-exchange.vercel.app';
  }
}

export const site = {
  name: 'RuffNeck Exchange',
  shortName: 'RNX',
  url: resolveSiteUrl(),
  description:
    'Discover products, compare suppliers, request quotes and connect with businesses across Nigeria and beyond.',
  states: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
    'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT',
    'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
    'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
    'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
  ],
};

export const departments = [
  'Agriculture & Agro-processing',
  'Industrial Equipment & Machinery',
  'Construction & Building Materials',
  'Energy & Electrical',
  'Refrigeration & Cold-chain',
  'Transport & Logistics',
  'Healthcare Supplies',
  'Technology & Software',
  'Wholesale & Distribution',
  'Professional & Business Services',
  'Food & Commercial Supplies',
  'Vehicles & Spare Parts',
  'Education & Training',
  'Retail & Consumer Goods',
] as const;

/**
 * Search aliases help customers find the right department using everyday
 * product and service terms. They are taxonomy terms, not live inventory.
 */
export const departmentKeywords: Record<(typeof departments)[number], string[]> = {
  'Agriculture & Agro-processing': [
    'farm', 'farming', 'agriculture', 'agro', 'food processing', 'seeds',
    'fertilizer', 'fertiliser', 'livestock',
  ],
  'Industrial Equipment & Machinery': [
    'equipment', 'machinery', 'machine', 'industrial', 'factory', 'generator', 'tools',
  ],
  'Construction & Building Materials': [
    'construction', 'building', 'cement', 'blocks', 'steel', 'roofing', 'tiles', 'plumbing',
  ],
  'Energy & Electrical': [
    'energy', 'solar', 'electricity', 'electrical', 'inverter', 'battery', 'panels', 'power',
  ],
  'Refrigeration & Cold-chain': [
    'refrigeration', 'cold room', 'cold rooms', 'fridge', 'freezer', 'air conditioning',
    'air conditioner', 'hvac', 'cooling', 'ice machine',
  ],
  'Transport & Logistics': [
    'transport', 'logistics', 'shipping', 'delivery', 'haulage', 'freight',
  ],
  'Healthcare Supplies': [
    'health', 'medical', 'hospital', 'clinic', 'medical equipment', 'pharma', 'pharmaceutical',
  ],
  'Technology & Software': [
    'technology', 'software', 'IT', 'computer', 'laptop', 'mobile app', 'web development',
    'AI', 'automation',
  ],
  'Wholesale & Distribution': [
    'wholesale', 'bulk', 'distributor', 'distribution', 'supplier',
  ],
  'Professional & Business Services': [
    'professional', 'consulting', 'legal', 'accounting', 'business support', 'HR',
  ],
  'Food & Commercial Supplies': [
    'food', 'restaurant', 'catering', 'hotel', 'commercial kitchen', 'packaging', 'groceries',
  ],
  'Vehicles & Spare Parts': [
    'vehicle', 'car', 'motorcycle', 'truck', 'spare parts', 'auto parts', 'tyres', 'tires',
  ],
  'Education & Training': [
    'education', 'training', 'school', 'course', 'tutoring', 'learning',
  ],
  'Retail & Consumer Goods': [
    'retail', 'consumer', 'home', 'appliance', 'furniture', 'fashion',
  ],
};
