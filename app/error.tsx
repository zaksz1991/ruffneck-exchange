'use client';
import { useEffect } from 'react';
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { useEffect(() => { console.error('[RNX] Application rendering error:', error); }, [error]); return <main className="page-shell container narrow-shell"><p className="eyebrow">APPLICATION ERROR</p><h1>Something went wrong.</h1><p>The page could not be displayed. Your form data may not have been saved.</p><button className="button" onClick={() => reset()}>Try again</button></main>; }
