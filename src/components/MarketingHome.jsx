// src/components/MarketingHome.jsx - Unauthenticated landing page
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MarketingHome() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* Grid Background */}
      <div className="grid-background"></div>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="status-badge">
            <div className="status-dot"></div>
            <span>Powered by spaced repetition</span>
          </div>

          <h1 className="hero-title">
            The new standard for
            <br />
            <span className="gradient-text">intelligent learning</span>
          </h1>

          <p className="hero-description">
            Master any subject with scientifically-proven spaced repetition.
            Built for students, professionals, and lifelong learners.
          </p>

          <div className="hero-cta">
            <button className="btn-primary" onClick={() => navigate('/register')}>
              Start learning
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                const featuresSection = document.querySelector('.features-section');
                featuresSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Learn more
            </button>
          </div>

          <div className="social-proof">
            <span className="social-proof-text">Trusted by 10,000+ learners</span>
            <div className="social-proof-logos">
              <div className="logo-placeholder">Stanford</div>
              <div className="logo-placeholder">MIT</div>
              <div className="logo-placeholder">Harvard</div>
              <div className="logo-placeholder">Berkeley</div>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="terminal-window">
            <div className="terminal-header">
              <div className="terminal-controls">
                <div className="control control-close"></div>
                <div className="control control-minimize"></div>
                <div className="control control-maximize"></div>
              </div>
              <div className="terminal-title">flashcard-session.py</div>
            </div>
            <div className="terminal-body">
              <div className="terminal-line">
                <span className="prompt">$</span>
                <span className="command">python study.py --algorithm=spaced-repetition</span>
              </div>
              <div className="terminal-line">
                <span className="output">&#10003; Loading deck: Advanced Algorithms</span>
              </div>
              <div className="terminal-line">
                <span className="output">&#10003; Cards to review: 15</span>
              </div>
              <div className="terminal-line">
                <span className="output">&#10003; Optimizing intervals based on performance</span>
              </div>
              <div className="terminal-line typing">
                <span className="output">Starting session...</span>
                <span className="cursor">|</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">Features</div>
            <h2 className="section-title">Everything you need to master any subject</h2>
            <p className="section-description">
              Built with performance, scalability, and user experience in mind.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <h3>Spaced Repetition</h3>
              <p>AI-powered algorithm schedules reviews at optimal intervals for maximum retention.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/>
                  <path d="m19 9-5 5-4-4-3 3"/>
                </svg>
              </div>
              <h3>Progress Analytics</h3>
              <p>Detailed insights into your learning patterns and performance metrics.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v4"/>
                  <path d="M16 2v4"/>
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <path d="M3 10h18"/>
                </svg>
              </div>
              <h3>Customizable Flashcards</h3>
              <p>Personalize your cards with rich text, images, and custom formatting to match your learning style.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m16 6 4 14"/>
                  <path d="M12 6v14"/>
                  <path d="M8 6v14"/>
                  <path d="M4 6v14"/>
                </svg>
              </div>
              <h3>Organized Library</h3>
              <p>Hierarchical organization with folders, tags, and advanced search capabilities.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <h3>Multiple Card Types</h3>
              <p>Create basic, cloze deletion, and image occlusion cards to master any type of content effectively.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3>Privacy First</h3>
              <p>End-to-end encryption ensures your study data remains private and secure.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="marketing-stats-section">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">Science-backed learning</div>
            <h2 className="section-title">Proven by research</h2>
            <p className="section-description">
              Spaced repetition has been extensively studied and validated by cognitive scientists worldwide.
            </p>
          </div>
          <div className="marketing-stats-grid">
            {[
              { value: '85%', label: 'Better retention vs traditional methods', offset: '42.45' },
              { value: '50%', label: 'Less time needed to memorize', offset: '141.5' },
              { value: '3x', label: 'Faster learning with spaced intervals', offset: '188.67' },
              { value: '95%', label: 'Retention after optimal intervals', offset: '14.15' },
            ].map((stat, i) => (
              <div key={i} className="marketing-stat-item">
                <div className="marketing-stat-circle">
                  <svg viewBox="0 0 100 100">
                    <circle className="circle-bg" cx="50" cy="50" r="45"/>
                    <circle className="circle-progress" cx="50" cy="50" r="45" strokeDasharray="283" strokeDashoffset={stat.offset}/>
                  </svg>
                  <div className="marketing-stat-number">{stat.value}</div>
                </div>
                <div className="marketing-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Terminal Demo Section */}
      <section className="terminal-demo-section">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">Developer-friendly</div>
            <h2 className="section-title">Built for efficiency</h2>
            <p className="section-description">
              Our algorithm automatically calculates optimal review intervals based on your performance.
            </p>
          </div>
          <div className="terminal-demo-grid">
            {[
              {
                title: 'algorithm-analysis.py',
                lines: [
                  { type: 'cmd', text: 'python analyze_performance.py --user-id=12345' },
                  { type: 'out', text: '&#10003; Analyzing 847 review sessions...' },
                  { type: 'out', text: '&#10003; Optimal interval: 2.3 days' },
                  { type: 'out', text: '&#10003; Retention rate: 92.4%' },
                  { type: 'typing', text: 'Scheduling next review...' },
                ]
              },
              {
                title: 'deck-optimization.py',
                lines: [
                  { type: 'cmd', text: 'python optimize_deck.py --deck="Machine Learning"' },
                  { type: 'out', text: '&#10003; Cards ready for review: 23' },
                  { type: 'out', text: '&#10003; New cards to introduce: 5' },
                  { type: 'out', text: '&#10003; Estimated session time: 12 min' },
                  { type: 'typing', text: 'Generating study queue...' },
                ]
              }
            ].map((terminal, i) => (
              <div key={i} className="terminal-window">
                <div className="terminal-header">
                  <div className="terminal-controls">
                    <div className="control control-close"></div>
                    <div className="control control-minimize"></div>
                    <div className="control control-maximize"></div>
                  </div>
                  <div className="terminal-title">{terminal.title}</div>
                </div>
                <div className="terminal-body">
                  {terminal.lines.map((line, j) => (
                    <div key={j} className={`terminal-line${line.type === 'typing' ? ' typing' : ''}`}>
                      {line.type === 'cmd' && <span className="prompt">$</span>}
                      <span className={line.type === 'cmd' ? 'command' : 'output'}
                        dangerouslySetInnerHTML={{ __html: line.text }}
                      />
                      {line.type === 'typing' && <span className="cursor">|</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to transform your learning?</h2>
            <p>Join thousands of students and professionals using intelligent flashcards.</p>
            <button className="btn-primary" onClick={() => navigate('/register')}>
              Get started for free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
