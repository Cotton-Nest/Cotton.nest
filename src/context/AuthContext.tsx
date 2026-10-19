import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  authProvider: 'google' | 'phone' | 'email';
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: (customData?: Partial<UserProfile>) => void;
  loginWithPhone: (phone: string, name: string) => void;
  loginWithEmail: (email: string, name: string) => void;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
}

const STORAGE_KEY = 'cotton_nest_user_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const loginWithGoogle = (customData?: Partial<UserProfile>) => {
    setIsLoading(true);
    // Defaults to the active app user email or custom provided Google profile
    const defaultGoogleEmail = "adityaa.22082011@gmail.com";
    const defaultName = customData?.name || "Aditya";
    const email = customData?.email || defaultGoogleEmail;
    
    // Generate avatar url based on name
    const avatar = customData?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(defaultName)}&backgroundColor=b83f60,c29e57,2c2420&textColor=ffffff`;

    const profile: UserProfile = {
      id: customData?.id || `usr_google_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: defaultName,
      email: email,
      phone: customData?.phone || "7838625915",
      avatar: avatar,
      authProvider: 'google',
    };

    setUser(profile);
    setIsLoading(false);
  };

  const loginWithPhone = (phone: string, name: string) => {
    setIsLoading(true);
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const cleanName = name.trim() || 'Valued Customer';
    const profile: UserProfile = {
      id: `usr_phone_${cleanPhone}`,
      name: cleanName,
      email: `${cleanPhone}@cottonnest.orders`,
      phone: cleanPhone,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=2c2420&textColor=dec89b`,
      authProvider: 'phone',
    };
    setUser(profile);
    setIsLoading(false);
  };

  const loginWithEmail = (email: string, name: string) => {
    setIsLoading(true);
    const cleanName = name.trim() || email.split('@')[0];
    const profile: UserProfile = {
      id: `usr_email_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: cleanName,
      email: email.trim().toLowerCase(),
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=b83f60&textColor=ffffff`,
      authProvider: 'email',
    };
    setUser(profile);
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    if (!user) return;
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithGoogle,
        loginWithPhone,
        loginWithEmail,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
