import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'BiUD - Bitcoin Username Domain',
  description: 'Register your unique .sBTC name on the Bitcoin blockchain',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Theme initialization - check localStorage or system preference
              (function() {
                try {
                  const theme = localStorage.getItem('biud-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
              
              // Prevent ethereum property conflict with browser extensions
              if (typeof window !== 'undefined') {
                const originalDefineProperty = Object.defineProperty;
                Object.defineProperty = function(obj, prop, descriptor) {
                  if (prop === 'ethereum' && obj === window) {
                    try {
                      return originalDefineProperty.call(this, obj, prop, {
                        ...descriptor,
                        configurable: true
                      });
                    } catch (e) {
                      return obj;
                    }
                  }
                  return originalDefineProperty.call(this, obj, prop, descriptor);
                };
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
