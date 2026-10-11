"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRecommendations } from '@/lib/api';
import { Loader2, ArrowRight, Check, ChevronLeft, Sparkles } from 'lucide-react';

export default function RecommendationsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanData = sessionStorage.getItem('currentScan');
    const goal = sessionStorage.getItem('selectedGoal');
    
    if (!scanData || !goal) {
      router.push('/scan');
      return;
    }

    const parsedScan = JSON.parse(scanData);
    getRecommendations(parsedScan.id, goal)
      .then((res) => setData(res))
      .catch((err) => setError(err.message));
  }, [router]);

  if (error) return <div className="p-12 text-center text-red-500 font-medium">{error}</div>;
  if (!data) return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
      <p className="text-slate-500 font-medium">Running deterministic match engine...</p>
    </div>
  );

  return (
    <div className="flex-1 py-12 px-6">
      <div className="max-w-4xl mx-auto space-y-10">
        
        <button onClick={() => router.back()} className="group flex items-center text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Back to Profile
        </button>

        <div className="glass p-8 rounded-[2rem] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <h1 className="text-4xl font-jakarta font-bold text-slate-900 mb-2">Personalized Matches</h1>
          <p className="text-slate-600 text-lg">
            Targeting: <span className="font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full text-sm align-middle ml-2">{data.goal}</span>
          </p>
        </div>

        <div className="space-y-8">
          {data.recommendations.map((rec: any) => (
            <div key={rec.product.id} className="group glass hover:shadow-2xl hover:shadow-indigo-500/10 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start transition-all duration-300 border border-transparent hover:border-indigo-100">
              
              {/* Image Placeholder */}
              <div className="w-full md:w-56 h-56 rounded-2xl flex-shrink-0 flex items-center justify-center text-slate-400 relative overflow-hidden shadow-inner border border-slate-100">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100" />
                {/* Abstract shape for product */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white rounded-full shadow-sm flex items-center justify-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Product</span>
                </div>
              </div>
              
              <div className="flex-1 w-full space-y-6">
                
                {/* Header & Match Score */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-5">
                  <div>
                    <p className="text-xs font-bold text-indigo-500 tracking-wider uppercase mb-1.5">{rec.product.brand}</p>
                    <h3 className="text-2xl font-jakarta font-bold text-slate-900">{rec.product.name}</h3>
                  </div>
                  
                  {/* Premium Match Badge */}
                  <div className="flex flex-col items-center justify-center bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-slate-900/20">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Match</span>
                    <span className="text-xl font-bold flex items-center">
                      {rec.match_score}
                      <span className="text-sm text-slate-400 ml-0.5">%</span>
                    </span>
                  </div>
                </div>

                <p className="text-slate-600 font-medium leading-relaxed">
                  {rec.product.description}
                </p>

                {/* Explanation Checklist */}
                <div className="bg-white/60 p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                    Why this matches you
                  </h4>
                  <ul className="space-y-3">
                    {rec.explanation.map((reason: string, i: number) => (
                      <li key={i} className="flex items-start text-sm text-slate-700 font-medium">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mr-3 shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="leading-relaxed">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Footer Action */}
                <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4">
                  <span className="text-2xl font-bold text-slate-900 font-jakarta">${rec.product.price.toFixed(2)}</span>
                  <button 
                    onClick={() => {
                      sessionStorage.setItem('selectedProduct', JSON.stringify(rec.product));
                      router.push('/product');
                    }}
                    className="w-full sm:w-auto flex items-center justify-center px-8 py-3.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    View Product & Goal
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </button>
                </div>
              </div>

            </div>
          ))}

          {data.recommendations.length === 0 && (
            <div className="text-center py-16 glass rounded-3xl">
              <p className="text-slate-500 font-medium">No strict matches found for this specific goal combination.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
