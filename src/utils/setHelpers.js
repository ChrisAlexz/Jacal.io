// src/utils/setHelpers.js - Pure helper functions for Set page

export const truncateTitle = (title, maxLength = 30) => {
  if (!title) return 'Untitled';
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
};

export const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return 'Unknown date';
  }
};

export const sortItems = (items, sortBy) => {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'alphabetical':
        return a.name.localeCompare(b.name);
      case 'recent':
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      case 'oldest':
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      default:
        return 0;
    }
  });
};

export const filterItems = (items, searchTerm) => {
  if (!searchTerm.trim()) return items;
  const lowercaseSearch = searchTerm.toLowerCase();

  return items.filter(item => {
    const nameMatches = item.name?.toLowerCase().includes(lowercaseSearch);
    if (item.type === 'folder') {
      const childrenMatch = item.children?.some(child => child.name?.toLowerCase().includes(lowercaseSearch));
      const setsMatch = item.sets?.some(set => set.name?.toLowerCase().includes(lowercaseSearch));
      return nameMatches || childrenMatch || setsMatch;
    }
    return nameMatches;
  });
};

export const buildTree = (folders, sets, sortBy, searchTerm) => {
  try {
    if (!Array.isArray(folders) || !Array.isArray(sets)) return [];

    const tree = [];
    const folderMap = new Map();

    folders.forEach(folder => {
      if (folder?.id) {
        folderMap.set(folder.id, {
          id: folder.id, name: folder.name, type: 'folder',
          created_at: folder.created_at, children: [], sets: [], parent_id: folder.parent_id
        });
      }
    });

    sets.forEach(set => {
      if (set?.id) {
        const deckItem = {
          id: set.id, name: set.title || 'Untitled Deck', type: 'deck',
          created_at: set.created_at, card_count: set.card_count || 0
        };
        if (set.class_id && folderMap.has(set.class_id)) {
          folderMap.get(set.class_id).sets.push(deckItem);
        } else {
          tree.push(deckItem);
        }
      }
    });

    const rootFolders = [];
    const childFolders = [];
    folders.forEach(folder => {
      if (folder?.id && folderMap.has(folder.id)) {
        (folder.parent_id ? childFolders : rootFolders).push(folder);
      }
    });

    rootFolders.forEach(folder => {
      if (folderMap.has(folder.id)) tree.push(folderMap.get(folder.id));
    });

    childFolders.forEach(folder => {
      if (folder.parent_id && folderMap.has(folder.parent_id) && folderMap.has(folder.id)) {
        folderMap.get(folder.parent_id).children.push(folderMap.get(folder.id));
      }
    });

    const sortRecursively = (nodes) => {
      const sorted = sortItems(nodes, sortBy);
      sorted.forEach(node => {
        if (node.type === 'folder') {
          node.children = sortRecursively(node.children);
          node.sets = sortItems(node.sets, sortBy);
        }
      });
      return sorted;
    };

    return filterItems(sortRecursively(tree), searchTerm);
  } catch {
    return [];
  }
};
