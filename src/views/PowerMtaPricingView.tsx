import React, { useState } from 'react';
import { Check, Star, Shield, ArrowRight, Zap, Sparkles } from 'lucide-react';

interface PowerMtaPricingViewProps {
  addToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const PowerMtaPricingView: React.FC<PowerMtaPricingViewProps> = ({ addToast }) => {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    addToast('success', 'Order Submitted', `Your request for ${selectedPlan} has been received.`);
    setTimeout(() => {
      setSelectedPlan(null);
      setSubmitted(false);
      setEmail('');
      setNotes('');
    }, 1800);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-widest text-[#8cc052] bg-[#f4faee] px-3 py-1 rounded-full border border-[#c9e89b]">
          One Time Service &amp; Support
        </span>
        <h1 className="text-3xl font-bold text-gray-800">PowerMTA.PW Pricing Plans</h1>
        <p className="text-sm text-gray-500">
          Enterprise setup, VirtualMTA configuration, Interspire Email Marketer deployment, and deliverability tuning.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan 1: PowerMTA */}
        <div className="pmta-card p-6 flex flex-col justify-between hover:shadow-md transition">
          <div className="space-y-4">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-800 uppercase">Power MTA</h3>
              <p className="text-xs text-gray-500 mt-1">Core MTA engine and IP cluster setup</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-sm font-semibold text-gray-400">$</span>
                <span className="text-4xl font-black text-[#8cc052] ml-0.5">49</span>
                <span className="text-sm font-bold text-[#8cc052]">.99</span>
                <span className="text-xs text-gray-400 ml-2">/ one-time</span>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-gray-600">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Power MTA Installation &amp; Configuration</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>VirtualMTA Creation &amp; IP Rotation</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Bounce Processor Setup &amp; Rules</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Mail Server Optimization as Cluster</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>DKIM, DMARC, SPF, MX, RDNS, EHLO</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Load Balancer for IP Pool</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <button
              onClick={() => setSelectedPlan('POWER MTA ($49.99)')}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded text-sm transition"
            >
              Request Setup
            </button>
          </div>
        </div>

        {/* Plan 2: Email Marketer */}
        <div className="pmta-card p-6 flex flex-col justify-between hover:shadow-md transition">
          <div className="space-y-4">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-800 uppercase">Email Marketer</h3>
              <p className="text-xs text-gray-500 mt-1">Interspire web interface and broadcasting</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-sm font-semibold text-gray-400">$</span>
                <span className="text-4xl font-black text-[#8cc052] ml-0.5">29</span>
                <span className="text-sm font-bold text-[#8cc052]">.99</span>
                <span className="text-xs text-gray-400 ml-2">/ one-time</span>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-gray-600">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Responsive Email Templates</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Easy WYSIWYG &amp; Advanced HTML Editing</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Popup &amp; Inbox Previews</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Built-In Spam Score Checking</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Link Click &amp; Open Tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Full List Management &amp; CSV Import</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Email Speed Throttling</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <button
              onClick={() => setSelectedPlan('Email Marketer ($29.99)')}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded text-sm transition"
            >
              Request Setup
            </button>
          </div>
        </div>

        {/* Plan 3: ALL IN ONE (Highlighted) */}
        <div className="pmta-card p-6 flex flex-col justify-between border-2 border-[#8cc052] relative shadow-lg bg-gradient-to-b from-white to-[#f9fcf6]">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8cc052] text-white text-[11px] font-extrabold uppercase px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Most Popular</span>
          </div>

          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-bold text-gray-800 uppercase">ALL IN ONE</h3>
              <p className="text-xs text-[#6fa035] font-semibold mt-1">Full PowerMTA + Interspire Marketer Suite</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-sm font-semibold text-gray-400">$</span>
                <span className="text-4xl font-black text-[#8cc052] ml-0.5">69</span>
                <span className="text-sm font-bold text-[#8cc052]">.99</span>
                <span className="text-xs text-gray-400 ml-2">/ complete package</span>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-gray-700">
              <li className="flex items-center gap-2 font-semibold">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Everything in PowerMTA Setup</span>
              </li>
              <li className="flex items-center gap-2 font-semibold">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Everything in Interspire Marketer</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Automated Multi-IP Rotation Pools</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Automated Warm-up Delivery Schedule</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Feedback Loops (FBL) Integration</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Full Domain DNS Alignment (SPF, DKIM, DMARC)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#8cc052] shrink-0" />
                <span>Dedicated Priority Technical Support</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <button
              onClick={() => setSelectedPlan('ALL IN ONE ($69.99)')}
              className="w-full py-2.5 bg-[#8cc052] hover:bg-[#7bb342] text-white font-bold rounded text-sm shadow-md transition"
            >
              Order All In One Suite
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-base">Request Plan: {selectedPlan}</h3>
              <button onClick={() => setSelectedPlan(null)} className="text-gray-400 hover:text-gray-600 text-lg">
                &times;
              </button>
            </div>
            {submitted ? (
              <div className="p-8 text-center space-y-3">
                <Check className="w-12 h-12 text-[#8cc052] mx-auto" />
                <h4 className="font-bold text-gray-800 text-lg">Request Confirmed!</h4>
                <p className="text-xs text-gray-500">
                  Our delivery engineering team will contact you shortly to initialize server configuration.
                </p>
              </div>
            ) : (
              <form onSubmit={handleOrder} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Your Email</label>
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Server Details / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="OS version, number of IPs, domain name, or special requirements..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#8cc052]"
                  />
                </div>
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(null)}
                    className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-100 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#8cc052] hover:bg-[#7bb342] text-white rounded text-sm font-bold shadow-sm"
                  >
                    Confirm Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
