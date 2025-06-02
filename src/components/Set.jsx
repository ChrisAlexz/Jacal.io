// src/components/Set.jsx - UPDATED WITH IMPORT FUNCTIONALITY
import React, { useEffect, useState, useContext } from 'react';
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
  faFileImport 
} from '@fortawesome/free-solid-svg-icons';

export default function Set() {
  const { user } = useContext(UserAuthContext);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClasses, setExpandedClasses] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [editingClassNames, setEditingClassNames] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  
  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: '',
    id: null,
    name: '',
    onConfirm: null
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    if (user) fetchClasses();
  }, [user]);

  const fetchClasses = async () => {
    setLoading(true);
    
    // First get classes and their flashcard sets
    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select(`*, flashcard_sets (*)`)
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (classesError) {
      console.error('Error fetching classes:', classesError);
      setLoading(false);
      return;
    }

    // Then get card counts for each flashcard set
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
                console.error('Error counting cards:', countError);
              }

              return {
                ...set,
                card_count: count || 0
              };
            })
          );

          return {
            ...cls,
            flashcard_sets: setsWithCounts
          };
        })
      );

      setClasses(classesWithCounts);
      const expanded = {};
      const names = {};
      classesWithCounts.forEach(cls => {
        expanded[cls.id] = true;
        names[cls.id] = cls.name;
      });
      setExpandedClasses(expanded);
      setEditingClassNames(names);
    }
    
    setLoading(false);
  };

  const toggleClass = (id) => {
    setExpandedClasses(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Updated delete class handler with custom modal
  const handleDeleteClass = async (classId, className, e) => {
    e.stopPropagation();
    
    const classObj = classes.find(c => c.id === classId);
    const deckCount = classObj?.flashcard_sets?.length || 0;
    
    setDeleteModal({
      isOpen: true,
      type: 'class',
      id: classId,
      name: className,
      onConfirm: () => performDeleteClass(classId),
      title: 'Delete Class',
      message: deckCount > 0 
        ? `This will delete the class "${className}" and all ${deckCount} deck${deckCount !== 1 ? 's' : ''} inside it.`
        : `This will delete the class "${className}".`
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

  // Updated delete deck handler with custom modal
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
        ? `This will delete the deck "${deckTitle}" and all ${cardCount} card${cardCount !== 1 ? 's' : ''} inside it.`
        : `This will delete the deck "${deckTitle}".`
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

  const handleClassNameInputChange = (classId, value) => {
    setEditingClassNames(prev => ({ ...prev, [classId]: value }));
  };

  const handleClassNameBlur = async (classId) => {
    const newName = editingClassNames[classId];
    const { error } = await supabase
      .from("classes")
      .update({ name: newName })
      .eq("id", classId);

    if (error) {
      console.error("Error updating class name:", error);
    }
  };

  // Handle import success
  const handleImportSuccess = (deckId) => {
    // Refresh the classes data
    fetchClasses();
    setShowImportModal(false);
    setSelectedClassId(null);
  };

  // Filter classes based on search term
  const filteredClasses = classes.filter(cls => 
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.flashcard_sets.some(deck => 
      deck.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

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

  return (
    <Layout>
      <div className="set-page">
        <div className="set-container">
          {/* Header Section */}
          <div className="set-header">
            <div className="header-content">
              <div className="header-text">
                <h1>My Flashcard Sets</h1>
                <p>Manage and organize your learning materials</p>
              </div>
              <div className="header-actions">
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
                  Create New Set
                </button>
              </div>
            </div>
            
            {/* Search and Filter Bar */}
            <div className="controls-bar">
              <div className="search-container">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search your sets..."
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
                  <option value="recent">Recently Created</option>
                  <option value="alphabetical">A to Z</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="set-content">
            {loading ? (
              <div className="loading-section">
                <div className="loading-spinner"></div>
                <p>Loading your sets...</p>
              </div>
            ) : filteredClasses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📚</div>
                <h3>{searchTerm ? 'No sets found' : 'No sets yet'}</h3>
                <p>
                  {searchTerm 
                    ? `No sets match "${searchTerm}". Try a different search term.`
                    : 'Create your first flashcard set or import from Anki/Quizlet to get started!'
                  }
                </p>
                {!searchTerm && (
                  <div className="empty-actions">
                    <button 
                      onClick={() => setShowModal(true)}
                      className="empty-action-btn"
                    >
                      Create Your First Set
                    </button>
                    <button 
                      onClick={() => setShowImportModal(true)}
                      className="empty-action-btn secondary"
                    >
                      <FontAwesomeIcon icon={faFileImport} />
                      Import from Anki/Quizlet
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="class-list">
                {filteredClasses.map(cls => (
                  <div key={cls.id} className="class-item">
                    <div className="class-header" onClick={() => toggleClass(cls.id)}>
                      <div className="class-title">
                        <FontAwesomeIcon
                          icon={expandedClasses[cls.id] ? faChevronDown : faChevronRight}
                          className="expand-icon"
                        />
                        <span className="deck-count">
                          {cls.flashcard_sets.length} {cls.flashcard_sets.length === 1 ? 'deck' : 'decks'}
                        </span>
                        <input
                          type="text"
                          value={editingClassNames[cls.id] || ''}
                          onChange={(e) => handleClassNameInputChange(cls.id, e.target.value)}
                          onBlur={() => handleClassNameBlur(cls.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-class-title-input"
                        />
                      </div>
                      <div className="class-actions">
                        <button
                          className="import-deck-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClassId(cls.id);
                            setShowImportModal(true);
                          }}
                          title="Import to this set"
                        >
                          <FontAwesomeIcon icon={faFileImport} />
                        </button>
                        <button
                          className="add-deck-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClassId(cls.id);
                            setShowModal(true);
                          }}
                          title="Add deck"
                        >
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                        <button
                          className="delete-class-btn"
                          onClick={(e) => handleDeleteClass(cls.id, cls.name, e)}
                          title="Delete class"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>

                    {expandedClasses[cls.id] && (
                      <div className="deck-list">
                        {cls.flashcard_sets.length === 0 ? (
                          <div className="empty-decks">
                            <p>No decks in this class yet</p>
                            <div className="empty-deck-actions">
                              <button
                                className="add-first-deck"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClassId(cls.id);
                                  setShowModal(true);
                                }}
                              >
                                Add Deck
                              </button>
                              <button
                                className="import-first-deck"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClassId(cls.id);
                                  setShowImportModal(true);
                                }}
                              >
                                <FontAwesomeIcon icon={faFileImport} />
                                Import
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="deck-grid">
                            {cls.flashcard_sets.map(deck => (
                              <div key={deck.id} className="deck-card">
                                <div className="deck-card-header">
                                  <div className="deck-title-with-speed">
                                    <h4 className="deck-title">{deck.title}</h4>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/speed/${deck.id}`);
                                      }}
                                      className="speed-button-compact"
                                      title="Speed Focus Mode"
                                    >
                                      <FontAwesomeIcon icon={faBolt} />
                                      <span>Speed</span>
                                    </button>
                                  </div>
                                  <div className="deck-actions">
                                    <button
                                      className="action-btn edit-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/flashcards/${deck.id}`);
                                      }}
                                      title="Edit deck"
                                    >
                                      <FontAwesomeIcon icon={faEdit} />
                                    </button>
                                    <button
                                      className="action-btn delete-btn"
                                      onClick={(e) => handleDeleteDeck(deck.id, deck.title, e)}
                                      title="Delete deck"
                                    >
                                      <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Updated stats layout - horizontal row for date and cards */}
                                <div className="deck-stats">
                                  <div className="deck-stats-row">
                                    <div className="deck-stats-horizontal">
                                      <div className="stat-item">
                                        <span className="stat-icon">📄</span>
                                        <span className="stat-text">
                                          {deck.card_count || 0} cards
                                        </span>
                                      </div>
                                      <div className="stat-item">
                                        <span className="stat-icon">📅</span>
                                        <span className="stat-text">
                                          {formatDate(deck.created_at)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="deck-card-footer">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/study/${deck.id}`);
                                    }}
                                    className="study-button-full"
                                  >
                                    Study
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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

        {/* Custom Delete Confirmation Modal */}
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