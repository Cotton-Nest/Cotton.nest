import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { LoyaltyProvider } from './context/LoyaltyContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <LoyaltyProvider>
      <App />
    </LoyaltyProvider>
  </AuthProvider>
);
