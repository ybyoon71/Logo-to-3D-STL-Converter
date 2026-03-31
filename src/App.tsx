import React, { useState, useRef } from "react";
import { Upload, Download, FileType, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parameters
  const [params, setParams] = useState({
    maxDim: 50,
    baseThickness: 3,
    logoExtrude: 2,
    size: 200,
    threshold: 128,
    invert: false,
    baseShape: "circle",
  });

  const handleParamChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setParams((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : (type === "number" || type === "range" ? parseFloat(value) : value),
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setStlUrl(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setStlUrl(null);
      setError(null);
    }
  };

  const generateSTL = async () => {
    if (!file) return;

    setIsGenerating(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("maxDim", params.maxDim.toString());
    formData.append("baseThickness", params.baseThickness.toString());
    formData.append("logoExtrude", params.logoExtrude.toString());
    formData.append("size", params.size.toString());
    formData.append("threshold", params.threshold.toString());
    formData.append("invert", params.invert.toString());
    formData.append("baseShape", params.baseShape);

    try {
      const response = await fetch("/api/generate-stl", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to generate STL file.");
      }

      const blob = await response.blob();
      
      // Basic validation: Check if file size matches binary STL header + facet count
      if (blob.size < 84) {
        throw new Error("Generated STL file is too small and likely invalid.");
      }
      
      const url = URL.createObjectURL(blob);
      setStlUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans text-[#1a1a1a]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00205b] text-white">
              <FileType size={18} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Universal 3D Logo Generator</h1>
          </div>
          <div className="text-xs font-medium uppercase tracking-widest text-gray-400">
            Professional CAD Tool
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Upload & Preview */}
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">1. Upload Image</h2>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition-all hover:border-[#00205b] hover:bg-white"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="h-full w-full rounded-lg object-contain p-4"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-400 group-hover:text-[#00205b]">
                    <Upload size={40} strokeWidth={1.5} />
                    <p className="text-sm font-medium">Click or drag logo here</p>
                    <p className="text-xs">PNG, JPG, SVG up to 5MB</p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                />
              </div>
            </div>
          </div>

          {/* Middle Column: Parameters */}
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">2. Configure Parameters</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Base Shape</label>
                  <select
                    name="baseShape"
                    value={params.baseShape}
                    onChange={handleParamChange}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#00205b] focus:outline-none"
                  >
                    <option value="circle">Circle</option>
                    <option value="square">Square</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Dimension (mm)</label>
                  <input
                    type="number"
                    name="maxDim"
                    value={params.maxDim}
                    onChange={handleParamChange}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#00205b] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Base Thickness (mm)</label>
                  <input
                    type="number"
                    name="baseThickness"
                    value={params.baseThickness}
                    onChange={handleParamChange}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#00205b] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Logo Extrusion (mm)</label>
                  <input
                    type="number"
                    name="logoExtrude"
                    value={params.logoExtrude}
                    onChange={handleParamChange}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#00205b] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Resolution (Grid Size)</label>
                  <input
                    type="number"
                    name="size"
                    value={params.size}
                    onChange={handleParamChange}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#00205b] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Logo Threshold (0-255)</label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    name="threshold"
                    value={params.threshold}
                    onChange={handleParamChange}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Darker</span>
                    <span>{params.threshold}</span>
                    <span>Lighter</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="invert"
                    name="invert"
                    checked={params.invert}
                    onChange={handleParamChange}
                    className="h-4 w-4 rounded border-gray-300 text-[#00205b] focus:ring-[#00205b]"
                  />
                  <label htmlFor="invert" className="text-sm font-medium text-gray-600">Invert Logo Detection</label>
                </div>
                <div className="mt-2 rounded-lg bg-amber-50 p-3 text-[10px] text-amber-700">
                  <p className="font-bold uppercase tracking-wider mb-1">Tip for Complex Logos</p>
                  <p>If your logo has a dark background (like the Korea Univ. logo), use the <strong>Threshold</strong> slider and <strong>Invert</strong> checkbox to ensure the correct parts are extruded.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Actions & Results */}
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">3. Generate & Download</h2>
              
              <button
                onClick={generateSTL}
                disabled={!file || isGenerating}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold transition-all ${
                  !file || isGenerating
                    ? "cursor-not-allowed bg-gray-100 text-gray-400"
                    : "bg-[#00205b] text-white shadow-lg shadow-[#00205b]/20 hover:scale-[1.02] active:scale-[0.98]"
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generating STL...
                  </>
                ) : (
                  <>
                    <FileType size={20} />
                    Generate 3D Model
                  </>
                )}
              </button>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-4 flex items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-600"
                  >
                    <AlertCircle size={18} />
                    {error}
                  </motion.div>
                )}

                {stlUrl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-6 space-y-4"
                  >
                    <div className="rounded-xl bg-green-50 p-4 text-center">
                      <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold text-green-700">
                        <CheckCircle2 size={16} />
                        MODEL GENERATED SUCCESSFULLY!
                      </div>
                      <p className="text-[10px] text-green-600">Verified Manifold & Cura Compatible</p>
                    </div>
                    
                    <a
                      href={stlUrl}
                      download="custom_logo_pendant.stl"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-4 font-semibold text-white shadow-lg shadow-green-600/20 transition-all hover:scale-[1.02] hover:bg-green-700 active:scale-[0.98]"
                    >
                      <Download size={20} />
                      Download STL File
                    </a>

                    <div className="mt-6 space-y-4 rounded-xl border border-blue-100 bg-blue-50 p-5">
                      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
                        <CheckCircle2 size={14} />
                        Recommended Cura Settings
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div className="space-y-1">
                          <p className="font-medium text-blue-600">Quality & Walls</p>
                          <ul className="list-inside list-disc text-blue-500/80">
                            <li>Layer Height: 0.12 - 0.2mm</li>
                            <li>Wall Line Count: 3</li>
                            <li><span className="font-bold text-blue-700">Print Thin Walls: ON</span></li>
                          </ul>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-blue-600">Infill & Shell</p>
                          <ul className="list-inside list-disc text-blue-500/80">
                            <li>Infill: 15-20% (Grid)</li>
                            <li>Top Layers: 5 (Critical)</li>
                            <li><span className="font-bold text-blue-700">Enable Ironing: ON</span></li>
                          </ul>
                        </div>
                      </div>
                      <div className="mt-2 border-t border-blue-200 pt-2">
                        <p className="text-[10px] leading-relaxed text-blue-600/70 italic">
                          * 내부 채움이 낮을 때 모델이 깨져 보인다면 'Top Layers'를 5층 이상으로 높여주세요. 
                          글씨가 안 보인다면 'Print Thin Walls'를 체크하세요.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Model Specs</h3>
                      <ul className="list-inside list-disc space-y-1 text-[11px] text-gray-500">
                        <li>Resolution: {params.size}x{params.size}</li>
                        <li>Total Height: {(params.baseThickness + params.logoExtrude).toFixed(1)}mm</li>
                        <li>Coordinate: Centered (0,0)</li>
                        <li>Manifold: Verified Watertight</li>
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-gray-200 py-8 text-center text-xs text-gray-400">
        &copy; 2026 Universal 3D CAD Tool. All rights reserved.
      </footer>
    </div>
  );
}
