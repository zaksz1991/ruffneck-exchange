'use client';

export function PrintQuoteDocumentButton() {
  return (
    <button className="button button-small" type="button" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
