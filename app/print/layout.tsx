// app/print/layout.tsx
// Standalone ROOT layout for all /print/* pages.
// By declaring <html> and <body> here, Next.js does NOT wrap these pages
// inside app/layout.tsx — prevents nested <html> hydration errors and
// ensures Puppeteer captures the document rather than the login/root page.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { height: 100%; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            color: #111827;
            background: #fff;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }
          .doc-content { flex: 1; }
          .doc-footer {
            text-align: center;
            font-size: 10px;
            color: #323232;
            border-top: 0.5px solid #bbbbbb;
            padding: 10px 24px;
            margin-top: 10px;
            background: #fff;
          }
          @media print {
            body { background: #fff !important; }
            .no-print { display: none !important; }
            .doc-footer { position: fixed; bottom: 0; left: 0; right: 0; }
          }
          @page { size: A4; margin: 10mm 10mm 10mm 10mm; }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
