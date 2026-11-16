import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_PLATFORM_SETTINGS, DEFAULT_SERVICES } from '../data/defaults';
import {
  subscribeActivePromotions,
  subscribeActiveServices,
  subscribeAllReviews,
  subscribePlatformSettings,
  subscribePublicCaregivers,
} from '../services/firestoreService';
import type {
  CaregiverPublicProfile,
  PlatformSettings,
  PromotionOffer,
  ReviewRecord,
  ServiceItem,
} from '../types/pawcare';

interface DataContextValue {
  services: ServiceItem[];
  platformSettings: PlatformSettings;
  publicCaregivers: CaregiverPublicProfile[];
  reviews: ReviewRecord[];
  promotions: PromotionOffer[];
  loadingPublicData: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<ServiceItem[]>(DEFAULT_SERVICES);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(
    DEFAULT_PLATFORM_SETTINGS
  );
  const [publicCaregivers, setPublicCaregivers] = useState<CaregiverPublicProfile[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [promotions, setPromotions] = useState<PromotionOffer[]>([]);
  const [loadingPublicData, setLoadingPublicData] = useState(true);

  useEffect(() => {
    const unsubs = [
      subscribeActiveServices((data) => {
        setServices(data.length > 0 ? data : DEFAULT_SERVICES);
        setLoadingPublicData(false);
      }),
      subscribePlatformSettings(setPlatformSettings),
      subscribePublicCaregivers(setPublicCaregivers),
      subscribeAllReviews(setReviews),
      subscribeActivePromotions(setPromotions),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  return (
    <DataContext.Provider
      value={{
        services,
        platformSettings,
        publicCaregivers,
        reviews,
        promotions,
        loadingPublicData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function usePublicData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('usePublicData must be used inside DataProvider');
  return ctx;
}
