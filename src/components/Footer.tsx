
import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 text-center">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm text-gray-600">
          © {currentYear} • MIT License • v1.0.0 • 
          <a href="mailto:contact@datautils.dev" className="ml-1 text-indigo-600 hover:text-indigo-700">
            Contact
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
