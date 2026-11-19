import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MailOpen,
  MessageSquare,
  PawPrint,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookingReceiptModal } from '../components/BookingReceiptModal';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { useAuth } from '../contexts/AuthContext';
import { usePublicData } from '../contexts/DataContext';
import {
  MVP_TARGET_METRICS,
  VALIDATION_EXPERIMENT_PLAN,
  VENTURE_FINANCIAL_SCENARIOS,
  resolvePetImage,
  resolveServiceImage,
} from '../data/defaults';
import { formatAppError } from '../lib/authErrors';
import {
  adminDeletePromotion,
  adminDeleteReview,
  adminDeleteService,
  adminGrantAccess,
  adminResolveBookingDispute,
  adminResolveTicket,
  adminRevokeAccess,
  adminSavePlatformSettings,
  adminSavePromotion,
  adminSaveService,
  adminUpdateCaregiverVerification,
  adminUpdatePaymentStatus,
  adminUpdateUserStatus,
  deletePet,
  generateId,
  logAdminAction,
  replyConversationAsAdmin,
  subscribeAdminsListAdmin,
  subscribeAllBookingsAdmin,
  subscribeAllCaregiversAdmin,
  subscribeAllConversationsAdmin,
  subscribeAllPaymentsAdmin,
  subscribeAllPetsAdmin,
  subscribeAllPromotionsAdmin,
  subscribeAllServicesAdmin,
  subscribeAllTicketsAdmin,
  subscribeAllTransactionsAdmin,
  subscribeAllUsersAdmin,
  subscribeAuditLogsAdmin,
  subscribeConversationMessages,
  updateBookingStatus,
  updateConversationStatusAdmin,
  type AdminRecord,
} from '../services/firestoreService';
import type {
  AdminAuditLog,
  BookingRecord,
  BookingStatus,
  CaregiverPrivateProfile,
  PaymentRecord,
  PaymentStatus,
  PetProfile,
  PetType,
  PlatformSettings,
  PromotionOffer,
  ServiceItem,
  SupportConversation,
  SupportConversationMessage,
  SupportTicket,
  TransactionRecord,
  UserProfile,
} from '../types/pawcare';

type AdminTab =
  | 'overview'
  | 'users'
  | 'pets'
  | 'caregivers'
  | 'bookings'
  | 'financials'
  | 'content'
  | 'messages'
  | 'audit'
  | 'reports';

const BOOTSTRAP_OWNER_EMAIL = 'sonich8171@gmail.com';

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function bookingStatusTextColor(status: BookingStatus): string {
  switch (status) {
    case 'completed':
      return 'text-teal-800';
    case 'in_progress':
    case 'confirmed':
    case 'accepted':
      return 'text-violet-800';
    case 'cancelled':
    case 'rejected':
      return 'text-red-700';
    default:
      return 'text-amber-800';
  }
}

export function AdminDashboard() {
  const { firebaseUser, userProfile, logout } = useAuth();
  const { platformSettings, reviews } = usePublicData();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [adminsList, setAdminsList] = useState<AdminRecord[]>([]);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [caregivers, setCaregivers] = useState<CaregiverPrivateProfile[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [adminServices, setAdminServices] = useState<ServiceItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [promotions, setPromotions] = useState<PromotionOffer[]>([]);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<SupportConversationMessage[]>([]);
  const [convReplyText, setConvReplyText] = useState('');
  const [sendingConvReply, setSendingConvReply] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'customer' | 'caregiver' | 'admin'>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  const [petSearch, setPetSearch] = useState('');
  const [petTypeFilter, setPetTypeFilter] = useState<'all' | PetType>('all');
  const [confirmDeletePetId, setConfirmDeletePetId] = useState<string | null>(null);

  const [cgSearch, setCgSearch] = useState('');
  const [cgStatusFilter, setCgStatusFilter] = useState<
    'all' | 'pending' | 'verified' | 'rejected' | 'suspended'
  >('all');

  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [bookingDisputeFilter, setBookingDisputeFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [bookingDateRange, setBookingDateRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [globalSearch, setGlobalSearch] = useState('');

  const [ledgerView, setLedgerView] = useState<'payments' | 'transactions'>('payments');
  const [reviewMinStars, setReviewMinStars] = useState<'all' | '5' | '4' | '3'>('all');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'open' | 'in_review' | 'resolved'>('all');

  // Admin grant state
  const [grantUid, setGrantUid] = useState('');
  const [grantingAdmin, setGrantingAdmin] = useState(false);

  // Modals
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [viewingPet, setViewingPet] = useState<PetProfile | null>(null);
  const [inspectBooking, setInspectBooking] = useState<BookingRecord | null>(null);
  const [reviewingCg, setReviewingCg] = useState<CaregiverPrivateProfile | null>(null);
  const [cgAdminNotes, setCgAdminNotes] = useState('');

  // Editable Settings state
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(platformSettings);
  const [newLocality, setNewLocality] = useState('');
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');
  const [newTestiName, setNewTestiName] = useState('');
  const [newTestiRole, setNewTestiRole] = useState('');
  const [newTestiLocality, setNewTestiLocality] = useState('');
  const [newTestiQuote, setNewTestiQuote] = useState('');
  const [newTestiRating, setNewTestiRating] = useState('5');
  const [savingSettings, setSavingSettings] = useState(false);

  // Service editor state
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [svcTitle, setSvcTitle] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcDuration, setSvcDuration] = useState('');
  const [svcPrice, setSvcPrice] = useState('500');
  const [svcPayout, setSvcPayout] = useState('300');
  const [svcActive, setSvcActive] = useState(true);
  const [svcImageUrl, setSvcImageUrl] = useState('');

  // Promotion form state
  const [promoCode, setPromoCode] = useState('');
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoDiscount, setPromoDiscount] = useState('10');

  // Ticket response state
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({});

  useEffect(() => {
    setSettingsDraft(platformSettings);
  }, [platformSettings]);

  useEffect(() => {
    setListenerError(null);
    const onSubErr = (err: Error) => {
      setListenerError(`Live admin data sync issue: ${err.message}`);
    };
    const unsubs = [
      subscribeAllUsersAdmin(setUsers, onSubErr),
      subscribeAdminsListAdmin(setAdminsList, onSubErr),
      subscribeAllPetsAdmin(setPets, onSubErr),
      subscribeAllCaregiversAdmin(setCaregivers, onSubErr),
      subscribeAllBookingsAdmin(setBookings, onSubErr),
      subscribeAllPaymentsAdmin(setPayments, onSubErr),
      subscribeAllTransactionsAdmin(setTransactions, onSubErr),
      subscribeAllServicesAdmin(setAdminServices, onSubErr),
      subscribeAllTicketsAdmin(setTickets, onSubErr),
      subscribeAllPromotionsAdmin(setPromotions, onSubErr),
      subscribeAllConversationsAdmin(setConversations, onSubErr),
      subscribeAuditLogsAdmin(setAuditLogs, onSubErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!selectedConvId) {
      setConvMessages([]);
      return;
    }
    return subscribeConversationMessages(selectedConvId, setConvMessages);
  }, [selectedConvId]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  // Aggregated Real Metrics
  const metrics = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, '0')}`;
    const currentYearPrefix = `${currentDate.getFullYear()}-`;

    const totalCustomers = users.filter((u) => u.role === 'customer').length;
    const verifiedCaregivers = caregivers.filter((c) => c.verificationStatus === 'verified');
    const pendingApps = caregivers.filter((c) => c.verificationStatus === 'pending');
    const pendingBookings = bookings.filter((b) => b.status === 'pending');
    const confirmedBookings = bookings.filter((b) =>
      ['accepted', 'confirmed', 'in_progress'].includes(b.status)
    );
    const activeBookingsList = bookings.filter((b) =>
      ['pending', 'accepted', 'confirmed', 'in_progress'].includes(b.status)
    );
    const completedBookings = bookings.filter((b) => b.status === 'completed');
    const cancelledBookings = bookings.filter((b) =>
      ['cancelled', 'rejected'].includes(b.status)
    );
    const openDisputes = bookings.filter((b) => b.disputeStatus === 'open').length;
    const openTickets = tickets.filter((t) => t.status !== 'resolved').length;
    const activeValidBookings = bookings.filter(
      (b) => !['cancelled', 'rejected'].includes(b.status)
    );

    const grossBookingValue = activeValidBookings.reduce((s, b) => s + b.grossAmount, 0);
    const platformCommissionRevenue = activeValidBookings.reduce(
      (s, b) => s + b.platformCommission,
      0
    );
    const caregiverPayoutTotal = activeValidBookings.reduce((s, b) => s + b.caregiverPayout, 0);

    const getBookingTime = (b: BookingRecord) => {
      const created = toMillis(b.createdAt);
      if (created > 0) return created;
      const parsed = new Date(b.bookingDate).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const weeklyRevenue = activeValidBookings
      .filter((b) => {
        const ms = getBookingTime(b);
        return ms > 0 && now - ms <= sevenDaysMs;
      })
      .reduce((s, b) => s + b.platformCommission, 0);

    const monthlyRevenue = activeValidBookings
      .filter((b) => {
        if (b.bookingDate?.startsWith(currentMonthKey)) return true;
        const ms = getBookingTime(b);
        if (!ms) return false;
        const d = new Date(ms);
        return (
          d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth()
        );
      })
      .reduce((s, b) => s + b.platformCommission, 0);

    const yearlyRevenue = activeValidBookings
      .filter((b) => {
        if (b.bookingDate?.startsWith(currentYearPrefix)) return true;
        const ms = getBookingTime(b);
        return ms > 0 && new Date(ms).getFullYear() === currentDate.getFullYear();
      })
      .reduce((s, b) => s + b.platformCommission, 0);

    const customerGrowth30d = users.filter((u) => {
      const ms = toMillis(u.createdAt);
      return ms > 0 && now - ms <= thirtyDaysMs;
    }).length;

    const paidOrVerifiedCount = bookings.filter((b) =>
      ['paid', 'test_verified'].includes(b.paymentStatus)
    ).length;

    const positiveReviews = reviews.filter((r) => r.rating >= 4).length;
    const positivePct =
      reviews.length > 0 ? Math.round((positiveReviews / reviews.length) * 100) : 0;
    const repeatInterestCount = reviews.filter((r) => r.wouldRepeat).length;
    const repeatPct =
      reviews.length > 0 ? Math.round((repeatInterestCount / reviews.length) * 100) : 0;

    return {
      totalUsers: users.length,
      totalCustomers,
      customerGrowth30d,
      totalPets: pets.length,
      totalCaregivers: caregivers.length,
      verifiedCaregivers: verifiedCaregivers.length,
      pendingApps: pendingApps.length,
      totalBookings: bookings.length,
      pendingBookings: pendingBookings.length,
      confirmedBookings: confirmedBookings.length,
      activeBookings: activeBookingsList.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookings.length,
      openDisputes,
      openTickets,
      grossBookingValue,
      platformCommissionRevenue,
      caregiverPayoutTotal,
      weeklyRevenue,
      monthlyRevenue,
      yearlyRevenue,
      netPlatformRevenue: platformCommissionRevenue - settingsDraft.monthlyFixedCost,
      paidOrVerifiedCount,
      positivePct,
      repeatPct,
    };
  }, [users, pets, caregivers, bookings, reviews, tickets, settingsDraft.monthlyFixedCost]);

  // Live Chart Datasets
  const scenarioComparisonData = useMemo(() => {
    const rows = VENTURE_FINANCIAL_SCENARIOS.map((s) => {
      const bookingsCount = s.customers * s.purchasesPerCustomer;
      const gross = bookingsCount * s.sellingPrice;
      const payout = bookingsCount * s.variableCost;
      const contribution = gross - payout;
      const surplus = contribution - s.fixedCost;
      return {
        name: s.label.replace(' Scenario', ''),
        GrossValue: gross,
        PlatformContribution: contribution,
        CaregiverPayout: payout,
        Surplus: surplus,
        Bookings: bookingsCount,
      };
    });
    rows.push({
      name: 'Actual Live',
      GrossValue: metrics.grossBookingValue,
      PlatformContribution: metrics.platformCommissionRevenue,
      CaregiverPayout: metrics.caregiverPayoutTotal,
      Surplus: metrics.netPlatformRevenue,
      Bookings: metrics.totalBookings,
    });
    return rows;
  }, [metrics]);

  const revenueTrendData = useMemo(() => {
    const map = new Map<
      string,
      { month: string; Gross: number; Commission: number; Payouts: number; Bookings: number }
    >();
    bookings
      .filter((b) => !['cancelled', 'rejected'].includes(b.status))
      .forEach((b) => {
        const key = (b.bookingDate || '').slice(0, 7) || 'Unknown';
        const prev = map.get(key) || {
          month: key,
          Gross: 0,
          Commission: 0,
          Payouts: 0,
          Bookings: 0,
        };
        prev.Gross += b.grossAmount;
        prev.Commission += b.platformCommission;
        prev.Payouts += b.caregiverPayout;
        prev.Bookings += 1;
        map.set(key, prev);
      });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [bookings]);

  const customerGrowthData = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((u) => {
      const ms = toMillis(u.createdAt);
      const key = ms
        ? new Date(ms).toISOString().slice(0, 7)
        : new Date().toISOString().slice(0, 7);
      map.set(key, (map.get(key) || 0) + 1);
    });
    let cumulative = 0;
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, newUsers]) => {
        cumulative += newUsers;
        return { month, NewUsers: newUsers, TotalUsers: cumulative };
      });
  }, [users]);

  const servicePopularityData = useMemo(() => {
    const map = new Map<string, { service: string; Bookings: number; Revenue: number }>();
    bookings
      .filter((b) => !['cancelled', 'rejected'].includes(b.status))
      .forEach((b) => {
        const prev = map.get(b.serviceTitle) || {
          service: b.serviceTitle,
          Bookings: 0,
          Revenue: 0,
        };
        prev.Bookings += 1;
        prev.Revenue += b.grossAmount;
        map.set(b.serviceTitle, prev);
      });
    return Array.from(map.values()).sort((a, b) => b.Bookings - a.Bookings);
  }, [bookings]);

  const caregiverPerformanceData = useMemo(() => {
    return caregivers
      .map((cg) => {
        const cgBookings = bookings.filter(
          (b) => b.caregiverId === cg.caregiverId && b.status === 'completed'
        );
        const payout = cgBookings.reduce((sum, b) => sum + b.caregiverPayout, 0);
        return {
          name: cg.fullName.split(' ')[0] || cg.fullName,
          CompletedSessions: cgBookings.length,
          PayoutINR: payout,
        };
      })
      .sort((a, b) => b.CompletedSessions - a.CompletedSessions)
      .slice(0, 8);
  }, [caregivers, bookings]);

  // Filtered Lists
  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.locality || '').toLowerCase().includes(q);
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'all' || u.accountStatus === userStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredPets = pets.filter((p) => {
    const owner = users.find((u) => u.uid === p.ownerId);
    const q = petSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.breed.toLowerCase().includes(q) ||
      (owner?.displayName || '').toLowerCase().includes(q) ||
      (owner?.email || '').toLowerCase().includes(q);
    const matchesType = petTypeFilter === 'all' || p.petType === petTypeFilter;
    return matchesSearch && matchesType;
  });

  const filteredCaregivers = caregivers.filter((cg) => {
    const q = cgSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      cg.fullName.toLowerCase().includes(q) ||
      cg.email.toLowerCase().includes(q) ||
      cg.locality.toLowerCase().includes(q) ||
      cg.servicesOffered.some((s) => s.toLowerCase().includes(q));
    const matchesStatus =
      cgStatusFilter === 'all'
        ? true
        : cgStatusFilter === 'suspended'
        ? cg.accountStatus === 'suspended'
        : cg.verificationStatus === cgStatusFilter && cg.accountStatus === 'active';
    return matchesSearch && matchesStatus;
  });

  const todayIso = new Date().toISOString().split('T')[0];

  const filteredBookings = bookings.filter((b) => {
    const q = bookingSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.bookingId.toLowerCase().includes(q) ||
      b.customerId.toLowerCase().includes(q) ||
      b.customerName.toLowerCase().includes(q) ||
      (b.customerEmail || '').toLowerCase().includes(q) ||
      b.caregiverName.toLowerCase().includes(q) ||
      b.petName.toLowerCase().includes(q) ||
      (b.serviceName || b.serviceTitle).toLowerCase().includes(q) ||
      b.locality.toLowerCase().includes(q);
    const matchesStatus = bookingStatusFilter === 'all' || b.status === bookingStatusFilter;
    const matchesDispute =
      bookingDisputeFilter === 'all' || b.disputeStatus === bookingDisputeFilter;
    let matchesDate = true;
    if (bookingDateRange === 'today') {
      matchesDate = b.bookingDate === todayIso;
    } else if (bookingDateRange === '7d' || bookingDateRange === '30d') {
      const days = bookingDateRange === '7d' ? 7 : 30;
      const ms = toMillis(b.createdAt) || new Date(b.bookingDate).getTime();
      matchesDate = Boolean(ms && Date.now() - ms <= days * 24 * 60 * 60 * 1000);
    }
    return matchesSearch && matchesStatus && matchesDispute && matchesDate;
  });

  const liveInProgressCount = bookings.filter((b) => b.status === 'in_progress').length;

  const globalMatches = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return { bookings: [], users: [], caregivers: [], pets: [] };
    return {
      bookings: bookings
        .filter(
          (b) =>
            b.bookingId.toLowerCase().includes(q) ||
            b.customerName.toLowerCase().includes(q) ||
            b.caregiverName.toLowerCase().includes(q) ||
            b.petName.toLowerCase().includes(q)
        )
        .slice(0, 3),
      users: users
        .filter(
          (u) =>
            u.displayName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.phone || '').toLowerCase().includes(q)
        )
        .slice(0, 3),
      caregivers: caregivers
        .filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.locality.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q)
        )
        .slice(0, 3),
      pets: pets
        .filter((p) => p.name.toLowerCase().includes(q) || p.breed.toLowerCase().includes(q))
        .slice(0, 3),
    };
  }, [globalSearch, bookings, users, caregivers, pets]);

  const filteredReviews = reviews.filter((r) => {
    if (reviewMinStars === 'all') return true;
    return r.rating >= Number(reviewMinStars);
  });

  const filteredTickets = tickets.filter((t) => {
    if (ticketStatusFilter === 'all') return true;
    return t.status === ticketStatusFilter;
  });

  const adminUidSet = useMemo(() => new Set(adminsList.map((a) => a.uid)), [adminsList]);
  const nonAdminUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.email.toLowerCase() !== BOOTSTRAP_OWNER_EMAIL &&
          !adminUidSet.has(u.uid) &&
          u.role !== 'admin'
      ),
    [users, adminUidSet]
  );

  // CSV Exports (6 Datasets)
  const todayStamp = () => new Date().toISOString().split('T')[0];

  const exportCustomersCsv = () => {
    downloadCsv(
      `pawcare_customers_${todayStamp()}.csv`,
      ['UID', 'Name', 'Email', 'Phone', 'Locality', 'Role', 'AccountStatus', 'PetsCount'],
      users.map((u) => [
        u.uid,
        u.displayName,
        u.email,
        u.phone || '',
        u.locality || '',
        u.role,
        u.accountStatus,
        pets.filter((p) => p.ownerId === u.uid).length,
      ])
    );
  };

  const exportCaregiversCsv = () => {
    downloadCsv(
      `pawcare_caregivers_${todayStamp()}.csv`,
      [
        'CaregiverID',
        'FullName',
        'Email',
        'Phone',
        'Locality',
        'ExperienceYears',
        'ServicesOffered',
        'VerificationStatus',
        'AccountStatus',
        'CompletedJobs',
        'TotalPayoutINR',
      ],
      caregivers.map((cg) => {
        const jobs = bookings.filter(
          (b) => b.caregiverId === cg.caregiverId && b.status === 'completed'
        );
        return [
          cg.caregiverId,
          cg.fullName,
          cg.email,
          cg.phone,
          cg.locality,
          cg.experienceYears,
          cg.servicesOffered.join(' | '),
          cg.verificationStatus,
          cg.accountStatus,
          jobs.length,
          jobs.reduce((s, b) => s + b.caregiverPayout, 0),
        ];
      })
    );
  };

  const exportBookingsCsv = () => {
    downloadCsv(
      `pawcare_bookings_${todayStamp()}.csv`,
      [
        'BookingID',
        'Date',
        'TimeSlot',
        'Customer',
        'CustomerPhone',
        'Caregiver',
        'Pet',
        'Service',
        'Locality',
        'Address',
        'Status',
        'PaymentMethod',
        'PaymentStatus',
        'DisputeStatus',
        'GrossAmountINR',
        'CaregiverPayoutINR',
        'PlatformCommissionINR',
      ],
      bookings.map((b) => [
        b.bookingId,
        b.bookingDate,
        b.timeSlot,
        b.customerName,
        b.customerPhone || '',
        b.caregiverName,
        b.petName,
        b.serviceTitle,
        b.locality,
        b.serviceAddress,
        b.status,
        b.paymentMethod,
        b.paymentStatus,
        b.disputeStatus,
        b.grossAmount,
        b.caregiverPayout,
        b.platformCommission,
      ])
    );
  };

  const exportRevenueSummaryCsv = () => {
    downloadCsv(
      `pawcare_revenue_summary_${todayStamp()}.csv`,
      ['Metric', 'ValueINR'],
      [
        ['Gross Booking Value (Valid Bookings)', metrics.grossBookingValue],
        ['Platform Commission Revenue (All-Time)', metrics.platformCommissionRevenue],
        ['Caregiver Payout Total (All-Time)', metrics.caregiverPayoutTotal],
        ['Weekly Commission Revenue (Last 7 Days)', metrics.weeklyRevenue],
        ['Monthly Commission Revenue (Current Month)', metrics.monthlyRevenue],
        ['Yearly Commission Revenue (Current Year)', metrics.yearlyRevenue],
        ['Monthly Fixed Cost Assumption', settingsDraft.monthlyFixedCost],
        ['Net Platform Revenue (Commission - Fixed Cost)', metrics.netPlatformRevenue],
      ]
    );
  };

  const exportTransactionsCsv = () => {
    downloadCsv(
      `pawcare_transactions_${todayStamp()}.csv`,
      [
        'TransactionID',
        'BookingID',
        'CustomerID',
        'CaregiverID',
        'Type',
        'Status',
        'GrossAmountINR',
        'PlatformCommissionINR',
        'CaregiverPayoutINR',
      ],
      transactions.map((t) => [
        t.transactionId,
        t.bookingId,
        t.customerId,
        t.caregiverId,
        t.type,
        t.status,
        t.grossAmount,
        t.platformCommission,
        t.caregiverPayout,
      ])
    );
  };

  const exportReviewsCsv = () => {
    downloadCsv(
      `pawcare_reviews_${todayStamp()}.csv`,
      ['ReviewID', 'BookingID', 'CustomerName', 'CaregiverID', 'Rating', 'WouldRepeat', 'Comment'],
      reviews.map((r) => [
        r.reviewId,
        r.bookingId,
        r.customerName,
        r.caregiverId,
        r.rating,
        r.wouldRepeat ? 'Yes' : 'No',
        r.comment,
      ])
    );
  };

  const handleServicePriceChange = (rawPrice: string) => {
    setSvcPrice(rawPrice);
    if (settingsDraft.commissionModel === 'percentage') {
      const gross = Number(rawPrice) || 0;
      const pct = Number(settingsDraft.commissionPercentage ?? 40);
      const payout = Math.max(0, Math.round(gross * (1 - pct / 100)));
      setSvcPayout(String(payout));
    }
  };

  const handleSaveServiceForm = async (e: FormEvent) => {
    e.preventDefault();
    if (svcTitle.trim().length < 2) {
      showToast('error', 'Service title must be at least 2 characters.');
      return;
    }
    if (svcDuration.trim().length < 2) {
      showToast('error', 'Duration label must be at least 2 characters.');
      return;
    }
    if (svcDesc.trim().length < 10) {
      showToast('error', 'Service description must be at least 10 characters.');
      return;
    }
    const gross = Math.max(50, Number(svcPrice) || 500);
    const payout = Math.min(gross, Math.max(0, Number(svcPayout) || 300));
    const commission = gross - payout;
    const isNew = !editingService;
    const serviceId =
      editingService?.serviceId ||
      svcTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') ||
      generateId('svc');

    try {
      await adminSaveService(
        {
          serviceId,
          slug: serviceId,
          title: svcTitle.trim(),
          description: svcDesc.trim(),
          durationLabel: svcDuration.trim(),
          basePrice: gross,
          providerPayout: payout,
          platformCommission: commission,
          isActive: svcActive,
          imageUrl: svcImageUrl.trim(),
        },
        isNew
      );
      setEditingService(null);
      setSvcTitle('');
      setSvcDesc('');
      setSvcDuration('');
      setSvcImageUrl('');
      await logAdminAction({
        action: isNew ? 'service_create' : 'service_update',
        targetType: 'service',
        targetId: serviceId,
        details: `${svcTitle.trim()} (₹${gross}, payout ₹${payout})`,
      });
      showToast('success', 'Service catalog updated in Firestore.');
    } catch (err) {
      showToast('error', formatAppError(err, 'Failed to save service.'));
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await adminSavePlatformSettings(settingsDraft);
      await logAdminAction({
        action: 'settings_save',
        targetType: 'platformSettings',
        targetId: 'global',
        details: 'Updated global PawCare platform pricing, localities, FAQs & testimonials',
      });
      showToast('success', 'Platform settings, policies & content published.');
    } catch (err) {
      showToast('error', formatAppError(err, 'Failed to save settings.'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleGrantAdmin = async (uid: string, email: string) => {
    if (!uid || !email) return;
    setGrantingAdmin(true);
    try {
      await adminGrantAccess(uid, email);
      await logAdminAction({
        action: 'admin_grant',
        targetType: 'admin',
        targetId: uid,
        details: `Granted admin access to ${email}`,
      });
      setGrantUid('');
      showToast('success', `Granted Owner/Admin access to ${email}.`);
    } catch (err) {
      showToast('error', formatAppError(err, 'Could not grant admin access.'));
    } finally {
      setGrantingAdmin(false);
    }
  };

  const handleRevokeAdmin = async (uid: string, email: string) => {
    if (email.toLowerCase() === BOOTSTRAP_OWNER_EMAIL || uid === firebaseUser?.uid) {
      showToast('error', 'Primary bootstrap owner and active session cannot be revoked.');
      return;
    }
    try {
      await adminRevokeAccess(uid);
      await logAdminAction({
        action: 'admin_revoke',
        targetType: 'admin',
        targetId: uid,
        details: `Revoked admin access from ${email}`,
      });
      showToast('success', `Revoked Admin access from ${email}.`);
    } catch (err) {
      showToast('error', formatAppError(err, 'Could not revoke admin access.'));
    }
  };

  const navItems: {
    id: AdminTab;
    label: string;
    shortLabel: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    { id: 'overview', label: 'Overview & Venture', shortLabel: 'Overview', icon: LayoutDashboard },
    {
      id: 'users',
      label: 'Users & Admin Team',
      shortLabel: 'Users',
      icon: Users,
      badge: users.length,
    },
    {
      id: 'pets',
      label: 'Registered Pets',
      shortLabel: 'Pets',
      icon: PawPrint,
      badge: pets.length,
    },
    {
      id: 'caregivers',
      label: 'Caregiver Verification',
      shortLabel: 'Caregivers',
      icon: ShieldCheck,
      badge: metrics.pendingApps,
    },
    {
      id: 'bookings',
      label: 'Bookings & Disputes',
      shortLabel: 'Bookings',
      icon: Calendar,
      badge: metrics.openDisputes > 0 ? metrics.openDisputes : bookings.length,
    },
    {
      id: 'financials',
      label: 'Financials & Ledger',
      shortLabel: 'Financials',
      icon: IndianRupee,
    },
    {
      id: 'content',
      label: 'Catalog & Promos',
      shortLabel: 'Catalog',
      icon: BookOpen,
    },
    {
      id: 'messages',
      label: 'Live Support Inbox',
      shortLabel: 'Inbox',
      icon: MailOpen,
      badge: conversations.filter((c) => c.unreadByAdmin).length,
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      shortLabel: 'Audit',
      icon: ClipboardList,
      badge: auditLogs.length,
    },
    {
      id: 'reports',
      label: 'Reviews, Tickets & CSV',
      shortLabel: 'Reports',
      icon: BarChart3,
      badge: metrics.openTickets,
    },
  ];

  const activeNav = navItems.find((item) => item.id === activeTab) || navItems[0];
  const pendingCaregiversList = caregivers.filter((c) => c.verificationStatus === 'pending');

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* Persistent Desktop Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 lg:sticky lg:top-20">
            <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-5">
              {/* Admin Gmail Identity */}
              <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
                <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-1 ring-violet-200">
                  <ImageWithFallback
                    src={userProfile?.photoUrl || firebaseUser?.photoURL || undefined}
                    alt={userProfile?.displayName || firebaseUser?.displayName || 'PawCare Owner'}
                    fallbackLabel={userProfile?.displayName || firebaseUser?.email || 'Owner'}
                    variant="avatar"
                    seed={firebaseUser?.uid || 'owner'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-violet-700">
                    Owner Console · Gmail Auth
                  </p>
                  <p className="font-display font-bold text-sm text-stone-900 truncate">
                    {userProfile?.displayName || firebaseUser?.displayName || 'PawCare Owner'}
                  </p>
                  <p className="text-[11px] text-stone-500 truncate">
                    {firebaseUser?.email || BOOTSTRAP_OWNER_EMAIL}
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <nav className="space-y-1" aria-label="Admin sections">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`relative w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                        active ? 'text-white' : 'text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="admin-sidebar-active"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                          className="absolute inset-0 bg-emerald-900 rounded-xl -z-0"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span
                          className={`relative z-10 font-mono-tabular text-xs font-semibold shrink-0 ${
                            active ? 'text-violet-100' : 'text-teal-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Quick Export & Sign Out */}
              <div className="pt-4 border-t border-stone-100 space-y-2">
                <button
                  type="button"
                  onClick={exportBookingsCsv}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-stone-800 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-teal-700" /> Export Bookings CSV
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* Main Workspace */}
          <main className="lg:col-span-9 space-y-6 min-w-0">
            {/* Mobile Tab Strip */}
            <div className="lg:hidden -mx-4 px-4 overflow-x-auto pb-1">
              <div className="inline-flex gap-1.5 p-1.5 bg-white border border-stone-200 rounded-2xl min-w-full">
                {navItems.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-violet-700 text-white'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{tab.shortLabel}</span>
                      {typeof tab.badge === 'number' && tab.badge > 0 && (
                        <span
                          className={`font-mono-tabular text-[11px] ${
                            active ? 'text-violet-100' : 'text-teal-700'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Listener Error Alert */}
            {listenerError && (
              <div
                role="alert"
                className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-900 text-sm font-medium flex items-center justify-between gap-3"
              >
                <span>{listenerError}</span>
                <button
                  type="button"
                  onClick={() => setListenerError(null)}
                  className="p-1 rounded-lg hover:bg-red-100 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Toast Notification */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  role="status"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center justify-between gap-3 ${
                    toast.type === 'success'
                      ? 'bg-teal-50 border-teal-200 text-teal-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <span>{toast.text}</span>
                  <button
                    type="button"
                    onClick={() => setToast(null)}
                    className="p-1 rounded-lg hover:bg-black/5 cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Workspace Header Bar + Global Ops Command Search */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-violet-700">
                    {platformSettings.platformName || 'PawCare'} Owner Operations ·{' '}
                    {activeNav.label}
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-900 mt-0.5">
                    {activeNav.label}
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCgStatusFilter('pending');
                      setActiveTab('caregivers');
                    }}
                    className="px-3 py-2 text-xs font-semibold bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-stone-800 cursor-pointer whitespace-nowrap font-mono-tabular"
                  >
                    Pending CG: {metrics.pendingApps}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingDisputeFilter('open');
                      setActiveTab('bookings');
                    }}
                    className="px-3 py-2 text-xs font-semibold bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-stone-800 cursor-pointer whitespace-nowrap font-mono-tabular"
                  >
                    Open Disputes: {metrics.openDisputes}
                  </button>
                  <button
                    type="button"
                    onClick={exportBookingsCsv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV Report
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Global command search: booking ID, customer, caregiver, locality, or pet..."
                  className="w-full pl-10 pr-8 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-violet-600"
                />
                {globalSearch && (
                  <button
                    type="button"
                    onClick={() => setGlobalSearch('')}
                    aria-label="Clear global search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {globalSearch.trim().length > 0 && (
                <div className="pt-2 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                  {globalMatches.bookings.map((b) => (
                    <button
                      key={b.bookingId}
                      type="button"
                      onClick={() => {
                        setInspectBooking(b);
                        setGlobalSearch('');
                      }}
                      className="p-2.5 text-left border border-stone-200 rounded-xl bg-stone-50 hover:border-teal-300 cursor-pointer"
                    >
                      <p className="font-semibold text-stone-900 truncate">
                        Booking · {b.petName}
                      </p>
                      <p className="text-[11px] text-stone-500 truncate">
                        {b.customerName} → {b.caregiverName}
                      </p>
                    </button>
                  ))}
                  {globalMatches.users.map((u) => (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => {
                        setViewingUser(u);
                        setGlobalSearch('');
                      }}
                      className="p-2.5 text-left border border-stone-200 rounded-xl bg-stone-50 hover:border-violet-300 cursor-pointer"
                    >
                      <p className="font-semibold text-stone-900 truncate">
                        User · {u.displayName}
                      </p>
                      <p className="text-[11px] text-stone-500 truncate">{u.email}</p>
                    </button>
                  ))}
                  {globalMatches.caregivers.map((cg) => (
                    <button
                      key={cg.caregiverId}
                      type="button"
                      onClick={() => {
                        setCgSearch(cg.fullName);
                        setCgStatusFilter('all');
                        setActiveTab('caregivers');
                        setGlobalSearch('');
                      }}
                      className="p-2.5 text-left border border-stone-200 rounded-xl bg-stone-50 hover:border-violet-300 cursor-pointer"
                    >
                      <p className="font-semibold text-stone-900 truncate">
                        Caregiver · {cg.fullName}
                      </p>
                      <p className="text-[11px] text-stone-500 truncate">
                        {cg.locality} · {cg.verificationStatus}
                      </p>
                    </button>
                  ))}
                  {globalMatches.pets.map((p) => (
                    <button
                      key={p.petId}
                      type="button"
                      onClick={() => {
                        setViewingPet(p);
                        setGlobalSearch('');
                      }}
                      className="p-2.5 text-left border border-stone-200 rounded-xl bg-stone-50 hover:border-teal-300 cursor-pointer"
                    >
                      <p className="font-semibold text-stone-900 truncate">Pet · {p.name}</p>
                      <p className="text-[11px] text-stone-500 truncate">
                        {p.petType} · {p.breed}
                      </p>
                    </button>
                  ))}
                  {globalMatches.bookings.length === 0 &&
                    globalMatches.users.length === 0 &&
                    globalMatches.caregivers.length === 0 &&
                    globalMatches.pets.length === 0 && (
                      <p className="col-span-full text-stone-500 py-1">
                        No matching bookings, users, caregivers, or pets found.
                      </p>
                    )}
                </div>
              )}
            </div>

            {/* Animated Tab Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* 1. OVERVIEW & VENTURE COMMAND */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Live Operations Dispatch Strip */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setBookingStatusFilter('in_progress');
                          setActiveTab('bookings');
                        }}
                        className="text-left bg-white border border-stone-200 hover:border-teal-300 rounded-2xl p-4 space-y-1 cursor-pointer transition-colors"
                      >
                        <p className="text-[11px] font-semibold text-teal-700">
                          In Care Right Now
                        </p>
                        <p className="font-display text-2xl font-extrabold text-stone-900 font-mono-tabular">
                          {liveInProgressCount}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBookingStatusFilter('pending');
                          setActiveTab('bookings');
                        }}
                        className="text-left bg-white border border-stone-200 hover:border-amber-300 rounded-2xl p-4 space-y-1 cursor-pointer transition-colors"
                      >
                        <p className="text-[11px] font-semibold text-amber-700">
                          Awaiting Caregiver
                        </p>
                        <p className="font-display text-2xl font-extrabold text-stone-900 font-mono-tabular">
                          {metrics.pendingBookings}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCgStatusFilter('pending');
                          setActiveTab('caregivers');
                        }}
                        className="text-left bg-white border border-stone-200 hover:border-violet-300 rounded-2xl p-4 space-y-1 cursor-pointer transition-colors"
                      >
                        <p className="text-[11px] font-semibold text-violet-700">
                          Verify Queue
                        </p>
                        <p className="font-display text-2xl font-extrabold text-stone-900 font-mono-tabular">
                          {metrics.pendingApps}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTicketStatusFilter('open');
                          setActiveTab('reports');
                        }}
                        className="text-left bg-white border border-stone-200 hover:border-red-300 rounded-2xl p-4 space-y-1 cursor-pointer transition-colors"
                      >
                        <p className="text-[11px] font-semibold text-red-700">
                          Open Escalations
                        </p>
                        <p className="font-display text-2xl font-extrabold text-stone-900 font-mono-tabular">
                          {metrics.openDisputes + metrics.openTickets}
                        </p>
                      </button>
                    </div>

                    {(metrics.pendingApps > 0 ||
                      metrics.openDisputes > 0 ||
                      metrics.openTickets > 0) && (
                      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                          <div className="text-xs text-amber-950 space-y-0.5">
                            <p className="font-bold text-sm">Action Queue Requiring Owner Review</p>
                            <p>
                              {metrics.pendingApps} pending caregiver verification(s) ·{' '}
                              {metrics.openDisputes} open booking dispute(s) ·{' '}
                              {metrics.openTickets} unresolved support ticket(s).
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {metrics.pendingApps > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCgStatusFilter('pending');
                                setActiveTab('caregivers');
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              Verify Caregivers
                            </button>
                          )}
                          {metrics.openDisputes > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setBookingDisputeFilter('open');
                                setActiveTab('bookings');
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              Inspect Disputes
                            </button>
                          )}
                          {metrics.openTickets > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setTicketStatusFilter('open');
                                setActiveTab('reports');
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-stone-800 bg-white border border-stone-200 rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              Open Tickets
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 12 Core Operational & Financial KPIs (All 9 Required Metrics + Revenue) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {[
                        {
                          label: 'Total Customers',
                          value: metrics.totalCustomers,
                          sub: `${metrics.totalUsers} total accounts (+${metrics.customerGrowth30d} in 30d)`,
                        },
                        {
                          label: 'Total Caregivers',
                          value: metrics.totalCaregivers,
                          sub: `${metrics.totalPets} registered pets`,
                        },
                        {
                          label: 'Pending Caregiver Apps',
                          value: metrics.pendingApps,
                          sub: 'Awaiting document verification',
                        },
                        {
                          label: 'Approved Caregivers',
                          value: metrics.verifiedCaregivers,
                          sub: 'Live in public directory',
                        },
                        {
                          label: 'Total Bookings',
                          value: metrics.totalBookings,
                          sub: 'All marketplace requests',
                        },
                        {
                          label: 'Pending Bookings',
                          value: metrics.pendingBookings,
                          sub: 'Awaiting caregiver response',
                        },
                        {
                          label: 'Confirmed Bookings',
                          value: metrics.confirmedBookings,
                          sub: 'Accepted / confirmed / in progress',
                        },
                        {
                          label: 'Completed Bookings',
                          value: metrics.completedBookings,
                          sub: 'Successfully fulfilled sessions',
                        },
                        {
                          label: 'Cancelled Bookings',
                          value: metrics.cancelledBookings,
                          sub: 'Cancelled or rejected requests',
                        },
                        {
                          label: 'Monthly Commission',
                          value: `₹${metrics.monthlyRevenue}`,
                          sub: `₹${metrics.weeklyRevenue} last 7 days`,
                        },
                        {
                          label: 'Gross Booking Value',
                          value: `₹${metrics.grossBookingValue}`,
                          sub: `₹${metrics.caregiverPayoutTotal} payouts`,
                        },
                        {
                          label: 'Customer Satisfaction',
                          value: reviews.length > 0 ? `${metrics.positivePct}%` : '—',
                          sub: `Net surplus ₹${metrics.netPlatformRevenue}`,
                        },
                      ].map((kpi) => (
                        <div
                          key={kpi.label}
                          className="bg-white border border-stone-200 rounded-2xl p-4 space-y-1 hover:border-stone-300 transition-colors"
                        >
                          <p className="text-xs text-stone-500">{kpi.label}</p>
                          <p className="font-display text-2xl font-extrabold text-stone-900 font-mono-tabular">
                            {kpi.value}
                          </p>
                          <p className="text-[11px] text-stone-400">{kpi.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* MVP Targets vs Actual Live Performance */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                      <div>
                        <h2 className="font-display text-xl font-bold text-stone-900">
                          MVP Validation Targets vs. Actual Live Data
                        </h2>
                        <p className="text-xs text-stone-500">
                          Venture Quest Phase-1 benchmarks tracked against real Firestore activity.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          {
                            label: 'Registered Accounts',
                            target: `${MVP_TARGET_METRICS.interestedUsersTarget} users`,
                            actual: `${metrics.totalUsers} users`,
                            pct: Math.min(
                              100,
                              Math.round(
                                (metrics.totalUsers / MVP_TARGET_METRICS.interestedUsersTarget) * 100
                              )
                            ),
                          },
                          {
                            label: 'Paid / Verified Bookings',
                            target: `${MVP_TARGET_METRICS.paidBookingsTarget} bookings`,
                            actual: `${metrics.paidOrVerifiedCount} paid (${metrics.totalBookings} total)`,
                            pct: Math.min(
                              100,
                              Math.round(
                                (metrics.paidOrVerifiedCount /
                                  MVP_TARGET_METRICS.paidBookingsTarget) *
                                  100
                              )
                            ),
                          },
                          {
                            label: 'Positive Feedback (4+ ★)',
                            target: `${MVP_TARGET_METRICS.positiveFeedbackTargetPct}% target`,
                            actual:
                              reviews.length > 0
                                ? `${metrics.positivePct}% (${reviews.length} reviews)`
                                : '0 reviews yet',
                            pct: metrics.positivePct,
                          },
                          {
                            label: 'Repeat / Referral Intent',
                            target: `${MVP_TARGET_METRICS.repeatInterestTargetPct}% target`,
                            actual:
                              reviews.length > 0
                                ? `${metrics.repeatPct}% would repeat`
                                : '0 responses yet',
                            pct: metrics.repeatPct,
                          },
                        ].map((card) => (
                          <div
                            key={card.label}
                            className="border border-stone-200 rounded-xl p-4 space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-stone-800">{card.label}</p>
                              <span className="font-mono-tabular text-xs font-bold text-teal-700">
                                {card.pct}%
                              </span>
                            </div>
                            <div className="text-xs space-y-0.5">
                              <p className="text-stone-500">Target: {card.target}</p>
                              <p className="font-mono-tabular font-bold text-teal-800">
                                Actual: {card.actual}
                              </p>
                            </div>
                            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${card.pct}%` }}
                                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                className="h-full bg-teal-600 rounded-full"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Revenue Scenarios Chart + 30-Day Experiment */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                        <div>
                          <h2 className="font-display text-lg font-bold text-stone-900">
                            Financial Model Assumptions vs. Actual Live Revenue
                          </h2>
                          <p className="text-xs text-stone-500">
                            Scenario benchmarks (₹500 booking / ₹300 payout / ₹200 contribution)
                            compared with live Firestore ledger totals.
                          </p>
                        </div>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={scenarioComparisonData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              <Bar
                                dataKey="GrossValue"
                                name="Gross Booking Value (₹)"
                                fill="#0D9488"
                                radius={[6, 6, 0, 0]}
                              />
                              <Bar
                                dataKey="PlatformContribution"
                                name="Platform Contribution (₹)"
                                fill="#6D28D9"
                                radius={[6, 6, 0, 0]}
                              />
                              <Bar
                                dataKey="CaregiverPayout"
                                name="Caregiver Payout (₹)"
                                fill="#78716C"
                                radius={[6, 6, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                        <h2 className="font-display text-lg font-bold text-stone-900">
                          30-Day Validation Experiment Plan
                        </h2>
                        <div className="space-y-3">
                          {VALIDATION_EXPERIMENT_PLAN.map((step) => (
                            <div
                              key={step.week}
                              className="p-3.5 border border-stone-200 rounded-xl space-y-1 text-xs"
                            >
                              <div className="flex items-center justify-between font-semibold text-stone-900">
                                <span>
                                  {step.week}: {step.title}
                                </span>
                              </div>
                              <p className="text-stone-600">Target: {step.target}</p>
                              <p className="text-stone-400">Channels: {step.channel}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Live Activity Feed: Recent Bookings & Pending Caregivers */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display text-lg font-bold text-stone-900">
                            Latest Marketplace Bookings
                          </h2>
                          <button
                            type="button"
                            onClick={() => setActiveTab('bookings')}
                            className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                          >
                            View all
                          </button>
                        </div>
                        {bookings.length === 0 ? (
                          <p className="text-xs text-stone-500 py-4">No bookings placed yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {bookings.slice(0, 5).map((b) => (
                              <div
                                key={b.bookingId}
                                className="flex items-center justify-between gap-3 p-3 border border-stone-200 rounded-xl text-xs"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                                    <ImageWithFallback
                                      src={resolveServiceImage(b.serviceTitle)}
                                      alt={b.serviceTitle}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-stone-900 truncate">
                                      {b.serviceTitle} · {b.petName}
                                    </p>
                                    <p className="text-stone-500 truncate">
                                      {b.customerName} → {b.caregiverName} · {b.bookingDate}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-mono-tabular font-bold text-stone-900">
                                    ₹{b.grossAmount}
                                  </p>
                                  <p
                                    className={`capitalize font-semibold ${bookingStatusTextColor(
                                      b.status
                                    )}`}
                                  >
                                    {b.status.replace('_', ' ')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display text-lg font-bold text-stone-900">
                            Pending Caregiver Verifications ({pendingCaregiversList.length})
                          </h2>
                          <button
                            type="button"
                            onClick={() => {
                              setCgStatusFilter('pending');
                              setActiveTab('caregivers');
                            }}
                            className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                          >
                            Manage queue
                          </button>
                        </div>
                        {pendingCaregiversList.length === 0 ? (
                          <p className="text-xs text-stone-500 py-4">
                            All caregiver applications are reviewed.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {pendingCaregiversList.slice(0, 5).map((cg) => (
                              <div
                                key={cg.caregiverId}
                                className="flex items-center justify-between gap-3 p-3 border border-stone-200 rounded-xl text-xs"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
                                    <ImageWithFallback
                                      src={cg.photoUrl}
                                      alt={cg.fullName}
                                      fallbackLabel={cg.fullName}
                                      variant="avatar"
                                      seed={cg.caregiverId}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-stone-900 truncate">
                                      {cg.fullName}
                                    </p>
                                    <p className="text-stone-500 truncate">
                                      {cg.locality} · {cg.idDocType} ({cg.idDocNumber})
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewingCg(cg);
                                    setCgAdminNotes(cg.adminNotes || '');
                                  }}
                                  className="px-3 py-1.5 font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer shrink-0"
                                >
                                  Review
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. USERS & ADMIN GMAIL TEAM */}
                {activeTab === 'users' && (
                  <div className="space-y-6">
                    {/* Admin Team Access Control */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-violet-700" /> Authorized Admin
                            Gmail Accounts
                          </h2>
                          <p className="text-xs text-stone-500 mt-0.5">
                            Only verified Gmail accounts listed here (or primary owner{' '}
                            <span className="font-medium text-stone-700">
                              {BOOTSTRAP_OWNER_EMAIL}
                            </span>
                            ) can access the Owner/Admin Dashboard.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="p-3.5 border border-violet-200 bg-violet-50/40 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-bold text-stone-900 truncate">
                              {BOOTSTRAP_OWNER_EMAIL}
                            </p>
                            <p className="text-violet-700 font-semibold mt-0.5">
                              Primary Bootstrap Owner
                            </p>
                          </div>
                          <ShieldCheck className="w-4 h-4 text-violet-700 shrink-0" />
                        </div>

                        {adminsList
                          .filter((a) => a.email.toLowerCase() !== BOOTSTRAP_OWNER_EMAIL)
                          .map((adm) => (
                            <div
                              key={adm.uid}
                              className="p-3.5 border border-stone-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-stone-900 truncate">{adm.email}</p>
                                <p className="text-stone-400 font-mono-tabular truncate mt-0.5">
                                  UID: {adm.uid.slice(0, 12)}…
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRevokeAdmin(adm.uid, adm.email)}
                                className="px-2.5 py-1 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg font-semibold cursor-pointer shrink-0"
                              >
                                Revoke
                              </button>
                            </div>
                          ))}
                      </div>

                      {nonAdminUsers.length > 0 && (
                        <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row gap-2 max-w-xl">
                          <select
                            value={grantUid}
                            onChange={(e) => setGrantUid(e.target.value)}
                            className="flex-1 px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                          >
                            <option value="">Select registered Gmail user to grant Admin...</option>
                            {nonAdminUsers.map((u) => (
                              <option key={u.uid} value={u.uid}>
                                {u.displayName} ({u.email})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!grantUid || grantingAdmin}
                            onClick={() => {
                              const target = nonAdminUsers.find((u) => u.uid === grantUid);
                              if (target) handleGrantAdmin(target.uid, target.email);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-xl cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Grant Admin Access
                          </button>
                        </div>
                      )}
                    </div>

                    {/* All Users Table */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                          <h2 className="font-display text-xl font-bold text-stone-900">
                            Customers & Registered Accounts ({filteredUsers.length} / {users.length}
                            )
                          </h2>
                          <p className="text-xs text-stone-500">
                            Inspect customer profiles, registered pets, booking history, or
                            suspend/reactivate accounts.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={userSearch}
                              onChange={(e) => setUserSearch(e.target.value)}
                              placeholder="Search name, email, phone..."
                              className="w-full pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-xl"
                            />
                          </div>
                          <select
                            value={userRoleFilter}
                            onChange={(e) =>
                              setUserRoleFilter(
                                e.target.value as 'all' | 'customer' | 'caregiver' | 'admin'
                              )
                            }
                            className="px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                          >
                            <option value="all">All Roles</option>
                            <option value="customer">Customer</option>
                            <option value="caregiver">Caregiver</option>
                            <option value="admin">Admin</option>
                          </select>
                          <select
                            value={userStatusFilter}
                            onChange={(e) =>
                              setUserStatusFilter(
                                e.target.value as 'all' | 'active' | 'suspended'
                              )
                            }
                            className="px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                          >
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="border-b border-stone-200 text-xs text-stone-500">
                            <tr>
                              <th className="py-2.5 pr-4">Account</th>
                              <th className="py-2.5 pr-4">Contact</th>
                              <th className="py-2.5 pr-4">Locality</th>
                              <th className="py-2.5 pr-4">Pets</th>
                              <th className="py-2.5 pr-4">Bookings</th>
                              <th className="py-2.5 pr-4">Status</th>
                              <th className="py-2.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 text-xs">
                            {filteredUsers.map((u) => {
                              const userPets = pets.filter((p) => p.ownerId === u.uid);
                              const userBookings = bookings.filter((b) => b.customerId === u.uid);
                              const isOwner = u.email.toLowerCase() === BOOTSTRAP_OWNER_EMAIL;
                              return (
                                <tr key={u.uid} className="hover:bg-stone-50/70">
                                  <td className="py-3 pr-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
                                        <ImageWithFallback
                                          src={u.photoUrl}
                                          alt={u.displayName}
                                          fallbackLabel={u.displayName}
                                          variant="avatar"
                                          seed={u.uid}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div>
                                        <p className="font-semibold text-stone-900">
                                          {u.displayName}
                                        </p>
                                        <p className="text-[11px] text-stone-400 capitalize">
                                          {isOwner ? 'Primary Owner' : u.role}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 pr-4 text-stone-600">
                                    <p>{u.email}</p>
                                    {u.phone && (
                                      <p className="text-[11px] text-stone-400">{u.phone}</p>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4 text-stone-600">{u.locality || '—'}</td>
                                  <td className="py-3 pr-4 font-mono-tabular">{userPets.length}</td>
                                  <td className="py-3 pr-4 font-mono-tabular">
                                    {userBookings.length}
                                  </td>
                                  <td className="py-3 pr-4">
                                    <span
                                      className={`capitalize font-semibold ${
                                        u.accountStatus === 'active'
                                          ? 'text-teal-800'
                                          : 'text-red-700'
                                      }`}
                                    >
                                      {u.accountStatus}
                                    </span>
                                  </td>
                                  <td className="py-3 text-right space-x-2 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => setViewingUser(u)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold bg-stone-100 text-stone-800 hover:bg-stone-200 cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" /> Details
                                    </button>
                                    {!isOwner && u.uid !== firebaseUser?.uid && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const next =
                                            u.accountStatus === 'active' ? 'suspended' : 'active';
                                          try {
                                            await adminUpdateUserStatus(u.uid, next);
                                            showToast('success', `${u.displayName} is now ${next}.`);
                                          } catch (err) {
                                            showToast(
                                              'error',
                                              formatAppError(err, 'Could not update user status.')
                                            );
                                          }
                                        }}
                                        className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                                          u.accountStatus === 'active'
                                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                            : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                                        }`}
                                      >
                                        {u.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. REGISTERED PETS REGISTRY */}
                {activeTab === 'pets' && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-xl font-bold text-stone-900">
                          Registered Pets Registry ({filteredPets.length} / {pets.length})
                        </h2>
                        <p className="text-xs text-stone-500">
                          Review every pet profile, owner details, feeding schedules, and medical
                          disclosures across PawCare.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="relative w-full sm:w-64">
                          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={petSearch}
                            onChange={(e) => setPetSearch(e.target.value)}
                            placeholder="Search pet, breed, owner..."
                            className="w-full pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                        </div>
                        <select
                          value={petTypeFilter}
                          onChange={(e) => setPetTypeFilter(e.target.value as 'all' | PetType)}
                          className="px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                        >
                          <option value="all">All Species</option>
                          {(['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'] as PetType[]).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {filteredPets.length === 0 ? (
                      <div className="py-12 text-center text-sm text-stone-500 border border-stone-200 rounded-xl">
                        No pet profiles match your filter.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredPets.map((pet) => {
                          const owner = users.find((u) => u.uid === pet.ownerId);
                          const petBookingsCount = bookings.filter(
                            (b) => b.petId === pet.petId
                          ).length;
                          const isConfirmingDelete = confirmDeletePetId === pet.petId;
                          return (
                            <div
                              key={pet.petId}
                              className="border border-stone-200 rounded-2xl p-4 flex flex-col justify-between gap-4 hover:border-stone-300 transition-colors"
                            >
                              <div className="flex items-start gap-3.5">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                                  <ImageWithFallback
                                    src={resolvePetImage(pet)}
                                    alt={`${pet.name} (${pet.petType})`}
                                    fallbackLabel={pet.petType}
                                    variant="pet"
                                    hoverZoom
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <h3 className="font-display font-bold text-base text-stone-900 truncate">
                                      {pet.name}
                                    </h3>
                                    <span className="font-mono-tabular text-xs font-semibold text-teal-800 shrink-0">
                                      {petBookingsCount} bookings
                                    </span>
                                  </div>
                                  <p className="text-xs text-stone-600">
                                    {pet.petType} · {pet.breed} · {pet.ageYears} yrs · {pet.gender}
                                  </p>
                                  <p className="text-xs text-stone-500 truncate">
                                    Parent: <strong>{owner?.displayName || 'Unknown'}</strong>
                                    {owner?.email ? ` (${owner.email})` : ''}
                                  </p>
                                </div>
                              </div>

                              {(pet.healthInfo ||
                                pet.feedingInstructions ||
                                pet.behavioralInfo ||
                                pet.specialCare) && (
                                <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-600 space-y-1">
                                  {pet.feedingInstructions && (
                                    <p className="truncate">
                                      <strong>Feeding:</strong> {pet.feedingInstructions}
                                    </p>
                                  )}
                                  {pet.healthInfo && (
                                    <p className="truncate">
                                      <strong>Health:</strong> {pet.healthInfo}
                                    </p>
                                  )}
                                  {pet.behavioralInfo && (
                                    <p className="truncate">
                                      <strong>Behavior:</strong> {pet.behavioralInfo}
                                    </p>
                                  )}
                                  {pet.specialCare && (
                                    <p className="truncate">
                                      <strong>Special Care:</strong> {pet.specialCare}
                                    </p>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setViewingPet(pet)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Full Care Profile
                                </button>
                                {isConfirmingDelete ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await deletePet(pet.petId);
                                          setConfirmDeletePetId(null);
                                          showToast('success', `Removed pet profile ${pet.name}.`);
                                        } catch (err) {
                                          showToast(
                                            'error',
                                            formatAppError(err, 'Could not remove pet profile.')
                                          );
                                        }
                                      }}
                                      className="px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                                    >
                                      Confirm Delete
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeletePetId(null)}
                                      className="px-2.5 py-1.5 text-xs font-semibold text-stone-600 bg-stone-100 rounded-lg cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeletePetId(pet.petId)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. CAREGIVER MANAGEMENT & VERIFICATION */}
                {activeTab === 'caregivers' && (
                  <div className="space-y-4">
                    <div className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display text-xl font-bold text-stone-900">
                          Caregiver Profiles & Verification ({filteredCaregivers.length} /{' '}
                          {caregivers.length})
                        </h2>
                        <p className="text-xs text-stone-500">
                          Verify Aadhaar/PAN/Student ID documents before listing caregivers in public
                          search.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="relative">
                          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={cgSearch}
                            onChange={(e) => setCgSearch(e.target.value)}
                            placeholder="Search caregiver, area, service..."
                            className="pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                          />
                        </div>
                        <select
                          value={cgStatusFilter}
                          onChange={(e) =>
                            setCgStatusFilter(
                              e.target.value as
                                | 'all'
                                | 'pending'
                                | 'verified'
                                | 'rejected'
                                | 'suspended'
                            )
                          }
                          className="px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                        >
                          <option value="all">All Statuses</option>
                          <option value="pending">Pending Review</option>
                          <option value="verified">Verified & Active</option>
                          <option value="rejected">Rejected</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                    </div>

                    {filteredCaregivers.length === 0 ? (
                      <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-sm text-stone-500">
                        No caregiver profiles match your current filter.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {filteredCaregivers.map((cg) => {
                          const completedCount = bookings.filter(
                            (b) => b.caregiverId === cg.caregiverId && b.status === 'completed'
                          ).length;
                          const cgReviews = reviews.filter((r) => r.caregiverId === cg.caregiverId);
                          const avgRating =
                            cgReviews.length > 0
                              ? (
                                  cgReviews.reduce((s, r) => s + r.rating, 0) / cgReviews.length
                                ).toFixed(1)
                              : 'New';

                          return (
                            <div
                              key={cg.caregiverId}
                              className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
                                    <ImageWithFallback
                                      src={cg.photoUrl}
                                      alt={cg.fullName}
                                      fallbackLabel={cg.fullName}
                                      variant="avatar"
                                      seed={cg.caregiverId}
                                      hoverZoom
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="font-display font-bold text-stone-900 truncate">
                                      {cg.fullName}
                                    </h3>
                                    <p className="text-xs text-stone-500 truncate">
                                      {cg.locality} · {cg.phone} · {cg.email}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right text-xs shrink-0">
                                  <span
                                    className={`font-semibold capitalize ${
                                      cg.verificationStatus === 'verified'
                                        ? 'text-teal-800'
                                        : cg.verificationStatus === 'rejected'
                                        ? 'text-red-700'
                                        : 'text-amber-800'
                                    }`}
                                  >
                                    {cg.verificationStatus}
                                  </span>
                                  {cg.accountStatus === 'suspended' && (
                                    <p className="text-[11px] font-semibold text-red-700">
                                      Suspended
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="text-xs text-stone-600 space-y-1 bg-stone-50 p-3.5 rounded-xl">
                                <p>
                                  <span className="font-semibold">Address:</span> {cg.address}
                                </p>
                                <p>
                                  <span className="font-semibold">Experience & Rating:</span>{' '}
                                  {cg.experienceYears} yrs · ★ {avgRating} ({cgReviews.length}{' '}
                                  reviews) · {completedCount} completed jobs · ₹{cg.expectedCharge}
                                  /session
                                </p>
                                <p>
                                  <span className="font-semibold">Skills:</span>{' '}
                                  {cg.skills.join(', ') || '—'}
                                </p>
                                <p>
                                  <span className="font-semibold">Availability:</span>{' '}
                                  {cg.availability.join(', ')}
                                </p>
                                <p>
                                  <span className="font-semibold">ID Document:</span> {cg.idDocType}{' '}
                                  — {cg.idDocNumber}
                                  {cg.idDocUrl && (
                                    <>
                                      {' '}
                                      (
                                      <a
                                        href={cg.idDocUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-teal-700 underline"
                                      >
                                        View Document
                                      </a>
                                      )
                                    </>
                                  )}
                                </p>
                                <p>
                                  <span className="font-semibold">Services:</span>{' '}
                                  {cg.servicesOffered.join(', ')}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewingCg(cg);
                                    setCgAdminNotes(cg.adminNotes || '');
                                  }}
                                  className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                                >
                                  Review / Verify
                                </button>
                                {cg.accountStatus === 'suspended' ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await adminUpdateCaregiverVerification(
                                          cg,
                                          cg.verificationStatus,
                                          'active',
                                          cg.adminNotes || 'Account reactivated by admin.'
                                        );
                                        showToast('success', `${cg.fullName} reactivated.`);
                                      } catch (err) {
                                        showToast(
                                          'error',
                                          formatAppError(err, 'Could not reactivate caregiver.')
                                        );
                                      }
                                    }}
                                    className="px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
                                  >
                                    Reactivate
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await adminUpdateCaregiverVerification(
                                          cg,
                                          cg.verificationStatus,
                                          'suspended',
                                          cg.adminNotes || 'Account suspended by admin.'
                                        );
                                        showToast('success', `${cg.fullName} suspended.`);
                                      } catch (err) {
                                        showToast(
                                          'error',
                                          formatAppError(err, 'Could not suspend caregiver.')
                                        );
                                      }
                                    }}
                                    className="px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer"
                                  >
                                    Suspend
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. BOOKINGS & DISPUTES */}
                {activeTab === 'bookings' && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <h2 className="font-display text-xl font-bold text-stone-900">
                        All Bookings & Disputes ({filteredBookings.length} / {bookings.length})
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        <div className="relative">
                          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={bookingSearch}
                            onChange={(e) => setBookingSearch(e.target.value)}
                            placeholder="Search ID, customer, caregiver, pet..."
                            className="pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                        </div>
                        <select
                          value={bookingStatusFilter}
                          onChange={(e) => setBookingStatusFilter(e.target.value)}
                          className="px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                        >
                          <option value="all">All Booking Statuses</option>
                          {(
                            [
                              'pending',
                              'accepted',
                              'confirmed',
                              'in_progress',
                              'completed',
                              'cancelled',
                              'rejected',
                            ] as BookingStatus[]
                          ).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bookingDisputeFilter}
                          onChange={(e) =>
                            setBookingDisputeFilter(e.target.value as 'all' | 'open' | 'resolved')
                          }
                          className="px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                        >
                          <option value="all">All Disputes</option>
                          <option value="open">Open Disputes</option>
                          <option value="resolved">Resolved Disputes</option>
                        </select>
                        <select
                          value={bookingDateRange}
                          onChange={(e) =>
                            setBookingDateRange(
                              e.target.value as 'all' | 'today' | '7d' | '30d'
                            )
                          }
                          className="px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                        >
                          <option value="all">All Dates</option>
                          <option value="today">Today</option>
                          <option value="7d">Last 7 Days</option>
                          <option value="30d">Last 30 Days</option>
                        </select>
                        {(bookingSearch ||
                          bookingStatusFilter !== 'all' ||
                          bookingDisputeFilter !== 'all' ||
                          bookingDateRange !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setBookingSearch('');
                              setBookingStatusFilter('all');
                              setBookingDisputeFilter('all');
                              setBookingDateRange('all');
                            }}
                            className="px-3 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {filteredBookings.length === 0 ? (
                      <p className="text-sm text-stone-500 py-8 text-center">
                        No bookings match the current filters.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {filteredBookings.map((b) => {
                          const paymentRec = payments.find((p) => p.bookingId === b.bookingId);
                          return (
                            <div
                              key={b.bookingId}
                              className="border border-stone-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                            >
                              <div className="flex items-start gap-3.5 min-w-0">
                                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                                  <ImageWithFallback
                                    src={resolveServiceImage(b.serviceTitle)}
                                    alt={b.serviceTitle}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono-tabular text-[11px] px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-semibold">
                                      ID: {b.bookingId}
                                    </span>
                                    <span className="text-[11px] text-stone-400 font-mono-tabular">
                                      Created:{' '}
                                      {toMillis(b.createdAt) > 0
                                        ? new Date(toMillis(b.createdAt)).toLocaleString('en-IN')
                                        : 'Pending timestamp'}
                                    </span>
                                  </div>
                                  <p className="font-semibold text-stone-900 text-sm">
                                    {b.serviceName || b.serviceTitle} · {b.petName}
                                    {b.petType
                                      ? ` (${b.petType}${b.petBreed ? ` / ${b.petBreed}` : ''})`
                                      : ''}{' '}
                                    · {b.bookingDate} (
                                    {b.startTime && b.endTime
                                      ? `${b.startTime}–${b.endTime}`
                                      : b.timeSlot}
                                    )
                                  </p>
                                  <p className="text-stone-600">
                                    Customer: <strong>{b.customerName}</strong> (
                                    {b.customerEmail || 'no email'} · UID: {b.customerId}
                                    {b.customerPhone ? ` · ${b.customerPhone}` : ''}) → Caregiver:{' '}
                                    <strong>{b.caregiverName}</strong> · {b.locality}
                                  </p>
                                  <p className="text-stone-500">Address: {b.serviceAddress}</p>
                                  {(b.petInstructions || b.specialInstructions) && (
                                    <p className="text-stone-500">
                                      Care Notes:{' '}
                                      {[b.petInstructions, b.specialInstructions]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  )}
                                  <p className="font-mono-tabular text-stone-600">
                                    Amount: ₹{b.bookingAmount ?? b.grossAmount} · Payout: ₹
                                    {b.caregiverPayout} · Commission: ₹{b.platformCommission} ·
                                    Status: {b.bookingStatus || b.status} · Payment:{' '}
                                    {b.paymentMethod} ({b.paymentStatus})
                                  </p>
                                  {b.disputeStatus !== 'none' && (
                                    <p className="text-amber-800 font-semibold">
                                      Dispute ({b.disputeStatus}): {b.disputeNotes}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <select
                                  aria-label={`Booking status for ${b.bookingId}`}
                                  value={b.status}
                                  onChange={async (e) => {
                                    try {
                                      await updateBookingStatus({
                                        booking: b,
                                        nextStatus: e.target.value as BookingStatus,
                                        actorRole: 'admin',
                                      });
                                      showToast('success', `Booking ${b.bookingId} updated.`);
                                    } catch (err) {
                                      showToast(
                                        'error',
                                        formatAppError(err, 'Could not update booking status.')
                                      );
                                    }
                                  }}
                                  className="px-2.5 py-1.5 border border-stone-200 rounded-lg font-semibold bg-white"
                                >
                                  {(
                                    [
                                      'pending',
                                      'accepted',
                                      'rejected',
                                      'confirmed',
                                      'in_progress',
                                      'completed',
                                      'cancelled',
                                    ] as BookingStatus[]
                                  ).map((st) => (
                                    <option key={st} value={st}>
                                      {st}
                                    </option>
                                  ))}
                                </select>

                                {paymentRec && (
                                  <select
                                    aria-label={`Payment status for ${b.bookingId}`}
                                    value={paymentRec.status}
                                    onChange={async (e) => {
                                      try {
                                        await adminUpdatePaymentStatus(
                                          paymentRec,
                                          e.target.value as PaymentStatus
                                        );
                                        showToast('success', `Payment status updated.`);
                                      } catch (err) {
                                        showToast(
                                          'error',
                                          formatAppError(err, 'Could not update payment status.')
                                        );
                                      }
                                    }}
                                    className="px-2.5 py-1.5 border border-stone-200 rounded-lg font-medium bg-stone-50"
                                  >
                                    {(
                                      [
                                        'pending',
                                        'test_verified',
                                        'paid',
                                        'refund_pending',
                                        'refunded',
                                      ] as PaymentStatus[]
                                    ).map((pst) => (
                                      <option key={pst} value={pst}>
                                        Pay: {pst}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setInspectBooking(b)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Inspect
                                </button>

                                {b.disputeStatus === 'open' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await adminResolveBookingDispute(
                                          b.bookingId,
                                          'resolved',
                                          `${b.disputeNotes || ''} [Resolved by Admin]`
                                        );
                                        showToast('success', 'Booking dispute marked resolved.');
                                      } catch (err) {
                                        showToast(
                                          'error',
                                          formatAppError(err, 'Could not resolve dispute.')
                                        );
                                      }
                                    }}
                                    className="px-3 py-1.5 font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg cursor-pointer"
                                  >
                                    Resolve Dispute
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. FINANCIALS, COMMISSION & LEDGER */}
                {activeTab === 'financials' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                      {[
                        {
                          label: 'Gross Booking Value',
                          value: `₹${metrics.grossBookingValue}`,
                          accent: 'text-stone-900',
                        },
                        {
                          label: 'Caregiver Payouts',
                          value: `₹${metrics.caregiverPayoutTotal}`,
                          accent: 'text-teal-800',
                        },
                        {
                          label: 'Weekly Commission',
                          value: `₹${metrics.weeklyRevenue}`,
                          accent: 'text-violet-700',
                        },
                        {
                          label: 'Monthly Commission',
                          value: `₹${metrics.monthlyRevenue}`,
                          accent: 'text-violet-700',
                        },
                        {
                          label: 'Yearly Commission',
                          value: `₹${metrics.yearlyRevenue}`,
                          accent: 'text-violet-700',
                        },
                        {
                          label: 'Net Platform Surplus',
                          value: `₹${metrics.netPlatformRevenue}`,
                          accent:
                            metrics.netPlatformRevenue >= 0 ? 'text-teal-800' : 'text-red-700',
                        },
                      ].map((card) => (
                        <div
                          key={card.label}
                          className="bg-white border border-stone-200 rounded-2xl p-4 space-y-1"
                        >
                          <p className="text-[11px] text-stone-500">{card.label}</p>
                          <p
                            className={`font-display text-lg font-bold font-mono-tabular ${card.accent}`}
                          >
                            {card.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Pricing & Commission Configuration */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <div>
                        <h2 className="font-display text-xl font-bold text-stone-900">
                          Pricing & Commission Model Configuration
                        </h2>
                        <p className="text-xs text-stone-500">
                          Configure fixed margin or percentage split and monthly fixed operating
                          cost assumptions.
                        </p>
                      </div>
                      <form
                        onSubmit={handleSaveSettings}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
                      >
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Commission Model
                          </label>
                          <select
                            value={settingsDraft.commissionModel}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                commissionModel: e.target.value as 'fixed_margin' | 'percentage',
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl bg-white"
                          >
                            <option value="fixed_margin">Fixed Margin (₹)</option>
                            <option value="percentage">Percentage Split (%)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Platform Commission (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={settingsDraft.commissionPercentage ?? 40}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                commissionPercentage: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Default Session Price (₹)
                          </label>
                          <input
                            type="number"
                            value={settingsDraft.defaultBookingPrice}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                defaultBookingPrice: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Default Caregiver Payout (₹)
                          </label>
                          <input
                            type="number"
                            value={settingsDraft.defaultProviderCost}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                defaultProviderCost: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Monthly Fixed Cost (₹)
                          </label>
                          <input
                            type="number"
                            value={settingsDraft.monthlyFixedCost}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                monthlyFixedCost: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl font-mono-tabular"
                          />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-5">
                          <button
                            type="submit"
                            disabled={savingSettings}
                            className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
                          >
                            {savingSettings ? 'Saving...' : 'Save Financial Settings'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* 4 Interactive Analytics Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
                        <h3 className="font-display text-base font-bold text-stone-900 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-teal-700" /> Revenue & Booking Growth
                          Trends
                        </h3>
                        {revenueTrendData.length === 0 ? (
                          <p className="text-xs text-stone-500 py-10 text-center">
                            No valid bookings yet to plot monthly revenue trends.
                          </p>
                        ) : (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={revenueTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Area
                                  type="monotone"
                                  dataKey="Gross"
                                  name="Gross (₹)"
                                  stroke="#0D9488"
                                  fill="#CCFBF1"
                                />
                                <Area
                                  type="monotone"
                                  dataKey="Commission"
                                  name="Commission (₹)"
                                  stroke="#6D28D9"
                                  fill="#EDE9FE"
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
                        <h3 className="font-display text-base font-bold text-stone-900 flex items-center gap-2">
                          <Users className="w-4 h-4 text-violet-700" /> Customer Registration
                          Growth
                        </h3>
                        {customerGrowthData.length === 0 ? (
                          <p className="text-xs text-stone-500 py-10 text-center">
                            Customer registration data will appear here.
                          </p>
                        ) : (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={customerGrowthData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar
                                  dataKey="NewUsers"
                                  name="New Accounts"
                                  fill="#6D28D9"
                                  radius={[6, 6, 0, 0]}
                                />
                                <Bar
                                  dataKey="TotalUsers"
                                  name="Cumulative Accounts"
                                  fill="#0D9488"
                                  radius={[6, 6, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
                        <h3 className="font-display text-base font-bold text-stone-900 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-teal-700" /> Service Popularity
                        </h3>
                        {servicePopularityData.length === 0 ? (
                          <p className="text-xs text-stone-500 py-10 text-center">
                            No bookings recorded across services yet.
                          </p>
                        ) : (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={servicePopularityData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar
                                  dataKey="Bookings"
                                  name="Bookings"
                                  fill="#0D9488"
                                  radius={[6, 6, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
                        <h3 className="font-display text-base font-bold text-stone-900 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-violet-700" /> Caregiver Performance
                        </h3>
                        {caregiverPerformanceData.length === 0 ? (
                          <p className="text-xs text-stone-500 py-10 text-center">
                            Caregiver performance metrics will appear after sessions complete.
                          </p>
                        ) : (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={caregiverPerformanceData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar
                                  dataKey="CompletedSessions"
                                  name="Completed Sessions"
                                  fill="#6D28D9"
                                  radius={[6, 6, 0, 0]}
                                />
                                <Bar
                                  dataKey="PayoutINR"
                                  name="Payout (₹)"
                                  fill="#0D9488"
                                  radius={[6, 6, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Payments & Transactions Ledger Switcher */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-teal-700" /> Payment Tracking &
                            Transaction Ledger
                          </h2>
                          <p className="text-xs text-stone-500">
                            {payments.length} payment records · {transactions.length} immutable
                            ledger transactions
                          </p>
                        </div>
                        <div className="inline-flex p-1 bg-stone-100 rounded-xl self-start">
                          <button
                            type="button"
                            onClick={() => setLedgerView('payments')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                              ledgerView === 'payments'
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-600'
                            }`}
                          >
                            Payments ({payments.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setLedgerView('transactions')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                              ledgerView === 'transactions'
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-600'
                            }`}
                          >
                            Transactions ({transactions.length})
                          </button>
                        </div>
                      </div>

                      {ledgerView === 'payments' ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="border-b border-stone-200 text-stone-500">
                              <tr>
                                <th className="py-2 pr-4">Reference / ID</th>
                                <th className="py-2 pr-4">Method / Mode</th>
                                <th className="py-2 pr-4 text-right">Gross (₹)</th>
                                <th className="py-2 pr-4 text-right">Commission (₹)</th>
                                <th className="py-2 pr-4 text-right">Payout (₹)</th>
                                <th className="py-2 pr-4">Status</th>
                                <th className="py-2 text-right">Update</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 font-mono-tabular">
                              {payments.map((p) => (
                                <tr key={p.paymentId}>
                                  <td className="py-2.5 pr-4">{p.referenceCode || p.paymentId}</td>
                                  <td className="py-2.5 pr-4 font-sans">
                                    {p.method} ({p.gatewayMode.replace('_', ' ')})
                                  </td>
                                  <td className="py-2.5 pr-4 text-right">₹{p.grossAmount}</td>
                                  <td className="py-2.5 pr-4 text-right text-violet-700">
                                    ₹{p.platformCommission}
                                  </td>
                                  <td className="py-2.5 pr-4 text-right text-teal-700">
                                    ₹{p.caregiverPayout}
                                  </td>
                                  <td className="py-2.5 pr-4 font-sans capitalize font-semibold">
                                    {p.status}
                                  </td>
                                  <td className="py-2.5 text-right font-sans">
                                    <select
                                      value={p.status}
                                      onChange={async (e) => {
                                        try {
                                          await adminUpdatePaymentStatus(
                                            p,
                                            e.target.value as PaymentStatus
                                          );
                                          showToast('success', `Payment ${p.paymentId} updated.`);
                                        } catch (err) {
                                          showToast(
                                            'error',
                                            formatAppError(err, 'Could not update payment status.')
                                          );
                                        }
                                      }}
                                      className="px-2 py-1 border border-stone-200 rounded-lg bg-white"
                                    >
                                      {(
                                        [
                                          'pending',
                                          'test_verified',
                                          'paid',
                                          'refund_pending',
                                          'refunded',
                                        ] as PaymentStatus[]
                                      ).map((st) => (
                                        <option key={st} value={st}>
                                          {st}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="border-b border-stone-200 text-stone-500">
                              <tr>
                                <th className="py-2 pr-4">Transaction ID</th>
                                <th className="py-2 pr-4">Booking ID</th>
                                <th className="py-2 pr-4">Type</th>
                                <th className="py-2 pr-4 text-right">Gross (₹)</th>
                                <th className="py-2 pr-4 text-right">Commission (₹)</th>
                                <th className="py-2 pr-4 text-right">Payout (₹)</th>
                                <th className="py-2 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 font-mono-tabular">
                              {transactions.map((t) => (
                                <tr key={t.transactionId}>
                                  <td className="py-2.5 pr-4">{t.transactionId}</td>
                                  <td className="py-2.5 pr-4">{t.bookingId}</td>
                                  <td className="py-2.5 pr-4 font-sans capitalize">
                                    {t.type.replace('_', ' ')}
                                  </td>
                                  <td className="py-2.5 pr-4 text-right">₹{t.grossAmount}</td>
                                  <td className="py-2.5 pr-4 text-right text-violet-700">
                                    ₹{t.platformCommission}
                                  </td>
                                  <td className="py-2.5 pr-4 text-right text-teal-700">
                                    ₹{t.caregiverPayout}
                                  </td>
                                  <td className="py-2.5 text-right font-sans capitalize font-semibold">
                                    {t.status}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 7. CATALOG, CONTENT, FAQS, TESTIMONIALS & PROMOS */}
                {activeTab === 'content' && (
                  <div className="space-y-6">
                    {/* Services Editor */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                      <h2 className="font-display text-xl font-bold text-stone-900">
                        Manage Services & Pricing ({adminServices.length})
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {adminServices.map((s) => (
                          <div
                            key={s.serviceId}
                            className="border border-stone-200 rounded-xl p-4 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 border border-stone-200">
                                <ImageWithFallback
                                  src={resolveServiceImage(s)}
                                  alt={s.title}
                                  hoverZoom
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-stone-900 text-sm truncate">
                                    {s.title}
                                  </p>
                                  <span
                                    className={`text-[11px] font-semibold shrink-0 ${
                                      s.isActive ? 'text-teal-700' : 'text-stone-400'
                                    }`}
                                  >
                                    {s.isActive ? 'Enabled' : 'Disabled'}
                                  </span>
                                </div>
                                <p className="text-stone-500 mt-0.5 font-mono-tabular">
                                  ₹{s.basePrice} (₹{s.providerPayout} payout / ₹
                                  {s.platformCommission} fee) · {s.durationLabel}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await adminSaveService({ ...s, isActive: !s.isActive }, false);
                                    showToast(
                                      'success',
                                      `${s.title} ${!s.isActive ? 'enabled' : 'disabled'}.`
                                    );
                                  } catch (err) {
                                    showToast(
                                      'error',
                                      formatAppError(err, 'Could not update service visibility.')
                                    );
                                  }
                                }}
                                className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg font-semibold cursor-pointer"
                              >
                                {s.isActive ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingService(s);
                                  setSvcTitle(s.title);
                                  setSvcDesc(s.description);
                                  setSvcDuration(s.durationLabel);
                                  setSvcPrice(String(s.basePrice));
                                  setSvcPayout(String(s.providerPayout));
                                  setSvcActive(s.isActive);
                                  setSvcImageUrl(
                                    s.imageUrl &&
                                      (s.imageUrl.startsWith('http://') ||
                                        s.imageUrl.startsWith('https://'))
                                      ? s.imageUrl
                                      : ''
                                  );
                                }}
                                className="px-2.5 py-1 bg-stone-100 rounded-lg font-semibold cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await adminDeleteService(s.serviceId);
                                    showToast('success', `${s.title} removed.`);
                                  } catch (err) {
                                    showToast(
                                      'error',
                                      formatAppError(err, 'Could not delete service.')
                                    );
                                  }
                                }}
                                className="p-1 text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <form
                        onSubmit={handleSaveServiceForm}
                        className="pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-3"
                      >
                        <input
                          type="text"
                          required
                          minLength={2}
                          value={svcTitle}
                          onChange={(e) => setSvcTitle(e.target.value)}
                          placeholder="Service Title"
                          className="px-3 py-2 text-sm border border-stone-200 rounded-xl"
                        />
                        <input
                          type="text"
                          required
                          minLength={2}
                          value={svcDuration}
                          onChange={(e) => setSvcDuration(e.target.value)}
                          placeholder="Duration (e.g., 60 mins)"
                          className="px-3 py-2 text-sm border border-stone-200 rounded-xl"
                        />
                        <input
                          type="number"
                          required
                          min="50"
                          value={svcPrice}
                          onChange={(e) => handleServicePriceChange(e.target.value)}
                          placeholder="Gross Price (₹)"
                          className="px-3 py-2 text-sm border border-stone-200 rounded-xl"
                        />
                        <input
                          type="number"
                          required
                          min="0"
                          value={svcPayout}
                          onChange={(e) => setSvcPayout(e.target.value)}
                          placeholder="Caregiver Payout (₹)"
                          className="px-3 py-2 text-sm border border-stone-200 rounded-xl"
                        />
                        <textarea
                          rows={2}
                          required
                          minLength={10}
                          value={svcDesc}
                          onChange={(e) => setSvcDesc(e.target.value)}
                          placeholder="Service description (at least 10 characters)..."
                          className="sm:col-span-2 px-3 py-2 text-sm border border-stone-200 rounded-xl"
                        />
                        <input
                          type="url"
                          value={svcImageUrl}
                          onChange={(e) => setSvcImageUrl(e.target.value)}
                          placeholder="Optional custom HTTPS image URL (leave blank to use default service photo)"
                          className="sm:col-span-2 px-3 py-2 text-sm border border-stone-200 rounded-xl"
                        />
                        <div className="sm:col-span-2 flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={svcActive}
                              onChange={(e) => setSvcActive(e.target.checked)}
                            />
                            <span>Active on public site</span>
                          </label>
                          <div className="flex gap-2">
                            {editingService && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingService(null);
                                  setSvcTitle('');
                                  setSvcDesc('');
                                  setSvcImageUrl('');
                                }}
                                className="px-3 py-2 text-xs bg-stone-100 rounded-xl cursor-pointer"
                              >
                                Cancel Edit
                              </button>
                            )}
                            <button
                              type="submit"
                              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
                            >
                              {editingService ? 'Update Service' : 'Add Service'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>

                    {/* Platform Identity, Policies, Localities, FAQs & Testimonials */}
                    <form
                      onSubmit={handleSaveSettings}
                      className="bg-white border border-stone-200 rounded-2xl p-6 space-y-6"
                    >
                      <h2 className="font-display text-xl font-bold text-stone-900">
                        Platform Identity, Policies, Areas, FAQs & Testimonials
                      </h2>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Platform Name
                          </label>
                          <input
                            type="text"
                            maxLength={80}
                            value={settingsDraft.platformName || 'PawCare'}
                            onChange={(e) =>
                              setSettingsDraft({ ...settingsDraft, platformName: e.target.value })
                            }
                            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Admin WhatsApp Number
                          </label>
                          <input
                            type="text"
                            required
                            minLength={8}
                            maxLength={20}
                            value={settingsDraft.whatsappNumber}
                            onChange={(e) =>
                              setSettingsDraft({ ...settingsDraft, whatsappNumber: e.target.value })
                            }
                            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Support Email
                          </label>
                          <input
                            type="email"
                            value={settingsDraft.supportEmail || ''}
                            onChange={(e) =>
                              setSettingsDraft({ ...settingsDraft, supportEmail: e.target.value })
                            }
                            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Homepage Hero Announcement Notice
                        </label>
                        <input
                          type="text"
                          maxLength={300}
                          value={settingsDraft.heroBannerNotice || ''}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              heroBannerNotice: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Booking Policy
                          </label>
                          <textarea
                            rows={3}
                            maxLength={1200}
                            value={settingsDraft.bookingPolicy || ''}
                            onChange={(e) =>
                              setSettingsDraft({ ...settingsDraft, bookingPolicy: e.target.value })
                            }
                            className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Cancellation Policy
                          </label>
                          <textarea
                            rows={3}
                            maxLength={1200}
                            value={settingsDraft.cancellationPolicy || ''}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                cancellationPolicy: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                        </div>
                      </div>

                      {/* Dehradun Localities */}
                      <div className="space-y-2 pt-2 border-t border-stone-100">
                        <label className="block text-xs font-semibold text-stone-700">
                          Active Dehradun Service Localities ({settingsDraft.localities.length})
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {settingsDraft.localities.map((loc) => (
                            <span
                              key={loc}
                              className="inline-flex items-center gap-1.5 text-xs bg-stone-100 px-3 py-1 rounded-lg"
                            >
                              {loc}
                              <button
                                type="button"
                                onClick={() =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    localities: settingsDraft.localities.filter((l) => l !== loc),
                                  })
                                }
                                className="text-stone-500 hover:text-red-700 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1 max-w-md">
                          <input
                            type="text"
                            value={newLocality}
                            onChange={(e) => setNewLocality(e.target.value)}
                            placeholder="Add Dehradun area (e.g., Clock Tower)"
                            className="flex-1 px-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newLocality.trim();
                              if (trimmed && !settingsDraft.localities.includes(trimmed)) {
                                setSettingsDraft({
                                  ...settingsDraft,
                                  localities: [...settingsDraft.localities, trimmed],
                                });
                                setNewLocality('');
                              }
                            }}
                            className="px-3 py-2 text-xs font-semibold bg-stone-800 text-white rounded-xl cursor-pointer"
                          >
                            Add Area
                          </button>
                        </div>
                      </div>

                      {/* FAQs Editor */}
                      <div className="space-y-3 pt-2 border-t border-stone-100">
                        <label className="block text-xs font-semibold text-stone-700">
                          Public Frequently Asked Questions ({(settingsDraft.faqs || []).length})
                        </label>
                        <div className="space-y-2">
                          {(settingsDraft.faqs || []).map((faq, idx) => (
                            <div
                              key={`${faq.question}-${idx}`}
                              className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-start justify-between gap-3 text-xs"
                            >
                              <div>
                                <p className="font-semibold text-stone-900">{faq.question}</p>
                                <p className="text-stone-600 mt-0.5">{faq.answer}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    faqs: (settingsDraft.faqs || []).filter((_, i) => i !== idx),
                                  })
                                }
                                className="text-red-700 hover:bg-red-50 p-1 rounded cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={newFaqQuestion}
                            onChange={(e) => setNewFaqQuestion(e.target.value)}
                            placeholder="New FAQ question..."
                            className="px-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                          <input
                            type="text"
                            value={newFaqAnswer}
                            onChange={(e) => setNewFaqAnswer(e.target.value)}
                            placeholder="FAQ answer..."
                            className="px-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const q = newFaqQuestion.trim();
                              const a = newFaqAnswer.trim();
                              if (!q || !a) return;
                              setSettingsDraft({
                                ...settingsDraft,
                                faqs: [...(settingsDraft.faqs || []), { question: q, answer: a }],
                              });
                              setNewFaqQuestion('');
                              setNewFaqAnswer('');
                            }}
                            className="px-3 py-2 text-xs font-semibold bg-stone-800 text-white rounded-xl cursor-pointer"
                          >
                            Add FAQ Item
                          </button>
                        </div>
                      </div>

                      {/* Community Testimonials Editor */}
                      <div className="space-y-3 pt-2 border-t border-stone-100">
                        <label className="block text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-teal-700" /> Community Testimonials (
                          {(settingsDraft.testimonials || []).length})
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {(settingsDraft.testimonials || []).map((t, idx) => (
                            <div
                              key={`${t.name}-${idx}`}
                              className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5">
                                <p className="font-semibold text-stone-900">
                                  {t.name} · {t.locality} · ★ {t.rating}
                                </p>
                                <p className="text-[11px] text-stone-500">{t.role}</p>
                                <p className="text-stone-600 mt-1">“{t.quote}”</p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    testimonials: (settingsDraft.testimonials || []).filter(
                                      (_, i) => i !== idx
                                    ),
                                  })
                                }
                                className="text-red-700 hover:bg-red-50 p-1 rounded cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            value={newTestiName}
                            onChange={(e) => setNewTestiName(e.target.value)}
                            placeholder="Customer name"
                            className="px-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                          <input
                            type="text"
                            value={newTestiRole}
                            onChange={(e) => setNewTestiRole(e.target.value)}
                            placeholder="Role (e.g., Pet Parent)"
                            className="px-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                          <input
                            type="text"
                            value={newTestiLocality}
                            onChange={(e) => setNewTestiLocality(e.target.value)}
                            placeholder="Locality (e.g., Jakhan)"
                            className="px-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                          <select
                            value={newTestiRating}
                            onChange={(e) => setNewTestiRating(e.target.value)}
                            className="px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                          >
                            <option value="5">5 Stars</option>
                            <option value="4">4 Stars</option>
                            <option value="3">3 Stars</option>
                          </select>
                          <input
                            type="text"
                            value={newTestiQuote}
                            onChange={(e) => setNewTestiQuote(e.target.value)}
                            placeholder="Testimonial quote..."
                            className="sm:col-span-3 px-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newTestiName.trim() || !newTestiQuote.trim()) return;
                              setSettingsDraft({
                                ...settingsDraft,
                                testimonials: [
                                  ...(settingsDraft.testimonials || []),
                                  {
                                    name: newTestiName.trim(),
                                    role: newTestiRole.trim() || 'Dehradun Pet Parent',
                                    locality: newTestiLocality.trim() || 'Dehradun',
                                    quote: newTestiQuote.trim(),
                                    rating: Number(newTestiRating) || 5,
                                  },
                                ],
                              });
                              setNewTestiName('');
                              setNewTestiRole('');
                              setNewTestiLocality('');
                              setNewTestiQuote('');
                            }}
                            className="px-3 py-2 text-xs font-semibold bg-stone-800 text-white rounded-xl cursor-pointer"
                          >
                            Add Testimonial
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
                      >
                        {savingSettings ? 'Publishing...' : 'Publish Content, Policies & Settings'}
                      </button>
                    </form>

                    {/* Promotional Offers */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-violet-700" /> Promotional Offers (
                        {promotions.length})
                      </h2>
                      <div className="flex flex-wrap gap-3">
                        {promotions.map((p) => (
                          <div
                            key={p.promoId}
                            className="border border-stone-200 rounded-xl px-4 py-3 text-xs flex items-center gap-4"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-stone-900">
                                  {p.code} ({p.discountPercent}% off)
                                </p>
                                <span
                                  className={`text-[11px] font-semibold ${
                                    p.isActive ? 'text-teal-700' : 'text-stone-400'
                                  }`}
                                >
                                  {p.isActive ? 'Active' : 'Paused'}
                                </span>
                              </div>
                              <p className="text-stone-500">{p.title}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await adminSavePromotion({ ...p, isActive: !p.isActive }, false);
                                    showToast(
                                      'success',
                                      `${p.code} ${!p.isActive ? 'activated' : 'paused'}.`
                                    );
                                  } catch (err) {
                                    showToast(
                                      'error',
                                      formatAppError(err, 'Could not update promotion.')
                                    );
                                  }
                                }}
                                className="px-2.5 py-1 bg-stone-100 rounded font-semibold cursor-pointer"
                              >
                                {p.isActive ? 'Pause' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await adminDeletePromotion(p.promoId);
                                    showToast('success', `${p.code} removed.`);
                                  } catch (err) {
                                    showToast(
                                      'error',
                                      formatAppError(err, 'Could not remove promotion.')
                                    );
                                  }
                                }}
                                className="text-red-700 hover:underline cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          placeholder="Code (e.g. DGU15)"
                          className="px-3 py-2 text-xs border border-stone-200 rounded-xl"
                        />
                        <input
                          type="text"
                          value={promoTitle}
                          onChange={(e) => setPromoTitle(e.target.value)}
                          placeholder="Offer title"
                          className="px-3 py-2 text-xs border border-stone-200 rounded-xl"
                        />
                        <input
                          type="text"
                          value={promoDesc}
                          onChange={(e) => setPromoDesc(e.target.value)}
                          placeholder="Optional description"
                          className="sm:col-span-2 px-3 py-2 text-xs border border-stone-200 rounded-xl"
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="1"
                            max="90"
                            value={promoDiscount}
                            onChange={(e) => setPromoDiscount(e.target.value)}
                            className="w-20 px-3 py-2 text-xs border border-stone-200 rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (promoCode.trim().length < 3 || promoTitle.trim().length < 3) {
                                showToast(
                                  'error',
                                  'Promo code and offer title must each be at least 3 characters.'
                                );
                                return;
                              }
                              try {
                                await adminSavePromotion(
                                  {
                                    promoId: generateId('promo'),
                                    code: promoCode.trim(),
                                    title: promoTitle.trim(),
                                    description: promoDesc.trim(),
                                    discountPercent: Number(promoDiscount) || 10,
                                    isActive: true,
                                  },
                                  true
                                );
                                setPromoCode('');
                                setPromoTitle('');
                                setPromoDesc('');
                                showToast('success', 'Promotional code created.');
                              } catch (err) {
                                showToast(
                                  'error',
                                  formatAppError(err, 'Could not create promotional code.')
                                );
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-xl cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 8. REVIEWS, SUPPORT TICKETS & CSV REPORTS */}
                {activeTab === 'reports' && (
                  <div className="space-y-6">
                    {/* 6 Downloadable CSV Exports */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <div>
                        <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
                          <Download className="w-5 h-5 text-teal-700" /> Downloadable Business
                          Reports (CSV)
                        </h2>
                        <p className="text-xs text-stone-500">
                          Export live Firestore datasets for Venture Quest audits, payouts, or
                          offline spreadsheets.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          {
                            label: 'Customers CSV',
                            count: `${users.length} records`,
                            fn: exportCustomersCsv,
                          },
                          {
                            label: 'Caregivers CSV',
                            count: `${caregivers.length} records`,
                            fn: exportCaregiversCsv,
                          },
                          {
                            label: 'Bookings CSV',
                            count: `${bookings.length} records`,
                            fn: exportBookingsCsv,
                          },
                          {
                            label: 'Revenue Summary CSV',
                            count: '8 KPI rows',
                            fn: exportRevenueSummaryCsv,
                          },
                          {
                            label: 'Transactions CSV',
                            count: `${transactions.length} records`,
                            fn: exportTransactionsCsv,
                          },
                          {
                            label: 'Reviews CSV',
                            count: `${reviews.length} records`,
                            fn: exportReviewsCsv,
                          },
                        ].map((exp) => (
                          <button
                            key={exp.label}
                            type="button"
                            onClick={exp.fn}
                            className="p-4 border border-stone-200 hover:border-teal-400 rounded-xl flex items-center justify-between text-left bg-stone-50/50 hover:bg-teal-50/40 transition-colors cursor-pointer"
                          >
                            <div>
                              <p className="text-sm font-semibold text-stone-900">{exp.label}</p>
                              <p className="text-xs text-stone-500 font-mono-tabular">
                                {exp.count}
                              </p>
                            </div>
                            <Download className="w-4 h-4 text-teal-700 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Customer Reviews Directory */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
                            <Star className="w-5 h-5 text-amber-500" /> Verified Customer Reviews (
                            {filteredReviews.length})
                          </h2>
                          <p className="text-xs text-stone-500">
                            Positive feedback rate: {metrics.positivePct}% · Repeat intent:{' '}
                            {metrics.repeatPct}%
                          </p>
                        </div>
                        <select
                          value={reviewMinStars}
                          onChange={(e) =>
                            setReviewMinStars(e.target.value as 'all' | '5' | '4' | '3')
                          }
                          className="px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                        >
                          <option value="all">All Ratings</option>
                          <option value="5">5 Stars Only</option>
                          <option value="4">4+ Stars</option>
                          <option value="3">3+ Stars</option>
                        </select>
                      </div>

                      {filteredReviews.length === 0 ? (
                        <p className="text-xs text-stone-500 py-4">No verified reviews yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {filteredReviews.map((r) => {
                            const cgName =
                              caregivers.find((c) => c.caregiverId === r.caregiverId)?.fullName ||
                              r.caregiverId;
                            return (
                              <div
                                key={r.reviewId}
                                className="border border-stone-200 rounded-xl p-4 space-y-1.5 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-stone-900">
                                    {r.customerName} → {cgName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono-tabular font-bold text-amber-600">
                                      ★ {r.rating}/5
                                    </span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await adminDeleteReview(r.reviewId);
                                          showToast('success', 'Review removed by admin.');
                                        } catch (err) {
                                          showToast(
                                            'error',
                                            formatAppError(err, 'Failed to remove review.')
                                          );
                                        }
                                      }}
                                      aria-label={`Delete review ${r.reviewId}`}
                                      className="p-1 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-stone-700 leading-relaxed">{r.comment}</p>
                                <p className="text-[11px] text-stone-400">
                                  Booking: {r.bookingId} · Would book again:{' '}
                                  {r.wouldRepeat ? 'Yes' : 'No'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Support Tickets */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-teal-700" /> Support Tickets (
                          {filteredTickets.length} / {tickets.length})
                        </h2>
                        <select
                          value={ticketStatusFilter}
                          onChange={(e) =>
                            setTicketStatusFilter(
                              e.target.value as 'all' | 'open' | 'in_review' | 'resolved'
                            )
                          }
                          className="px-3 py-2 text-xs border border-stone-200 rounded-xl bg-white"
                        >
                          <option value="all">All Tickets</option>
                          <option value="open">Open</option>
                          <option value="in_review">In Review</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>

                      {filteredTickets.length === 0 ? (
                        <p className="text-sm text-stone-500">
                          No support tickets match the selected filter.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {filteredTickets.map((t) => (
                            <div
                              key={t.ticketId}
                              className="border border-stone-200 rounded-xl p-4 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-stone-900 text-sm">
                                  {t.subject} — {t.name} ({t.email})
                                </p>
                                <span
                                  className={`capitalize font-semibold ${
                                    t.status === 'resolved'
                                      ? 'text-teal-700'
                                      : t.status === 'in_review'
                                      ? 'text-violet-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {t.status.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-stone-600">{t.message}</p>
                              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <input
                                  type="text"
                                  value={ticketReply[t.ticketId] ?? t.adminResponse ?? ''}
                                  onChange={(e) =>
                                    setTicketReply({
                                      ...ticketReply,
                                      [t.ticketId]: e.target.value,
                                    })
                                  }
                                  placeholder="Write admin resolution note..."
                                  className="flex-1 px-3 py-1.5 border border-stone-200 rounded-lg"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await adminResolveTicket(
                                        t.ticketId,
                                        'in_review',
                                        ticketReply[t.ticketId] || 'Under review by PawCare Admin'
                                      );
                                      showToast('success', 'Ticket marked in review.');
                                    } catch (err) {
                                      showToast(
                                        'error',
                                        formatAppError(err, 'Could not update ticket status.')
                                      );
                                    }
                                  }}
                                  className="px-3 py-1.5 font-semibold text-stone-800 bg-stone-100 rounded-lg cursor-pointer"
                                >
                                  In Review
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await adminResolveTicket(
                                        t.ticketId,
                                        'resolved',
                                        ticketReply[t.ticketId] || 'Resolved by PawCare Dehradun Admin'
                                      );
                                      showToast('success', 'Ticket marked resolved.');
                                    } catch (err) {
                                      showToast(
                                        'error',
                                        formatAppError(err, 'Could not resolve ticket.')
                                      );
                                    }
                                  }}
                                  className="px-3 py-1.5 font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                                >
                                  Mark Resolved
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Caregiver Performance Table */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                      <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-violet-700" /> Caregiver
                        Performance Report
                      </h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="border-b border-stone-200 text-stone-500">
                            <tr>
                              <th className="py-2 pr-4">Caregiver</th>
                              <th className="py-2 pr-4">Locality</th>
                              <th className="py-2 pr-4">Status</th>
                              <th className="py-2 pr-4 text-right">Completed Jobs</th>
                              <th className="py-2 text-right">Total Payout (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 font-mono-tabular">
                            {caregivers.map((cg) => {
                              const cgJobs = bookings.filter(
                                (b) => b.caregiverId === cg.caregiverId && b.status === 'completed'
                              );
                              const payout = cgJobs.reduce((sum, b) => sum + b.caregiverPayout, 0);
                              return (
                                <tr key={cg.caregiverId}>
                                  <td className="py-2.5 pr-4 font-sans font-semibold text-stone-900">
                                    {cg.fullName}
                                  </td>
                                  <td className="py-2.5 pr-4 font-sans">{cg.locality}</td>
                                  <td className="py-2.5 pr-4 font-sans capitalize">
                                    {cg.verificationStatus}
                                  </td>
                                  <td className="py-2.5 pr-4 text-right">{cgJobs.length}</td>
                                  <td className="py-2.5 text-right font-semibold text-teal-800">
                                    ₹{payout}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 9. Live Customer & Caregiver Support Inbox */}
                {activeTab === 'messages' && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display text-2xl font-bold text-emerald-950 flex items-center gap-2">
                          <MailOpen className="w-6 h-6 text-emerald-800" /> Live Support Conversations
                        </h2>
                        <p className="text-xs text-stone-500">
                          Two-way real-time messages from verified customers &amp; caregivers using the Message Admin widget.
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 font-mono-tabular">
                        {conversations.filter((c) => c.unreadByAdmin).length} unread threads
                      </span>
                    </div>

                    {conversations.length === 0 ? (
                      <p className="text-sm text-stone-500 py-8 text-center">
                        No live chat threads yet. Incoming customer/caregiver messages appear here automatically.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Left thread list */}
                        <div className="lg:col-span-5 space-y-2 max-h-[520px] overflow-y-auto pr-1">
                          {conversations.map((conv) => {
                            const selected = selectedConvId === conv.conversationId;
                            return (
                              <button
                                key={conv.conversationId}
                                type="button"
                                onClick={() => setSelectedConvId(conv.conversationId)}
                                className={`w-full text-left p-3.5 rounded-2xl border transition-colors cursor-pointer space-y-1 ${
                                  selected
                                    ? 'bg-emerald-900 text-white border-emerald-900'
                                    : conv.unreadByAdmin
                                    ? 'bg-amber-50/70 border-amber-300 hover:bg-amber-50'
                                    : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-sm truncate">
                                    {conv.userName}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                      selected
                                        ? 'bg-white/20 text-white'
                                        : conv.unreadByAdmin
                                        ? 'bg-amber-500 text-emerald-950'
                                        : 'bg-stone-200 text-stone-700'
                                    }`}
                                  >
                                    {conv.unreadByAdmin ? 'New' : conv.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <p
                                  className={`text-[11px] truncate ${
                                    selected ? 'text-emerald-100' : 'text-stone-500'
                                  }`}
                                >
                                  {conv.userRole} · {conv.userEmail}
                                </p>
                                <p
                                  className={`text-xs truncate ${
                                    selected ? 'text-white/90' : 'text-stone-700'
                                  }`}
                                >
                                  {conv.lastMessage}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                        {/* Right selected conversation stream */}
                        <div className="lg:col-span-7 border border-stone-200 rounded-2xl overflow-hidden flex flex-col h-[520px] bg-[#FDFBF7]">
                          {!selectedConvId ? (
                            <div className="flex-1 flex items-center justify-center p-6 text-sm text-stone-500">
                              Select a conversation thread on the left to read and reply live.
                            </div>
                          ) : (
                            <>
                              {(() => {
                                const current = conversations.find(
                                  (c) => c.conversationId === selectedConvId
                                );
                                if (!current) return null;
                                return (
                                  <div className="bg-white border-b border-stone-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="font-bold text-sm text-stone-900 truncate">
                                        {current.userName} · {current.subject}
                                      </p>
                                      <p className="text-[11px] text-stone-500 truncate">
                                        {current.userEmail} ({current.userRole})
                                      </p>
                                    </div>
                                    <select
                                      value={current.status}
                                      onChange={async (e) => {
                                        const nextStatus = e.target.value as
                                          | 'open'
                                          | 'in_review'
                                          | 'resolved';
                                        try {
                                          await updateConversationStatusAdmin(
                                            current.conversationId,
                                            nextStatus
                                          );
                                          await logAdminAction({
                                            action: 'conversation_status',
                                            targetType: 'conversation',
                                            targetId: current.conversationId,
                                            details: `Marked status ${nextStatus} for ${current.userEmail}`,
                                          });
                                          showToast('success', `Thread marked ${nextStatus}.`);
                                        } catch (err) {
                                          showToast(
                                            'error',
                                            formatAppError(err, 'Could not update thread status.')
                                          );
                                        }
                                      }}
                                      className="px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-xl bg-stone-50"
                                    >
                                      <option value="open">Open</option>
                                      <option value="in_review">In Review</option>
                                      <option value="resolved">Resolved</option>
                                    </select>
                                  </div>
                                );
                              })()}

                              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {convMessages.map((m) => {
                                  const isAdmin = m.senderRole === 'admin';
                                  return (
                                    <div
                                      key={m.messageId}
                                      className={`flex flex-col ${
                                        isAdmin ? 'items-end' : 'items-start'
                                      }`}
                                    >
                                      <span className="text-[10px] text-stone-400 mb-0.5 px-1">
                                        {m.senderName} ({isAdmin ? 'Admin' : 'Member'})
                                      </span>
                                      <div
                                        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                                          isAdmin
                                            ? 'bg-emerald-900 text-white rounded-br-sm'
                                            : 'bg-white border border-stone-200 text-stone-900 rounded-bl-sm'
                                        }`}
                                      >
                                        {m.text}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  if (!firebaseUser || !selectedConvId || !convReplyText.trim()) return;
                                  setSendingConvReply(true);
                                  try {
                                    await replyConversationAsAdmin({
                                      conversationId: selectedConvId,
                                      adminUid: firebaseUser.uid,
                                      adminName:
                                        userProfile?.displayName ||
                                        firebaseUser.displayName ||
                                        'PawCare Admin',
                                      text: convReplyText.trim(),
                                      nextStatus: 'in_review',
                                    });
                                    await logAdminAction({
                                      action: 'conversation_reply',
                                      targetType: 'conversation',
                                      targetId: selectedConvId,
                                      details: convReplyText.trim().slice(0, 120),
                                    });
                                    setConvReplyText('');
                                  } catch (err) {
                                    showToast(
                                      'error',
                                      formatAppError(err, 'Failed to send reply.')
                                    );
                                  } finally {
                                    setSendingConvReply(false);
                                  }
                                }}
                                className="p-3 bg-white border-t border-stone-200 flex items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={convReplyText}
                                  onChange={(e) => setConvReplyText(e.target.value)}
                                  placeholder="Reply directly to user..."
                                  maxLength={800}
                                  className="flex-1 px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                                />
                                <button
                                  type="submit"
                                  disabled={sendingConvReply || !convReplyText.trim()}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                                >
                                  <Send className="w-3.5 h-3.5" /> Reply
                                </button>
                              </form>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 10. Immutable Admin Audit Logs */}
                {activeTab === 'audit' && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display text-2xl font-bold text-emerald-950 flex items-center gap-2">
                          <ClipboardList className="w-6 h-6 text-emerald-800" /> Admin Audit Logs
                        </h2>
                        <p className="text-xs text-stone-500">
                          Immutable trail of caregiver verifications, catalog edits, admin access updates, and support actions.
                        </p>
                      </div>
                      <input
                        type="text"
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        placeholder="Filter by action, admin email, or target..."
                        className="px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50 w-full sm:w-72"
                      />
                    </div>

                    {auditLogs.length === 0 ? (
                      <p className="text-sm text-stone-500 py-8 text-center">
                        No audit records recorded yet.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-stone-200 text-stone-500">
                            <tr>
                              <th className="py-2 pr-4">When</th>
                              <th className="py-2 pr-4">Admin</th>
                              <th className="py-2 pr-4">Action</th>
                              <th className="py-2 pr-4">Target</th>
                              <th className="py-2">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {auditLogs
                              .filter((l) => {
                                const q = auditSearch.trim().toLowerCase();
                                if (!q) return true;
                                return (
                                  l.action.toLowerCase().includes(q) ||
                                  l.actorEmail.toLowerCase().includes(q) ||
                                  l.targetType.toLowerCase().includes(q) ||
                                  l.details.toLowerCase().includes(q)
                                );
                              })
                              .slice(0, 80)
                              .map((log) => {
                                const ms = toMillis(log.createdAt);
                                const stamp = ms
                                  ? new Date(ms).toLocaleString('en-IN', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })
                                  : 'Just now';
                                return (
                                  <tr key={log.logId}>
                                    <td className="py-2.5 pr-4 whitespace-nowrap text-stone-500 font-mono-tabular">
                                      {stamp}
                                    </td>
                                    <td className="py-2.5 pr-4 font-medium text-stone-800">
                                      {log.actorEmail}
                                    </td>
                                    <td className="py-2.5 pr-4">
                                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 font-semibold">
                                        {log.action}
                                      </span>
                                    </td>
                                    <td className="py-2.5 pr-4 font-mono-tabular text-stone-600">
                                      {log.targetType}:{log.targetId.slice(0, 14)}
                                    </td>
                                    <td className="py-2.5 text-stone-700">{log.details}</td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Customer Profile Detail Modal */}
      <AnimatePresence>
        {viewingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white border border-stone-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
                    <ImageWithFallback
                      src={viewingUser.photoUrl}
                      alt={viewingUser.displayName}
                      fallbackLabel={viewingUser.displayName}
                      variant="avatar"
                      seed={viewingUser.uid}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-bold text-stone-900 truncate">
                      {viewingUser.displayName}
                    </h3>
                    <p className="text-xs text-stone-500 truncate">
                      {viewingUser.email} · {viewingUser.role} · {viewingUser.accountStatus}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingUser(null)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-stone-50 rounded-xl p-4 text-xs text-stone-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <p>
                  <strong>Phone:</strong> {viewingUser.phone || 'Not provided'}
                </p>
                <p>
                  <strong>Locality:</strong> {viewingUser.locality || 'Not provided'}
                </p>
                <p className="sm:col-span-2">
                  <strong>Address:</strong> {viewingUser.address || 'Not provided'}
                </p>
                <p className="sm:col-span-2">
                  <strong>Emergency Contact:</strong>{' '}
                  {viewingUser.emergencyContactName
                    ? `${viewingUser.emergencyContactName} (${viewingUser.emergencyContactPhone || 'N/A'})`
                    : 'Not provided'}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-display text-sm font-bold text-stone-900">
                  Registered Pets ({pets.filter((p) => p.ownerId === viewingUser.uid).length})
                </h4>
                {pets.filter((p) => p.ownerId === viewingUser.uid).length === 0 ? (
                  <p className="text-xs text-stone-500">No pets added by this customer.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pets
                      .filter((p) => p.ownerId === viewingUser.uid)
                      .map((p) => (
                        <div
                          key={p.petId}
                          className="border border-stone-200 rounded-xl p-3 text-xs flex items-start gap-3"
                        >
                          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                            <ImageWithFallback
                              src={resolvePetImage(p)}
                              alt={`${p.name} (${p.petType})`}
                              fallbackLabel={p.petType}
                              variant="pet"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-900">
                              {p.name} ({p.petType} · {p.breed})
                            </p>
                            <p className="text-stone-500">
                              {p.ageYears} yrs · {p.gender}
                            </p>
                            {p.healthInfo && (
                              <p className="text-stone-600 mt-1">Health: {p.healthInfo}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-display text-sm font-bold text-stone-900">
                  Booking History ({bookings.filter((b) => b.customerId === viewingUser.uid).length}
                  )
                </h4>
                {bookings.filter((b) => b.customerId === viewingUser.uid).length === 0 ? (
                  <p className="text-xs text-stone-500">No bookings placed by this customer.</p>
                ) : (
                  <div className="space-y-2">
                    {bookings
                      .filter((b) => b.customerId === viewingUser.uid)
                      .map((b) => (
                        <div
                          key={b.bookingId}
                          className="border border-stone-200 rounded-xl p-3 text-xs flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-semibold text-stone-900">
                              {b.serviceTitle} for {b.petName}
                            </p>
                            <p className="text-stone-500">
                              {b.bookingDate} ({b.timeSlot}) · Caregiver: {b.caregiverName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono-tabular font-semibold">₹{b.grossAmount}</p>
                            <p className="capitalize text-stone-500">{b.status}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pet Full Care Profile Modal */}
      <AnimatePresence>
        {viewingPet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 ring-1 ring-stone-200">
                    <ImageWithFallback
                      src={resolvePetImage(viewingPet)}
                      alt={viewingPet.name}
                      fallbackLabel={viewingPet.petType}
                      variant="pet"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-bold text-stone-900 truncate">
                      {viewingPet.name}
                    </h3>
                    <p className="text-xs text-stone-500">
                      {viewingPet.petType} · {viewingPet.breed} · {viewingPet.ageYears} yrs ·{' '}
                      {viewingPet.gender}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingPet(null)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="bg-stone-50 rounded-xl p-4 text-xs text-stone-700 space-y-2">
                <p>
                  <strong>Feeding Instructions:</strong>{' '}
                  {viewingPet.feedingInstructions || 'Standard schedule'}
                </p>
                <p>
                  <strong>Health & Vaccinations:</strong> {viewingPet.healthInfo || 'None noted'}
                </p>
                <p>
                  <strong>Behavior & Temperament:</strong>{' '}
                  {viewingPet.behavioralInfo || 'Friendly'}
                </p>
                <p>
                  <strong>Special Care Notes:</strong> {viewingPet.specialCare || 'None noted'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Caregiver Verification Modal */}
      <AnimatePresence>
        {reviewingCg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 ring-1 ring-stone-200">
                    <ImageWithFallback
                      src={reviewingCg.photoUrl}
                      alt={reviewingCg.fullName}
                      fallbackLabel={reviewingCg.fullName}
                      variant="avatar"
                      seed={reviewingCg.caregiverId}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="font-display text-xl font-bold text-stone-900 truncate">
                    Verify {reviewingCg.fullName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewingCg(null)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="text-xs text-stone-600 space-y-1 bg-stone-50 p-3.5 rounded-xl">
                <p>
                  <strong>Locality:</strong> {reviewingCg.locality} · {reviewingCg.address}
                </p>
                <p>
                  <strong>ID Proof:</strong> {reviewingCg.idDocType} — {reviewingCg.idDocNumber}
                </p>
                <p>
                  <strong>Experience:</strong> {reviewingCg.experienceYears} years
                </p>
                <p>
                  <strong>Skills:</strong> {reviewingCg.skills.join(', ')}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Admin Verification Notes
                </label>
                <textarea
                  rows={3}
                  value={cgAdminNotes}
                  onChange={(e) => setCgAdminNotes(e.target.value)}
                  placeholder="ID verified against registration details..."
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await adminUpdateCaregiverVerification(
                        reviewingCg,
                        'rejected',
                        'active',
                        cgAdminNotes || 'Documents incomplete.'
                      );
                      await logAdminAction({
                        action: 'caregiver_reject',
                        targetType: 'caregiver',
                        targetId: reviewingCg.caregiverId,
                        details: `Rejected ${reviewingCg.fullName}: ${cgAdminNotes || 'Documents incomplete.'}`,
                      });
                      setReviewingCg(null);
                      showToast('success', `${reviewingCg.fullName} marked rejected.`);
                    } catch (err) {
                      showToast('error', formatAppError(err, 'Could not reject caregiver.'));
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 rounded-xl cursor-pointer"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await adminUpdateCaregiverVerification(
                        reviewingCg,
                        reviewingCg.verificationStatus,
                        'suspended',
                        cgAdminNotes || 'Account suspended by admin.'
                      );
                      await logAdminAction({
                        action: 'caregiver_suspend',
                        targetType: 'caregiver',
                        targetId: reviewingCg.caregiverId,
                        details: `Suspended ${reviewingCg.fullName}`,
                      });
                      setReviewingCg(null);
                      showToast('success', `${reviewingCg.fullName} suspended.`);
                    } catch (err) {
                      showToast('error', formatAppError(err, 'Could not suspend caregiver.'));
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 rounded-xl cursor-pointer"
                >
                  Suspend
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await adminUpdateCaregiverVerification(
                        reviewingCg,
                        'verified',
                        'active',
                        cgAdminNotes || 'Verified by PawCare Dehradun Admin.'
                      );
                      await logAdminAction({
                        action: 'caregiver_verify',
                        targetType: 'caregiver',
                        targetId: reviewingCg.caregiverId,
                        details: `Verified and published ${reviewingCg.fullName} (${reviewingCg.locality})`,
                      });
                      setReviewingCg(null);
                      showToast(
                        'success',
                        `${reviewingCg.fullName} approved and published to directory.`
                      );
                    } catch (err) {
                      showToast(
                        'error',
                        formatAppError(err, 'Could not approve and publish caregiver.')
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve & Publish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BookingReceiptModal
        booking={inspectBooking}
        payment={
          inspectBooking
            ? payments.find((p) => p.bookingId === inspectBooking.bookingId)
            : undefined
        }
        viewerRole="admin"
        onClose={() => setInspectBooking(null)}
      />
    </div>
  );
}
