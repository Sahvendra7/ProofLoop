"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { demoJourneyJump, getJourney } from '@/lib/api';
import { Loader2, ArrowUpRight, ArrowDownRight, RefreshCcw, Home, CheckCircle2, Minus } from 'lucide-react';
import Link from 'next/link';

export default function JourneyPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJumping, setIsJumping] = useState(false);

  useEffect(() => {
    const scanData = sessionStorage.getItem('currentScan');
    if (scanData) {
      const parsedScan = JSON.parse(scanData);
      getJourney(parsedScan.id)
        .then(res => setData(res))
        .catch(() => {});
    }
  }, []);

  const handleTimeJump = async () => {
    setIsJumping(true);
    try {
      const res = await demoJourneyJump();
      const journeyRes = await getJourney(res.new_scan_id);
      setData(journeyRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsJumping(false);
    }
  };

  const renderDelta = (name: string, current: number, baseline: number, delta: number) => {
    const isGood = name === 'hydration' ? delta > 0 : delta < 0;
    const isNeutral = delta === 0;
    const absDelta = Math.abs(delta);
    
    return (
      <div key={name} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
        <span className="font-bold text-slate-700 capitalize font-jakarta">{name}</span>
        
        <div className="flex items-center space-x-4 md:space-x-8">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Day 0</span>
            <span className="text-xl font-bold text-slate-500">{baseline}</span>
          </div>
          
          <div className="hidden sm:block text-slate-300">
            <ArrowRightIcon className="w-5 h-5" />
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Day 21</span>
            <span className="text-xl font-bold text-slate-900">{current}</span>
          </div>

          <div className={`flex items-center justify-center w-24 px-3 py-2 rounded-xl text-sm font-bold shadow-sm ${
            isNeutral ? 'bg-slate-50 text-slate-500 border border-slate-200' :
            isGood ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}>
            {isNeutral ? <Minus className="w-4 h-4 mr-1" /> : isGood ? <ArrowUpRight className="w-4 h-4 mr-1 stroke-[3]" /> : <ArrowDownRight className="w-4 h-4 mr-1 stroke-[3]" />}
            {absDelta} pts
          </div>
        </div>
      </div>
    );
  };

  if (error) return <div className="p-12 text-center text-red-500 font-medium">{error}</div>;

  return (
    <div className="flex-1 py-12 px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-jakarta font-bold text-slate-900 tracking-tight">Your Skin Journey</h1>
          <p className="text-lg text-slate-500 font-light max-w-xl mx-auto leading-relaxed">
            ProofLoop closes the loop. Measure your skin against your baseline to see objective changes over time.
          </p>
        </div>

        {!data ? (
          <div className="glass p-12 md:p-16 rounded-[3rem] text-center space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mx-auto text-indigo-600 border border-slate-100 relative z-10">
              <RefreshCcw className="w-10 h-10" />
            </div>
            
            <div className="relative z-10">
              <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold tracking-widest uppercase rounded-full mb-6 border border-amber-200">
                Demo Mode
              </div>
              <h2 className="text-3xl font-bold font-jakarta text-slate-900 mb-4">Baseline Saved: Day 0</h2>
              <p className="text-slate-600 font-medium max-w-lg mx-auto leading-relaxed">
                Fast-forwarding your timeline for demonstration. In the real application, you would return weeks later and perform a new scan to compare against this baseline.
              </p>
            </div>
            
            <button
              onClick={handleTimeJump}
              disabled={isJumping}
              className="relative z-10 inline-flex items-center justify-center px-10 py-5 bg-indigo-600 text-white font-bold text-lg rounded-2xl hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-600/30 hover:-translate-y-1 transition-all duration-300 disabled:bg-slate-300 disabled:translate-y-0 disabled:shadow-none"
            >
              {isJumping ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <RefreshCcw className="w-6 h-6 mr-3" />}
              {isJumping ? 'Simulating time...' : 'Fast Forward to Day 21'}
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            
            <div className="grid grid-cols-2 gap-6 md:gap-8">
              <div className="glass p-8 rounded-[2rem] text-center flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Baseline</span>
                <span className="text-4xl font-jakarta font-bold text-slate-900">Day 0</span>
              </div>
              <div className="bg-slate-900 p-8 rounded-[2rem] text-center relative overflow-hidden shadow-2xl flex flex-col items-center justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/30 rounded-bl-full blur-2xl" />
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest block mb-2 relative z-10">Current</span>
                <span className="text-4xl font-jakarta font-bold text-white relative z-10">Day 21</span>
              </div>
            </div>

            <div className="glass p-8 md:p-10 rounded-[2rem]">
              <h3 className="text-xl font-bold font-jakarta text-slate-900 mb-8 flex items-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mr-3" />
                Measured Signals
              </h3>
              <div className="space-y-4">
                {Object.keys(data.deltas).map((key) => 
                  renderDelta(
                    key, 
                    (data.current.measurements as any)[key], 
                    (data.baseline.measurements as any)[key], 
                    data.deltas[key]
                  )
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-12 rounded-[2.5rem] text-center space-y-8 relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
              <div className="relative z-10 space-y-6">
                <h2 className="text-4xl font-jakarta font-bold tracking-tight">The Loop is Closed</h2>
                <p className="text-indigo-200 font-medium max-w-lg mx-auto text-lg leading-relaxed">
                  By comparing objective measurements, you no longer have to guess if a product works for you.
                </p>
                <div className="pt-4">
                  <Link 
                    href="/"
                    className="inline-flex items-center justify-center px-10 py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-indigo-50 hover:scale-105 transition-all duration-300 shadow-xl shadow-white/10"
                  >
                    <Home className="w-5 h-5 mr-3" />
                    Back to Start
                  </Link>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

// Simple internal icon for layout
function ArrowRightIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  )
}
