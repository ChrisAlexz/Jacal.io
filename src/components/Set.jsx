// src/components/Set.jsx - ENHANCED HIERARCHICAL FOLDER SYSTEM
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
  
  const [classes, setClasses] = useState([]);
  const [currentClassId, setCurrentClassId] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
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
      // Check database structure and debug the current context
      checkDatabaseStructure();
      fetchClasses();
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
  }, [searchParams, currentClassId]);

  const loadCurrentClassPath = async (classId) => {
    if (!classId) {
      setCurrentPath([]);
      return;
    }

    try {
      // Build the full breadcrumb path by traversing up the hierarchy
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

  const checkDatabaseStructure = async () => {
    try {
      console.log('🔍 Checking database structure and data...');
      
      // First, check all classes for this user to see the data structure
      const { data: allClasses, error: allError } = await supabase
        .from('classes')
        .select('id, name, parent_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (allError) {
        console.error('❌ Error fetching all classes:', allError);
      } else {
        console.log('📊 ALL classes for user:', allClasses?.length || 0);
        if (allClasses && allClasses.length > 0) {
          console.table(allClasses);
          
          // Show hierarchy structure
          const rootFolders = allClasses.filter(c => c.parent_id === null);
          const subFolders = allClasses.filter(c => c.parent_id !== null);
          
          console.log('🏠 Root folders:', rootFolders.length, rootFolders.map(f => f.name));
          console.log('📁 Sub folders:', subFolders.length);
          
          subFolders.forEach(sub => {
            const parent = allClasses.find(p => p.id === sub.parent_id);
            console.log(`  📂 "${sub.name}" (parent: "${parent?.name || 'UNKNOWN'}")`);
          });
        }
      }
      
      // If we're in a specific folder, check what should be shown
      if (currentClassId) {
        console.log('🔍 Checking what should be visible in folder:', currentClassId);
        const { data: childClasses, error: childError } = await supabase
          .from('classes')
          .select('id, name, parent_id, created_at')
          .eq('user_id', user.id)
          .eq('parent_id', currentClassId);
          
        if (childError) {
          console.error('❌ Error fetching child classes:', childError);
        } else {
          console.log('👶 Child classes in current folder:', childClasses?.length || 0, childClasses);
        }
      }
      
    } catch (error) {
      console.error('💥 Error checking database structure:', error);
    }
  };

  const fetchClasses = async () => {
    setLoading(true);
    
    try {
      console.log('🔄 Fetching classes for user:', user.id, 'currentClassId:', currentClassId);
      
      let classesQuery = supabase
        .from('classes')
        .select(`*, flashcard_sets (*)`)
        .eq('user_id', user.id);

      // Filter by current folder context
      if (currentClassId) {
        console.log('📁 Filtering by parent_id:', currentClassId);
        classesQuery = classesQuery.eq('parent_id', currentClassId);
      } else {
        console.log('🏠 Loading root level folders (parent_id IS NULL)');
        classesQuery = classesQuery.is('parent_id', null);
      }

      const { data: classesData, error: classesError } = await classesQuery
        .order('name', { ascending: true });

      if (classesError) {
        console.error('❌ Error fetching classes:', classesError);
        setLoading(false);
        return;
      }

      console.log('📊 Raw classes data:', classesData?.length || 0, 'items');
      if (classesData && classesData.length > 0) {
        console.log('📁 Classes found:', classesData.map(c => ({ 
          id: c.id, 
          name: c.name, 
          parent_id: c.parent_id,
          created_at: c.created_at 
        })));
      }

      // Get card counts for each flashcard set
      if (classesData) {
        const classesWithCounts = await Promise.all(
          classesData.map(async (cls) => {
            const setsWithCounts = await Promise.all(
              cls.flashcard_sets.map(async (set) => {
                const { count, error: countError } = await supabase
                  .from('flashcard_cards')
                  .select('*', { count: 'exact', head: true })
                  .eq('set_id', set.id);

                if (countError) {
                  console.error('❌ Error counting cards:', countError);
                }

                return {
                  ...set,
                  card_count: count || 0
                };
              })
            );

            return {
              ...cls,
              flashcard_sets: setsWithCounts,
              isFolder: true
            };
          })
        );

        console.log('✅ Processed classes with counts:', classesWithCounts.length, 'items');
        console.log('🎯 Setting classes state with:', classesWithCounts.map(c => c.name));
        
        // Force re-render by using functional state update
        setClasses(() => {
          console.log('🔄 State update function called with new data:', classesWithCounts.length, 'items');
          return classesWithCounts;
        });
      } else {
        console.log('📭 No classes data received');
        setClasses([]);
      }
    } catch (error) {
      console.error('💥 Error in fetchClasses:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToClass = (classId) => {
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
      console.log('🚀 === FOLDER CREATION DEBUG ===');
      console.log('📝 Folder name:', folderName);
      console.log('📍 Current context:', { currentClassId, currentPath });
      console.log('👤 User ID:', user.id);
      
      const folderData = {
        name: folderName.trim(),
        user_id: user.id,
        parent_id: currentClassId || null
      };
      
      console.log('📋 Data being inserted:', folderData);
      
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
      console.log('🔍 Checking what should now be visible...');

      // Close the modal first
      setShowCreateFolderModal(false);
      
      // Check what's in the database after creation
      const { data: checkData, error: checkError } = await supabase
        .from('classes')
        .select('id, name, parent_id, created_at')
        .eq('user_id', user.id)
        .eq('parent_id', currentClassId || null);
        
      console.log('📊 Items that should be visible after creation:', checkData?.length || 0, checkData);
      
      // Force a complete refresh of the data
      console.log('🔄 Triggering fetchClasses...');
      await fetchClasses();
      
      // Add a small delay to ensure state has updated
      setTimeout(() => {
        console.log('🎯 After fetchClasses delay, current state:', {
          classesLength: classes.length,
          currentClassId: currentClassId
        });
      }, 100);
      
    } catch (error) {
      console.error('💥 Error in createNewFolder:', error);
      throw error;
    }
  };

  // Enhanced delete handlers
  const handleDeleteClass = async (classId, className, e) => {
    e.stopPropagation();
    
    const classObj = classes.find(c => c.id === classId);
    const deckCount = classObj?.flashcard_sets?.length || 0;
    
    setDeleteModal({
      isOpen: true,
      type: 'folder',
      id: classId,
      name: className,
      onConfirm: () => performDeleteClass(classId),
      title: 'Delete Folder',
      message: deckCount > 0 
        ? `This will permanently delete the folder "${className}" and all ${deckCount} deck${deckCount !== 1 ? 's' : ''} inside it. This action cannot be undone.`
        : `This will permanently delete the folder "${className}". This action cannot be undone.`
    });
  };

  const performDeleteClass = async (classId) => {
    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);

      if (!error) {
        setClasses(prev => prev.filter(c => c.id !== classId));
      }
    } catch (err) {
      console.error('Error deleting class:', err);
    }
  };

  const handleDeleteDeck = async (deckId, deckTitle, e) => {
    e.stopPropagation();
    
    const deck = classes.flatMap(c => c.flashcard_sets).find(d => d.id === deckId);
    const cardCount = deck?.card_count || 0;
    
    setDeleteModal({
      isOpen: true,
      type: 'deck',
      id: deckId,
      name: deckTitle,
      onConfirm: () => performDeleteDeck(deckId),
      title: 'Delete Deck',
      message: cardCount > 0 
        ? `This will permanently delete the deck "${deckTitle}" and all ${cardCount} card${cardCount !== 1 ? 's' : ''} inside it. This action cannot be undone.`
        : `This will permanently delete the deck "${deckTitle}". This action cannot be undone.`
    });
  };

  const performDeleteDeck = async (deckId) => {
    try {
      const { error } = await supabase
        .from('flashcard_sets')
        .delete()
        .eq('id', deckId);

      if (!error) {
        setClasses(prev =>
          prev.map(c => ({
            ...c,
            flashcard_sets: c.flashcard_sets.filter(d => d.id !== deckId)
          }))
        );
      }
    } catch (err) {
      console.error('Error deleting deck:', err);
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

  // Handle import success
  const handleImportSuccess = (deckId) => {
    fetchClasses();
    setShowImportModal(false);
    setSelectedClassId(null);
  };

  // Sort and filter logic - FIXED
  const getSortedAndFilteredClasses = () => {
    console.log('🔍 getSortedAndFilteredClasses called with:', classes.length, 'classes');
    
    let filtered = classes.filter(cls => 
      cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.flashcard_sets.some(deck => 
        deck.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    console.log('📝 After filtering by search term:', filtered.length, 'classes');

    // Sort classes
    switch (sortBy) {
      case 'alphabetical':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
    }

    console.log('📊 Final filtered classes:', filtered.map(c => c.name));
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

  const filteredClasses = getSortedAndFilteredClasses();
  
  console.log('🎨 Rendering with:', {
    classesLength: classes.length,
    filteredClassesLength: filteredClasses.length,
    searchTerm,
    currentClassId,
    loading
  });

  return (
    <Layout>
      <div className="set-page">
        <div className="set-container">
          {/* Enhanced Header Section */}
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
                {/* Debug button - remove after fixing */}
                <button 
                  onClick={() => {
                    console.log('🔍 DEBUG: Manual refresh triggered');
                    console.log('📍 Current context:', { currentClassId, currentPath });
                    console.log('📊 Current classes state:', classes.length, classes.map(c => c.name));
                    console.log('📝 Current search term:', searchTerm);
                    const filtered = getSortedAndFilteredClasses();
                    console.log('🎯 Filtered classes:', filtered.length, filtered.map(c => c.name));
                    checkDatabaseStructure();
                    fetchClasses();
                  }}
                  className="debug-btn"
                  style={{ 
                    background: '#ff6b35', 
                    color: 'white', 
                    border: 'none', 
                    padding: '10px', 
                    borderRadius: '8px',
                    fontSize: '0.8rem'
                  }}
                >
                  🔍 Debug
                </button>
              </div>
            </div>
            
            {/* Enhanced Breadcrumb Navigation */}
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
            
            {/* Enhanced Controls Bar */}
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
            ) : filteredClasses.length === 0 ? (
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
              <div className={`content-grid ${viewMode}-view`} key={`${currentClassId}-${classes.length}`}>
                {filteredClasses.map(cls => (
                  <div key={cls.id} className="folder-card">
                    {/* Folder Header */}
                    <div className="folder-header">
                      <div className="folder-info">
                        <div className="folder-icon-and-name">
                          <FontAwesomeIcon 
                            icon={faFolder} 
                            className="folder-icon"
                          />
                          <div className="folder-details">
                            <h3 className="folder-name">{cls.name}</h3>
                            <div className="folder-meta">
                              <span className="deck-count">
                                {cls.flashcard_sets.length} deck{cls.flashcard_sets.length !== 1 ? 's' : ''}
                              </span>
                              <span className="folder-date">
                                Created {formatDate(cls.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="folder-actions">
                        <button
                          className="action-btn open-btn"
                          onClick={() => navigateToClass(cls.id)}
                          title="Open folder"
                        >
                          <FontAwesomeIcon icon={faFolderOpen} />
                        </button>
                        <button
                          className="action-btn import-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClassId(cls.id);
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
                            setSelectedClassId(cls.id);
                            setShowModal(true);
                          }}
                          title="Add deck to folder"
                        >
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                        <button
                          className="action-btn delete-btn"
                          onClick={(e) => handleDeleteClass(cls.id, cls.name, e)}
                          title="Delete folder"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>

                    {/* Deck Preview */}
                    {cls.flashcard_sets.length > 0 && (
                      <div className="deck-preview">
                        <div className="preview-header">
                          <span className="preview-title">Recent Decks</span>
                          <button
                            className="view-all-btn"
                            onClick={() => navigateToClass(cls.id)}
                          >
                            View All
                          </button>
                        </div>
                        <div className="preview-decks">
                          {cls.flashcard_sets.slice(0, 3).map(deck => (
                            <div key={deck.id} className="preview-deck">
                              <div className="preview-deck-info">
                                <span className="preview-deck-title">{deck.title}</span>
                                <span className="preview-deck-meta">
                                  {deck.card_count} cards • {formatDate(deck.created_at)}
                                </span>
                              </div>
                              <div className="preview-deck-actions">
                                <button
                                  className="preview-action study"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/study/${deck.id}`);
                                  }}
                                  title="Study deck"
                                >
                                  Study
                                </button>
                                <button
                                  className="preview-action speed"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/speed/${deck.id}`);
                                  }}
                                  title="Speed mode"
                                >
                                  <FontAwesomeIcon icon={faBolt} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty Folder State */}
                    {cls.flashcard_sets.length === 0 && (
                      <div className="empty-folder-content">
                        <div className="empty-folder-icon">📂</div>
                        <p>Empty folder</p>
                        <div className="empty-folder-actions">
                          <button
                            className="empty-folder-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClassId(cls.id);
                              setShowModal(true);
                            }}
                          >
                            Add Deck
                          </button>
                          <button
                            className="empty-folder-btn secondary"
                            onClick={() => navigateToClass(cls.id)}
                          >
                            Open Folder
                          </button>
                        </div>
                      </div>
                    )}
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
              fetchClasses();
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

        {/* Enhanced Delete Confirmation Modal */}
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
      // Success - modal will be closed by parent component
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