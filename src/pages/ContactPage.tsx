import { CheckCircle2, Mail, MapPin, MessageCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePublicData } from '../contexts/DataContext';
import { submitSupportTicket } from '../services/firestoreService';

export function ContactPage() {
  const { firebaseUser, userProfile, isEmailVerified } = useAuth();
  const { platformSettings } = usePublicData();

  const [name, setName] = useState(userProfile?.displayName || '');
  const [email, setEmail] = useState(userProfile?.email || firebaseUser?.email || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const whatsappClean = platformSettings.whatsappNumber.replace(/[^0-9]/g, '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2 || !email.includes('@') || subject.trim().length < 3 || message.trim().length < 5) {
      setError('Please enter your name, valid email, subject, and a message (at least 5 characters).');
      return;
    }

    if (!firebaseUser || !isEmailVerified) {
      const mailto = `mailto:${platformSettings.supportEmail || 'care@pawcaredehradun.in'}?subject=${encodeURIComponent(
        `[PawCare Inquiry] ${subject.trim()}`
      )}&body=${encodeURIComponent(`From: ${name.trim()} (${email.trim()}, ${phone.trim()})\n\n${message.trim()}`)}`;
      window.location.href = mailto;
      setSubmittedId('EMAIL-DISPATCH');
      return;
    }

    setSubmitting(true);
    try {
      const id = await submitSupportTicket({
        userId: firebaseUser.uid,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubmittedId(id);
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="max-w-2xl space-y-3">
        <p className="text-sm font-semibold text-teal-700">Contact & Support</p>
        <h1 className="font-display text-4xl font-extrabold text-stone-900 tracking-tight">
          Get in Touch With PawCare Dehradun
        </h1>
        <p className="text-base text-stone-600">
          Questions about bookings, caregiver onboarding, or locality coverage? Reach our team via
          support ticket or WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-6 sm:p-8">
          {submittedId ? (
            <div className="py-10 text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-teal-700 mx-auto" />
              <h2 className="font-display text-2xl font-bold text-stone-900">
                Inquiry Received
              </h2>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                {submittedId === 'EMAIL-DISPATCH'
                  ? 'Your email client has been opened with your inquiry details.'
                  : `Your support ticket (${submittedId}) has been saved to our Dehradun admin desk.`}
              </p>
              <button
                type="button"
                onClick={() => setSubmittedId(null)}
                className="px-4 py-2 text-sm font-semibold text-teal-700 bg-teal-50 rounded-xl cursor-pointer"
              >
                Send Another Inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-display text-xl font-bold text-stone-900">Send a Message</h2>
              {!firebaseUser && (
                <p className="text-xs text-stone-500">
                  Tip: Sign in for tracked support tickets inside your dashboard, or submit directly
                  below via email/WhatsApp.
                </p>
              )}

              {error && (
                <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="Ananya Joshi"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Phone / WhatsApp (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="+91 98XXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="Booking question or caregiver support"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Message</label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="Share your Dehradun locality, pet type, or question..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Inquiry'}
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-stone-900">Direct Channels</h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-stone-900">WhatsApp Care Coordinator</p>
                  <p className="text-stone-600 mb-2">
                    Quick assistance for Dehradun bookings and caregiver onboarding.
                  </p>
                  <a
                    href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(
                      'Hello PawCare Dehradun support, I need assistance.'
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 px-3.5 py-2 rounded-lg"
                  >
                    Open WhatsApp Chat
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-3 border-t border-stone-100">
                <Mail className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-stone-900">Support Email</p>
                  <p className="text-stone-600">
                    {platformSettings.supportEmail || 'care@pawcaredehradun.in'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-3 border-t border-stone-100">
                <MapPin className="w-5 h-5 text-stone-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-stone-900">Launch Operations</p>
                  <p className="text-stone-600">Dehradun, Uttarakhand, India</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
            <h3 className="font-display text-lg font-bold text-stone-900">Quick FAQs</h3>
            <div className="space-y-3 text-xs text-stone-600">
              {(platformSettings.faqs || []).slice(0, 3).map((faq, i) => (
                <div key={i} className="space-y-1">
                  <p className="font-semibold text-stone-900">{faq.question}</p>
                  <p>{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
