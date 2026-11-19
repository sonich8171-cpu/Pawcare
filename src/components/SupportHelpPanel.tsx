import { ChevronDown, HelpCircle, Mail, MessageCircle, Send } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { formatAppError } from '../lib/authErrors';
import { submitSupportTicket, subscribeUserSupportTickets } from '../services/firestoreService';
import type { BookingRecord, PlatformSettings, SupportTicket } from '../types/pawcare';

interface SupportHelpPanelProps {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  roleLabel: 'customer' | 'caregiver';
  bookings: BookingRecord[];
  platformSettings: PlatformSettings;
  onToast: (type: 'success' | 'error', text: string) => void;
}

export function SupportHelpPanel({
  userId,
  userName,
  userEmail,
  userPhone,
  roleLabel,
  bookings,
  platformSettings,
  onToast,
}: SupportHelpPanelProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  useEffect(() => {
    if (!userId) return;
    return subscribeUserSupportTickets(userId, setTickets, (err) => {
      onToast('error', formatAppError(err, 'Could not load your support tickets.'));
    });
  }, [userId]);

  const whatsappClean = platformSettings.whatsappNumber.replace(/[^0-9]/g, '');

  const quickSubjects =
    roleLabel === 'caregiver'
      ? [
          'Booking schedule adjustment',
          'Customer entry or contact issue',
          'Payout settlement query',
          'Profile verification inquiry',
        ]
      : [
          'Reschedule or timing update',
          'Payment or refund status',
          'Caregiver arrival or check-in',
          'Special pet care instruction update',
        ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3) {
      onToast('error', 'Please enter a short subject (at least 3 characters).');
      return;
    }
    if (message.trim().length < 5) {
      onToast('error', 'Please describe your request (at least 5 characters).');
      return;
    }
    setSubmitting(true);
    try {
      const id = await submitSupportTicket({
        userId,
        name: userName || 'PawCare Member',
        email: userEmail,
        phone: userPhone,
        subject: subject.trim(),
        message: message.trim(),
        bookingId: bookingId || undefined,
      });
      setSubject('');
      setBookingId('');
      setMessage('');
      onToast('success', `Support ticket ${id} submitted. Our Dehradun coordinator desk will respond shortly.`);
    } catch (err) {
      onToast('error', formatAppError(err, 'Could not submit support ticket.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Instant Channels */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-stone-900">
            Help & Support Desk
          </h1>
          <p className="text-sm text-stone-600">
            Raise a booking ticket, track coordinator replies, or reach our Dehradun care desk directly.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(
              `Hi PawCare Desk, I need assistance with my ${roleLabel} account (${userEmail}).`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl whitespace-nowrap"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Coordinator
          </a>
          {platformSettings.supportEmail && (
            <a
              href={`mailto:${platformSettings.supportEmail}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl whitespace-nowrap"
            >
              <Mail className="w-3.5 h-3.5" /> Email Support
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Submit Ticket Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
        >
          <div>
            <h2 className="font-display text-lg font-bold text-stone-900">
              Raise a Support Ticket
            </h2>
            <p className="text-xs text-stone-500">
              Tickets route directly to the PawCare Operations team with your booking context.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {quickSubjects.map((qs) => (
              <button
                key={qs}
                type="button"
                onClick={() => setSubject(qs)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                  subject === qs
                    ? 'bg-teal-50 border-teal-300 text-teal-800'
                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                {qs}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Subject</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={150}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Describe the topic briefly"
                className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Related Booking (Optional)
              </label>
              <select
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl bg-white"
              >
                <option value="">General account inquiry</option>
                {bookings.slice(0, 15).map((b) => (
                  <option key={b.bookingId} value={b.bookingId}>
                    {b.serviceTitle} · {b.petName} ({b.bookingDate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Details & Preferred Resolution
            </label>
            <textarea
              rows={4}
              required
              minLength={5}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share timing details, issue context, or how our team can help..."
              className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}
          </button>
        </form>

        {/* Live My Tickets History */}
        <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-stone-900">
              Your Tickets ({tickets.length})
            </h2>
            <span className="text-xs text-stone-500 font-mono-tabular">Live Sync</span>
          </div>

          {tickets.length === 0 ? (
            <div className="py-6 text-center text-xs text-stone-500">
              No support tickets raised yet. Submit one on the left anytime you need help.
            </div>
          ) : (
            <div className="divide-y divide-stone-100 max-h-[380px] overflow-y-auto">
              {tickets.map((t) => (
                <div key={t.ticketId} className="py-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-stone-900 truncate">{t.subject}</p>
                    <span
                      className={`font-semibold capitalize shrink-0 ${
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
                  <p className="text-stone-600 leading-relaxed">{t.message}</p>
                  {t.bookingId && (
                    <p className="text-[11px] text-stone-400 font-mono-tabular">
                      Booking: {t.bookingId}
                    </p>
                  )}
                  {t.adminResponse && (
                    <div className="mt-2 p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-900">
                      <span className="font-semibold">Coordinator Reply:</span> {t.adminResponse}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Help FAQs */}
      {(platformSettings.faqs || []).length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-stone-900 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-teal-700" /> Frequently Asked Questions
          </h2>
          <div className="divide-y divide-stone-100">
            {(platformSettings.faqs || []).map((faq, idx) => {
              const open = openFaqIdx === idx;
              return (
                <div key={`${faq.question}-${idx}`} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(open ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
                  >
                    <span className="text-sm font-semibold text-stone-900">{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {open && <p className="mt-2 text-xs text-stone-600 leading-relaxed">{faq.answer}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
