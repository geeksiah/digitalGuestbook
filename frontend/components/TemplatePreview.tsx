'use client';

import { useState, useEffect } from 'react';
import { templatesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface TemplateFile {
  name: string;
  type: string;
  size?: number;
  editable: boolean;
}

interface TemplatePreviewProps {
  templateId: string;
}

export function TemplatePreview({ templateId }: TemplatePreviewProps) {
  const [files, setFiles] = useState<TemplateFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [templateId]);

  const loadFiles = async () => {
    try {
      const response = await templatesApi.getFiles(templateId);
      setFiles(response.data.files);
      
      // Auto-select index.html
      if (response.data.files.length > 0) {
        setSelectedFile('index.html');
        loadFileContent('index.html');
      }
    } catch (error: any) {
      toast.error('Failed to load template files');
      console.error('Load files error:', error);
    }
  };

  const loadFileContent = async (filePath: string) => {
    setLoading(true);
    try {
      const response = await templatesApi.getFileContent(templateId, filePath);
      setFileContent(response.data.content);
      setSelectedFile(filePath);
    } catch (error: any) {
      toast.error('Failed to load file content');
      setFileContent('');
      console.error('Load file content error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'directory': return '📁';
      case 'html': return '📄';
      case 'css': return '🎨';
      case 'javascript': case 'js': return '⚙️';
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': return '🖼️';
      case 'svg': return '🎭';
      case 'json': return '📋';
      default: return '📄';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
      {/* File List */}
      <div className="col-span-1 border border-gray-200 rounded-lg p-4 overflow-y-auto bg-white">
        <h3 className="font-semibold mb-3 text-gray-900">Template Files</h3>
        <div className="space-y-1">
          {files.length === 0 ? (
            <p className="text-sm text-gray-500">No files found</p>
          ) : (
            files.map((file) => (
              <button
                key={file.name}
                onClick={() => file.editable && loadFileContent(file.name)}
                disabled={!file.editable}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedFile === file.name
                    ? 'bg-primary-100 text-primary-900'
                    : file.editable
                    ? 'hover:bg-gray-100 text-gray-700'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center">
                  <span className="mr-2">{getFileIcon(file.type)}</span>
                  <span className="truncate flex-1">{file.name}</span>
                </div>
                {file.size && (
                  <div className="text-xs text-gray-500 ml-6 mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* File Content */}
      <div className="col-span-1 lg:col-span-3 border border-gray-200 rounded-lg overflow-hidden bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <div className="text-gray-500">Loading...</div>
            </div>
          </div>
        ) : selectedFile ? (
          <div className="h-full flex flex-col">
            <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="font-medium text-gray-900">{selectedFile}</span>
              <span className="text-sm text-gray-600">
                {fileContent.length.toLocaleString()} characters
              </span>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50">
              <pre className="p-4 text-sm font-mono leading-relaxed">
                <code className="text-gray-800">{fileContent}</code>
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Select a file to view its contents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Also export a simpler thumbnail preview component
export function TemplateThumbnail({ templateId, name }: { templateId: string; name: string }) {
  const [hasPreview, setHasPreview] = useState(true);
  const previewUrl = `/api/templates/${templateId}/preview`;

  return (
    <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
      {hasPreview ? (
        <img
          src={previewUrl}
          alt={`${name} preview`}
          className="w-full h-full object-cover"
          onError={() => setHasPreview(false)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
        <p className="text-white text-sm font-medium truncate">{name}</p>
      </div>
    </div>
  );
}