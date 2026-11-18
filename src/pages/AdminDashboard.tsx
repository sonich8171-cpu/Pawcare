import {
  Activity,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
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
import {
  adminDeletePromotion,
  adminDeleteService,
  adminResolveBookingDispute,
  adminResolveTicket,
  adminSavePlatformSettings,
  adminSavePromotion,
  adminSaveService,
  adminUpdateCaregiverVerification,
  adminUpdatePaymentStatus,
  adminUpdateUserStatus,
  generateId,
  subscribeAllBookingsAdmin,
  subscribeAllCaregiversAdmin,
  subscribeAllPaymentsAdmin,
  subscribeAllPetsAdmin,
  subscribeAllPromotionsAdmin,
  subscribeAllServicesAdmin,
  subscribeAllTicketsAdmin,
  subscribeAllTransactionsAdmin,
  subscribeAllUsersAdmin,
  updateBookingStatus,
} from '../services/firestoreService';
import type {
  BookingRecord,
  BookingStatus,
  CaregiverPrivateProfile,
  PaymentRecord,
  PaymentStatus,
  PetProfile,
  PlatformSettings,
  PromotionOffer,
  ServiceItem,
  SupportTicket,
  TransactionRecord,
  UserProfile,
} from '../types/pawcare';

type AdminTab =
  | 'overview'
  | 'users'
  | 'caregivers'
  | 'bookings'
  | 'financials'
  | 'content'
  | 'reports';

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

export function AdminDashboard() {
  const { firebaseUser, logout } = useAuth();
  const { platformSettings, reviews } = usePublicData();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [caregivers, setCaregivers] = useState<CaregiverPrivateProfile[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [adminServices, setAdminServices] = useState<ServiceItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [promotions, setPromotions] = useState<PromotionOffer[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'customer' | 'caregiver' | 'admin'>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [cgSearch, setCgSearch] = useState('');
  const [cgStatusFilter, setCgStatusFilter] = useState<
    'all' | 'pending' | 'verified' | 'rejected' | 'suspended'
  >('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [bookingDisputeFilter, setBookingDisputeFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // Modals
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [reviewingCg, setReviewingCg] = useState<CaregiverPrivateProfile | null>(null);
  const [cgAdminNotes, setCgAdminNotes] = useState('');

  // Editable Settings state
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(platformSettings);
  const [newLocality, setNewLocality] = useState('');
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');
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
  const [promoDiscount, setPromoDiscount] = useState('10');

  // Ticket response state
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({});

  useEffect(() => {
    setSettingsDraft(platformSettings);
  }, [platformSettings]);

  useEffect(() => {
    const unsubs = [
      subscribeAllUsersAdmin(setUsers),
      subscribeAllPetsAdmin(setPets),
      subscribeAllCaregiversAdmin(setCaregivers),
      subscribeAllBookingsAdmin(setBookings),
      subscribeAllPaymentsAdmin(setPayments),
      subscribeAllTransactionsAdmin(setTransactions),
      subscribeAllServicesAdmin(setAdminServices),
      subscribeAllTicketsAdmin(setTickets),
      subscribeAllPromotionsAdmin(setPromotions),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

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

    const verifiedCaregivers = caregivers.filter((c) => c.verificationStatus === 'verified');
    const pendingApps = caregivers.filter((c) => c.verificationStatus === 'pending');
    const activeBookingsList = bookings.filter((b) =>
      ['pending', 'accepted', 'confirmed', 'in_progress'].includes(b.status)
    );
    const completedBookings = bookings.filter((b) => b.status === 'completed');
    const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');
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
      customerGrowth30d,
      totalCaregivers: caregivers.length,
      verifiedCaregivers: verifiedCaregivers.length,
      pendingApps: pendingApps.length,
      totalBookings: bookings.length,
      activeBookings: activeBookingsList.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookings.length,
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
  }, [users, caregivers, bookings, reviews, settingsDraft.monthlyFixedCost]);

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

  const filteredBookings = bookings.filter((b) => {
    const q = bookingSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.bookingId.toLowerCase().includes(q) ||
      b.customerName.toLowerCase().includes(q) ||
      b.caregiverName.toLowerCase().includes(q) ||
      b.petName.toLowerCase().includes(q) ||
      b.locality.toLowerCase().includes(q);
    const matchesStatus = bookingStatusFilter === 'all' || b.status === bookingStatusFilter;
    const matchesDispute =
      bookingDisputeFilter === 'all' || b.disputeStatus === bookingDisputeFilter;
    return matchesSearch && matchesStatus && matchesDispute;
  });

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

    await adminSaveService(
      {
        serviceId,
        slug: serviceId,
        title: svcTitle,
        description: svcDesc,
        durationLabel: svcDuration,
        basePrice: gross,
        providerPayout: payout,
        platformCommission: commission,
        isActive: svcActive,
        imageUrl: svcImageUrl.trim() || editingService?.imageUrl,
      },
      isNew
    );
    setEditingService(null);
    setSvcTitle('');
    setSvcDesc('');
    setSvcDuration('');
    setSvcImageUrl('');
    showToast('success', 'Service saved to Firestore.');
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await adminSavePlatformSettings(settingsDraft);
      showToast('success', 'Platform settings updated.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const navItems: { id: AdminTab; label: string; icon: typeof LayoutDashboard; badge?: number }[] =
    [
      { id: 'overview', label: 'Overview & Venture', icon: LayoutDashboard },
      { id: 'users', label: 'Customers & Users', icon: Users, badge: users.length },
      {
        id: 'caregivers',
        label: 'Caregivers',
        icon: ShieldCheck,
        badge: metrics.pendingApps,
      },
      { id: 'bookings', label: 'Bookings & Disputes', icon: Calendar, badge: bookings.length },
      { id: 'financials', label: 'Financials & Analytics', icon: IndianRupee },
      { id: 'content', label: 'Services & Settings', icon: BookOpen },
      {
        id: 'reports',
        label: 'Reports & Tickets',
        icon: BarChart3,
        badge: tickets.filter((t) => t.status !== 'resolved').length,
      },
    ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {toast && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center justify-between ${
            toast.type === 'success'
              ? 'bg-teal-50 border-teal-200 text-teal-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-violet-700">
            Owner Dashboard · {platformSettings.platformName || 'PawCare'}
          </p>
          <h1 className="font-display text-3xl font-extrabold text-stone-900">
            Owner Operations & Venture Control
          </h1>
          {firebaseUser?.email && (
            <p className="text-xs text-stone-500 mt-1">
              Signed in as Owner: <span className="font-medium text-stone-700">{firebaseUser.email}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={exportBookingsCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-50 rounded-xl cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" /> Export Bookings CSV
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Horizontal Admin Tab Bar */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-stone-100 rounded-2xl">
        {navItems.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="font-mono-tabular text-[11px] text-teal-700">{tab.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 1. Overview & Venture Metrics */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Registered Users', value: metrics.totalUsers },
              { label: 'Customer Growth (30d)', value: `+${metrics.customerGrowth30d}` },
              { label: 'Verified Caregivers', value: `${metrics.verifiedCaregivers}/${metrics.totalCaregivers}` },
              { label: 'Pending Caregiver Apps', value: metrics.pendingApps },
              { label: 'Active Bookings', value: metrics.activeBookings },
              { label: 'Total / Completed', value: `${metrics.totalBookings} / ${metrics.completedBookings}` },
              { label: 'Monthly Revenue (Comm.)', value: `₹${metrics.monthlyRevenue}` },
              { label: 'Total Gross Value', value: `₹${metrics.grossBookingValue}` },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-white border border-stone-200 rounded-2xl p-4 space-y-1"
              >
                <p className="text-xs text-stone-500">{kpi.label}</p>
                <p className="font-display text-xl font-bold text-stone-900 font-mono-tabular">
                  {kpi.value}
                </p>
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
                Venture Quest Phase-1 benchmarks tracked separately from real Firestore activity.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Interested / Registered Users',
                  target: `${MVP_TARGET_METRICS.interestedUsersTarget} users`,
                  actual: `${metrics.totalUsers} users`,
                  pct: Math.min(
                    100,
                    Math.round((metrics.totalUsers / MVP_TARGET_METRICS.interestedUsersTarget) * 100)
                  ),
                },
                {
                  label: 'Paid / Verified Bookings',
                  target: `${MVP_TARGET_METRICS.paidBookingsTarget} bookings`,
                  actual: `${metrics.paidOrVerifiedCount} paid/verified (${metrics.totalBookings} total)`,
                  pct: Math.min(
                    100,
                    Math.round(
                      (metrics.paidOrVerifiedCount / MVP_TARGET_METRICS.paidBookingsTarget) * 100
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
                  label: 'Repeat / Referral Interest',
                  target: `${MVP_TARGET_METRICS.repeatInterestTargetPct}% target`,
                  actual:
                    reviews.length > 0 ? `${metrics.repeatPct}% would repeat` : '0 responses yet',
                  pct: metrics.repeatPct,
                },
              ].map((card) => (
                <div key={card.label} className="border border-stone-200 rounded-xl p-4 space-y-2.5">
                  <p className="text-xs font-semibold text-stone-800">{card.label}</p>
                  <div className="text-xs space-y-0.5">
                    <p className="text-stone-500">Target: {card.target}</p>
                    <p className="font-mono-tabular font-bold text-teal-800">
                      Actual: {card.actual}
                    </p>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 rounded-full"
                      style={{ width: `${card.pct}%` }}
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
                  Note: Scenario columns reflect initial planning assumptions (₹500 booking / ₹300
                  payout / ₹200 contribution / ₹5,000 fixed cost), not verified market prices.
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
                    <Bar dataKey="GrossValue" name="Gross Booking Value (₹)" fill="#0D9488" />
                    <Bar
                      dataKey="PlatformContribution"
                      name="Platform Contribution (₹)"
                      fill="#6D28D9"
                    />
                    <Bar dataKey="CaregiverPayout" name="Caregiver Payout (₹)" fill="#78716C" />
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
        </div>
      )}

      {/* 2. Customer & User Management */}
      {activeTab === 'users' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900">
                Customers & Registered Accounts ({filteredUsers.length} / {users.length})
              </h2>
              <p className="text-xs text-stone-500">
                Inspect customer profiles, registered pets, booking history, or suspend/reactivate accounts.
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
                  setUserRoleFilter(e.target.value as 'all' | 'customer' | 'caregiver' | 'admin')
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
                  setUserStatusFilter(e.target.value as 'all' | 'active' | 'suspended')
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
                  <th className="py-2.5 pr-4">Name</th>
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
                  return (
                    <tr key={u.uid}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-stone-900">{u.displayName}</p>
                        <p className="text-[11px] text-stone-400 capitalize">{u.role}</p>
                      </td>
                      <td className="py-3 pr-4 text-stone-600">
                        <p>{u.email}</p>
                        {u.phone && <p className="text-[11px] text-stone-400">{u.phone}</p>}
                      </td>
                      <td className="py-3 pr-4 text-stone-600">{u.locality || '—'}</td>
                      <td className="py-3 pr-4 font-mono-tabular">{userPets.length}</td>
                      <td className="py-3 pr-4 font-mono-tabular">{userBookings.length}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`capitalize font-semibold px-2 py-0.5 rounded ${
                            u.accountStatus === 'active'
                              ? 'bg-teal-50 text-teal-800'
                              : 'bg-red-50 text-red-700'
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
                        <button
                          type="button"
                          onClick={async () => {
                            const next = u.accountStatus === 'active' ? 'suspended' : 'active';
                            await adminUpdateUserStatus(u.uid, next);
                            showToast('success', `${u.displayName} is now ${next}.`);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                            u.accountStatus === 'active'
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                          }`}
                        >
                          {u.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Caregiver Management & Verification */}
      {activeTab === 'caregivers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-stone-900">
              Caregiver Management & Verification ({filteredCaregivers.length} / {caregivers.length})
            </h2>
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
                    e.target.value as 'all' | 'pending' | 'verified' | 'rejected' | 'suspended'
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
                    ? (cgReviews.reduce((s, r) => s + r.rating, 0) / cgReviews.length).toFixed(1)
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
                      <div className="flex items-center gap-1.5">
                        {cg.accountStatus === 'suspended' && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700">
                            Suspended
                          </span>
                        )}
                        <span
                          className={`text-xs font-semibold capitalize px-2.5 py-1 rounded-lg ${
                            cg.verificationStatus === 'verified'
                              ? 'bg-teal-50 text-teal-800'
                              : cg.verificationStatus === 'rejected'
                              ? 'bg-red-50 text-red-800'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {cg.verificationStatus}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-stone-600 space-y-1 bg-stone-50 p-3 rounded-xl">
                      <p>
                        <span className="font-semibold">Address:</span> {cg.address}
                      </p>
                      <p>
                        <span className="font-semibold">Experience & Rating:</span>{' '}
                        {cg.experienceYears} yrs · ★ {avgRating} ({cgReviews.length} reviews) ·{' '}
                        {completedCount} completed jobs
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
                        <span className="font-semibold">ID Document:</span> {cg.idDocType} —{' '}
                        {cg.idDocNumber}
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
                            await adminUpdateCaregiverVerification(
                              cg,
                              cg.verificationStatus,
                              'active',
                              cg.adminNotes || 'Account reactivated by admin.'
                            );
                            showToast('success', `${cg.fullName} reactivated.`);
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await adminUpdateCaregiverVerification(
                              cg,
                              cg.verificationStatus,
                              'suspended',
                              cg.adminNotes || 'Account suspended by admin.'
                            );
                            showToast('success', `${cg.fullName} suspended.`);
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

      {/* 4. Bookings & Disputes */}
      {activeTab === 'bookings' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-stone-900">
              All Bookings & Disputes ({filteredBookings.length} / {bookings.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                placeholder="Search ID, customer, caregiver, pet..."
                className="px-3 py-2 text-xs border border-stone-200 rounded-xl"
              />
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
            </div>
          </div>

          <div className="space-y-3">
            {filteredBookings.map((b) => {
              const paymentRec = payments.find((p) => p.bookingId === b.bookingId);
              return (
                <div
                  key={b.bookingId}
                  className="border border-stone-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-stone-900 text-sm">
                      {b.serviceTitle} · {b.petName}
                      {b.petType ? ` (${b.petType}${b.petBreed ? ` / ${b.petBreed}` : ''})` : ''} ·{' '}
                      {b.bookingDate} ({b.timeSlot})
                    </p>
                    <p className="text-stone-600">
                      Customer: <strong>{b.customerName}</strong>
                      {b.customerPhone ? ` (${b.customerPhone})` : ''} → Caregiver:{' '}
                      <strong>{b.caregiverName}</strong> · {b.locality}
                    </p>
                    <p className="text-stone-500">Address: {b.serviceAddress}</p>
                    {(b.petInstructions || b.specialInstructions) && (
                      <p className="text-stone-500">
                        Care Notes: {[b.petInstructions, b.specialInstructions].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="font-mono-tabular text-stone-500">
                      Gross: ₹{b.grossAmount} · Payout: ₹{b.caregiverPayout} · Commission: ₹
                      {b.platformCommission} · Payment: {b.paymentMethod} ({b.paymentStatus})
                    </p>
                    {b.disputeStatus !== 'none' && (
                      <p className="text-amber-800 font-semibold">
                        Dispute ({b.disputeStatus}): {b.disputeNotes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      aria-label={`Booking status for ${b.bookingId}`}
                      value={b.status}
                      onChange={async (e) => {
                        await updateBookingStatus({
                          booking: b,
                          nextStatus: e.target.value as BookingStatus,
                          actorRole: 'admin',
                        });
                        showToast('success', `Booking ${b.bookingId} updated.`);
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
                          await adminUpdatePaymentStatus(
                            paymentRec,
                            e.target.value as PaymentStatus
                          );
                          showToast('success', `Payment status updated.`);
                        }}
                        className="px-2.5 py-1.5 border border-stone-200 rounded-lg font-medium bg-stone-50"
                      >
                        {(
                          ['pending', 'test_verified', 'paid', 'refund_pending', 'refunded'] as PaymentStatus[]
                        ).map((pst) => (
                          <option key={pst} value={pst}>
                            Pay: {pst}
                          </option>
                        ))}
                      </select>
                    )}

                    {b.disputeStatus === 'open' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await adminResolveBookingDispute(
                            b.bookingId,
                            'resolved',
                            `${b.disputeNotes || ''} [Resolved by Admin]`
                          );
                          showToast('success', 'Booking dispute marked resolved.');
                        }}
                        className="px-3 py-1.5 font-semibold text-white bg-amber-700 rounded-lg cursor-pointer"
                      >
                        Resolve Dispute
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Financials, Commission & Live Analytics */}
      {activeTab === 'financials' && (
        <div className="space-y-6">
          {/* Revenue Timeframes & Separation */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Gross Booking Value', value: `₹${metrics.grossBookingValue}`, accent: 'text-stone-900' },
              { label: 'Caregiver Payouts', value: `₹${metrics.caregiverPayoutTotal}`, accent: 'text-teal-800' },
              { label: 'Weekly Commission', value: `₹${metrics.weeklyRevenue}`, accent: 'text-violet-700' },
              { label: 'Monthly Commission', value: `₹${metrics.monthlyRevenue}`, accent: 'text-violet-700' },
              { label: 'Yearly Commission', value: `₹${metrics.yearlyRevenue}`, accent: 'text-violet-700' },
              {
                label: 'Net Platform Revenue',
                value: `₹${metrics.netPlatformRevenue}`,
                accent: metrics.netPlatformRevenue >= 0 ? 'text-teal-800' : 'text-red-700',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white border border-stone-200 rounded-2xl p-4 space-y-1"
              >
                <p className="text-[11px] text-stone-500">{card.label}</p>
                <p className={`font-display text-lg font-bold font-mono-tabular ${card.accent}`}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Pricing & Commission Configuration */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-stone-900">
              Pricing & Commission Model Configuration
            </h2>
            <p className="text-xs text-stone-500">
              Venture plan defaults (₹500 booking / ₹300 provider cost / ₹5,000 fixed cost) are
              initial planning assumptions. Configure fixed margin or percentage split anytime.
            </p>
            <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  Save Financial Settings
                </button>
              </div>
            </form>
          </div>

          {/* Live Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-stone-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-700" /> Revenue & Booking Growth Trends
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
                <Users className="w-4 h-4 text-violet-700" /> Customer Registration Growth
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
                      <Bar dataKey="NewUsers" name="New Accounts" fill="#6D28D9" />
                      <Bar dataKey="TotalUsers" name="Cumulative Accounts" fill="#0D9488" />
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
                      <Bar dataKey="Bookings" name="Bookings" fill="#0D9488" />
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
                      <Bar dataKey="CompletedSessions" name="Completed Sessions" fill="#6D28D9" />
                      <Bar dataKey="PayoutINR" name="Payout (₹)" fill="#0D9488" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-stone-900">
              Payment Tracking & Transaction Ledger ({payments.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-stone-200 text-stone-500">
                  <tr>
                    <th className="py-2 pr-4">Payment ID</th>
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
                      <td className="py-2.5 pr-4 text-right text-teal-700">₹{p.caregiverPayout}</td>
                      <td className="py-2.5 pr-4 font-sans capitalize font-semibold">
                        {p.status}
                      </td>
                      <td className="py-2.5 text-right font-sans">
                        <select
                          value={p.status}
                          onChange={async (e) => {
                            await adminUpdatePaymentStatus(p, e.target.value as PaymentStatus);
                            showToast('success', `Payment ${p.paymentId} updated.`);
                          }}
                          className="px-2 py-1 border border-stone-200 rounded-lg bg-white"
                        >
                          {(
                            ['pending', 'test_verified', 'paid', 'refund_pending', 'refunded'] as PaymentStatus[]
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
            <p className="text-xs text-stone-400">
              Recorded ledger transactions: {transactions.length}
            </p>
          </div>
        </div>
      )}

      {/* 6. Services, Policies, FAQs, Localities & Promos */}
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
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-stone-900 text-sm truncate">{s.title}</p>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                            s.isActive
                              ? 'bg-teal-50 text-teal-800'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {s.isActive ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-stone-500 mt-0.5">
                        ₹{s.basePrice} gross (₹{s.providerPayout} payout / ₹{s.platformCommission} fee)
                        · {s.durationLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await adminSaveService({ ...s, isActive: !s.isActive }, false);
                        showToast(
                          'success',
                          `${s.title} ${!s.isActive ? 'enabled' : 'disabled'}.`
                        );
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
                          s.imageUrl && (s.imageUrl.startsWith('http://') || s.imageUrl.startsWith('https://'))
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
                      onClick={() => adminDeleteService(s.serviceId)}
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
                value={svcTitle}
                onChange={(e) => setSvcTitle(e.target.value)}
                placeholder="Service Title"
                className="px-3 py-2 text-sm border border-stone-200 rounded-xl"
              />
              <input
                type="text"
                required
                value={svcDuration}
                onChange={(e) => setSvcDuration(e.target.value)}
                placeholder="Duration (e.g., 60 mins)"
                className="px-3 py-2 text-sm border border-stone-200 rounded-xl"
              />
              <input
                type="number"
                required
                value={svcPrice}
                onChange={(e) => handleServicePriceChange(e.target.value)}
                placeholder="Gross Price (₹)"
                className="px-3 py-2 text-sm border border-stone-200 rounded-xl"
              />
              <input
                type="number"
                required
                value={svcPayout}
                onChange={(e) => setSvcPayout(e.target.value)}
                placeholder="Caregiver Payout (₹)"
                className="px-3 py-2 text-sm border border-stone-200 rounded-xl"
              />
              <textarea
                rows={2}
                required
                value={svcDesc}
                onChange={(e) => setSvcDesc(e.target.value)}
                placeholder="Service description..."
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
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-xl cursor-pointer"
                  >
                    {editingService ? 'Update Service' : 'Add Service'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Platform Settings: Branding, Policies, Localities & FAQs */}
          <form
            onSubmit={handleSaveSettings}
            className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5"
          >
            <h2 className="font-display text-xl font-bold text-stone-900">
              Platform Identity, Policies, Dehradun Areas & FAQs
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
                  Admin WhatsApp Number (with country code)
                </label>
                <input
                  type="text"
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
                  setSettingsDraft({ ...settingsDraft, heroBannerNotice: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Booking Policy (Displayed on Legal & Policies Page)
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
                  Cancellation Policy (Displayed on Legal & Policies Page)
                </label>
                <textarea
                  rows={3}
                  maxLength={1200}
                  value={settingsDraft.cancellationPolicy || ''}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, cancellationPolicy: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700">
                Configurable Dehradun Localities
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

            {/* Interactive FAQs Editor */}
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

            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
            >
              {savingSettings ? 'Saving...' : 'Save Content, Policies & Settings'}
            </button>
          </form>

          {/* Promotional Offers */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-violet-700" /> Promotional Offers
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
                        className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                          p.isActive
                            ? 'bg-teal-50 text-teal-800'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-stone-500">{p.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await adminSavePromotion({ ...p, isActive: !p.isActive }, false);
                        showToast('success', `${p.code} ${!p.isActive ? 'activated' : 'paused'}.`);
                      }}
                      className="px-2 py-1 bg-stone-100 rounded font-semibold cursor-pointer"
                    >
                      {p.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => adminDeletePromotion(p.promoId)}
                      className="text-red-700 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
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
                    if (promoCode.trim().length < 3 || promoTitle.trim().length < 3) return;
                    await adminSavePromotion(
                      {
                        promoId: generateId('promo'),
                        code: promoCode,
                        title: promoTitle,
                        discountPercent: Number(promoDiscount) || 10,
                        isActive: true,
                      },
                      true
                    );
                    setPromoCode('');
                    setPromoTitle('');
                    showToast('success', 'Promotional code created.');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-violet-700 rounded-xl cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Reports, CSV Exports & Support Tickets */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* 6 Downloadable CSV Exports */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-teal-700" /> Downloadable Business Reports (CSV)
              </h2>
              <p className="text-xs text-stone-500">
                Export live Firestore records directly for Venture Quest audits, GST/accounting, or offline analysis.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: 'Customers CSV', count: `${users.length} records`, fn: exportCustomersCsv },
                { label: 'Caregivers CSV', count: `${caregivers.length} records`, fn: exportCaregiversCsv },
                { label: 'Bookings CSV', count: `${bookings.length} records`, fn: exportBookingsCsv },
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
                { label: 'Reviews CSV', count: `${reviews.length} records`, fn: exportReviewsCsv },
              ].map((exp) => (
                <button
                  key={exp.label}
                  type="button"
                  onClick={exp.fn}
                  className="p-4 border border-stone-200 hover:border-teal-400 rounded-xl flex items-center justify-between text-left bg-stone-50/50 hover:bg-teal-50/40 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{exp.label}</p>
                    <p className="text-xs text-stone-500 font-mono-tabular">{exp.count}</p>
                  </div>
                  <Download className="w-4 h-4 text-teal-700 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-teal-700" /> Support Tickets ({tickets.length})
              </h2>
            </div>

            {tickets.length === 0 ? (
              <p className="text-sm text-stone-500">No support tickets submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div
                    key={t.ticketId}
                    className="border border-stone-200 rounded-xl p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-stone-900 text-sm">
                        {t.subject} — {t.name} ({t.email})
                      </p>
                      <span className="capitalize font-semibold px-2 py-0.5 rounded bg-stone-100">
                        {t.status}
                      </span>
                    </div>
                    <p className="text-stone-600">{t.message}</p>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <input
                        type="text"
                        value={ticketReply[t.ticketId] ?? t.adminResponse ?? ''}
                        onChange={(e) =>
                          setTicketReply({ ...ticketReply, [t.ticketId]: e.target.value })
                        }
                        placeholder="Write admin resolution note..."
                        className="flex-1 px-3 py-1.5 border border-stone-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await adminResolveTicket(
                            t.ticketId,
                            'resolved',
                            ticketReply[t.ticketId] || 'Resolved by PawCare Dehradun Admin'
                          );
                          showToast('success', 'Ticket marked resolved.');
                        }}
                        className="px-3 py-1.5 font-semibold text-white bg-teal-700 rounded-lg cursor-pointer"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-violet-700" /> Caregiver Performance Report
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
                        <td className="py-2.5 pr-4 font-sans capitalize">{cg.verificationStatus}</td>
                        <td className="py-2.5 pr-4 text-right">{cgJobs.length}</td>
                        <td className="py-2.5 text-right font-semibold text-teal-800">₹{payout}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Customer Profile Detail Modal */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-stone-900">
                  {viewingUser.displayName}
                </h3>
                <p className="text-xs text-stone-500">
                  {viewingUser.email} · {viewingUser.role} · {viewingUser.accountStatus}
                </p>
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
                          {p.healthInfo && <p className="text-stone-600 mt-1">Health: {p.healthInfo}</p>}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-display text-sm font-bold text-stone-900">
                Booking History ({bookings.filter((b) => b.customerId === viewingUser.uid).length})
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
          </div>
        </div>
      )}

      {/* Caregiver Verification Modal */}
      {reviewingCg && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 space-y-4">
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
                  await adminUpdateCaregiverVerification(
                    reviewingCg,
                    'rejected',
                    'active',
                    cgAdminNotes || 'Documents incomplete.'
                  );
                  setReviewingCg(null);
                  showToast('success', `${reviewingCg.fullName} marked rejected.`);
                }}
                className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 rounded-xl cursor-pointer"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={async () => {
                  await adminUpdateCaregiverVerification(
                    reviewingCg,
                    reviewingCg.verificationStatus,
                    'suspended',
                    cgAdminNotes || 'Account suspended by admin.'
                  );
                  setReviewingCg(null);
                  showToast('success', `${reviewingCg.fullName} suspended.`);
                }}
                className="px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 rounded-xl cursor-pointer"
              >
                Suspend
              </button>
              <button
                type="button"
                onClick={async () => {
                  await adminUpdateCaregiverVerification(
                    reviewingCg,
                    'verified',
                    'active',
                    cgAdminNotes || 'Verified by PawCare Dehradun Admin.'
                  );
                  setReviewingCg(null);
                  showToast(
                    'success',
                    `${reviewingCg.fullName} approved and published to directory.`
                  );
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve & Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
