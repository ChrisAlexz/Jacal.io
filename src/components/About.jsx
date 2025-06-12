import React from 'react';
import Layout from './Layout';
import '../styles/About.css';
import { MdSchool, MdFolderSpecial, MdBrush, MdBarChart, MdEditNote, MdDevices, MdRecordVoiceOver, MdImage, MdSpeed, MdMemory } from 'react-icons/md';

export default function About() {
  return (
    <Layout>
      <div className="about-container">
        {/* Hero Section */}
        <div className="about-hero">
          <div className="hero-content">
            <div className="hero-icon">
              <div className="orbit-container">
                <div className="orbit-center"></div>
                <div className="orbit-ring">
                  <div className="orbit-particle orbit-particle-1"></div>
                  <div className="orbit-particle orbit-particle-2"></div>
                  <div className="orbit-particle orbit-particle-3"></div>
                </div>
              </div>
            </div>
            <h1 className="hero-title">Learn Smarter, Not Harder</h1>
            <p className="hero-subtitle">
              Master any subject with our advanced flashcard system featuring multimedia support, 
              multiple card types, and scientifically-proven learning techniques
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div className="features-section">
          <div className="section-header">
            <h2 className="section-title">Powerful Learning Features</h2>
            <p className="section-subtitle">
              Everything you need for effective studying, from basic flashcards to advanced learning modes
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon tech-icon">
                <MdSchool />
              </div>
              <div className="feature-content">
                <h3>Smart Spaced Repetition</h3>
                <p>
                  Our intelligent algorithm automatically schedules your review sessions based on how well you know each card. 
                  Rate cards as Easy, Good, Hard, or Again to optimize your learning intervals and maximize retention.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon design-icon">
                <MdBrush />
              </div>
              <div className="feature-content">
                <h3>Rich Text Formatting</h3>
                <p>
                  Create beautiful flashcards with advanced formatting including bold, italics, colors, 
                  superscript, subscript, and structured text. Perfect for detailed notes, definitions, and organized content.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon cloze-icon">
                <MdEditNote />
              </div>
              <div className="feature-content">
                <h3>Multiple Card Types</h3>
                <p>
                  Choose from Basic cards, Type-Answer cards for active recall, Cloze deletions for fill-in-the-blank, 
                  and Image Occlusion cards for visual learning. Each type optimized for different learning scenarios.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon mobile-icon">
                <MdRecordVoiceOver />
              </div>
              <div className="feature-content">
                <h3>Audio Integration</h3>
                <p>
                  Record and attach audio to both sides of your flashcards. Perfect for language learning, 
                  pronunciation practice, music theory, or creating audio-only study sessions for commuting.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon progress-icon">
                <MdImage />
              </div>
              <div className="feature-content">
                <h3>Image Occlusion</h3>
                <p>
                  Upload images and create interactive occlusion cards by covering parts of diagrams, maps, or charts. 
                  Ideal for anatomy, geography, technical diagrams, and visual memorization tasks.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon organize-icon">
                <MdSpeed />
              </div>
              <div className="feature-content">
                <h3>Speed Focus Mode</h3>
                <p>
                  Test your knowledge under time pressure with our Speed Focus mode. Quick-fire questions 
                  help identify weak areas and build confidence for exams and time-pressured scenarios.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon mobile-icon">
                <MdBarChart />
              </div>
              <div className="feature-content">
                <h3>Study Analytics</h3>
                <p>
                  Track your learning journey with detailed statistics, study streaks, and progress tracking. 
                  Monitor your performance and maintain consistent study habits with comprehensive insights.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon organize-icon">
                <MdFolderSpecial />
              </div>
              <div className="feature-content">
                <h3>Organized Learning</h3>
                <p>
                  Create unlimited sets organized by classes or subjects. Import decks from Anki and Quizlet, 
                  and keep your study materials perfectly organized and easily accessible across all your devices.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon mobile-icon">
                <MdDevices />
              </div>
              <div className="feature-content">
                <h3>Cross-Device Access</h3>
                <p>
                  Access your flashcards from any device with responsive design that adapts to desktop, 
                  tablet, and mobile screens. Your study progress syncs across all devices automatically.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="how-it-works-section">
          <div className="section-header">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">
              Get started in minutes with our intuitive learning system
            </p>
          </div>

          <div className="steps-container">
            <div className="step-item">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Create Your Study Material</h3>
                <p>
                  Build flashcard sets using our advanced editor with rich text formatting, math expressions, 
                  audio recordings, and images. Choose from multiple card types or import existing decks from Anki/Quizlet.
                </p>
              </div>
              <div className="step-visual create-visual">
                <div className="mock-card">
                  <div className="mock-text-line long"></div>
                  <div className="mock-text-line medium"></div>
                  <div className="mock-text-line short"></div>
                </div>
              </div>
            </div>

            <div className="step-item reverse">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Study with Intelligence</h3>
                <p>
                  Review your cards with spaced repetition algorithm. Rate each card's difficulty to customize 
                  your learning schedule. Use Speed Focus mode for quick reviews or regular study for deep learning.
                </p>
              </div>
              <div className="step-visual study-visual">
                <div className="difficulty-buttons-demo">
                  <div className="demo-btn again">Again</div>
                  <div className="demo-btn hard">Hard</div>
                  <div className="demo-btn good">Good</div>
                  <div className="demo-btn easy">Easy</div>
                </div>
              </div>
            </div>

            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Track Your Progress</h3>
                <p>
                  Monitor your learning with comprehensive analytics including study statistics, streak tracking, 
                  and performance insights to optimize your study routine and maintain consistency.
                </p>
              </div>
              <div className="step-visual progress-visual">
                <div className="progress-demo">
                  <div className="progress-bar-demo">
                    <div className="progress-fill-demo"></div>
                  </div>
                  <div className="stats-demo">
                    <div className="stat-demo">📚 25 Sets</div>
                    <div className="stat-demo">📄 485 Cards</div>
                    <div className="stat-demo">🔥 12 Day Streak</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card Types Section */}
        <div className="card-types-section">
          <div className="section-header">
            <h2 className="section-title">Flexible Card Types</h2>
            <p className="section-subtitle">
              Choose the perfect card type for your learning style and subject matter
            </p>
          </div>

          <div className="card-types-grid">
            <div className="card-type-item">
              <div className="card-type-icon">💭</div>
              <h4>Basic Cards</h4>
              <p>Traditional front-and-back flashcards perfect for vocabulary, definitions, and general Q&A.</p>
            </div>

            <div className="card-type-item">
              <div className="card-type-icon">⌨️</div>
              <h4>Type-Answer Cards</h4>
              <p>Active recall cards where you type the answer, improving retention through active engagement.</p>
            </div>

            <div className="card-type-item">
              <div className="card-type-icon">🔍</div>
              <h4>Cloze Deletions</h4>
              <p>Fill-in-the-blank style cards created by selecting text to hide, ideal for context-based learning.</p>
            </div>

            <div className="card-type-item">
              <div className="card-type-icon">🖼️</div>
              <h4>Image Occlusion</h4>
              <p>Interactive image-based cards where you cover and reveal parts of diagrams, perfect for visual subjects.</p>
            </div>
          </div>
        </div>

        {/* Science Section */}
        <div className="science-section">
          <div className="science-content">
            <div className="science-text">
              <h2>Built on Learning Science</h2>
              <p>
                Our platform combines cutting-edge cognitive psychology research with modern technology. 
                Spaced repetition, active recall, and multimedia learning are proven to be the most effective 
                methods for long-term retention and deep understanding.
              </p>
              <div className="science-stats">
                <div className="science-stat">
                  <div className="stat-number">85%</div>
                  <div className="stat-label">Better Retention</div>
                </div>
                <div className="science-stat">
                  <div className="stat-number">60%</div>
                  <div className="stat-label">Less Study Time</div>
                </div>
                <div className="science-stat">
                  <div className="stat-number">3x</div>
                  <div className="stat-label">Faster Learning</div>
                </div>
              </div>
            </div>
            <div className="science-visual">
              <div className="brain-diagram">
                <div className="brain-section section-1"></div>
                <div className="brain-section section-2"></div>
                <div className="brain-section section-3"></div>
                <div className="brain-waves">
                  <div className="wave wave-1"></div>
                  <div className="wave wave-2"></div>
                  <div className="wave wave-3"></div>
                </div>
              </div>
            </div>
          </div>
        </div>



        {/* CTA Section */}
        <div className="cta-section">
          <div className="cta-content">
            <h2>Ready to Transform Your Learning?</h2>
            <p>
              Join thousands of students, professionals, and lifelong learners who have discovered 
              the power of intelligent flashcards with multimedia support and advanced study modes.
            </p>
            <div className="cta-buttons">
              <button className="cta-primary">
                Get Started Free
              </button>
              <button className="cta-secondary">
                View Demo
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}