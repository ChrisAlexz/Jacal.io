'use client';
// src/components/TubelightNavbar.jsx
// Floating "tubelight" navbar — dark-glass adaptation of the Apple-style spec.
// Tailwind (scoped, preflight off) + framer-motion + lucide.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, Layers, Info } from 'lucide-react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs';
import logo from '../assets/jacal.jpg';

const navItems = [
  { name: 'Home', url: '/', icon: Home },
  { name: 'Sets', url: '/set', icon: Layers },
  { name: 'About', url: '/about', icon: Info },
];

export default function TubelightNavbar() {
  const pathname = usePathname() || '/';
  const [scrolled, setScrolled] = useState(false);

  // rAF-throttled scroll listener; only updates state when the boolean flips.
  useEffect(() => {
    let frame = null;
    let last = false;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const next = window.scrollY > 50;
        if (next !== last) {
          last = next;
          setScrolled(next);
        }
        frame = null;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const isActive = (url) =>
    url === '/' ? pathname === '/' : pathname.startsWith(url);

  return (
    <div className="fixed bottom-0 sm:top-0 left-1/2 -translate-x-1/2 z-50 mb-4 sm:mb-6 sm:pt-6 pointer-events-none transition-all duration-500 ease-in-out max-w-[calc(100vw-1rem)]">
      <div
        className={`flex items-center rounded-full border text-white sm:backdrop-blur-lg shadow-lg pointer-events-auto transition-all duration-500 ease-in-out ${
          scrolled
            ? 'gap-1 sm:gap-2 bg-[#0a0a0a]/88 px-1 py-1 border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
            : 'gap-2 sm:gap-6 bg-[#0a0a0a]/72 px-2 py-2 sm:px-5 sm:py-3 border-white/10 shadow-[0_18px_48px_rgba(0,0,0,0.45)]'
        }`}
      >
        {/* Logo slot */}
        <Link
          href="/"
          className={`flex items-center shrink-0 transition-all duration-500 ${
            scrolled ? 'pl-2 pr-1 sm:pl-3' : 'pl-2 pr-1 sm:pl-5 sm:pr-3'
          }`}
        >
          <img
            src={logo.src}
            alt="Jacal"
            className="h-7 w-7 rounded-full object-cover"
          />
        </Link>

        {/* Nav items */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.url);
          return (
            <Link
              key={item.name}
              href={item.url}
              className={`relative cursor-pointer text-sm font-semibold rounded-full transition-all duration-500 whitespace-nowrap text-[#a1a1aa] hover:text-primary ${
                active ? 'bg-primary/10 text-primary' : ''
              } ${
                scrolled
                  ? 'px-3 py-2 sm:px-5'
                  : 'px-4 py-2.5 sm:px-10 sm:py-3.5'
              }`}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>

              {active && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-primary/5 rounded-full -z-10"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full">
                    <div className="absolute w-12 h-6 bg-primary/20 rounded-full blur-md -top-2 -left-2" />
                    <div className="absolute w-8 h-6 bg-primary/20 rounded-full blur-md -top-1" />
                    <div className="absolute w-4 h-4 bg-primary/20 rounded-full blur-sm top-0 left-2" />
                  </div>
                </motion.div>
              )}
            </Link>
          );
        })}

        {/* Auth controls */}
        <div className="flex items-center gap-1 shrink-0 pl-1 pr-2 sm:pr-2">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-sm font-semibold text-[#a1a1aa] hover:text-white rounded-full px-3 py-2 transition-colors duration-300">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="text-sm font-semibold text-white rounded-full px-4 py-2 bg-gradient-to-br from-[#4facfe] to-[#6366f1] hover:opacity-90 transition-opacity duration-300 whitespace-nowrap">
                Sign Up
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <div className="pl-1 pr-1">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </div>
    </div>
  );
}
