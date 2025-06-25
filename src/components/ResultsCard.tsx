
import React from 'react';
import { Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResultsCardProps {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  summary: string;
  previewData?: any[];
  onReset: () => void;
}

const ResultsCard = ({ success, downloadUrl, filename, summary, previewData, onReset }: ResultsCardProps) => {
  const handleDownload = () => {
    if (downloadUrl && filename) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {success ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          )}
          <h3 className="text-lg font-medium text-gray-900">
            {success ? 'Processing Complete' : 'No Results Found'}
          </h3>
        </div>
        
        <Button variant="outline" onClick={onReset}>
          Reset
        </Button>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">{summary}</p>
      
      {success && downloadUrl && (
        <div className="space-y-4">
          <Button onClick={handleDownload} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download {filename || 'Results'}
          </Button>
          
          {previewData && previewData.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h4 className="text-sm font-medium text-gray-900">Preview (first 10 rows)</h4>
              </div>
              <div className="p-4 bg-white overflow-x-auto">
                <div className="grid gap-2 text-xs">
                  {previewData.slice(0, 10).map((row, index) => (
                    <div key={index} className="grid grid-cols-3 gap-4 py-1 border-b border-gray-100 last:border-0">
                      {Object.entries(row).slice(0, 3).map(([key, value]) => (
                        <div key={key} className="truncate">
                          <span className="font-medium text-gray-600">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsCard;
