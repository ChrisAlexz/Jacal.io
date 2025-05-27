// src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Home from './components/Home';
import About from './components/About';
import Set from './components/Set';
import Flashcard from './components/Flashcard';
import FlashcardStudyPage from './components/FlashcardStudyPage';
import Register from './components/authentication/Register';
import Navbar from './components/Navbar';
import FlashcardStudy from './components/FlashcardStudy';
import { UserAuthProvider } from './components/context/UserAuthContext';

function App() {
  return (
    <UserAuthProvider>
      <div className="app-container min-h-screen">
        <Navbar />
        <div className="page-content px-4 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/set" element={<Set />} />
            <Route path="/register" element={<Register />} />
            <Route path="/flashcards" element={<Flashcard />} />
            <Route path="/flashcards/:id" element={<Flashcard />} />
            <Route path="/study/:id" element={<FlashcardStudyPage />} />
          </Routes>
        </div>
      </div>
    </UserAuthProvider>
  );
}

export default App;