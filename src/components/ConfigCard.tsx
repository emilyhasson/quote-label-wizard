
import React, { useState } from 'react';
import { Eye, EyeOff, Plus, X } from 'lucide-react';
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
  contextWindow: number;
  metadata: string[];
  onFilesChange: (files: File[]) => void;
  onLabelsChange: (labels: string[]) => void;
  onPromptChange: (prompt: string) => void;
  onApiKeyChange: (apiKey: string) => void;
  onModelChange: (model: string) => void;
  onContextWindowChange: (contextWindow: number) => void;
  onMetadataChange: (metadata: string[]) => void;
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
  contextWindow,
  metadata,
  onFilesChange,
  onLabelsChange,
  onPromptChange,
  onApiKeyChange,
  onModelChange,
  onContextWindowChange,
  onMetadataChange,
  onRun,
  isProcessing
}: ConfigCardProps) => {
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [newMetadataField, setNewMetadataField] = useState('');

  const isReadyToRun = files.length > 0 && apiKey.length > 0 && (mode === 'quotes' || labels.length > 0);
  
  const acceptedTypes = mode === 'labels' ? ['.xlsx', '.csv'] : ['.txt', '.md'];

  const handleAddMetadata = () => {
    if (newMetadataField.trim() && !metadata.includes(newMetadataField.trim())) {
      onMetadataChange([...metadata, newMetadataField.trim()]);
      setNewMetadataField('');
    }
  };

  const handleRemoveMetadata = (index: number) => {
    const newMetadata = metadata.filter((_, i) => i !== index);
    onMetadataChange(newMetadata);
  };

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
        <>
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Context Window</h3>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">±</span>
              <Input
                type="number"
                min="10"
                max="500"
                value={contextWindow}
                onChange={(e) => onContextWindowChange(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-sm text-gray-600">characters around each quote</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Output Metadata Fields</h3>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {metadata.map((field, index) => (
                  <div key={index} className="flex items-center bg-gray-100 rounded-md px-3 py-1">
                    <span className="text-sm text-gray-700">{field}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-4 w-4 p-0 hover:bg-gray-200"
                      onClick={() => handleRemoveMetadata(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Add metadata field..."
                  value={newMetadataField}
                  onChange={(e) => setNewMetadataField(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMetadata();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMetadata}
                  disabled={!newMetadataField.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          {mode === 'labels' ? 'Labeling Instructions' : 'Extraction Prompt'}
        </h3>
        <Textarea
          placeholder={mode === 'labels' 
            ? "Customize the labeling instructions..." 
            : "Describe what kind of quotes you want to extract..."
          }
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[120px]"
        />
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
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
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
