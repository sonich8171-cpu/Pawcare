export type UserRole = 'customer' | 'caregiver' | 'admin';
export type AccountStatus = 'active' | 'suspended';
export type PetType = 'Dog' | 'Cat' | 'Bird' | 'Rabbit' | 'Other';
export type PetGender = 'Male' | 'Female' | 'Unknown';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type IdDocType = 'Aadhaar' | 'PAN' | 'Passport' | 'Driving License' | 'Student ID';
export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type PaymentMethod = 'cash' | 'upi' | 'online_gateway';
export type PaymentStatus = 'pending' | 'test_verified' | 'paid' | 'refund_pending' | 'refunded';
export type DisputeStatus = 'none' | 'open' | 'resolved';
export type NotificationType =
  | 'booking_request'
  | 'booking_update'
  | 'cancellation'
  | 'review_reminder'
  | 'verification';

export const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export const FIELD_LIMITS = {
  DISPLAY_NAME_MAX: 100,
  EMAIL_MAX: 160,
  PHONE_MAX: 20,
  LOCALITY_MAX: 100,
  ADDRESS_MAX: 300,
  PHOTO_URL_MAX: 1000,
  PET_NAME_MAX: 80,
  BREED_MAX: 80,
  NOTES_MAX: 600,
  BIO_MAX: 800,
  DOC_NUMBER_MAX: 40,
  MESSAGE_MAX: 1000,
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  locality?: string;
  address?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  photoUrl?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PetProfile {
  petId: string;
  ownerId: string;
  name: string;
  petType: PetType;
  breed: string;
  ageYears: number;
  gender: PetGender;
  healthInfo?: string;
  feedingInstructions?: string;
  behavioralInfo?: string;
  specialCare?: string;
  photoUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CaregiverPrivateProfile {
  caregiverId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  locality: string;
  photoUrl?: string;
  bio?: string;
  experienceYears: number;
  skills: string[];
  servicesOffered: string[];
  availability: string[];
  expectedCharge: number;
  idDocType: IdDocType;
  idDocNumber: string;
  idDocUrl?: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  adminNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CaregiverPublicProfile {
  caregiverId: string;
  fullName: string;
  locality: string;
  photoUrl?: string;
  bio?: string;
  experienceYears: number;
  skills: string[];
  servicesOffered: string[];
  availability: string[];
  expectedCharge: number;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  ratingAvg: number;
  reviewCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ServiceItem {
  serviceId: string;
  slug: string;
  title: string;
  description: string;
  durationLabel: string;
  basePrice: number;
  providerPayout: number;
  platformCommission: number;
  isActive: boolean;
  imageUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BookingRecord {
  bookingId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  caregiverId: string;
  caregiverName: string;
  petId: string;
  petName: string;
  petType?: string;
  petBreed?: string;
  petInstructions?: string;
  serviceId: string;
  serviceTitle: string;
  bookingDate: string;
  timeSlot: string;
  locality: string;
  serviceAddress: string;
  specialInstructions?: string;
  grossAmount: number;
  caregiverPayout: number;
  platformCommission: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  hasReview: boolean;
  disputeStatus: DisputeStatus;
  disputeNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReviewRecord {
  reviewId: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  caregiverId: string;
  rating: number;
  comment: string;
  wouldRepeat: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationRecord {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedBookingId?: string;
  isRead: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PaymentRecord {
  paymentId: string;
  bookingId: string;
  customerId: string;
  caregiverId: string;
  grossAmount: number;
  platformCommission: number;
  caregiverPayout: number;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayMode: 'pending_integration' | 'test_mode' | 'cash_on_service';
  referenceCode?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TransactionRecord {
  transactionId: string;
  bookingId: string;
  customerId: string;
  caregiverId: string;
  grossAmount: number;
  platformCommission: number;
  caregiverPayout: number;
  type: 'booking_charge' | 'refund';
  status: 'pending' | 'test_verified' | 'settled' | 'refunded';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface TestimonialItem {
  name: string;
  role: string;
  locality: string;
  quote: string;
  rating: number;
}

export interface PlatformSettings {
  settingId: string;
  platformName?: string;
  whatsappNumber: string;
  supportEmail?: string;
  heroBannerNotice?: string;
  bookingPolicy?: string;
  cancellationPolicy?: string;
  defaultBookingPrice: number;
  defaultProviderCost: number;
  monthlyFixedCost: number;
  commissionModel: 'fixed_margin' | 'percentage';
  commissionPercentage?: number;
  localities: string[];
  faqs?: FaqItem[];
  testimonials?: TestimonialItem[];
  updatedAt?: unknown;
}

export interface SupportTicket {
  ticketId: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  bookingId?: string;
  status: 'open' | 'in_review' | 'resolved';
  adminResponse?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PromotionOffer {
  promoId: string;
  code: string;
  title: string;
  description?: string;
  discountPercent: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}
