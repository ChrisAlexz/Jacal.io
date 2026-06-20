import React, { useContext } from 'react';
import { useRouter } from 'next/navigation';
import Layout from './Layout';
import UserAuthContext from './context/UserAuthContext';
import '../styles/About.css';
import { MdSchool, MdFolderSpecial, MdDevices, MdRecordVoiceOver } from 'react-icons/md';
import { FilePlus2, Brain, TrendingUp } from 'lucide-react';

export default function About() {
  const router = useRouter();
  const { isLoggedIn } = useContext(UserAuthContext);

  const handleGetStarted = () => {
    if (isLoggedIn) {
      // If user is already logged in, take them to the sets page or dashboard
      router.push('/set');
    } else {
      // If not logged in, take them to register
      router.push('/register');
    }
  };

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

          <div className="hiw-layout">
            <div className="hiw-image">
              <img
                src="/study-focus.jpg"
                alt="A student focused on studying with flashcards"
                loading="lazy"
              />
            </div>

            <ol className="hiw-steps">
              <li className="hiw-step">
                <div className="hiw-step-icon">
                  <FilePlus2 size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="hiw-step-body">
                  <span className="hiw-step-label">Step 1</span>
                  <h3>Create your study material</h3>
                  <p>
                    Build flashcard sets with our rich editor — text, math, audio,
                    and images — or import existing decks from Anki and Quizlet.
                  </p>
                </div>
              </li>

              <li className="hiw-step">
                <div className="hiw-step-icon">
                  <Brain size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="hiw-step-body">
                  <span className="hiw-step-label">Step 2</span>
                  <h3>Study with intelligence</h3>
                  <p>
                    Our spaced-repetition algorithm surfaces each card at the optimal
                    moment. Rate difficulty to fine-tune your personal learning curve.
                  </p>
                </div>
              </li>

              <li className="hiw-step">
                <div className="hiw-step-icon">
                  <TrendingUp size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="hiw-step-body">
                  <span className="hiw-step-label">Step 3</span>
                  <h3>Track your progress</h3>
                  <p>
                    Monitor streaks, retention, and study stats with clear analytics
                    that keep you consistent and motivated.
                  </p>
                </div>
              </li>
            </ol>
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
              <button className="cta-primary" onClick={handleGetStarted}>
                {isLoggedIn ? 'Go to Dashboard' : 'Get Started Free'}
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