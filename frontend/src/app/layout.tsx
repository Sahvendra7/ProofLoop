import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { Activity, Menu, Code } from 'lucide-react'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })

export const metadata: Metadata = {
  title: 'ProofLoop - Measure Your Skincare Journey',
  description: 'AI-powered skincare commerce that lets you measure your skin, understand what fits, visualize your goals, and track what changes.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`flex flex-col min-h-screen font-sans ${inter.variable} ${jakarta.variable} bg-slate-50 text-slate-900 selection:bg-indigo-500/30`}>
        
        {/* Modern floating header */}
        <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 py-4 pointer-events-none">
          <header className="pointer-events-auto bg-white/70 hover:bg-white/90 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] py-3 px-6 rounded-2xl flex items-center justify-between w-full max-w-5xl transition-all duration-300">
            <Link href="/" className="flex items-center space-x-2.5 font-jakarta font-bold text-xl tracking-tight group">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 group-hover:rotate-3 transition-transform duration-300">
                <Activity className="w-5 h-5" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">ProofLoop</span>
            </Link>

            <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
              <Link href="/#how-it-works" className="hover:text-slate-900 transition-colors">How it Works</Link>
              <Link href="/scan" className="hover:text-slate-900 transition-colors">Try AI Scan</Link>
              <a href="https://devpost.com" target="_blank" className="hover:text-slate-900 transition-colors flex items-center gap-1.5">
                <Code className="w-4 h-4" />
                Hackathon
              </a>
            </nav>

            <div className="flex items-center space-x-4">
              <Link 
                href="/scan" 
                className="hidden md:inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 bg-slate-900 rounded-xl hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5"
              >
                Get Started
              </Link>
              <button className="md:hidden text-slate-600 p-2">
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </header>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative pt-24">
          {/* Subtle global background glow */}
          <div className="absolute top-0 inset-x-0 h-screen overflow-hidden -z-10 pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-400/10 blur-[120px]" />
            <div className="absolute top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-violet-400/10 blur-[100px]" />
          </div>
          {children}
        </div>
      </body>
    </html>
  )
}
