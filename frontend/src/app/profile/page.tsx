"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Droplets, Target, Activity, Flame, ShieldAlert, Zap, Loader2, Info } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [scan, setScan] = useState<any>(null);
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const data = sessionStorage.getItem('currentScan');
    if (data) {
      setScan(JSON.parse(data));
      // Delay mounting animation trigger slightly for effect
      setTimeout(() => setMounted(true), 100);
    } else {
      router.push('/scan');
    }
  }, [router]);

  const handleContinue = () => {
    if (selectedGoal) {
      sessionStorage.setItem('selectedGoal', selectedGoal);
      router.push('/recommendations');
    }
  };

  if (!scan) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  const measurements = scan.measurements;
  
  const signals = [
    { name: 'Hydration', score: measurements.hydration, icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-500', shadow: 'shadow-blue-500/20' },
    { name: 'Oiliness', score: measurements.oiliness, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500', shadow: 'shadow-orange-500/20' },
    { name: 'Redness', score: measurements.redness, icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-500', shadow: 'shadow-rose-500/20' },
    { name: 'Texture', score: measurements.texture, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/20' },
    { name: 'Pore appearance', score: measurements.pores, icon: Target, color: 'text-indigo-500', bg: 'bg-indigo-500', shadow: 'shadow-indigo-500/20' },
    { name: 'Overall skin appearance', score: 100, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500', shadow: 'shadow-amber-500/20', hideScore: true },
  ];

  return (
    <div className="flex-1 py-12 px-6">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Profile Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 mb-6">
            <Zap className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-jakarta font-bold text-slate-900 mb-4 tracking-tight">Your Measured Profile</h1>
          <p className="text-lg text-slate-500 font-light max-w-xl mx-auto">
            We've extracted your objective cosmetic signals. No guesswork, just data.
          </p>
          {scan.is_demo && (
            <div className="mt-6">
              <span className="inline-flex items-center px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm border border-amber-200">
                Demo Mode Active
              </span>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          
          {/* Measurements Column */}
          <div className="space-y-6">
            <div className="glass p-8 rounded-3xl">
              <h2 className="text-2xl font-bold font-jakarta mb-8 flex items-center">
                <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm mr-3">1</span>
                Current Signals
              </h2>
              
              <div className="space-y-6">
                {signals.filter(s => !s.hideScore).map((s, idx) => (
                  <div key={s.name} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <s.icon className={`w-4 h-4 mr-2 ${s.color}`} />
                        <span className="text-slate-700 font-medium text-sm">{s.name}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {s.score}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={`h-full ${s.bg} rounded-full transition-all duration-1000 ease-out`} 
                        style={{ width: mounted ? `${s.score}%` : '0%' }} 
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Insight Box */}
              <div className="mt-10 p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2" />
                <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center">
                  <Info className="w-4 h-4 mr-2 text-indigo-600" />
                  What this means
                </h3>
                <p className="text-sm text-indigo-950/70 leading-relaxed font-medium">
                  Your highest measured signal is <strong className="font-bold text-indigo-900">Oiliness</strong>, while your <strong className="font-bold text-indigo-900">Hydration</strong> level is lower. 
                  This indicates a potential combination skin profile. You might benefit from lightweight, hydrating products that balance oil without stripping the skin barrier.
                </p>
              </div>
            </div>
          </div>

          {/* Goal Selection Column */}
          <div className="space-y-6 lg:sticky lg:top-32">
            <div className="glass p-8 rounded-3xl flex flex-col h-full border-2 border-transparent transition-colors duration-300 hover:border-slate-200/50">
              <h2 className="text-2xl font-bold font-jakarta mb-2 flex items-center">
                <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm mr-3">2</span>
                Choose Your Goal
              </h2>
              <p className="text-slate-500 mb-8 font-light text-sm ml-11">
                Select one primary cosmetic goal to target.
              </p>
              
              <div className="space-y-3 flex-1 ml-11">
                {signals.map((s) => {
                  const isSelected = selectedGoal === s.name;
                  return (
                    <button
                      key={s.name}
                      onClick={() => setSelectedGoal(s.name)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                        isSelected 
                          ? `border-slate-900 bg-slate-900 text-white shadow-xl shadow-slate-900/20 scale-[1.02]` 
                          : `border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:scale-[1.01] text-slate-700 bg-white`
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-white/10' : 'bg-slate-100'}`}>
                          <s.icon className={`w-4 h-4 ${isSelected ? 'text-white' : s.color}`} />
                        </div>
                        <span className="font-semibold text-sm">{s.name}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-white' : 'border-slate-300'
                      }`}>
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 ml-11">
                <button
                  onClick={handleContinue}
                  disabled={!selectedGoal}
                  className={`group w-full flex items-center justify-center py-4 rounded-2xl font-bold transition-all duration-300 ${
                    selectedGoal 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:-translate-y-0.5' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Find My Matches
                  <ChevronRight className={`w-5 h-5 ml-1 transition-transform ${selectedGoal ? 'group-hover:translate-x-1' : ''}`} />
                </button>
              </div>
            </div>
          </div>

        </div>
        
      </div>
    </div>
  );
}
