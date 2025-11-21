import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Analyzer from './pages/Analyzer';
import KnowledgeBase from './pages/KnowledgeBase';

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Analyzer />} />
            <Route path="/kb" element={<KnowledgeBase />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;