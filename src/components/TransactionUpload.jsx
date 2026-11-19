import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, AlertCircle, Sparkles } from 'lucide-react';

const TransactionUpload = ({ user, onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const uploadFile = async (file) => {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/v1/transactions/upload', {
        method: 'POST',
        headers: { 'x-user-id': user.id },
        body: formData,
      });
      const result = await response.json();
      if (result.success) onUploadSuccess(result.data);
      else setError(result.error || 'Upload failed');
    } catch (err) {
      setError('Network error connecting to backend API');
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/demo/load', {
        method: 'POST',
        headers: { 'x-user-id': user.id },
      });
      const result = await response.json();
      if (result.success) onUploadSuccess(result.data);
      else setError(result.error || 'Failed to load demo data');
    } catch (err) {
      setError('Network error connecting to backend API');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = React.useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) uploadFile(acceptedFiles[0]);
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.tsv', '.txt']
    }
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer text-center
          ${isDragActive ? 'border-green-500 bg-green-950/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900'}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="p-4 bg-slate-800 rounded-full">
            <Upload className="w-8 h-8 text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              {loading ? 'Analyzing Statement...' : 'Upload Statements'}
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Drag & drop a CSV or TSV bank statement, or click to browse.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <AlertCircle className="w-3 h-3" />
            <span>Processed locally — data never leaves your machine</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={loadDemoData}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-green-400 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Load 90 days of demo data
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-950/50 border border-red-800 text-red-400 text-xs rounded-lg text-center">
          {error}
        </div>
      )}
    </div>
  );
};

export default TransactionUpload;
