import Link from 'next/link';
import { ArrowRight, ScanFace, Target, Sparkles, LineChart } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      
      {/* Hero Section */}
      <section className="relative px-6 pt-32 pb-24 md:pt-48 md:pb-32 overflow-hidden flex flex-col items-center text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-indigo-100 to-fuchsia-50 opacity-50 rounded-full blur-3xl -z-10" />
        
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 border border-slate-200/60 shadow-sm backdrop-blur-md mb-8 hover:scale-105 transition-transform cursor-pointer">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">YouCam Hackathon MVP</span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-jakarta font-extrabold tracking-tight text-slate-900 mb-8 max-w-5xl leading-[1.1]">
          Know your skin. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
            Measure what changes.
          </span>
        </h1>
        
        <p className="text-lg md:text-2xl text-slate-600 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
          ProofLoop combines AI skin analysis, explainable recommendations, and longitudinal tracking into one continuous shopping journey.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
          <Link 
            href="/scan" 
            className="group flex items-center justify-center px-8 py-4 bg-slate-900 text-white text-lg font-medium rounded-2xl hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/20 transition-all duration-300"
          >
            Start Skin Scan
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a 
            href="#how-it-works"
            className="flex items-center justify-center px-8 py-4 bg-white text-slate-900 text-lg font-medium rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 shadow-sm"
          >
            How it works
          </a>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="how-it-works" className="py-32 px-6 bg-white relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-jakarta font-bold text-slate-900 mb-6">The Measurable Loop</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto font-light">
              We replace marketing claims with mathematical confidence. Experience the complete journey from initial baseline to proven results.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1 */}
            <div className="group p-8 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 mb-6 group-hover:scale-110 transition-transform duration-300">
                <ScanFace className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-jakarta text-slate-900 mb-3">1. Scan & Measure</h3>
              <p className="text-slate-600 font-light leading-relaxed">
                Get objective measurements of hydration, texture, and 14+ signals using YouCam AI.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group p-8 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-pink-500 shadow-sm border border-slate-100 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-jakarta text-slate-900 mb-3">2. Choose a Goal</h3>
              <p className="text-slate-600 font-light leading-relaxed">
                Translate raw data into actionable goals like reducing redness or improving hydration.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group p-8 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-violet-500 shadow-sm border border-slate-100 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-jakarta text-slate-900 mb-3">3. Shop Matches</h3>
              <p className="text-slate-600 font-light leading-relaxed">
                Find products deterministically matched to your profile with clear explanations.
              </p>
            </div>

            {/* Card 4 */}
            <div className="group p-8 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm border border-slate-100 mb-6 group-hover:scale-110 transition-transform duration-300">
                <LineChart className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-jakarta text-slate-900 mb-3">4. Track Progress</h3>
              <p className="text-slate-600 font-light leading-relaxed">
                Compare future scans to your baseline to verify if a product actually worked.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Trust Layer / Dark Section */}
      <section className="py-32 px-6 bg-slate-900 text-white relative overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-500/20 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3" />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-jakarta font-bold mb-6">Built on Trust & Data</h2>
            <p className="text-lg text-slate-400 font-light max-w-2xl mx-auto">
              The ProofLoop engine is transparent by design. We separate objective measurements from conceptual goals.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-12 mb-16">
            <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-3 flex items-center text-indigo-300">
                <span className="w-2 h-2 bg-indigo-400 rounded-full mr-3"></span>
                AI Measurement
              </h3>
              <p className="text-slate-400 font-light leading-relaxed">Powered by the YouCam Skin Analysis API for objective, quantified skin signals.</p>
            </div>
            <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-3 flex items-center text-pink-300">
                <span className="w-2 h-2 bg-pink-400 rounded-full mr-3"></span>
                Deterministic Matches
              </h3>
              <p className="text-slate-400 font-light leading-relaxed">Generated logically from your measurements and our structured product catalogue.</p>
            </div>
            <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-3 flex items-center text-violet-300">
                <span className="w-2 h-2 bg-violet-400 rounded-full mr-3"></span>
                Conceptual Visualization
              </h3>
              <p className="text-slate-400 font-light leading-relaxed">Shows a conceptual appearance goal for inspiration, not a guaranteed medical result.</p>
            </div>
            <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-3 flex items-center text-emerald-300">
                <span className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></span>
                Mathematical Progress
              </h3>
              <p className="text-slate-400 font-light leading-relaxed">Compares baseline scans to current scans to objectively track metric changes.</p>
            </div>
          </div>

          <div className="bg-slate-950/50 p-6 rounded-2xl text-center text-sm text-slate-400 border border-slate-800">
            <strong className="text-slate-300 font-semibold uppercase tracking-wider text-xs mr-2">Disclaimer:</strong> 
            ProofLoop is a cosmetic shopping tool. It does not provide medical diagnoses, medical advice, or guarantee product results.
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 text-center bg-slate-50 border-t border-slate-200">
        <p className="text-slate-500 text-sm font-medium">
          &copy; 2026 ProofLoop. Built for the YouCam API Hackathon.
        </p>
      </footer>
    </main>
  );
}
