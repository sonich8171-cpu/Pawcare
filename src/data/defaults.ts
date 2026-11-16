import heroPetcareImg from '../assets/images/hero_dehradun_petcare_1794551073014.jpg';
import sittingImg from '../assets/images/service_pet_sitting_1794551073161.jpg';
import walkingImg from '../assets/images/service_dog_walking_1794551073939.jpg';
import feedingImg from '../assets/images/service_pet_feeding_1794551074585.jpg';
import trustCaregiverImg from '../assets/images/about_caregiver_trust_1794551075144.jpg';
import basicCareImg from '../assets/images/basic_pet_care_1794805412569.jpg';
import temporaryCareImg from '../assets/images/temporary_pet_care_1794805412405.jpg';
import aboutStoryImg from '../assets/images/about_dehradun_story_1794805413692.jpg';
import dogPortraitImg from '../assets/images/pet_dog_portrait_1794805413211.jpg';
import catPortraitImg from '../assets/images/pet_cat_portrait_1794805414369.jpg';
import rabbitPortraitImg from '../assets/images/pet_rabbit_portrait_1794805414472.jpg';
import birdPortraitImg from '../assets/images/pet_bird_portrait_1794805414527.jpg';
import type { PetType, PlatformSettings, ServiceItem } from '../types/pawcare';

export const BRAND_ASSETS = {
  heroPetcareImg,
  sittingImg,
  walkingImg,
  feedingImg,
  basicCareImg,
  temporaryCareImg,
  trustCaregiverImg,
  aboutStoryImg,
  dogPortraitImg,
  catPortraitImg,
  rabbitPortraitImg,
  birdPortraitImg,
};

const SERVICE_IMAGE_BY_KEY: Record<string, string> = {
  'pet-sitting': sittingImg,
  'pet sitting': sittingImg,
  'dog-walking': walkingImg,
  'dog walking': walkingImg,
  'pet-feeding': feedingImg,
  'pet feeding': feedingImg,
  'basic-pet-care': basicCareImg,
  'basic pet care': basicCareImg,
  'temporary-pet-care': temporaryCareImg,
  'temporary pet care': temporaryCareImg,
};

export function resolveServiceImage(
  serviceOrTitle?: Partial<Pick<ServiceItem, 'serviceId' | 'slug' | 'title' | 'imageUrl'>> | string
): string {
  if (!serviceOrTitle) return sittingImg;
  if (typeof serviceOrTitle === 'string') {
    const key = serviceOrTitle.trim().toLowerCase();
    if (SERVICE_IMAGE_BY_KEY[key]) return SERVICE_IMAGE_BY_KEY[key];
    if (key.includes('walk')) return walkingImg;
    if (key.includes('feed')) return feedingImg;
    if (key.includes('basic') || key.includes('groom')) return basicCareImg;
    if (key.includes('temp') || key.includes('board')) return temporaryCareImg;
    return sittingImg;
  }

  // Prefer explicit remote HTTPS/Storage URLs or non-legacy local data URLs set by Admin
  const rawUrl = serviceOrTitle.imageUrl?.trim();
  if (rawUrl && (rawUrl.startsWith('https://') || rawUrl.startsWith('http://') || rawUrl.startsWith('data:'))) {
    return rawUrl;
  }

  const candidates = [
    serviceOrTitle.serviceId,
    serviceOrTitle.slug,
    serviceOrTitle.title,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  for (const key of candidates) {
    if (SERVICE_IMAGE_BY_KEY[key]) return SERVICE_IMAGE_BY_KEY[key];
  }

  const combined = candidates.join(' ');
  if (combined.includes('walk')) return walkingImg;
  if (combined.includes('feed')) return feedingImg;
  if (combined.includes('basic') || combined.includes('groom')) return basicCareImg;
  if (combined.includes('temp') || combined.includes('board')) return temporaryCareImg;
  if (combined.includes('sit')) return sittingImg;

  return rawUrl || basicCareImg;
}

export function resolvePetImage(pet?: { photoUrl?: string; petType?: PetType }): string | undefined {
  if (pet?.photoUrl?.trim()) return pet.photoUrl.trim();
  switch (pet?.petType) {
    case 'Dog':
      return dogPortraitImg;
    case 'Cat':
      return catPortraitImg;
    case 'Rabbit':
      return rabbitPortraitImg;
    case 'Bird':
      return birdPortraitImg;
    default:
      return undefined;
  }
}

export const AVATAR_PALETTES = [
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-amber-100 text-amber-900 border-amber-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-rose-100 text-rose-800 border-rose-200',
] as const;

export function getAvatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

export function getInitials(name?: string): string {
  const parts = (name || 'PC')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'PC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const DEHRADUN_DEFAULT_LOCALITIES = [
  'Rajpur Road',
  'Jakhan',
  'Clement Town',
  'Dalanwala',
  'Ballupur',
  'Vasant Vihar',
  'Prem Nagar',
  'Karanpur',
  'Sahastradhara Road',
  'Pondha',
];

export const AVAILABILITY_SLOTS = [
  'Morning (07:00 - 10:00)',
  'Midday (11:00 - 14:00)',
  'Afternoon (15:00 - 17:00)',
  'Evening (17:30 - 20:30)',
  'Full Day (09:00 - 19:00)',
];

export const CAREGIVER_SKILLS = [
  'Dog Handling',
  'Cat Care',
  'Senior Pet Patience',
  'Puppy Routine Support',
  'Leash Training Basics',
  'Medication Reminders (Non-Vet)',
  'Dietary Portion Adherence',
  'Multi-Pet Supervision',
];

export const DEFAULT_SERVICES: ServiceItem[] = [
  {
    serviceId: 'pet-sitting',
    slug: 'pet-sitting',
    title: 'Pet Sitting',
    description:
      'Attentive in-home companionship and supervision while you are at work, in college lectures, or travelling out of Dehradun.',
    durationLabel: 'Half Day (4 hrs)',
    basePrice: 500,
    providerPayout: 300,
    platformCommission: 200,
    isActive: true,
    imageUrl: sittingImg,
  },
  {
    serviceId: 'dog-walking',
    slug: 'dog-walking',
    title: 'Dog Walking',
    description:
      'Structured neighbourhood walks tailored to your dog’s pace, hydration breaks, and paw cleaning after walks.',
    durationLabel: '45–60 mins',
    basePrice: 500,
    providerPayout: 300,
    platformCommission: 200,
    isActive: true,
    imageUrl: walkingImg,
  },
  {
    serviceId: 'pet-feeding',
    slug: 'pet-feeding',
    title: 'Pet Feeding',
    description:
      'Timely drop-in visits to serve measured meals, refresh clean drinking water, clean bowls, and confirm your pet is settled.',
    durationLabel: '30–45 mins',
    basePrice: 500,
    providerPayout: 300,
    platformCommission: 200,
    isActive: true,
    imageUrl: feedingImg,
  },
  {
    serviceId: 'basic-pet-care',
    slug: 'basic-pet-care',
    title: 'Basic Pet Care',
    description:
      'Gentle coat brushing, ear wiping, litter/crate tidying, playtime enrichment, and daily photo updates for pet parents.',
    durationLabel: '60–90 mins',
    basePrice: 500,
    providerPayout: 300,
    platformCommission: 200,
    isActive: true,
    imageUrl: basicCareImg,
  },
  {
    serviceId: 'temporary-pet-care',
    slug: 'temporary-pet-care',
    title: 'Temporary Pet Care',
    description:
      'Short-term scheduled care blocks for exams, weekend trips, or family events with consistent caregiver check-ins.',
    durationLabel: 'Full Day Block',
    basePrice: 500,
    providerPayout: 300,
    platformCommission: 200,
    isActive: true,
    imageUrl: temporaryCareImg,
  },
];

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  settingId: 'public_config',
  platformName: 'PawCare',
  whatsappNumber: '919876543210',
  supportEmail: 'care@pawcaredehradun.in',
  heroBannerNotice:
    'Now onboarding verified local caregivers across Rajpur Road, Jakhan, Clement Town, and Dalanwala.',
  bookingPolicy:
    'Bookings require a verified email address, an active pet profile with feeding and health disclosures, and an administrator-approved Dehradun caregiver. Slot locks prevent overlapping bookings.',
  cancellationPolicy:
    'Customers may cancel pending, accepted, or confirmed bookings directly from their dashboard before the scheduled care session starts. Cancelled slots are immediately released on the caregiver schedule.',
  defaultBookingPrice: 500,
  defaultProviderCost: 300,
  monthlyFixedCost: 5000,
  commissionModel: 'fixed_margin',
  commissionPercentage: 40,
  localities: DEHRADUN_DEFAULT_LOCALITIES,
  faqs: [
    {
      question: 'How does PawCare verify caregivers in Dehradun?',
      answer:
        'Every caregiver submits government or student ID documentation, local address details, and experience history. Profiles remain hidden from public booking until an administrator reviews and approves them.',
    },
    {
      question: 'Does PawCare provide veterinary or emergency medical care?',
      answer:
        'No. PawCare provides non-medical daily pet sitting, walking, feeding, and basic care. In case of any health emergency, caregivers contact the pet owner and emergency contact immediately.',
    },
    {
      question: 'How is booking pricing structured?',
      answer:
        'Our initial planning assumption is ₹500 per standard session (₹300 caregiver payout and ₹200 platform contribution), configurable by administrators as local market feedback evolves.',
    },
    {
      question: 'What is your cancellation policy?',
      answer:
        'Bookings may be cancelled prior to service start from your dashboard. Released slots immediately become available again, and any test-verified or pending payments are flagged for refund handling.',
    },
  ],
  testimonials: [
    {
      name: 'Riya Nautiyal',
      role: 'Postgraduate Student, Graphic Era',
      locality: 'Clement Town',
      quote:
        'During semester exams I needed reliable evening walks for my Indie pup. Booking a verified caregiver nearby saved us both so much stress.',
      rating: 5,
    },
    {
      name: 'Siddharth Rawat',
      role: 'Software Engineer',
      locality: 'Rajpur Road',
      quote:
        'Having clear feeding instructions stored on my dog’s profile and transparent pricing made every weekday visit effortless.',
      rating: 5,
    },
    {
      name: 'Meera Bisht',
      role: 'Architect & Cat Parent',
      locality: 'Dalanwala',
      quote:
        'When travelling for site visits, PawCare drop-in feeding keeps my two cats calm in their own home.',
      rating: 5,
    },
  ],
  updatedAt: null,
};

export const VENTURE_FINANCIAL_SCENARIOS = [
  {
    key: 'conservative',
    label: 'Conservative Scenario',
    customers: 10,
    purchasesPerCustomer: 1,
    sellingPrice: 500,
    variableCost: 300,
    fixedCost: 5000,
  },
  {
    key: 'base',
    label: 'Base Scenario',
    customers: 25,
    purchasesPerCustomer: 2,
    sellingPrice: 500,
    variableCost: 300,
    fixedCost: 5000,
  },
  {
    key: 'ambitious',
    label: 'Ambitious Scenario',
    customers: 50,
    purchasesPerCustomer: 3,
    sellingPrice: 500,
    variableCost: 300,
    fixedCost: 5000,
  },
] as const;

export const VALIDATION_EXPERIMENT_PLAN = [
  {
    week: 'Week 1',
    title: 'Instagram & WhatsApp Launch',
    target: '100–150 local pet owners reached across Dehradun groups',
    channel: 'Instagram, WhatsApp Communities, College Groups',
  },
  {
    week: 'Week 2',
    title: 'Customer Discovery Surveys',
    target: '30 completed pet owner pricing & trust surveys',
    channel: 'Local Pet Communities, Vet Clinics, Pet Shops',
  },
  {
    week: 'Week 3',
    title: 'Controlled Trial Bookings',
    target: '5–10 real trial bookings fulfilled by verified caregivers',
    channel: 'Direct WhatsApp & PawCare Web App',
  },
  {
    week: 'Week 4',
    title: 'Feedback & Referral Loop',
    target: '10–15 new customers & 20%+ repeat booking interest',
    channel: 'Referral Marketing & Post-Service Reviews',
  },
] as const;

export const MVP_TARGET_METRICS = {
  interestedUsersTarget: 20,
  paidBookingsTarget: 10,
  positiveFeedbackTargetPct: 80,
  repeatInterestTargetPct: 20,
} as const;
