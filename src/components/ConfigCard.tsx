
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUploader from './FileUploader';
import LabelInput from './LabelInput';

interface ConfigCardProps {
  mode: 'labels' | 'quotes';
  files: File[];
  labels: string[];
  prompt: string;
  apiKey: string;
  model: string;
  onFilesChange: (files: File[]) => void;
  onLabelsChange: (labels: string[]) => void;
  onPromptChange: (prompt: string) => void;
  onApiKeyChange: (apiKey: string) => void;
  onModelChange: (model: string) => void;
  onRun: () => void;
  isProcessing: boolean;
}

const ConfigCard = ({
  mode,
  files,
  labels,
  prompt,
  apiKey,
  model,
  onFilesChange,
  onLabelsChange,
  onPromptChange,
  onApiKeyChange,
  onModelChange,
  onRun,
  isProcessing
}: ConfigCardProps) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  const isReadyToRun = files.length > 0 && apiKey.length > 0 && (mode === 'quotes' || labels.length > 0);
  
  const acceptedTypes = mode === 'labels' ? ['.xlsx', '.csv'] : ['.txt', '.md'];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {mode === 'labels' ? 'Label Spreadsheet' : 'Extract Quotes'}
        </h2>
        <p className="text-sm text-gray-600">
          {mode === 'labels' 
            ? 'Upload a spreadsheet and add labels to categorize your data'
            : 'Upload text files and extract relevant quotes based on your criteria'
          }
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Upload Files</h3>
        <FileUploader
          multiple={mode === 'quotes'}
          acceptedTypes={acceptedTypes}
          files={files}
          onFilesChange={onFilesChange}
        />
      </div>

      {mode === 'labels' && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Labels</h3>
          <LabelInput labels={labels} onLabelsChange={onLabelsChange} />
        </div>
      )}

      {mode === 'quotes' && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Extraction Prompt</h3>
          <Textarea
            placeholder="Describe what kind of quotes you want to extract..."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
      )}

      <div>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors"
        >
          Custom Prompt (optional)
          {showPrompt ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {showPrompt && (
          <div className="mt-3">
            <Textarea
              placeholder={mode === 'labels' 
                ? "Add custom instructions for labeling..." 
                : "Additional context or instructions..."
              }
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={3}
            />
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">API Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-2">
              OpenAI API Key
              <span className="text-gray-400 ml-1">(stored only in your browser)</span>
            </label>
            <div className="relative">
              <Input
                type={apiKeyVisible ? 'text' : 'password'}
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                className={apiKey.length > 0 && apiKey.length < 20 ? 'border-yellow-500' : ''}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => setApiKeyVisible(!apiKeyVisible)}
              >
                {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {apiKey.length > 0 && apiKey.length < 20 && (
              <p className="text-xs text-yellow-600 mt-1">API key looks too short</p>
            )}
          </div>
          
          <div>
            <label className="block text-xs text-gray-600 mb-2">Model</label>
            <Select value={model} onValueChange={onModelChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-3.5-turbo-16k">GPT-3.5 Turbo 16K</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button 
        onClick={onRun}
        disabled={!isReadyToRun || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? 'Processing...' : `Run ${mode === 'labels' ? 'Labeling' : 'Quote Extraction'}`}
      </Button>
    </div>
  );
};

export default ConfigCard;
