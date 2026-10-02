import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import App from './App';
import { SetupNotice } from './components/SetupNotice';
import { KioskApp } from './kiosk/KioskApp';
import './index.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);

// Public self-check-in: /k/<secret token>. No sign-in, so Clerk isn't loaded at all.
const kioskToken = window.location.pathname.match(/^\/k\/([A-Za-z0-9_-]{20,100})\/?$/)?.[1];

if (kioskToken && convexUrl) {
  root.render(
    <React.StrictMode>
      <ConvexProvider client={new ConvexReactClient(convexUrl)}>
        <KioskApp token={kioskToken} />
      </ConvexProvider>
    </React.StrictMode>
  );
} else if (!convexUrl || !clerkKey) {
  root.render(<SetupNotice missing={[!convexUrl && 'VITE_CONVEX_URL', !clerkKey && 'VITE_CLERK_PUBLISHABLE_KEY'].filter(Boolean) as string[]} />);
} else {
  const convex = new ConvexReactClient(convexUrl);
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={clerkKey}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <App />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </React.StrictMode>
  );
}
