
import React from 'react';
import { Github, HelpCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  currentMode: 'labels' | 'quotes';
  onModeChange: (mode: 'labels' | 'quotes') => void;
}

const Header = ({ currentMode, onModeChange }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-semibold text-gray-900">DataUtils Pro</h1>
          
          {/* Mode Switch - Desktop */}
          <div className="hidden md:flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onModeChange('labels')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                currentMode === 'labels'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Label Spreadsheet
            </button>
            <button
              onClick={() => onModeChange('quotes')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                currentMode === 'quotes'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Extract Quotes
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" className="hidden md:inline-flex">
            <Info className="h-4 w-4 mr-2" />
            About
          </Button>
          <Button variant="ghost" size="sm">
            <HelpCircle className="h-4 w-4" />
            <span className="hidden md:inline ml-2">Help</span>
          </Button>
          <Button variant="ghost" size="sm">
            <Github className="h-4 w-4" />
            <span className="hidden md:inline ml-2">GitHub</span>
          </Button>
        </div>
      </div>

      {/* Mode Switch - Mobile */}
      <div className="md:hidden mt-4">
        <select
          value={currentMode}
          onChange={(e) => onModeChange(e.target.value as 'labels' | 'quotes')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="labels">Label Spreadsheet</option>
          <option value="quotes">Extract Quotes</option>
        </select>
      </div>
    </header>
  );
};

export default Header;
