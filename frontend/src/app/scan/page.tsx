"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, AlertCircle, ScanLine, ImagePlus, RefreshCcw, Aperture, X } from 'lucide-react';
import { analyzeSkin } from '@/lib/api';

export default function ScanPage() {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Camera State
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Stop camera when unmounting or switching modes
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stream]);

  const startCamera = async (currentFacingMode: 'user' | 'environment') => {
    stopCamera();
    setError(null);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: false,
      });
      setStream(newStream);
    } catch (err: any) {
      setError("Unable to access camera. Please check permissions.");
      setMode('upload');
    }
  };

  // Ensure srcObject is set once the video element is mounted
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, mode]);

  const handleModeSwitch = (newMode: 'upload' | 'camera') => {
    setMode(newMode);
    if (newMode === 'camera') {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
  };

  const toggleCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    startCamera(newMode);
  };

  const processFile = async (file: File | Blob) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Create a File object from Blob if necessary
      const imageFile = file instanceof File ? file : new File([file], "snapshot.jpg", { type: "image/jpeg" });
      const result = await analyzeSkin(imageFile);
      sessionStorage.setItem('currentScan', JSON.stringify(result));
      router.push('/profile');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze skin. Please try again.');
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            stopCamera();
            processFile(blob);
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden min-h-[80vh]">
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
        <div className="w-[600px] h-[600px] border border-slate-200/50 rounded-full absolute animate-[spin_60s_linear_infinite]" />
        <div className="w-[800px] h-[800px] border border-slate-200/50 rounded-full absolute animate-[spin_90s_linear_infinite_reverse]" />
      </div>

      <div className="max-w-md w-full glass rounded-[2rem] p-8 md:p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        
        {!isAnalyzing && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-8 mx-auto w-fit">
            <button
              onClick={() => handleModeSwitch('upload')}
              className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'upload' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Upload className="w-4 h-4 mr-2" /> Upload
            </button>
            <button
              onClick={() => handleModeSwitch('camera')}
              className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'camera' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Camera className="w-4 h-4 mr-2" /> Camera
            </button>
          </div>
        )}
        
        {mode === 'upload' && !isAnalyzing && (
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-100">
            <Camera className="w-10 h-10 text-indigo-600" />
          </div>
        )}
        
        <h1 className="text-3xl md:text-4xl font-jakarta font-bold text-slate-900 mb-4">
          {mode === 'camera' ? 'Take a Selfie' : 'Scan Your Skin'}
        </h1>
        <p className="text-slate-500 mb-8 font-light leading-relaxed">
          {mode === 'camera' 
            ? 'Ensure your face is well-lit and clearly visible.' 
            : 'Upload a clear selfie in natural light. Our YouCam AI engine will extract 14+ objective cosmetic signals.'}
        </p>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-start text-left shadow-sm">
            <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5 text-red-500" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {isAnalyzing ? (
          <div className="py-12 flex flex-col items-center relative">
            <div className="absolute inset-0 flex items-center justify-center -z-10">
              <div className="w-32 h-32 bg-indigo-500/10 rounded-full animate-ping" />
            </div>
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-600/30 animate-bounce">
              <ScanLine className="w-8 h-8" />
            </div>
            <p className="text-slate-900 font-bold text-lg font-jakarta">Analyzing measurements</p>
            <p className="text-sm text-slate-500 mt-2 font-light">Processing via YouCam AI Engine...</p>
          </div>
        ) : mode === 'upload' ? (
          <label className="relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-slate-300/60 rounded-[1.5rem] cursor-pointer hover:bg-slate-50/50 hover:border-indigo-400 transition-all duration-300 group overflow-hidden bg-slate-50/30">
            <div className="absolute inset-0 bg-indigo-50/0 group-hover:bg-indigo-50/50 transition-colors duration-500" />
            <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300">
                <ImagePlus className="w-5 h-5 text-indigo-500" />
              </div>
              <p className="mb-2 text-slate-700 font-medium font-jakarta">
                <span className="text-indigo-600 font-bold">Click to upload</span> or drag & drop
              </p>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">PNG, JPG up to 10MB</p>
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        ) : (
          <div className="relative w-full aspect-[3/4] bg-slate-900 rounded-[1.5rem] overflow-hidden shadow-inner flex flex-col items-center justify-center">
            {stream ? (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
                <div className="absolute bottom-6 inset-x-0 flex justify-center items-center gap-6 z-10">
                  <button 
                    onClick={() => handleModeSwitch('upload')}
                    className="w-12 h-12 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                  >
                    <Aperture className="w-8 h-8 text-indigo-600" />
                  </button>
                  <button 
                    onClick={toggleCamera}
                    className="w-12 h-12 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 transition"
                  >
                    <RefreshCcw className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-slate-400 flex flex-col items-center">
                <Camera className="w-8 h-8 mb-2 opacity-50 animate-pulse" />
                <span className="text-sm font-medium">Starting camera...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
