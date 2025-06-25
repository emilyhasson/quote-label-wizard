
import React, { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LabelInputProps {
  labels: string[];
  onLabelsChange: (labels: string[]) => void;
}

const LabelInput = ({ labels, onLabelsChange }: LabelInputProps) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const addLabel = () => {
    const trimmedValue = inputValue.trim();
    
    if (!trimmedValue) {
      setError('Label cannot be empty');
      return;
    }
    
    if (labels.includes(trimmedValue)) {
      setError('Label already exists');
      return;
    }
    
    onLabelsChange([...labels, trimmedValue]);
    setInputValue('');
    setError('');
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLabel();
    }
  };

  const removeLabel = (index: number) => {
    const newLabels = labels.filter((_, i) => i !== index);
    onLabelsChange(newLabels);
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Type label and press Enter"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError('');
            }}
            onKeyPress={handleKeyPress}
            className={error ? 'border-red-500 focus:ring-red-500' : ''}
          />
          {error && (
            <p className="text-xs text-red-600 mt-1">{error}</p>
          )}
        </div>
        <Button onClick={addLabel} disabled={!inputValue.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {labels.map((label, index) => (
            <div
              key={index}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors group"
            >
              <span>{label}</span>
              <button
                onClick={() => removeLabel(index)}
                className="ml-2 text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LabelInput;
