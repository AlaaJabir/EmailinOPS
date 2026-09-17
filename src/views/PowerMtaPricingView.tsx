import React, { useState } from 'react';
import { Check, Star, Shield, ArrowRight, Zap, Sparkles, Server } from 'lucide-react';

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
    <div className="p-2 sm:p-4 md:p-6 bg-[#E8ECEF] min-h-[calc(100vh-3.5rem)] font-sans text-gray-800">
      <div className="max-w-[1240px] mx-auto bg-white rounded-lg shadow-md border border-[#C5CED6] overflow-hidden">
        {/* Top Crimson Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-[#8B1A10] via-[#A81D14] to-[#75110B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#E0A328]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-black/25 flex items-center justify-center text-white border border-white/20 shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>PowerMTA Professional Deployment Services</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/20 text-[#FFD54F]">
                  Enterprise Setup
                </span>
              </h1>
              <p className="text-[11px] text-gray-200 mt-0.5 hidden sm:block">
                VirtualMTA IP pools, Interspire Email Marketer deployment, automated warm-up, and deliverability tuning.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Plan 1: PowerMTA */}
            <div className="border border-[#CCD2D8] rounded bg-white p-5 flex flex-col justify-between hover:shadow-xs hover:border-[#8B1A10] transition">
              <div className="space-y-4">
                <div className="border-b border-[#E2E8F0] pb-4">
                  <h3 className="text-base font-bold text-gray-900 uppercase">Power MTA</h3>
                  <p className="text-xs text-gray-500 mt-1">Core MTA engine and IP cluster setup</p>
                  <div className="mt-3 flex items-baseline">
                    <span className="text-sm font-bold text-gray-500">$</span>
                    <span className="text-3xl font-extrabold text-[#8B1A10] ml-0.5">49</span>
                    <span className="text-sm font-bold text-[#8B1A10]">.99</span>
                    <span className="text-xs text-gray-500 ml-2 font-medium">/ one-time</span>
                  </div>
                </div>

                <ul className="space-y-2 text-xs text-gray-700">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Power MTA Installation &amp; Configuration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>VirtualMTA Creation &amp; IP Rotation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Bounce Processor Setup &amp; Rules</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Mail Server Optimization as Cluster</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>DKIM, DMARC, SPF, MX, RDNS, EHLO</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Load Balancer for IP Pool</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => setSelectedPlan('POWER MTA ($49.99)')}
                  className="w-full py-2 bg-[#37474F] hover:bg-[#263238] text-white font-bold rounded text-xs transition shadow-xs"
                >
                  Request Setup
                </button>
              </div>
            </div>

            {/* Plan 2: Email Marketer */}
            <div className="border border-[#CCD2D8] rounded bg-white p-5 flex flex-col justify-between hover:shadow-xs hover:border-[#8B1A10] transition">
              <div className="space-y-4">
                <div className="border-b border-[#E2E8F0] pb-4">
                  <h3 className="text-base font-bold text-gray-900 uppercase">Email Marketer</h3>
                  <p className="text-xs text-gray-500 mt-1">Interspire web interface and broadcasting</p>
                  <div className="mt-3 flex items-baseline">
                    <span className="text-sm font-bold text-gray-500">$</span>
                    <span className="text-3xl font-extrabold text-[#8B1A10] ml-0.5">29</span>
                    <span className="text-sm font-bold text-[#8B1A10]">.99</span>
                    <span className="text-xs text-gray-500 ml-2 font-medium">/ one-time</span>
                  </div>
                </div>

                <ul className="space-y-2 text-xs text-gray-700">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Responsive Email Templates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>WYSIWYG &amp; Advanced HTML Editing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Popup &amp; Inbox Previews</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Built-In Spam Score Checking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Link Click &amp; Open Tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Full List Management &amp; CSV Import</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Email Speed Throttling</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => setSelectedPlan('Email Marketer ($29.99)')}
                  className="w-full py-2 bg-[#37474F] hover:bg-[#263238] text-white font-bold rounded text-xs transition shadow-xs"
                >
                  Request Setup
                </button>
              </div>
            </div>

            {/* Plan 3: ALL IN ONE (Highlighted) */}
            <div className="border-2 border-[#8B1A10] rounded bg-white p-5 flex flex-col justify-between relative shadow-md">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8B1A10] text-white text-[10px] font-extrabold uppercase px-3 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#FFD54F]" />
                <span>Enterprise Suite</span>
              </div>

              <div className="space-y-4">
                <div className="border-b border-[#E2E8F0] pb-4">
                  <h3 className="text-base font-bold text-gray-900 uppercase">ALL IN ONE</h3>
                  <p className="text-xs text-[#8B1A10] font-bold mt-1">Full PowerMTA + Marketer Suite</p>
                  <div className="mt-3 flex items-baseline">
                    <span className="text-sm font-bold text-gray-500">$</span>
                    <span className="text-3xl font-extrabold text-[#2E7D32] ml-0.5">69</span>
                    <span className="text-sm font-bold text-[#2E7D32]">.99</span>
                    <span className="text-xs text-gray-500 ml-2 font-medium">/ complete package</span>
                  </div>
                </div>

                <ul className="space-y-2 text-xs text-gray-800">
                  <li className="flex items-center gap-2 font-bold">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Everything in PowerMTA Setup</span>
                  </li>
                  <li className="flex items-center gap-2 font-bold">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Everything in Interspire Marketer</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Automated Multi-IP Rotation Pools</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Automated Warm-up Delivery Schedule</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Feedback Loops (FBL) Integration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Full Domain DNS Alignment (SPF, DKIM, DMARC)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span>Dedicated Priority Technical Support</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => setSelectedPlan('ALL IN ONE ($69.99)')}
                  className="w-full py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded text-xs shadow-xs transition"
                >
                  Order All In One Suite
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-[#CCD2D8] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#CCD2D8] bg-gradient-to-r from-[#8B1A10] to-[#75110B] text-white flex items-center justify-between">
                <h3 className="font-bold text-white text-sm">Request Plan: {selectedPlan}</h3>
                <button onClick={() => setSelectedPlan(null)} className="text-white hover:text-gray-200 text-lg">
                  &times;
                </button>
              </div>
              {submitted ? (
                <div className="p-8 text-center space-y-3">
                  <Check className="w-10 h-10 text-[#2E7D32] mx-auto" />
                  <h4 className="font-bold text-gray-900 text-base">Request Confirmed!</h4>
                  <p className="text-xs text-gray-600">
                    Our delivery engineering team will contact you shortly to initialize server configuration.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleOrder} className="p-5 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Your Email</label>
                    <input
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#CCD2D8] rounded text-xs text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Server Details / Notes</label>
                    <textarea
                      rows={3}
                      placeholder="OS version, number of IPs, domain name, or special requirements..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#CCD2D8] rounded text-xs text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                    />
                  </div>
                  <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E2E8F0]">
                    <button
                      type="button"
                      onClick={() => setSelectedPlan(null)}
                      className="px-3 py-1.5 border border-[#CCD2D8] rounded text-xs text-gray-700 hover:bg-gray-100 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded text-xs font-bold shadow-xs"
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
    </div>
  );
};
