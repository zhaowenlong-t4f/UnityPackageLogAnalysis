import React, { useCallback, useState } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200
        flex flex-col items-center justify-center h-64 bg-white
        ${isDragging ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-50' : 'border-slate-300 hover:border-slate-400'}
        ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-800">上传 Unity 打包日志</h3>
      <p className="text-slate-500 mt-2 text-sm">拖拽 .txt 或 .log 文件到此处</p>
      
      <input 
        type="file" 
        accept=".txt,.log" 
        className="hidden" 
        id="fileInput"
        onChange={handleInputChange}
      />
      <label 
        htmlFor="fileInput"
        className="mt-6 px-6 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 cursor-pointer shadow-sm transition-all"
      >
        浏览文件
      </label>
    </div>
  );
};

export default FileUpload;