"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveBaseline } from '@/lib/api';
import { ChevronLeft, Save, Sparkles, Loader2, Info, User } from 'lucide-react';

export default function ProductPage() {
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [scan, setScan] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);

  useEffect(() => {
    const prodData = sessionStorage.getItem('selectedProduct');
    const scanData = sessionStorage.getItem('currentScan');
    
    if (!prodData || !scanData) {
      router.push('/scan');
      return;
    }

    setProduct(JSON.parse(prodData));
    setScan(JSON.parse(scanData));
  }, [router]);

  const handleSaveBaseline = async () => {
    setIsSaving(true);
    try {
      await saveBaseline(scan.id);
      router.push('/journey');
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  if (!product) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="flex-1 py-12 px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <button onClick={() => router.back()} className="group flex items-center text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Back to Matches
        </button>

        <div className="glass rounded-[2rem] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-8 md:p-10 border-b border-slate-100 bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-indigo-400 mb-2">{product.brand}</p>
                <h1 className="text-4xl font-jakarta font-bold tracking-tight">{product.name}</h1>
              </div>
              <div className="text-3xl font-jakarta font-bold bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
                ${product.price.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="p-8 md:p-10 grid lg:grid-cols-2 gap-12 items-start bg-white/50">
            
            {/* Simulation Area */}
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold font-jakarta text-slate-900 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-indigo-500" />
                  Goal Visualization
                </h2>
              </div>
              
              <div className="relative w-full aspect-[3/4] bg-slate-100 rounded-3xl overflow-hidden border-2 transition-colors duration-500 shadow-inner group">
                <div className={`absolute inset-0 transition-opacity duration-700 ${showSimulation ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100 to-fuchsia-50 opacity-50" />
                </div>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg mb-6 transition-all duration-500 ${showSimulation ? 'bg-indigo-600 text-white scale-110 shadow-indigo-500/30' : 'bg-white text-slate-400'}`}>
                    {showSimulation ? <Sparkles className="w-10 h-10" /> : <User className="w-10 h-10 opacity-20" />}
                  </div>
                  <p className={`font-bold text-lg font-jakarta mb-3 transition-colors duration-500 ${showSimulation ? 'text-indigo-900' : 'text-slate-600'}`}>
                    {showSimulation ? 'Goal Visualization Active' : 'Current Appearance'}
                  </p>
                  <p className="text-sm text-slate-500 max-w-[250px] font-medium leading-relaxed">
                    {showSimulation 
                      ? "Conceptual goal visualization based on your profile — not a prediction of guaranteed product results."
                      : "Your baseline skin snapshot from the AI scan."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <button 
                  onClick={() => setShowSimulation(!showSimulation)}
                  className={`w-full py-4 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center border-2 ${
                    showSimulation 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className={`w-5 h-5 mr-2 ${showSimulation ? 'text-indigo-500' : 'text-slate-400'}`} />
                  {showSimulation ? 'Revert to Current' : 'Simulate Goal'}
                </button>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold tracking-wider uppercase rounded-md">
                    Demo Placeholder
                  </span>
                  <p className="text-xs text-slate-400 font-medium">Connected to YouCam API</p>
                </div>
              </div>
            </div>

            {/* Product Details & Action */}
            <div className="space-y-10 flex flex-col h-full">
              <div className="space-y-8 flex-1">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                    <Info className="w-4 h-4 mr-2" />
                    Product Description
                  </h3>
                  <p className="text-slate-700 font-medium leading-relaxed">{product.description}</p>
                </div>
                
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Key Ingredients</h3>
                  <div className="flex flex-wrap gap-2">
                    {product.ingredients.map((ing: string) => (
                      <span key={ing} className="px-4 py-2 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-xl text-sm font-semibold">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Formulated Targets</h3>
                  <div className="flex flex-wrap gap-2">
                    {product.target_concerns.map((tc: string) => (
                      <span key={tc} className="px-4 py-2 border-2 border-indigo-100 bg-indigo-50/50 text-indigo-700 rounded-xl text-sm font-semibold">
                        {tc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-200 space-y-6">
                <div className="bg-slate-900 text-white p-6 rounded-2xl">
                  <h4 className="font-bold font-jakarta mb-2">Close the Loop</h4>
                  <p className="text-sm text-slate-400 font-medium leading-relaxed">
                    Shopping should be measurable. Save this scan as your baseline, use the product, and scan again later to verify real changes.
                  </p>
                </div>
                
                <button
                  onClick={handleSaveBaseline}
                  disabled={isSaving}
                  className="group w-full flex items-center justify-center py-5 bg-indigo-600 text-white font-bold text-lg rounded-2xl hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-600/30 transition-all duration-300 hover:-translate-y-0.5 disabled:bg-slate-300 disabled:shadow-none disabled:translate-y-0"
                >
                  {isSaving ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Save Baseline & Buy
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
