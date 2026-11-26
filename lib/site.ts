function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const deploymentDomain = process.env.VERCEL_URL?.trim();
  const value = explicit || (productionDomain ? `https://${productionDomain}` : '') ||
    (deploymentDomain ? `https://${deploymentDomain}` : '') ||
    'https://ruffneck-exchange.vercel.app';
  try {
    return new URL(value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`).origin;
  } catch {
    return 'https://ruffneck-exchange.vercel.app';
  }
}

export const site = {
  name: 'RuffNeck Exchange',
  shortName: 'RNX',
  url: resolveSiteUrl(),
  description: 'Discover products, source services, compare business options and submit buying or procurement requests across Nigeria and beyond.',
  states: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
    'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT',
    'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
    'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
    'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
  ] as const,
};

export const departments = [
  { name: 'Agriculture & Agro-processing', slug: 'agriculture-agro-processing', description: 'Farm inputs, equipment, processing, packaging and agricultural supply chains.', keywords: ['farm', 'farming', 'agriculture', 'agro', 'food processing', 'seeds', 'fertilizer', 'fertiliser', 'livestock', 'irrigation'] },
  { name: 'Industrial Equipment & Machinery', slug: 'industrial-equipment-machinery', description: 'Production machinery, tools, plant equipment, maintenance and industrial supplies.', keywords: ['equipment', 'machinery', 'machine', 'industrial', 'factory', 'tools', 'manufacturing'] },
  { name: 'Construction & Building Materials', slug: 'construction-building-materials', description: 'Construction materials, finishing, fittings, building systems and contractors.', keywords: ['construction', 'building', 'cement', 'blocks', 'steel', 'roofing', 'tiles', 'plumbing', 'doors', 'windows'] },
  { name: 'Energy & Electrical', slug: 'energy-electrical', description: 'Power systems, solar, electrical components, installation and maintenance.', keywords: ['energy', 'solar', 'electricity', 'electrical', 'inverter', 'battery', 'panels', 'power', 'generator'] },
  { name: 'Refrigeration & Cold-chain', slug: 'refrigeration-cold-chain', description: 'Cold rooms, refrigeration equipment, HVAC, spare parts and technical services.', keywords: ['refrigeration', 'cold room', 'cold rooms', 'fridge', 'freezer', 'air conditioning', 'air conditioner', 'hvac', 'cooling', 'ice machine'] },
  { name: 'Transport & Logistics', slug: 'transport-logistics', description: 'Freight, haulage, delivery, storage, shipping and supply-chain services.', keywords: ['transport', 'logistics', 'shipping', 'delivery', 'haulage', 'freight', 'warehouse', 'courier'] },
  { name: 'Healthcare Supplies', slug: 'healthcare-supplies', description: 'Medical equipment, clinic supplies, diagnostics and healthcare procurement.', keywords: ['health', 'medical', 'hospital', 'clinic', 'medical equipment', 'pharma', 'pharmaceutical', 'diagnostic'] },
  { name: 'Technology & Software', slug: 'technology-software', description: 'Software, IT equipment, digital services, automation and technology solutions.', keywords: ['technology', 'software', 'it', 'computer', 'laptop', 'mobile app', 'web development', 'ai', 'automation', 'cybersecurity'] },
  { name: 'Wholesale & Distribution', slug: 'wholesale-distribution', description: 'Bulk sourcing, wholesale supply, distribution and channel partnerships.', keywords: ['wholesale', 'bulk', 'distributor', 'distribution', 'supplier', 'reseller'] },
  { name: 'Professional & Business Services', slug: 'professional-business-services', description: 'Professional expertise, consulting, business support and outsourced services.', keywords: ['professional', 'consulting', 'legal', 'accounting', 'business support', 'hr', 'marketing', 'design'] },
  { name: 'Food & Commercial Supplies', slug: 'food-commercial-supplies', description: 'Foodservice, hospitality, commercial kitchen, packaging and consumables.', keywords: ['food', 'restaurant', 'catering', 'hotel', 'commercial kitchen', 'packaging', 'groceries', 'bakery'] },
  { name: 'Vehicles & Spare Parts', slug: 'vehicles-spare-parts', description: 'Vehicles, fleet requirements, automotive components and maintenance services.', keywords: ['vehicle', 'car', 'motorcycle', 'truck', 'spare parts', 'auto parts', 'tyres', 'tires', 'fleet'] },
  { name: 'Education & Training', slug: 'education-training', description: 'Learning programmes, training services, education technology and supplies.', keywords: ['education', 'training', 'school', 'course', 'tutoring', 'learning', 'certification'] },
  { name: 'Retail & Consumer Goods', slug: 'retail-consumer-goods', description: 'Consumer products, household goods, appliances, furniture and retail supply.', keywords: ['retail', 'consumer', 'home', 'appliance', 'furniture', 'fashion', 'electronics'] }
] as const;

export function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function stateFromSlug(slug: string): string | undefined {
  return site.states.find((state) => slugify(state) === slug.toLowerCase());
}
