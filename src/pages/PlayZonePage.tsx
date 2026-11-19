import { PlayZoneSection } from '../components/PlayZoneSection';

interface PlayZonePageProps {
  defaultView?: 'play' | 'rewards';
}

export function PlayZonePage({ defaultView = 'play' }: PlayZonePageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <PlayZoneSection defaultView={defaultView} />
    </div>
  );
}
