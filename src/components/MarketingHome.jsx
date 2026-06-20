'use client';
// src/components/MarketingHome.jsx - Unauthenticated landing page
import React from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  CalendarClock,
  TrendingUp,
  Palette,
  FolderTree,
  Shapes,
  ShieldCheck,
} from 'lucide-react';
import Wordmark from './Wordmark';

const FEATURES = [
  {
    Icon: CalendarClock,
    title: 'Spaced Repetition',
    desc: 'AI-powered algorithm schedules reviews at optimal intervals for maximum retention.',
  },
  {
    Icon: TrendingUp,
    title: 'Progress Analytics',
    desc: 'Detailed insights into your learning patterns and performance metrics.',
  },
  {
    Icon: Palette,
    title: 'Customizable Flashcards',
    desc: 'Personalize your cards with rich text, images, and custom formatting to match your learning style.',
  },
  {
    Icon: FolderTree,
    title: 'Organized Library',
    desc: 'Hierarchical organization with folders, tags, and advanced search capabilities.',
  },
  {
    Icon: Shapes,
    title: 'Multiple Card Types',
    desc: 'Create basic, cloze deletion, and image occlusion cards to master any type of content effectively.',
  },
  {
    Icon: ShieldCheck,
    title: 'Privacy First',
    desc: 'End-to-end encryption ensures your study data remains private and secure.',
  },
];

// WebGL canvas — client-only so it never runs during SSR (keeps SEO content intact)
const ParticleCityBackground = dynamic(() => import('./ParticleCityBackground'), {
  ssr: false,
});

export default function MarketingHome() {
  const router = useRouter();

  return (
    <>
      {/* Scroll-driven 3D particle city, fixed behind all marketing content */}
      <ParticleCityBackground />

      <div className="home-container">
        {/* Subtle grid overlay (transparent base so the 3D city shows through) */}
        <div className="grid-background"></div>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-wordmark" style={{ marginBottom: '1.5rem' }}>
            <Wordmark name="Jacal" />
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
            <button className="btn-primary" onClick={() => router.push('/register')}>
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
            <span className="social-proof-text">Trusted by Learners Globally</span>
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
            {FEATURES.map(({ Icon, title, desc }) => (
              <div className="feature-card" key={title}>
                <div className="feature-icon">
                  <Icon size={24} strokeWidth={2} aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
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
          <div className="study-demo-image">
            <img
              src="/study-library.jpg"
              alt="A student reviewing flashcards in a library"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to transform your learning?</h2>
            <p>Join thousands of students and professionals using intelligent flashcards.</p>
            <button className="btn-primary" onClick={() => router.push('/register')}>
              Get started for free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </section>
      </div>
    </>
  );
}
