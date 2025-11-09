import React from 'react';

const Header: React.FC = () => (
  <header className="bg-gray-900/80 backdrop-blur-sm text-white p-4 shadow-lg w-full sticky top-0 z-10 border-b border-gray-700">
    <div className="container mx-auto flex items-center gap-4">
       <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m0 0v8h4M21 8h-4m0 0v8h-4M3 12h18M3 16h4m14 0h-4" />
      </svg>
      <div>
        <h1 className="text-2xl font-bold">Gemini Storyboard Generator</h1>
        <p className="text-sm text-gray-400">Generate a sequence of images from a script using Gemini</p>
      </div>
    </div>
  </header>
);

export default Header;
