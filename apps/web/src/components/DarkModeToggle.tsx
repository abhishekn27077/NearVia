import React, { useState, useEffect } from 'react';

const DarkModeToggle: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
  }, []);

  return (
    <button
      onClick={() => setIsDarkMode(!isDarkMode)}
      className={`p-3 rounded-full shadow-card transition duration-200 ${
        isDarkMode ? 'bg-cobalt text-white' : 'bg-amber text-charcoal'
      }`}
    >
      {isDarkMode ? '🌙 Dark Mode' : '☀ Light Mode'}
    </button>
  );
};

export default DarkModeToggle;