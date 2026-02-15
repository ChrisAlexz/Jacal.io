// src/hooks/useHomeStats.js - Home page stats and data fetching
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export const useHomeStats = (user) => {
  const [stats, setStats] = useState({ totalSets: 0, totalCards: 0, studiedToday: 0 });
  const [recentSets, setRecentSets] = useState([]);
  const [lastStudiedSet, setLastStudiedSet] = useState(null);
  const [loading, setLoading] = useState(true);

  const getLastStudiedSet = useCallback(async (availableSets) => {
    if (!user?.id || availableSets.length === 0) {
      setLastStudiedSet(null);
      return;
    }

    try {
      const { data: recentSession, error: sessionError } = await supabase
        .from('study_sessions')
        .select('set_id, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (!sessionError && recentSession) {
        const lastStudiedSetData = availableSets.find(set => set.id === recentSession.set_id);
        if (lastStudiedSetData && lastStudiedSetData.card_count > 0) {
          setLastStudiedSet({ ...lastStudiedSetData, last_studied_at: recentSession.updated_at });
          return;
        }
      }

      const { data: recentCards, error: cardsError } = await supabase
        .from('flashcard_cards')
        .select('set_id, last_reviewed')
        .eq('user_id', user.id)
        .not('last_reviewed', 'is', null)
        .order('last_reviewed', { ascending: false })
        .limit(10);

      if (!cardsError && recentCards && recentCards.length > 0) {
        const setReviewDates = {};
        recentCards.forEach(card => {
          if (!setReviewDates[card.set_id] || card.last_reviewed > setReviewDates[card.set_id]) {
            setReviewDates[card.set_id] = card.last_reviewed;
          }
        });

        let mostRecentSetId = null;
        let mostRecentDate = null;
        Object.entries(setReviewDates).forEach(([setId, reviewDate]) => {
          if (!mostRecentDate || reviewDate > mostRecentDate) {
            mostRecentDate = reviewDate;
            mostRecentSetId = setId;
          }
        });

        if (mostRecentSetId) {
          const lastStudiedSetData = availableSets.find(set => set.id === mostRecentSetId);
          if (lastStudiedSetData && lastStudiedSetData.card_count > 0) {
            setLastStudiedSet({ ...lastStudiedSetData, last_studied_at: mostRecentDate });
            return;
          }
        }
      }

      const setsWithCards = availableSets.filter(set => set.card_count > 0);
      if (setsWithCards.length > 0) {
        setLastStudiedSet(setsWithCards.sort((a, b) =>
          new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
        )[0]);
      } else {
        setLastStudiedSet(null);
      }
    } catch {
      const setsWithCards = availableSets.filter(set => set.card_count > 0);
      if (setsWithCards.length > 0) {
        setLastStudiedSet(setsWithCards.sort((a, b) =>
          new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
        )[0]);
      } else {
        setLastStudiedSet(null);
      }
    }
  }, [user?.id]);

  const fetchStats = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }

    try {
      const { data: userCards, error: cardsError } = await supabase
        .from('flashcard_cards')
        .select('set_id, id, user_id, last_reviewed')
        .eq('user_id', user.id);

      if (cardsError || !userCards || userCards.length === 0) {
        setStats({ totalSets: 0, totalCards: 0, studiedToday: 0 });
        setRecentSets([]);
        setLastStudiedSet(null);
        setLoading(false);
        return;
      }

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const studiedTodayCount = userCards.filter(card => {
        if (!card.last_reviewed) return false;
        const reviewDate = new Date(card.last_reviewed);
        return reviewDate >= todayStart && reviewDate < todayEnd;
      }).length;

      const setIds = [...new Set(userCards.map(card => card.set_id))].filter(Boolean);
      if (setIds.length === 0) {
        setStats({ totalSets: 0, totalCards: userCards.length, studiedToday: studiedTodayCount });
        setRecentSets([]);
        setLastStudiedSet(null);
        setLoading(false);
        return;
      }

      const setsData = [];
      for (const setId of setIds) {
        try {
          const { data: setData, error: setError } = await supabase
            .from('flashcard_sets').select('*').eq('id', setId).single();
          if (!setError && setData) setsData.push(setData);
        } catch { continue; }
      }

      if (setsData.length === 0) {
        setStats({ totalSets: 0, totalCards: userCards.length, studiedToday: studiedTodayCount });
        setRecentSets([]);
        setLastStudiedSet(null);
        setLoading(false);
        return;
      }

      const setsWithCounts = await Promise.all(
        setsData.map(async (set) => {
          try {
            const { count, error: countError } = await supabase
              .from('flashcard_cards')
              .select('*', { count: 'exact', head: true })
              .eq('set_id', set.id);
            return { ...set, card_count: countError ? 0 : (count || 0) };
          } catch { return { ...set, card_count: 0 }; }
        })
      );

      setStats({ totalSets: setsWithCounts.length, totalCards: userCards.length, studiedToday: studiedTodayCount });
      const sortedSets = setsWithCounts
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        .slice(0, 6);
      setRecentSets(sortedSets);
      await getLastStudiedSet(setsWithCounts);
    } catch {
      setStats({ totalSets: 0, totalCards: 0, studiedToday: 0 });
      setRecentSets([]);
      setLastStudiedSet(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, getLastStudiedSet]);

  useEffect(() => {
    setLoading(true);
    if (user) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [user, fetchStats]);

  return { stats, recentSets, lastStudiedSet, loading, fetchStats };
};
