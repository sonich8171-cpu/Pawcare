import { Check, Copy, MapPin, PawPrint, Printer, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { BookingRecord, PaymentRecord } from '../types/pawcare';

interface BookingReceiptModalProps {
  booking: BookingRecord | null;
  payment?: PaymentRecord;
  viewerRole: 'customer' | 'caregiver' | 'admin';
  onClose: () => void;
}

export function BookingReceiptModal({
  booking,
  payment,
  viewerRole,
  onClose,
}: BookingReceiptModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    if (!booking) return;
    try {
      await navigator.clipboard.writeText(booking.bookingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard unavailability
    }
  };

  return (
    <AnimatePresence>
      {booking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100">
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                  {viewerRole === 'caregiver' ? 'Caregiver Payout Slip' : 'PawCare Session Summary'}
                </p>
                <h2 className="font-display text-xl font-extrabold text-stone-900 truncate">
                  {booking.serviceName || booking.serviceTitle}
                </h2>
                <div className="flex items-center gap-2 text-xs text-stone-500 font-mono-tabular">
                  <span>{payment?.referenceCode || booking.bookingId}</span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-1 text-teal-700 hover:underline cursor-pointer font-sans font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy ID
                      </>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close receipt"
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Core Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-stone-500">Schedule</p>
                <p className="font-semibold text-stone-900 font-mono-tabular">
                  {booking.bookingDate}
                </p>
                <p className="text-stone-600">
                  {booking.startTime && booking.endTime
                    ? `${booking.startTime}–${booking.endTime} · `
                    : ''}
                  {booking.timeSlot}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-stone-500">Session Status</p>
                <p className="font-semibold text-stone-900 capitalize">
                  {booking.status.replace('_', ' ')}
                </p>
                <p className="text-stone-600 capitalize">
                  Pay: {booking.paymentMethod.replace('_', ' ')} ·{' '}
                  {booking.paymentStatus.replace('_', ' ')}
                </p>
              </div>
            </div>

            {/* Pet & Parties */}
            <div className="border-t border-b border-stone-100 py-4 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <PawPrint className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-stone-900">
                    {booking.petName}
                    {booking.petType
                      ? ` (${booking.petType}${booking.petBreed ? ` · ${booking.petBreed}` : ''})`
                      : ''}
                  </p>
                  <p className="text-stone-600">
                    Pet Parent: {booking.customerName}
                    {booking.customerPhone ? ` · ${booking.customerPhone}` : ''}
                  </p>
                  <p className="text-stone-600">Caregiver: {booking.caregiverName}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-violet-700 shrink-0 mt-0.5" />
                <p className="text-stone-600">
                  <span className="font-semibold text-stone-800">{booking.locality}</span> —{' '}
                  {booking.serviceAddress}
                </p>
              </div>
              {(booking.petInstructions || booking.specialInstructions) && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-1 text-stone-700">
                  {booking.petInstructions && (
                    <p>
                      <span className="font-semibold text-stone-900">Pet Care Routine:</span>{' '}
                      {booking.petInstructions}
                    </p>
                  )}
                  {booking.specialInstructions && (
                    <p>
                      <span className="font-semibold text-stone-900">Visit Instructions:</span>{' '}
                      {booking.specialInstructions}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Itemized Bill Details */}
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-stone-900 text-sm">Itemized Bill Details</p>
              <div className="space-y-1.5 text-stone-600">
                <div className="flex items-center justify-between">
                  <span>Session Value ({booking.serviceTitle})</span>
                  <span className="font-mono-tabular font-medium text-stone-900">
                    ₹{booking.grossAmount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Verified Caregiver Share</span>
                  <span className="font-mono-tabular text-stone-700">
                    ₹{booking.caregiverPayout}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Platform Coordination & Safety Fee</span>
                  <span className="font-mono-tabular text-stone-700">
                    ₹{booking.platformCommission}
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-sm font-bold text-stone-900">
                  <span>
                    {viewerRole === 'caregiver' ? 'Net Caregiver Payout' : 'Total Booking Amount'}
                  </span>
                  <span className="font-mono-tabular text-teal-800">
                    ₹{viewerRole === 'caregiver' ? booking.caregiverPayout : booking.grossAmount}
                  </span>
                </div>
              </div>
            </div>

            {booking.disputeStatus !== 'none' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <span className="font-semibold capitalize">
                  Dispute ({booking.disputeStatus}):
                </span>{' '}
                {booking.disputeNotes || 'Under review by PawCare support.'}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-100">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-stone-500">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" /> Verified PawCare Record
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
