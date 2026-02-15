// src/hooks/useSetManager.js - Set page data management
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { buildTree } from '../utils/setHelpers';

export const useSetManager = (user) => {
  const [folders, setFolders] = useState([]);
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('alphabetical');
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false, type: '', id: null, name: '', onConfirm: null
  });

  const tree = useMemo(() => buildTree(folders, sets, sortBy, searchTerm), [folders, sets, sortBy, searchTerm]);

  const fetchAllData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data: foldersData, error: foldersError } = await supabase
        .from('classes').select('*').eq('user_id', user.id).order('name', { ascending: true });
      if (foldersError) { setFolders([]); return; }

      const { data: setsData, error: setsError } = await supabase
        .from('flashcard_sets').select('*').eq('user_id', user.id).order('title', { ascending: true });
      if (setsError) { setSets([]); return; }

      const setsWithCounts = await Promise.all(
        (setsData || []).map(async (set) => {
          if (!set?.id) return null;
          try {
            const { count, error: countError } = await supabase
              .from('flashcard_cards').select('*', { count: 'exact', head: true }).eq('set_id', set.id);
            return { ...set, card_count: countError ? 0 : (count || 0) };
          } catch { return { ...set, card_count: 0 }; }
        })
      );

      setFolders(foldersData || []);
      setSets(setsWithCounts.filter(Boolean));
    } catch {
      setFolders([]);
      setSets([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) fetchAllData();
  }, [user, fetchAllData]);

  const handleSortChange = useCallback((e) => setSortBy(e.target.value), []);
  const handleSearchChange = useCallback((e) => setSearchTerm(e.target.value), []);

  const handleToggleExpand = useCallback((folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      newSet.has(folderId) ? newSet.delete(folderId) : newSet.add(folderId);
      return newSet;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const getAllFolderIds = (nodes) => {
      const ids = [];
      const traverse = (items) => {
        items.forEach(item => {
          if (item?.type === 'folder' && item.id) {
            ids.push(item.id);
            if (item.children) traverse(item.children);
          }
        });
      };
      traverse(nodes);
      return ids;
    };
    setExpandedFolders(new Set(getAllFolderIds(tree)));
  }, [tree]);

  const handleCollapseAll = useCallback(() => setExpandedFolders(new Set()), []);

  const createNewFolder = useCallback(async (folderName, parentId = null) => {
    if (!folderName.trim()) return;
    try {
      const { error } = await supabase
        .from('classes').insert([{ name: folderName.trim(), user_id: user.id, parent_id: parentId }]);
      if (error) throw new Error(error.message);
      setShowCreateFolderModal(false);
      setSelectedFolderId(null);
      await fetchAllData();
    } catch (error) { throw error; }
  }, [user?.id, fetchAllData]);

  const performDeleteItem = useCallback(async (itemId, itemType) => {
    try {
      const table = itemType === 'folder' ? 'classes' : 'flashcard_sets';
      const { error } = await supabase.from(table).delete().eq('id', itemId);
      if (!error) await fetchAllData();
    } catch { /* silent */ }
  }, [fetchAllData]);

  const handleDeleteItem = useCallback((itemId, itemName, itemType, e) => {
    e.stopPropagation();
    setDeleteModal({
      isOpen: true, type: itemType, id: itemId, name: itemName,
      onConfirm: () => performDeleteItem(itemId, itemType),
      title: itemType === 'folder' ? 'Delete Folder' : 'Delete Deck',
      message: itemType === 'folder'
        ? `This will permanently delete the folder "${itemName}" and all its contents. This action cannot be undone.`
        : `This will permanently delete the deck "${itemName}" and all its cards. This action cannot be undone.`
    });
  }, [performDeleteItem]);

  const closeDeleteModal = useCallback(() => {
    setDeleteModal({ isOpen: false, type: '', id: null, name: '', onConfirm: null });
  }, []);

  const handleImportSuccess = useCallback(() => {
    fetchAllData();
    setShowImportModal(false);
    setSelectedFolderId(null);
  }, [fetchAllData]);

  const handleCreateFolder = useCallback((parentId = null) => {
    setSelectedFolderId(parentId);
    setShowCreateFolderModal(true);
  }, []);

  const handleCreateDeck = useCallback((parentId = null) => {
    setSelectedFolderId(parentId);
    setShowModal(true);
  }, []);

  const handleImport = useCallback((parentId = null) => {
    setSelectedFolderId(parentId);
    setShowImportModal(true);
  }, []);

  return {
    // Data
    tree, folders, sets, loading, searchTerm, sortBy, expandedFolders,
    // Modal states
    showModal, setShowModal, showImportModal, setShowImportModal,
    selectedFolderId, setSelectedFolderId,
    showCreateFolderModal, setShowCreateFolderModal,
    deleteModal,
    // Actions
    fetchAllData, handleSortChange, handleSearchChange,
    handleToggleExpand, handleExpandAll, handleCollapseAll,
    createNewFolder, handleDeleteItem, closeDeleteModal,
    handleImportSuccess, handleCreateFolder, handleCreateDeck, handleImport,
  };
};
