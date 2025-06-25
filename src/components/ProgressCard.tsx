
import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ProgressCardProps {
  status: 'running' | 'success' | 'error';
  progress?: number;
  message: string;
  onCancel?: () => void;
  error?: string;
}

const ProgressCard = ({ status, progress, message, onCancel, error }: ProgressCardProps) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {status === 'running' && (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          )}
          {status === 'error' && (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <h3 className="text-lg font-medium text-gray-900">
            {status === 'running' && 'Processing...'}
            {status === 'success' && 'Complete'}
            {status === 'error' && 'Error'}
          </h3>
        </div>
        
        {status === 'running' && onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        )}
      </div>
      
      <p className="text-sm text-gray-600 mb-4">{message}</p>
      
      {status === 'running' && (
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          {progress !== undefined && (
            <p className="text-xs text-gray-500 text-right">{Math.round(progress)}%</p>
          )}
        </div>
      )}
      
      {status === 'error' && error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-start">
            <p className="text-sm text-red-800">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(error)}
              className="text-red-600 hover:text-red-800 ml-2"
            >
              Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressCard;
