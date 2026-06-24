"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  onClear: () => void;
  selectedFile: File | null;
  error: string | null;
  hint?: string;
  onUseSample?: () => void;
}

export default function FileUpload({
  onFileSelect,
  isLoading,
  onClear,
  selectedFile,
  error,
  hint = "Drag & drop your CSV file here",
  onUseSample,
}: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const validateAndSelectFile = (file: File | null) => {
    if (!file) return;
    onFileSelect(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all ${
          isDragActive
            ? "border-indigo-500 bg-indigo-500/5"
            : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".csv"
          onChange={handleChange}
          disabled={isLoading}
        />

        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-12 h-12 text-slate-500 mb-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
          />
        </svg>

        {selectedFile ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-200 mb-1">
              {selectedFile.name}
            </p>
            <p className="text-xs text-slate-500 mb-4">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </p>
            <button
              onClick={onClear}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div className="text-center flex flex-col items-center">
            <p className="text-sm font-medium text-slate-300 mb-1">
              {hint}, or{" "}
              <button
                onClick={onButtonClick}
                disabled={isLoading}
                className="text-indigo-400 hover:text-indigo-300 font-semibold focus:outline-none"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Only CSV files allowed (Max 50MB)
            </p>
            {onUseSample && (
              <button
                onClick={onUseSample}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition cursor-pointer"
              >
                Use sample CSV
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-rose-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <span className="text-sm text-rose-300 font-medium">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
