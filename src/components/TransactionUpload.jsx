import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';

const TransactionUpload = ({ onUploadSuccess }) => {
  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach((file) => {
      const formData = new FormData();
      formData.append('file', file);

      // Replace with your API endpoint
      fetch('/api/v1/transactions/upload', {
        method: 'POST',
        body: formData,
      })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          onUploadSuccess(result.data);
        } else {
          console.error('Upload failed:', result.error);
        }
      })
      .catch(error => console.error('Error uploading file:', error));
    });
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.tsv', '.txt']
    }
  });

  return (
    <div 
      {...getRootProps()} 
      className={`border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer 
        ${isDragActive ? 'border-green-500 bg-green-950/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900'}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="p-4 bg-slate-800 rounded-full">
          <Upload className="w-8 h-8 text-green-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Upload Statements</h3>
          <p className="text-sm text-slate-400 mt-1">
            Drag & drop CSV or TSV bank files here, or click to browse.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <AlertCircle className="w-3 h-3" />
          <span>Securely processed locally</span>
        </div>
      </div>
    </div>
  );
};

export default TransactionUpload;
EOF
