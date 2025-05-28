// src/components/About.jsx
import React from 'react';
import Layout from './Layout';
import '../styles/About.css';

export default function About() {
  return (
    <Layout>
      <div className="about-container">
        {/* Hero Section */}
        <div className="about-hero">
          <div className="hero-content">
            <div className="hero-icon">🧠</div>
            <h1 className="hero-title">Learn Smarter, Not Harder</h1>
            <p className="hero-subtitle">
              Master any subject with our intelligent flashcard system designed for modern learners
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div className="features-section">
          <div className="section-header">
            <h2 className="section-title">Why Choose Our Platform?</h2>
            <p className="section-subtitle">
              Built with cutting-edge learning science and modern technology
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon brain-icon">🧠</div>
              <div className="feature-content">
                <h3>Smart Spaced Repetition</h3>
                <p>
                  Our algorithm automatically schedules your review sessions based on how well you know each card. 
                  Study less, remember more with scientifically-proven spaced repetition.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon design-icon">🎨</div>
              <div className="feature-content">
                <h3>Rich Text Formatting</h3>
                <p>
                  Create beautiful flashcards with bold text, italics, colors, superscript, subscript, and more. 
                  Perfect for math equations, chemical formulas, and detailed notes.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon cloze-icon">📝</div>
              <div className="feature-content">
                <h3>Cloze Deletions</h3>
                <p>
                  Create fill-in-the-blank style cards by hiding key information. 
                  Perfect for memorizing definitions, dates, and important facts.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon mobile-icon">📱</div>
              <div className="feature-content">
                <h3>Study Anywhere</h3>
                <p>
                  Responsive design that works perfectly on desktop, tablet, and mobile. 
                  Study during your commute, lunch break, or whenever you have a spare moment.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon progress-icon">📊</div>
              <div className="feature-content">
                <h3>Progress Tracking</h3>
                <p>
                  Monitor your learning journey with detailed statistics and progress indicators. 
                  See how many cards you've mastered and track your daily study streaks.
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon organize-icon">📂</div>
              <div className="feature-content">
                <h3>Organized Learning</h3>
                <p>
                  Create unlimited sets and organize them by subject, class, or topic. 
                  Keep your study materials neat and easily accessible.
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
                <h3>Create Your Sets</h3>
                <p>
                  Add your study material by creating flashcard sets for different subjects. 
                  Use our rich text editor to format your content exactly how you want it.
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
                <h3>Study Smart</h3>
                <p>
                  Review your cards with our intelligent study system. Rate each card as Easy, Good, Hard, 
                  or Again to help the algorithm determine when to show it next.
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
                <h3>Track Progress</h3>
                <p>
                  Watch your knowledge grow with detailed progress tracking. 
                  See your daily study stats and celebrate your learning milestones.
                </p>
              </div>
              <div className="step-visual progress-visual">
                <div className="progress-demo">
                  <div className="progress-bar-demo">
                    <div className="progress-fill-demo"></div>
                  </div>
                  <div className="stats-demo">
                    <div className="stat-demo">📚 15 Sets</div>
                    <div className="stat-demo">📄 245 Cards</div>
                    <div className="stat-demo">🔥 7 Day Streak</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Science Section */}
        <div className="science-section">
          <div className="science-content">
            <div className="science-text">
              <h2>Built on Learning Science</h2>
              <p>
                Our platform is based on decades of cognitive psychology research. 
                Spaced repetition and active recall are proven to be the most effective 
                methods for long-term retention.
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
                  <div className="stat-number">2x</div>
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
              Join thousands of students, professionals, and lifelong learners who have 
              already discovered the power of intelligent flashcards.
            </p>
            <div className="cta-buttons">
              <button className="cta-primary">
                Get Started Free
              </button>
              <button className="cta-secondary">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}