import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CITIES, DEFAULT_CITY, type CityId } from '@/sim/cities';

interface CityState {
  city: CityId;
  setCity: (city: CityId) => void;
}

// The learner's choice of city layout, remembered across beats and visits.
// Hydration is manual (see CityToggle) so the server and first client render agree.
export const useCityStore = create<CityState>()(
  persist((set) => ({ city: DEFAULT_CITY, setCity: (city) => set({ city }) }), {
    name: 'howitworks-city',
    // Ignore a saved city that no longer exists
    merge: (saved, current) => {
      const city = (saved as Partial<CityState> | undefined)?.city;
      return city && city in CITIES ? { ...current, city } : current;
    },
    skipHydration: true,
  }),
);
