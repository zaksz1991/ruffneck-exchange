'use client';

import { useEffect } from 'react';

const pendingListingViews = new Set<string>();

/** Records at most one consented detail-view event per listing per browser tab session. */
export function ListingViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    const recordView = () => {
      const storageKey = `rnx_listing_view_session_${listingId}`;
      try {
        if (window.sessionStorage.getItem(storageKey)) return;
      } catch {
        // Continue without client-side de-duplication when session storage is unavailable.
      }

      if (pendingListingViews.has(listingId)) return;
      pendingListingViews.add(listingId);

      void fetch('/api/analytics/listing-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ listing_id: listingId }),
      })
        .then(async (response) => {
          const result = await response.json().catch(() => ({}));
          if (response.ok && result.recorded === true) {
            try {
              window.sessionStorage.setItem(storageKey, '1');
            } catch {
              // The event is recorded; lack of browser storage only affects de-duplication.
            }
          }
        })
        .catch(() => undefined)
        .finally(() => pendingListingViews.delete(listingId));
    };

    // Run on page entry, and retry if the visitor grants analytics consent while this page is open.
    recordView();
    window.addEventListener('rnx-analytics-consent-changed', recordView);
    return () => window.removeEventListener('rnx-analytics-consent-changed', recordView);
  }, [listingId]);

  return null;
}
