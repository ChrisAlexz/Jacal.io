// src/components/Set.jsx - Shows subfolders as individual visual items
import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  faArrowLeft,
  faHome,
  faFolder,
  faFolderOpen,
  faEllipsisH,
  faTh,
  faList,
  faSortAmountDown,
  faSortAmountUp,
  faCalendarAlt,
  faEye,
  faArchive
} from '@fortawesome/free-solid-svg-icons';

export default function Set() {
  const { user } = useContext(UserAuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [items, setItems] = useState([]);
  const [currentClassId, setCurrentClassId] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  
  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: '',
    id: null,
    name: '',
    onConfirm: null
  });

  useEffect(() => {
    console.log('🔄 useEffect triggered - currentClassId changed to:', currentClassId);
    if (user) {
      fetchItems();
    }
  }, [user, currentClassId]);

  useEffect(() => {
    const folderId = searchParams.get('folder');
    console.log('🔗 URL changed - folder param:', folderId, 'current:', currentClassId);
    
    if (folderId && folderId !== currentClassId) {
      console.log('📂 Navigating to folder:', folderId);
      setCurrentClassId(folderId);
      loadCurrentClassPath(folderId);
    } else if (!folderId && currentClassId) {
      console.log('🏠 Navigating to root');
      setCurrentClassId(null);
      setCurrentPath([]);
    }
  }, [searchParams]);

  const loadCurrentClassPath = async (classId) => {
    if (!classId) {
      setCurrentPath([]);
      return;
    }

    try {
      const path = [];
      let currentId = classId;
      
      while (currentId) {
        const { data: classData, error } = await supabase
          .from('classes')
          .select('id, name, parent_id')
          .eq('id', currentId)
          .single();
        
        if (error || !classData) break;
        
        path.unshift({ id: classData.id, name: classData.name });
        currentId = classData.parent_id;
      }
      
      setCurrentPath(path);
    } catch (error) {
      console.error('Error loading class path:', error);
      setCurrentPath([]);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    
    try {
      console.log('🔄 Fetching items for user:', user.id, 'currentClassId:', currentClassId);
      
      const allItems = [];

      // STEP 1: Get child folders for current context
      let foldersQuery = supabase
        .from('classes')
        .select('*')
        .eq('user_id', user.id);

      if (currentClassId) {
        foldersQuery = foldersQuery.eq('parent_id', currentClassId);
      } else {
        foldersQuery = foldersQuery.is('parent_id', null);
      }

      const { data: foldersData, error: foldersError } = await foldersQuery
        .order('name', { ascending: true });

      if (foldersError) {
        console.error('❌ Error fetching folders:', foldersError);
        setLoading(false);
        return;
      }

      console.log('📁 Child folders found:', foldersData?.length || 0);

      // STEP 2: Process each child folder and add as individual item
      for (const folder of foldersData || []) {
        // Count contents of this folder
        const { count: directSetsCount } = await supabase
          .from('flashcard_sets')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('class_id', folder.id);

        const { count: childFoldersCount } = await supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('parent_id', folder.id);

        allItems.push({
          ...folder,
          type: 'folder',
          isFolder: true,
          totalSets: directSetsCount || 0,
          totalSubfolders: childFoldersCount || 0,
          hasContent: (directSetsCount || 0) > 0 || (childFoldersCount || 0) > 0
        });
      }

      // STEP 3: Get direct flashcard sets in current folder
      let directSetsQuery = supabase
        .from('flashcard_sets')
        .select('*')
        .eq('user_id', user.id);

      if (currentClassId) {
        directSetsQuery = directSetsQuery.eq('class_id', currentClassId);
      } else {
        directSetsQuery = directSetsQuery.is('class_id', null);
      }

      const { data: directSets, error: directSetsError } = await directSetsQuery
        .order('created_at', { ascending: false });

      if (directSetsError) {
        console.error('❌ Error fetching direct sets:', directSetsError);
      }

      // Add direct sets as individual items
      for (const set of directSets || []) {
        const { count, error: countError } = await supabase
          .from('flashcard_cards')
          .select('*', { count: 'exact', head: true })
          .eq('set_id', set.id);

        if (countError) {
          console.error('❌ Error counting cards for set:', countError);
        }

        allItems.push({
          ...set,
          type: 'deck',
          isDeck: true,
          card_count: count || 0,
          name: set.title
        });
      }

      console.log('✅ Total items found:', allItems.length);
      console.log('📊 Items breakdown:', allItems.map(item => ({
        name: item.name,
        type: item.type,
        hasContent: item.hasContent,
        totalSets: item.totalSets,
        totalSubfolders: item.totalSubfolders
      })));

      setItems(allItems);
      
    } catch (error) {
      console.error('💥 Error in fetchItems:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToClass = (classId) => {
    console.log('🧭 navigateToClass called with:', classId);
    if (classId) {
      setSearchParams({ folder: classId });
    } else {
      setSearchParams({});
    }
  };

  const navigateToPath = (targetId) => {
    if (targetId) {
      setSearchParams({ folder: targetId });
    } else {
      setSearchParams({});
    }
  };

  const createNewFolder = async (folderName) => {
    if (!folderName.trim()) return;

    try {
      console.log('🚀 Creating folder:', folderName, 'in parent:', currentClassId);
      
      const folderData = {
        name: folderName.trim(),
        user_id: user.id,
        parent_id: currentClassId || null
      };
      
      const { data, error } = await supabase
        .from('classes')
        .insert([folderData])
        .select()
        .single();

      if (error) {
        console.error('❌ Insert error:', error);
        throw new Error(error.message);
      }

      console.log('✅ Folder created successfully:', data);
      setShowCreateFolderModal(false);
      await fetchItems();
      
    } catch (error) {
      console.error('💥 Error in createNewFolder:', error);
      throw error;
    }
  };

  const handleItemClick = (item, e) => {
    if (e.target.closest('.folder-actions') || e.target.closest('button')) {
      console.log('🚫 Click on action button, ignoring item click');
      return;
    }
    
    console.log('📁 Item clicked:', item.name, 'Type:', item.type, 'ID:', item.id);
    
    if (item.type === 'folder') {
      navigateToClass(item.id);
    } else if (item.type === 'deck') {
      navigate(`/flashcards/${item.id}`);
    }
  };

  const handleDeleteItem = async (itemId, itemName, itemType, e) => {
    e.stopPropagation();
    console.log('🗑️ Delete item clicked:', itemName, itemType);
    
    const item = items.find(i => i.id === itemId);
    
    setDeleteModal({
      isOpen: true,
      type: itemType,
      id: itemId,
      name: itemName,
      onConfirm: () => performDeleteItem(itemId, itemType),
      title: itemType === 'folder' ? 'Delete Folder' : 'Delete Deck',
      message: itemType === 'folder' 
        ? `This will permanently delete the folder "${itemName}"${item?.hasContent ? ' and all its contents' : ''}. This action cannot be undone.`
        : `This will permanently delete the deck "${itemName}" and all its cards. This action cannot be undone.`
    });
  };

  const performDeleteItem = async (itemId, itemType) => {
    try {
      const table = itemType === 'folder' ? 'classes' : 'flashcard_sets';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', itemId);

      if (!error) {
        setItems(prev => prev.filter(i => i.id !== itemId));
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      type: '',
      id: null,
      name: '',
      onConfirm: null
    });
  };

  const handleImportSuccess = (deckId) => {
    fetchItems();
    setShowImportModal(false);
    setSelectedClassId(null);
  };

  const getSortedAndFilteredItems = () => {
    let filtered = items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort: folders first, then decks
    filtered.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      
      switch (sortBy) {
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'recent':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    return filtered;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

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

  const filteredItems = getSortedAndFilteredItems();

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
                  onClick={() => setShowCreateFolderModal(true)}
                  className="create-folder-btn"
                  title="Create New Folder"
                >
                  <FontAwesomeIcon icon={faFolder} className="btn-icon" />
                  New Folder
                </button>
                <button 
                  onClick={() => setShowImportModal(true)}
                  className="import-btn"
                  title="Import from Anki or Quizlet"
                >
                  <FontAwesomeIcon icon={faFileImport} className="btn-icon" />
                  Import
                </button>
                <button 
                  onClick={() => setShowModal(true)}
                  className="create-set-btn"
                >
                  <span className="btn-icon">+</span>
                  Create Deck
                </button>
              </div>
            </div>
            
            {/* Breadcrumb Navigation */}
            {currentPath.length > 0 && (
              <div className="enhanced-breadcrumb">
                <div className="breadcrumb-content">
                  <button 
                    className="breadcrumb-item root"
                    onClick={() => navigateToPath(null)}
                    title="Go to root"
                  >
                    <FontAwesomeIcon icon={faHome} />
                    <span>Library</span>
                  </button>
                  {currentPath.map((pathItem, index) => (
                    <React.Fragment key={pathItem.id}>
                      <FontAwesomeIcon icon={faChevronRight} className="breadcrumb-separator" />
                      <button 
                        className={`breadcrumb-item ${index === currentPath.length - 1 ? 'current' : ''}`}
                        onClick={() => navigateToPath(pathItem.id)}
                        disabled={index === currentPath.length - 1}
                        title={index === currentPath.length - 1 ? 'Current folder' : `Go to ${pathItem.name}`}
                      >
                        <FontAwesomeIcon icon={index === currentPath.length - 1 ? faFolderOpen : faFolder} />
                        <span>{pathItem.name}</span>
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                <div className="breadcrumb-actions">
                  <button 
                    className="back-button"
                    onClick={() => {
                      const parentPath = currentPath.length > 1 ? currentPath[currentPath.length - 2].id : null;
                      navigateToPath(parentPath);
                    }}
                    title="Go back"
                  >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    <span>Back</span>
                  </button>
                </div>
              </div>
            )}
            
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
                    <option value="recent">Recently Modified</option>
                    <option value="alphabetical">A to Z</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>

              <div className="view-controls">
                <button
                  className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  <FontAwesomeIcon icon={faTh} />
                </button>
                <button
                  className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <FontAwesomeIcon icon={faList} />
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
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📚</div>
                <h3>{searchTerm ? 'No items found' : currentPath.length > 0 ? 'Empty folder' : 'Welcome to your library'}</h3>
                <p>
                  {searchTerm 
                    ? `No folders or decks match "${searchTerm}". Try a different search term.`
                    : currentPath.length > 0
                    ? 'This folder is empty. Create your first deck or subfolder to get started.'
                    : 'Start building your learning library by creating folders and flashcard decks!'
                  }
                </p>
                {!searchTerm && (
                  <div className="empty-actions">
                    <button 
                      onClick={() => setShowCreateFolderModal(true)}
                      className="empty-action-btn secondary"
                    >
                      <FontAwesomeIcon icon={faFolder} />
                      Create Folder
                    </button>
                    <button 
                      onClick={() => setShowModal(true)}
                      className="empty-action-btn"
                    >
                      Create Deck
                    </button>
                    <button 
                      onClick={() => setShowImportModal(true)}
                      className="empty-action-btn secondary"
                    >
                      <FontAwesomeIcon icon={faFileImport} />
                      Import Decks
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className={`content-grid ${viewMode}-view`}>
                {filteredItems.map(item => (
                  <div 
                    key={item.id} 
                    className={`folder-card ${item.type === 'deck' ? 'deck-card' : ''} clickable-card`}
                    onClick={(e) => handleItemClick(item, e)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Item Header */}
                    <div className="folder-header">
                      <div className="folder-info">
                        <div className="folder-icon-and-name">
                          <FontAwesomeIcon 
                            icon={item.type === 'folder' ? faFolder : faFileImport} 
                            className="folder-icon"
                            style={{ 
                              color: item.type === 'folder' ? '#4facfe' : '#ff6b35',
                              fontSize: '1.8rem'
                            }}
                          />
                          <div className="folder-details">
                            <h3 className="folder-name">{item.name}</h3>
                            <div className="folder-meta">
                              <span className="deck-count">
                                {item.type === 'folder' 
                                  ? item.hasContent
                                    ? `${item.totalSubfolders || 0} folder${(item.totalSubfolders || 0) !== 1 ? 's' : ''}, ${item.totalSets || 0} deck${(item.totalSets || 0) !== 1 ? 's' : ''}`
                                    : 'Empty folder'
                                  : `${item.card_count || 0} cards`
                                }
                              </span>
                              <span className="folder-date">
                                Created {formatDate(item.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="folder-actions">
                        {item.type === 'folder' ? (
                          // Folder actions
                          <>
                            <button
                              className="action-btn open-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('🔘 Open folder button clicked');
                                navigateToClass(item.id);
                              }}
                              title="Open folder"
                            >
                              <FontAwesomeIcon icon={faFolderOpen} />
                            </button>
                            <button
                              className="action-btn import-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClassId(item.id);
                                setShowImportModal(true);
                              }}
                              title="Import to this folder"
                            >
                              <FontAwesomeIcon icon={faFileImport} />
                            </button>
                            <button
                              className="action-btn add-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClassId(item.id);
                                setShowModal(true);
                              }}
                              title="Add deck to folder"
                            >
                              <FontAwesomeIcon icon={faPlus} />
                            </button>
                            <button
                              className="action-btn delete-btn"
                              onClick={(e) => handleDeleteItem(item.id, item.name, item.type, e)}
                              title="Delete folder"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </>
                        ) : (
                          // Deck actions
                          <>
                            <button
                              className="action-btn open-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/flashcards/${item.id}`);
                              }}
                              title="Edit deck"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button
                              className="action-btn import-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/study/${item.id}`);
                              }}
                              title="Study deck"
                              style={{ background: 'rgba(40, 167, 69, 0.1)', color: '#28a745', border: '1px solid rgba(40, 167, 69, 0.3)' }}
                            >
                              Study
                            </button>
                            <button
                              className="action-btn delete-btn"
                              onClick={(e) => handleDeleteItem(item.id, item.name, item.type, e)}
                              title="Delete deck"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Simplified bottom section - no preview, just visual consistency */}
                    <div className="item-summary">
                      {item.type === 'folder' ? (
                        <div className="folder-summary">
                          <div className="summary-icon">
                            📁
                          </div>
                          <p>
                            {item.hasContent 
                              ? `Contains ${item.totalSubfolders + item.totalSets} items`
                              : 'Empty folder - click to add content'
                            }
                          </p>
                        </div>
                      ) : (
                        <div className="deck-summary">
                          <div className="summary-icon">
                            🗂️
                          </div>
                          <p>
                            Ready to study • {item.card_count || 0} flashcards
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
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
              setSelectedClassId(null);
            }}
            onSuccess={() => {
              fetchItems();
              setShowModal(false);
              setSelectedClassId(null);
            }}
            preselectedClassId={selectedClassId}
          />
        )}

        {showImportModal && (
          <ImportModal
            onClose={() => {
              setShowImportModal(false);
              setSelectedClassId(null);
            }}
            onSuccess={handleImportSuccess}
            preselectedClassId={selectedClassId}
          />
        )}

        {showCreateFolderModal && (
          <CreateFolderModal
            onClose={() => setShowCreateFolderModal(false)}
            onSuccess={createNewFolder}
            currentPath={currentPath}
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
const CreateFolderModal = ({ onClose, onSuccess, currentPath }) => {
  const [folderName, setFolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
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
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content create-folder-modal">
        <div className="modal-header">
          <h3>Create New Folder</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="current-location">
            <span className="location-label">Creating in:</span>
            <div className="location-path">
              <FontAwesomeIcon icon={faHome} />
              {currentPath.length > 0 ? (
                currentPath.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <FontAwesomeIcon icon={faChevronRight} className="path-separator" />
                    <span>{item.name}</span>
                  </React.Fragment>
                ))
              ) : (
                <span>Library Root</span>
              )}
            </div>
          </div>

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
};