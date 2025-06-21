// src/components/Set.jsx - FIXED HIERARCHICAL TREE VIEW WITH LIMITED TITLE AND DATE
import React, { useEffect, useState, useContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import ClassDeckModal from './ClassDeckModal';
import ImportModal from './ImportModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import '../styles/Set.css';
import Layout from './Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronDown, 
  faChevronRight, 
  faTrash, 
  faEdit, 
  faPlus, 
  faSearch, 
  faBolt,
  faFileImport,
  faHome,
  faFolder,
  faFolderOpen,
  faEllipsisH,
  faList,
  faSortAmountDown,
  faSortAmountUp,
  faCalendarAlt,
  faEye,
  faArchive,
  faBookOpen,
  faLayerGroup
} from '@fortawesome/free-solid-svg-icons';

// Helper function to truncate title with ellipsis
const truncateTitle = (title, maxLength = 30) => {
  if (!title) return 'Untitled';
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown date';
  }
};

// Helper function to build tree structure from flat data
const buildTree = (folders, sets) => {
  try {
    console.log('Building tree with folders:', folders?.length, 'sets:', sets?.length);
    
    if (!Array.isArray(folders) || !Array.isArray(sets)) {
      console.error('Invalid input data for buildTree');
      return [];
    }
    
    const tree = [];
    const folderMap = new Map();
    
    // First pass: Create all folder objects
    folders.forEach(folder => {
      if (folder?.id) {
        folderMap.set(folder.id, {
          id: folder.id,
          name: folder.name,
          type: 'folder',
          created_at: folder.created_at,
          children: [],
          sets: [],
          parent_id: folder.parent_id
        });
      }
    });
    
    // Second pass: Add sets to their folders
    sets.forEach(set => {
      if (set?.id) {
        const deckItem = {
          id: set.id,
          name: set.title || 'Untitled Deck',
          type: 'deck',
          created_at: set.created_at,
          card_count: set.card_count || 0
        };
        
        if (set.class_id && folderMap.has(set.class_id)) {
          folderMap.get(set.class_id).sets.push(deckItem);
        } else {
          tree.push(deckItem);
        }
      }
    });
    
    // Third pass: Build hierarchy (single pass to avoid recursion)
    const rootFolders = [];
    const childFolders = [];
    
    folders.forEach(folder => {
      if (folder?.id && folderMap.has(folder.id)) {
        if (folder.parent_id) {
          childFolders.push(folder);
        } else {
          rootFolders.push(folder);
        }
      }
    });
    
    // Add root folders to tree
    rootFolders.forEach(folder => {
      if (folderMap.has(folder.id)) {
        tree.push(folderMap.get(folder.id));
      }
    });
    
    // Add child folders to their parents
    childFolders.forEach(folder => {
      if (folder.parent_id && folderMap.has(folder.parent_id) && folderMap.has(folder.id)) {
        const parent = folderMap.get(folder.parent_id);
        const child = folderMap.get(folder.id);
        parent.children.push(child);
        console.log('Added child folder', child.name, 'to parent', parent.name);
      }
    });
    
    // Sort tree
    const sortItems = (items) => {
      return items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    };
    
    const sortRecursively = (nodes) => {
      const sorted = sortItems(nodes);
      sorted.forEach(node => {
        if (node.type === 'folder') {
          node.children = sortRecursively(node.children);
          node.sets = sortItems(node.sets);
        }
      });
      return sorted;
    };
    
    const result = sortRecursively(tree);
    console.log('Final tree structure:', JSON.stringify(result, null, 2));
    console.log('Tree built successfully:', result.length, 'root items');
    return result;
    
  } catch (error) {
    console.error('Error building tree:', error);
    return [];
  }
};

// Tree Node Component - UPDATED WITH LIMITED TITLE AND DATE
const TreeNode = React.memo(({ 
  item, 
  depth = 0, 
  onToggleExpand, 
  onDeleteItem, 
  onCreateFolder, 
  onCreateDeck, 
  onImport,
  onNavigate,
  expandedFolders,
  searchTerm 
}) => {
  // ALL HOOKS MUST BE AT THE TOP - BEFORE ANY EARLY RETURNS
  const isFolder = item?.type === 'folder';
  const isExpanded = expandedFolders.has(item?.id);
  const hasChildren = isFolder && (
    (item?.children?.length > 0) || 
    (item?.sets?.length > 0)
  );
  
  // Filter children based on search
  const filteredChildren = useMemo(() => {
    if (!isFolder || !item?.children) return [];
    const filtered = item.children.filter(child => 
      child?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    console.log('Filtered children for', item.name, ':', filtered);
    return filtered;
  }, [isFolder, item?.children, searchTerm, item?.name]);
  
  const filteredSets = useMemo(() => {
    if (!isFolder || !item?.sets) return [];
    const filtered = item.sets.filter(set => 
      set?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    console.log('Filtered sets for', item.name, ':', filtered);
    return filtered;
  }, [isFolder, item?.sets, searchTerm, item?.name]);
  
  const handleItemClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isFolder && hasChildren) {
      onToggleExpand(item.id);
    } else if (!isFolder) {
      onNavigate(`/flashcards/${item.id}`);
    }
  }, [isFolder, hasChildren, item?.id, onToggleExpand, onNavigate]);
  
  const handleActionClick = useCallback((e, action) => {
    e.preventDefault();
    e.stopPropagation();
    
    switch (action) {
      case 'delete':
        onDeleteItem(item.id, item.name, item.type, e);
        break;
      case 'createFolder':
        onCreateFolder(item.id);
        break;
      case 'createDeck':
        onCreateDeck(item.id);
        break;
      case 'import':
        onImport(item.id);
        break;
      case 'study':
        onNavigate(`/study/${item.id}`);
        break;
      case 'edit':
        onNavigate(`/flashcards/${item.id}`);
        break;
    }
  }, [item?.id, item?.name, item?.type, onDeleteItem, onCreateFolder, onCreateDeck, onImport, onNavigate]);
  
  // NOW WE CAN DO EARLY RETURNS AFTER ALL HOOKS
  // Prevent deep nesting and validate item
  if (depth > 8 || !item?.id) {
    return null;
  }
  
  const hasVisibleChildren = filteredChildren.length > 0 || filteredSets.length > 0;
  
  // Don't render if search doesn't match and no visible children
  if (searchTerm && !item.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !hasVisibleChildren) {
    return null;
  }
  
  // Get truncated title and formatted date
  const displayTitle = truncateTitle(item.name, 30);
  const formattedDate = formatDate(item.created_at);
  
  return (
    <div className="tree-node">
      <div 
        className={`tree-item ${isFolder ? 'tree-folder' : 'tree-deck'}`}
        style={{ paddingLeft: `${Math.min(depth * 24 + 12, 240)}px` }}
        onClick={handleItemClick}
      >
        {/* Expand/Collapse Icon */}
        <div className="tree-icon">
          {isFolder && hasChildren && (
            <FontAwesomeIcon 
              icon={isExpanded ? faChevronDown : faChevronRight}
              className="expand-icon"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(item.id);
              }}
            />
          )}
          {isFolder && !hasChildren && <div className="expand-placeholder" />}
          
          {/* Item Icon */}
          <FontAwesomeIcon 
            icon={isFolder ? (isExpanded ? faFolderOpen : faFolder) : faBookOpen}
            className={`item-icon ${isFolder ? 'folder-icon' : 'deck-icon'}`}
          />
        </div>
        
        {/* Item Info - UPDATED WITH LIMITED TITLE AND DATE */}
        <div className="tree-item-info">
          <div className="tree-item-title-row">
            <span 
              className="tree-item-name" 
              title={item.name || 'Unnamed Item'} // Show full name on hover
            >
              {displayTitle}
            </span>
            <span className="tree-item-date">
              {formattedDate}
            </span>
          </div>
          <div className="tree-item-meta">
            {isFolder ? (
              <span className="item-count">
                {(item.children?.length || 0) + (item.sets?.length || 0)} items
              </span>
            ) : (
              <span className="card-count">
                {item.card_count || 0} cards
              </span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="tree-item-actions">
          {isFolder ? (
            <>
              <button
                className="tree-action-btn create-subfolder"
                onClick={(e) => handleActionClick(e, 'createFolder')}
                title="Create subfolder"
              >
                <FontAwesomeIcon icon={faFolder} />
              </button>
              <button
                className="tree-action-btn create-deck"
                onClick={(e) => handleActionClick(e, 'createDeck')}
                title="Create deck"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
              <button
                className="tree-action-btn import-deck"
                onClick={(e) => handleActionClick(e, 'import')}
                title="Import deck"
              >
                <FontAwesomeIcon icon={faFileImport} />
              </button>
            </>
          ) : (
            <>
              <button
                className="tree-action-btn study-deck"
                onClick={(e) => handleActionClick(e, 'study')}
                title="Study deck"
              >
                Study
              </button>
              <button
                className="tree-action-btn edit-deck"
                onClick={(e) => handleActionClick(e, 'edit')}
                title="Edit deck"
              >
                <FontAwesomeIcon icon={faEdit} />
              </button>
            </>
          )}
          <button
            className="tree-action-btn delete-item"
            onClick={(e) => handleActionClick(e, 'delete')}
            title={`Delete ${isFolder ? 'folder' : 'deck'}`}
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>
      
      {/* Children - Only render when expanded and has children */}
      {isFolder && isExpanded && hasVisibleChildren && (
        <div className="tree-children">
          {filteredChildren.map(child => (
            <TreeNode
              key={`folder-${child.id}`}
              item={child}
              depth={depth + 1}
              onToggleExpand={onToggleExpand}
              onDeleteItem={onDeleteItem}
              onCreateFolder={onCreateFolder}
              onCreateDeck={onCreateDeck}
              onImport={onImport}
              onNavigate={onNavigate}
              expandedFolders={expandedFolders}
              searchTerm={searchTerm}
            />
          ))}
          {filteredSets.map(set => (
            <TreeNode
              key={`deck-${set.id}`}
              item={set}
              depth={depth + 1}
              onToggleExpand={onToggleExpand}
              onDeleteItem={onDeleteItem}
              onCreateFolder={onCreateFolder}
              onCreateDeck={onCreateDeck}
              onImport={onImport}
              onNavigate={onNavigate}
              expandedFolders={expandedFolders}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Main SetPage Component
export default function SetPage() {
  const { user } = useContext(UserAuthContext);
  const navigate = useNavigate();
  
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('alphabetical');
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  
  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: '',
    id: null,
    name: '',
    onConfirm: null
  });

  // Memoized navigation function to prevent recreation
  const handleNavigate = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  const fetchAllData = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    
    try {
      console.log('Fetching all data...');
      
      // Fetch all folders
      const { data: foldersData, error: foldersError } = await supabase
        .from('classes')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (foldersError) {
        console.error('Error fetching folders:', foldersError);
        setTree([]);
        return;
      }

      // Fetch all flashcard sets
      const { data: setsData, error: setsError } = await supabase
        .from('flashcard_sets')
        .select('*')
        .eq('user_id', user.id)
        .order('title', { ascending: true });

      if (setsError) {
        console.error('Error fetching sets:', setsError);
        setTree([]);
        return;
      }

      console.log('Fetched folders:', foldersData?.length || 0);
      console.log('Fetched sets:', setsData?.length || 0);

      // Get card counts for all sets
      const setsWithCounts = await Promise.all(
        (setsData || []).map(async (set) => {
          if (!set?.id) return null;
          
          try {
            const { count, error: countError } = await supabase
              .from('flashcard_cards')
              .select('*', { count: 'exact', head: true })
              .eq('set_id', set.id);

            if (countError) {
              console.error('Error counting cards for set:', set.id, countError);
            }

            return {
              ...set,
              card_count: count || 0
            };
          } catch (error) {
            console.error('Error processing set:', set.id, error);
            return { ...set, card_count: 0 };
          }
        })
      );

      // Filter out null results
      const validSets = setsWithCounts.filter(Boolean);

      // Build tree structure
      const treeData = buildTree(foldersData || [], validSets);
      setTree(treeData);
      
    } catch (error) {
      console.error('Error in fetchAllData:', error);
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, fetchAllData]);

  const handleToggleExpand = useCallback((folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
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
            if (item.children) {
              traverse(item.children);
            }
          }
        });
      };
      traverse(nodes);
      return ids;
    };
    
    const folderIds = getAllFolderIds(tree);
    setExpandedFolders(new Set(folderIds));
  }, [tree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  const createNewFolder = useCallback(async (folderName, parentId = null) => {
    if (!folderName.trim()) return;

    try {
      const folderData = {
        name: folderName.trim(),
        user_id: user.id,
        parent_id: parentId
      };
      
      const { error } = await supabase
        .from('classes')
        .insert([folderData]);

      if (error) {
        throw new Error(error.message);
      }

      setShowCreateFolderModal(false);
      setSelectedFolderId(null);
      await fetchAllData();
      
    } catch (error) {
      console.error('Error in createNewFolder:', error);
      throw error;
    }
  }, [user?.id, fetchAllData]);

  const handleDeleteItem = useCallback((itemId, itemName, itemType, e) => {
    e.stopPropagation();
    
    setDeleteModal({
      isOpen: true,
      type: itemType,
      id: itemId,
      name: itemName,
      onConfirm: () => performDeleteItem(itemId, itemType),
      title: itemType === 'folder' ? 'Delete Folder' : 'Delete Deck',
      message: itemType === 'folder' 
        ? `This will permanently delete the folder "${itemName}" and all its contents. This action cannot be undone.`
        : `This will permanently delete the deck "${itemName}" and all its cards. This action cannot be undone.`
    });
  }, []);

  const performDeleteItem = useCallback(async (itemId, itemType) => {
    try {
      const table = itemType === 'folder' ? 'classes' : 'flashcard_sets';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', itemId);

      if (!error) {
        await fetchAllData();
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  }, [fetchAllData]);

  const closeDeleteModal = useCallback(() => {
    setDeleteModal({
      isOpen: false,
      type: '',
      id: null,
      name: '',
      onConfirm: null
    });
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

  if (!user) {
    return (
      <Layout>
        <div className="set-page">
          <div className="auth-required">
            <div className="auth-required-card">
              <div className="auth-icon">🔐</div>
              <h2>Authentication Required</h2>
              <p>Please log in to view your flashcard sets</p>
              <button 
                onClick={() => navigate('/register')}
                className="auth-btn"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="set-page">
        <div className="set-container">
          {/* Header Section */}
          <div className="set-header">
            <div className="header-content">
              <div className="header-text">
                <h1>My Learning Library</h1>
                <p>Organize and manage your flashcard collections</p>
              </div>
              <div className="header-actions">
                <button 
                  onClick={() => handleCreateFolder()}
                  className="create-folder-btn"
                  title="Create New Folder"
                >
                  <FontAwesomeIcon icon={faFolder} className="btn-icon" />
                  New Folder
                </button>
                
                <button 
                  onClick={() => handleImport()}
                  className="import-btn"
                  title="Import from Anki or Quizlet"
                >
                  <FontAwesomeIcon icon={faFileImport} className="btn-icon" />
                  Import
                </button>
                
                <button 
                  onClick={() => handleCreateDeck()}
                  className="create-set-btn"
                  title="Create New Deck"
                >
                  <span className="btn-icon">+</span>
                  New Deck
                </button>
              </div>
            </div>
            
            {/* Controls Bar */}
            <div className="enhanced-controls-bar">
              <div className="search-and-sort">
                <div className="search-container">
                  <FontAwesomeIcon icon={faSearch} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search folders and decks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                
                <div className="sort-container">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="sort-select"
                  >
                    <option value="alphabetical">Alphabetical</option>
                    <option value="recent">Recently Modified</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>

              <div className="tree-controls">
                <button
                  className="tree-control-btn"
                  onClick={handleExpandAll}
                  title="Expand All"
                >
                  <FontAwesomeIcon icon={faLayerGroup} />
                  Expand All
                </button>
                <button
                  className="tree-control-btn"
                  onClick={handleCollapseAll}
                  title="Collapse All"
                >
                  <FontAwesomeIcon icon={faList} />
                  Collapse All
                </button>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="set-content">
            {loading ? (
              <div className="loading-section">
                <div className="loading-spinner"></div>
                <p>Loading your library...</p>
              </div>
            ) : tree.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📚</div>
                <h3>Welcome to your library</h3>
                <p>Start building your learning library by creating folders and flashcard decks!</p>
                <div className="empty-actions">
                  <button 
                    onClick={() => handleCreateFolder()}
                    className="empty-action-btn secondary"
                  >
                    <FontAwesomeIcon icon={faFolder} />
                    Create Folder
                  </button>
                  <button 
                    onClick={() => handleCreateDeck()}
                    className="empty-action-btn"
                  >
                    Create Deck
                  </button>
                  <button 
                    onClick={() => handleImport()}
                    className="empty-action-btn secondary"
                  >
                    <FontAwesomeIcon icon={faFileImport} />
                    Import Decks
                  </button>
                </div>
              </div>
            ) : (
              <div className="tree-view">
                {tree.map(item => (
                  <TreeNode
                    key={item.id}
                    item={item}
                    depth={0}
                    onToggleExpand={handleToggleExpand}
                    onDeleteItem={handleDeleteItem}
                    onCreateFolder={handleCreateFolder}
                    onCreateDeck={handleCreateDeck}
                    onImport={handleImport}
                    onNavigate={handleNavigate}
                    expandedFolders={expandedFolders}
                    searchTerm={searchTerm}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        {showModal && (
          <ClassDeckModal
            onClose={() => {
              setShowModal(false);
              setSelectedFolderId(null);
            }}
            onSuccess={() => {
              fetchAllData();
              setShowModal(false);
              setSelectedFolderId(null);
            }}
            preselectedClassId={selectedFolderId}
          />
        )}

        {showImportModal && (
          <ImportModal
            onClose={() => {
              setShowImportModal(false);
              setSelectedFolderId(null);
            }}
            onSuccess={handleImportSuccess}
            preselectedClassId={selectedFolderId}
          />
        )}

        {showCreateFolderModal && (
          <CreateFolderModal
            onClose={() => {
              setShowCreateFolderModal(false);
              setSelectedFolderId(null);
            }}
            onSuccess={(folderName) => createNewFolder(folderName, selectedFolderId)}
            parentFolderId={selectedFolderId}
          />
        )}

        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={closeDeleteModal}
          onConfirm={deleteModal.onConfirm}
          title={deleteModal.title}
          message={deleteModal.message}
          itemName={deleteModal.name}
          type={deleteModal.type}
        />
      </div>
    </Layout>
  );
}

// Create Folder Modal Component
const CreateFolderModal = React.memo(({ onClose, onSuccess, parentFolderId }) => {
  const [folderName, setFolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      await onSuccess(folderName);
    } catch (err) {
      setError(err.message || 'Failed to create folder');
      setLoading(false);
    }
  }, [folderName, onSuccess]);

  return (
    <div className="modal-overlay">
      <div className="modal-content create-folder-modal">
        <div className="modal-header">
          <h3>Create New Folder</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          {parentFolderId && (
            <div className="current-location">
              <span className="location-label">Creating in folder:</span>
              <div className="location-path">
                <FontAwesomeIcon icon={faFolder} />
                <span>Selected Folder</span>
              </div>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="folderName">Folder Name</label>
            <input
              type="text"
              id="folderName"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name..."
              autoFocus
              maxLength={50}
              className="folder-name-input"
              disabled={loading}
            />
          </div>
        </form>

        <div className="modal-footer">
          <button 
            type="button" 
            onClick={onClose}
            className="modal-btn secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            onClick={handleSubmit}
            disabled={!folderName.trim() || loading}
            className="modal-btn primary"
          >
            {loading ? (
              <>
                <span className="loading-spinner-small"></span>
                Creating...
              </>
            ) : (
              'Create Folder'
            )}
          </button>
        </div>
      </div>
    </div>
  );
});