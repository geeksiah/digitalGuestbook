import React from 'react';
import Link from 'next/link';

// --- Brand Configuration ---
const BRAND = {
  green: "#063932",
  cream: "#F6F3EE",
  mist: "#EDF2F0",
  slate: "#0F172A",
  white: "#FFFFFF",
};

// --- LOGO COMPONENT ---
const EventPeepoLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill={BRAND.green} />
    <path d="M12 12H28" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    <path d="M12 20H24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    <path d="M12 28H28" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

// --- Utilities ---
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// --- Icons ---
const Icons = {
  ArrowRight: (props: React.SVGProps<SVGSVGElement>) => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>,
  Check: (props: React.SVGProps<SVGSVGElement>) => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
  Envelope: (props: React.SVGProps<SVGSVGElement>) => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>,
  QrCode: (props: React.SVGProps<SVGSVGElement>) => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" /></svg>,
  Play: (props: React.SVGProps<SVGSVGElement>) => <svg fill="currentColor" viewBox="0 0 24 24" {...props}><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>,
  Smartphone: (props: React.SVGProps<SVGSVGElement>) => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>,
  Shield: (props: React.SVGProps<SVGSVGElement>) => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>,
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  Chart: (props: React.SVGProps<SVGSVGElement>) => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  Sparkles: (props: React.SVGProps<SVGSVGElement>) => <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
};

// --- ANIMATED MOCKUPS (CSS-Only) ---

const MockupPhone = ({ className }: { className?: string }) => (
  <div className={cn("relative border-[#063932] bg-[#063932] border-[8px] rounded-[2.5rem] h-[380px] w-[210px] shadow-[0_30px_60px_-12px_rgba(6,57,50,0.4)] flex flex-col overflow-hidden animate-float bg-white", className)}>
    <div className="h-[20px] bg-[#063932] w-full absolute top-0 left-0 z-20 flex justify-center rounded-b-lg">
      <div className="h-[12px] w-[60px] bg-[#042823] rounded-b-lg"></div>
    </div>
    {/* Screen */}
    <div className="flex-1 bg-white relative overflow-hidden font-sans flex flex-col">
      {/* Invite Header */}
      <div className="h-[45%] bg-[#F8FAFC] p-4 pt-10 flex flex-col items-center justify-center text-center border-b border-gray-100">
        <div className="text-[8px] text-[#063932]/60 font-bold uppercase tracking-widest mb-3">You are invited</div>
        <div className="text-2xl text-[#063932] font-extrabold leading-tight mb-2 font-serif">Kwasi <br/>& Afua</div>
        <div className="text-[9px] text-gray-400 font-medium tracking-wide">THE UNION</div>
      </div>
      {/* Details */}
      <div className="p-4 space-y-3 flex-1">
        <div className="flex justify-between items-end border-b border-gray-100 pb-2">
          <div>
            <div className="text-[8px] text-gray-400 uppercase tracking-wide font-bold mb-0.5">Date</div>
            <div className="text-[10px] font-bold text-[#063932]">Sept 14, 2026</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] text-gray-400 uppercase tracking-wide font-bold mb-0.5">Time</div>
            <div className="text-[10px] font-bold text-[#063932]">4:00 PM</div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[8px] text-gray-400 uppercase tracking-wide font-bold">Venue</div>
          <div className="text-[10px] font-bold text-[#063932]">The Grand Estate, Accra</div>
          <div className="text-[8px] text-[#063932] underline">View Map</div>
        </div>
        {/* RSVP Button */}
        <div className="pt-2 mt-auto">
          <div className="w-full bg-[#063932] text-white py-2 rounded-lg text-[9px] font-bold text-center shadow-lg">
            Confirm Attendance
          </div>
        </div>
      </div>
    </div>
  </div>
);

// New Stylized Invite for "Features" Section
const MockupInviteDesign = ({ className }: { className?: string }) => (
  <div className={cn("relative border-[#063932] bg-[#063932] border-[8px] rounded-[2.5rem] h-[380px] w-[210px] shadow-2xl flex flex-col overflow-hidden bg-white", className)}>
    <div className="h-[20px] bg-[#063932] w-full absolute top-0 left-0 z-20 flex justify-center rounded-b-lg">
      <div className="h-[12px] w-[60px] bg-[#042823] rounded-b-lg"></div>
    </div>
    {/* Screen Content - Stylized Invite */}
    <div className="flex-1 relative overflow-hidden font-serif bg-[#FAF7F2] flex flex-col">
       {/* Background Pattern */}
       <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#063932] to-transparent"></div>
       
       <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 space-y-6">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#063932]/70">Save the Date</div>
          <div>
            <div className="text-3xl font-bold text-[#063932] leading-none font-serif">Kwasi</div>
            <div className="text-lg italic text-[#d4af37] font-serif">&</div>
            <div className="text-3xl font-bold text-[#063932] leading-none font-serif">Afua</div>
          </div>
          
          <div className="w-8 h-[1px] bg-[#063932]/20 my-2"></div>
          
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#063932]">September 14, 2026</div>
            <div className="text-[10px] text-[#063932]/80 uppercase tracking-widest">Accra, Ghana</div>
          </div>
       </div>
       
       <div className="p-4 z-10">
          <div className="w-full border border-[#063932] text-[#063932] py-2 rounded text-[10px] font-bold text-center uppercase tracking-wide">
            Open Invitation
          </div>
       </div>
    </div>
  </div>
);

const MockupDashboard = ({ className }: { className?: string }) => (
  <div className={cn("bg-white rounded-xl shadow-[0_20px_50px_rgb(0,0,0,0.08)] border border-gray-100 overflow-hidden w-full flex flex-col font-sans", className)}>
    {/* Header */}
    <div className="h-10 border-b border-gray-100 flex items-center px-4 justify-between bg-white">
      <div className="flex gap-1.5">
        <div className="w-2 h-2 rounded-full bg-red-400"></div>
        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
        <div className="w-2 h-2 rounded-full bg-green-400"></div>
      </div>
      <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Admin Panel</div>
    </div>
    {/* Body */}
    <div className="p-5 flex-1 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-bold text-[#063932]">Live Overview</h4>
        <div className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[9px] font-bold border border-green-100 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse relative"></span>
          Active
        </div>
      </div>
      
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Invited", val: "150", color: "bg-blue-50 text-blue-700" },
          { label: "Yes", val: "112", color: "bg-emerald-50 text-emerald-700" },
          { label: "Pending", val: "38", color: "bg-amber-50 text-amber-700" },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
            <div className="text-[8px] text-gray-500 mb-0.5 font-semibold uppercase">{stat.label}</div>
            <div className={`text-base font-extrabold ${stat.color.split(' ')[1]}`}>{stat.val}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {[1, 2, 3].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-500">
                {String.fromCharCode(65 + i)}
              </div>
              <div className="flex flex-col gap-1">
                <div className="w-16 h-2 bg-gray-200 rounded"></div>
                <div className="w-10 h-1.5 bg-gray-100 rounded"></div>
              </div>
            </div>
            <div className="px-1.5 py-0.5 bg-green-50 rounded text-[8px] font-bold text-green-700">Confirmed</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const MockupScanner = () => (
  <div className="relative w-40 h-40 bg-white rounded-2xl shadow-xl border border-gray-200 flex items-center justify-center overflow-hidden">
    <div className="absolute inset-0 border-[12px] border-black/5"></div>
    {/* Scanning Line Animation */}
    <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] z-10 animate-scan"></div>
    
    <div className="text-center p-4">
      <Icons.QrCode className="w-12 h-12 text-gray-800 mx-auto mb-2 opacity-80" />
      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Scanning...</div>
    </div>
  </div>
);

// --- Layout & Components ---

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-[#063932] selection:bg-[#063932] selection:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* Styles for Animations & Fonts */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes scan { 0% { top: 10%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 90%; opacity: 0; } }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-scan { animation: scan 2s linear infinite; }
        html { scroll-behavior: smooth; }
      `}} />

      {/* --- Navigation --- */}
      <nav className="fixed w-full z-50 top-0 bg-white/95 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <a href="#" className="flex items-center gap-3 group">
            <EventPeepoLogo className="w-10 h-10 group-hover:scale-105 transition-transform" />
            <span className="font-bold text-xl tracking-tight text-[#063932]">EventPeepo.</span>
          </a>

          <div className="hidden md:flex items-center gap-10">
            <a href="#features" className="text-sm font-semibold text-gray-600 hover:text-[#063932] transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-semibold text-gray-600 hover:text-[#063932] transition-colors">Process</a>
            <a href="#solutions" className="text-sm font-semibold text-gray-600 hover:text-[#063932] transition-colors">Solutions</a>
          </div>

          <div className="flex items-center gap-4">
            <a href="https://eventpeepo.com/#contact" className="text-sm font-bold text-gray-500 hover:text-[#063932] transition-colors hidden sm:block" target="_blank" rel="noopener noreferrer">
              Contact Us
            </a>
            <a href="/admin/login" className="bg-[#063932] text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-[#084d43] transition-all shadow-lg hover:shadow-[#063932]/20 active:scale-95" target="_blank" rel="noopener noreferrer">
              Client Dashboard
            </a>
          </div>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <section className="relative pt-36 pb-20 lg:pt-48 lg:pb-32 bg-[#F8FAFC] overflow-hidden border-b border-gray-100">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#063932]/5 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[80px] -translate-x-1/4 translate-y-1/4"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left: Text Content */}
            <div className="text-center lg:text-left">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#063932] leading-[1.1] tracking-tight mb-6">
                Bespoke Digital <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#063932] to-[#0d6e61]">Experiences.</span>
              </h1>
              
              <p className="max-w-xl mx-auto lg:mx-0 text-lg text-gray-600 mb-10 leading-relaxed font-medium">
                Your event's digital layer, handled. We design bespoke invitation suites and ensure seamless on-site access. You host; we manage the tech.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
                <a href="/admin/login" className="h-14 px-10 rounded-xl bg-[#063932] text-white font-bold text-base flex items-center justify-center hover:bg-[#084d43] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 min-w-[200px]" target="_blank" rel="noopener noreferrer">
                  Client Dashboard
                </a>
                <a href="https://eventpeepo.com/#contact" className="h-14 px-10 rounded-xl bg-white border border-gray-200 text-[#063932] font-bold text-base flex items-center justify-center gap-2 hover:border-gray-300 transition-all hover:bg-gray-50 shadow-sm min-w-[200px]" target="_blank" rel="noopener noreferrer">
                  Contact Us
                </a>
              </div>
              
              <div className="mt-12 pt-8 border-t border-gray-200/60 max-w-lg mx-auto lg:mx-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Trusted Partner For Events In</p>
                <div className="flex justify-center lg:justify-start gap-4 text-[#063932] font-bold opacity-80 text-sm tracking-wide">
                  <span>ACCRA</span> <span className="text-gray-300">•</span> <span>LAGOS</span> <span className="text-gray-300">•</span> <span>ABIDJAN</span> <span className="text-gray-300">•</span> <span>WORLDWIDE</span>
                </div>
              </div>
            </div>

            {/* Right: Visual Composition */}
            <div className="relative flex justify-center lg:justify-end items-center h-full min-h-[500px] lg:min-h-[600px]">
              {/* Background Blob */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-white/50 blur-3xl rounded-full z-0"></div>
              
              {/* Composition Container */}
              <div className="relative z-10 flex items-end justify-center lg:justify-end">
                {/* Phone Mockup (Front) - Centered on Mobile, Pushed on Desktop */}
                <div className="z-20 transform scale-100 lg:scale-125 lg:translate-x-10 origin-bottom">
                  <MockupPhone />
                </div>
                {/* Dashboard Mockup (Back) - Increased Size for Desktop */}
                <div className="absolute left-[-50px] lg:left-[-180px] bottom-10 z-10 w-[320px] lg:w-[480px] hidden sm:block animate-float" style={{ animationDelay: '1s' }}>
                  <MockupDashboard />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- Features Section (Bento Grid) --- */}
      <section id="features" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-20 md:text-center max-w-3xl md:mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-[#063932] mb-6 tracking-tight">Precision tools. White-glove service.</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              We've deconstructed the event management process and rebuilt it for the digital age. Every feature is designed to save you time and impress your guests.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 auto-rows-[auto]">
            
            {/* Feature 1: Digital Invitations (Large) */}
            <div className="md:col-span-2 rounded-3xl bg-[#F8FAFC] border border-gray-100 overflow-hidden relative group min-h-[500px] p-10 flex flex-col md:flex-row hover:border-[#063932]/20 transition-colors duration-500">
              <div className="relative z-10 flex-1 pr-0 md:pr-10">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 text-[#063932]">
                  <Icons.Envelope className="w-6 h-6" />
                </div>
                <h3 className="text-3xl font-bold text-[#063932] mb-4">Professionally Crafted Invitations</h3>
                <p className="text-gray-600 mb-6 leading-relaxed text-sm">
                  First impressions matter. Our design team builds responsive, app-like invitations that align perfectly with your brand. We handle the design, domain setup, and deployment to ensure a seamless, professional experience.
                </p>
                <ul className="space-y-3 text-sm font-semibold text-gray-500">
                  <li className="flex items-center gap-3"><div className="p-1 bg-[#063932]/10 rounded-full"><Icons.Check className="w-3 h-3 text-[#063932]"/></div> Full White-label Service</li>
                  <li className="flex items-center gap-3"><div className="p-1 bg-[#063932]/10 rounded-full"><Icons.Check className="w-3 h-3 text-[#063932]"/></div> Custom Subdomains</li>
                  <li className="flex items-center gap-3"><div className="p-1 bg-[#063932]/10 rounded-full"><Icons.Check className="w-3 h-3 text-[#063932]"/></div> Automated WhatsApp/SMS Reminders</li>
                </ul>
              </div>
              <div className="relative w-full md:w-1/2 flex justify-center items-center mt-10 md:mt-0">
                <div className="transform scale-100 transition-transform duration-700 group-hover:-translate-y-2">
                  <MockupInviteDesign />
                </div>
              </div>
            </div>

            {/* Feature 2: Analytics (Tall) */}
            <div className="rounded-3xl bg-white border border-gray-200 p-8 shadow-sm flex flex-col relative overflow-hidden group min-h-[500px] hover:shadow-xl transition-shadow duration-500">
              <div className="w-12 h-12 bg-[#F0FDF4] rounded-xl flex items-center justify-center mb-6 text-green-600">
                <Icons.Chart className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-[#063932] mb-3">Live Command Center</h3>
              <p className="text-gray-600 mb-8 text-sm leading-relaxed">
                We provide you with a real-time dashboard to monitor your guest list. Track confirmed RSVPs, dietary requirements, and +1s instantly.
              </p>
              <div className="flex-1 relative w-full mt-auto">
                <div className="transition-transform duration-500 group-hover:scale-105 w-full px-2">
                  <MockupDashboard />
                </div>
              </div>
            </div>

            {/* Feature 3: Security */}
            <div className="rounded-3xl bg-[#063932] text-white p-10 flex flex-col justify-between group overflow-hidden min-h-[400px]">
              <div>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 backdrop-blur-sm">
                  <Icons.QrCode className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Ironclad Access</h3>
                <p className="text-gray-300 leading-relaxed text-sm">
                  We generate unique, scannable QR codes for every confirmed guest. Our secure check-in system ensures zero gate-crashers and zero friction at the door.
                </p>
              </div>
              <div className="mt-8 flex justify-center pb-4">
                 <div className="transform group-hover:scale-110 transition-transform duration-500">
                    <MockupScanner />
                 </div>
              </div>
            </div>

            {/* Feature 4: Guestbook */}
            <div className="md:col-span-2 rounded-3xl bg-white border border-gray-200 p-10 flex flex-col md:flex-row items-center gap-12 shadow-sm min-h-[400px] group hover:border-gray-300 transition-colors">
              <div className="flex-1 space-y-6">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                  <Icons.Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#063932] mb-2">The Modern Guestbook</h3>
                  <p className="text-gray-600 leading-relaxed text-sm">
                    Forget pen and paper. We set up a digital portal where guests can leave heartfelt video messages, voice notes, and selfies directly from their phones. We curate these into a private digital gallery for you.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                    <span className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-gray-600">Video Messages</span>
                    <span className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-gray-600">Voice Notes</span>
                    <span className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-gray-600">Photo Gallery</span>
                </div>
              </div>
              <div className="flex-1 w-full h-64 bg-gray-50 rounded-2xl border border-gray-100 relative overflow-hidden flex items-center justify-center">
                 {/* Abstract visual representing media */}
                 <div className="relative w-full h-full flex items-center justify-center group-hover:scale-105 transition-transform duration-700">
                    <div className="absolute w-32 h-40 bg-white border border-gray-200 rotate-[-6deg] rounded-xl shadow-lg z-10 flex items-center justify-center">
                        <Icons.Play className="w-8 h-8 text-gray-300" />
                    </div>
                    <div className="absolute w-32 h-40 bg-gray-100 border border-gray-200 rotate-[6deg] rounded-xl shadow-md translate-x-12 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                    </div>
                 </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- Process Section --- */}
      <section id="how-it-works" className="py-24 bg-[#F8FAFC] border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#063932] mb-4">A Partnership for Perfection.</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">We are in this together. We handle the heavy lifting so you can deliver an exceptional experience.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gray-200 z-0"></div>

            {[
              { 
                step: "01", 
                title: "Consult & Build", 
                desc: "We work with you to understand your event's needs. Our team then builds a bespoke, professional event page tailored to your brand." 
              },
              { 
                step: "02", 
                title: "Invite & Manage", 
                desc: "Send your unique white-labeled link to guests. We provide you with the tools to track RSVPs and manage your guest list effortlessly." 
              },
              { 
                step: "03", 
                title: "Execute Flawlessly", 
                desc: "On event day, rely on our secure systems for check-in and digital guestbook capture. We ensure the tech runs smoothly in the background." 
              }
            ].map((item, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center group">
                <div className="w-24 h-24 bg-white rounded-full border-4 border-[#F8FAFC] shadow-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl font-extrabold text-[#063932]">{item.step}</span>
                </div>
                <h3 className="text-xl font-bold text-[#063932] mb-3">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed max-w-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Solutions / Pricing Section --- */}
      <section id="solutions" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-block px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold uppercase tracking-widest rounded-full mb-6 border border-amber-100">
            Exclusive Service
          </div>
          <h2 className="text-4xl font-bold text-[#063932] mb-6">Tailored Packages</h2>
          <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
            Every event is unique. We tailor our packages to align with your specific scale, requirements, and budget, ensuring you get exactly what you need for a flawless event.
          </p>
          
          <div className="bg-[#F8FAFC] rounded-3xl p-10 border border-gray-100 max-w-2xl mx-auto shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold text-[#063932] mb-6 text-left">Solutions we provide</h3>
            <ul className="grid sm:grid-cols-2 gap-y-4 gap-x-8 text-left text-sm text-gray-600 mb-10">
              <li className="flex items-center gap-3"><div className="p-0.5 bg-green-100 rounded-full"><Icons.Check className="w-3 h-3 text-green-700"/></div> Unlimited Guests</li>
              <li className="flex items-center gap-3"><div className="p-0.5 bg-green-100 rounded-full"><Icons.Check className="w-3 h-3 text-green-700"/></div> Bespoke Invitation Page</li>
              <li className="flex items-center gap-3"><div className="p-0.5 bg-green-100 rounded-full"><Icons.Check className="w-3 h-3 text-green-700"/></div> QR Code Check-in App</li>
              <li className="flex items-center gap-3"><div className="p-0.5 bg-green-100 rounded-full"><Icons.Check className="w-3 h-3 text-green-700"/></div> Digital Guestbook</li>
              <li className="flex items-center gap-3"><div className="p-0.5 bg-green-100 rounded-full"><Icons.Check className="w-3 h-3 text-green-700"/></div> SMS/Email Reminders</li>
              <li className="flex items-center gap-3"><div className="p-0.5 bg-green-100 rounded-full"><Icons.Check className="w-3 h-3 text-green-700"/></div> Priority Support</li>
            </ul>
            <div className="flex justify-center">
                <a href="https://eventpeepo.com/#contact" className="px-10 py-4 rounded-xl bg-[#063932] text-white font-bold hover:bg-[#084d43] transition-colors w-full sm:w-auto shadow-lg shadow-[#063932]/10" target="_blank" rel="noopener noreferrer">
                  Request a Quote
                </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#FAFAFA] border-t border-gray-200 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <EventPeepoLogo className="w-8 h-8" />
                <span className="font-bold text-xl text-[#063932]">EventPeepo.</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
                Defining the new standard for digital event management in West Africa.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-[#063932] mb-6">Product</h4>
              <ul className="space-y-3 text-sm text-gray-600">
                <li><a href="#features" className="hover:text-[#063932] transition-colors">Invitations</a></li>
                <li><a href="#features" className="hover:text-[#063932] transition-colors">RSVP Manager</a></li>
                <li><a href="#features" className="hover:text-[#063932] transition-colors">Guestbook</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-[#063932] mb-6">Company</h4>
              <ul className="space-y-3 text-sm text-gray-600">
                <li><a href="mailto:support@eventpeepo.com" className="hover:text-[#063932] transition-colors">Support</a></li>
                <li><a href="#" className="hover:text-[#063932] transition-colors">Privacy Policy</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-[#063932] mb-6">Contact</h4>
              <ul className="space-y-3 text-sm text-gray-600">
                <li><a href="mailto:sales@eventpeepo.com" className="hover:text-[#063932] transition-colors">sales@eventpeepo.com</a></li>
                <li><a href="tel:+233554247000" className="hover:text-[#063932] transition-colors">+233 554 247 000</a></li>
                <li><span className="text-gray-400">Accra, Ghana</span></li>
              </ul>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} EventPeepo Inc.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}