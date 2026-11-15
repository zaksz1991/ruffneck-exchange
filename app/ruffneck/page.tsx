const products = [
  ['RuffNeck LMS', 'Learning management, courses and training experiences.', 'https://ruffneck-lms.vercel.app/'],
  ['RuffNeck Prospector', 'Business prospecting and customer acquisition tools.', 'https://ruffneck-prospector.vercel.app/'],
  ['RuffNeck Connect', 'A platform for digital communication and connection.', 'https://ruffneck-connect.vercel.app/'],
  ['RuffNeck Social Hub', 'Social media management, publishing and engagement.', 'https://ruffneck-social-hub.vercel.app/'],
  ['Kano Run', 'A driving game experience rooted in Kano.', 'https://kano-run.vercel.app/'],
  ['Kano Keke', 'A local transport and gaming experience.', 'https://kano-keke.vercel.app/'],
  ['RuffNeck Entertainment', 'The official home of RuffNeck Entertainment.', 'https://ruffneck-entertainment.vercel.app/']
] as const;
export const metadata = { title: 'RuffNeck Products and Services', description: 'Explore products, services and digital experiences from RuffNeck Entertainment.', alternates: { canonical: '/ruffneck' } };
export default function RuffNeckPage() { return <main className="page-shell container"><div className="page-intro"><p className="eyebrow">OFFICIAL RUFFNECK SHOWCASE</p><h1>Explore the RuffNeck ecosystem.</h1><p>RuffNeck Entertainment products and services participate in the wider RuffNeck Exchange. They are presented as one seller and platform group, not as a replacement for the independent marketplace.</p></div><div className="platform-grid platform-grid-large">{products.map(([name, description, href], index) => <a className="platform-card" href={href} target="_blank" rel="noreferrer" key={name}><span className="category-index">RN / {String(index + 1).padStart(2, '0')}</span><h3>{name}</h3><p>{description}</p><span className="card-arrow">Open platform ↗</span></a>)}</div></main>; }
