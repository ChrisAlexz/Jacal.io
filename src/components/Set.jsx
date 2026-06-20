// src/components/Set.jsx - Modular set page using hook + sub-components
import React, { useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import UserAuthContext from './context/UserAuthContext';
import { useSetManager } from '../hooks/useSetManager';
import { TreeNode, CreateFolderModal } from './set/index';
import ClassDeckModal from './ClassDeckModal';
import ImportModal from './ImportModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import Layout from './Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faFolder, faFileImport, faLayerGroup, faList } from '@fortawesome/free-solid-svg-icons';
import '../styles/Set.css';

export default function SetPage() {
  const { user } = useContext(UserAuthContext);
  const router = useRouter();
  const mgr = useSetManager(user);

  const handleNavigate = useCallback((path) => router.push(path), [router]);

  if (!user) {
    return (
      <Layout>
        <div className="set-page">
          <div className="auth-required">
            <div className="auth-required-card">
              <div className="auth-icon">&#128274;</div>
              <h2>Authentication Required</h2>
              <p>Please log in to view your flashcard sets</p>
              <button onClick={() => router.push('/register')} className="auth-btn">Sign In</button>
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
                <button onClick={() => mgr.handleCreateFolder()} className="create-folder-btn" title="Create New Folder">
                  <FontAwesomeIcon icon={faFolder} className="btn-icon" /> New Folder
                </button>
                <button onClick={() => mgr.handleImport()} className="import-btn" title="Import from Anki or Quizlet">
                  <FontAwesomeIcon icon={faFileImport} className="btn-icon" /> Import
                </button>
                <button onClick={() => mgr.handleCreateDeck()} className="create-set-btn" title="Create New Deck">
                  <span className="btn-icon">+</span> New Deck
                </button>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="enhanced-controls-bar">
              <div className="search-and-sort">
                <div className="search-container">
                  <FontAwesomeIcon icon={faSearch} className="search-icon" />
                  <input type="text" placeholder="Search folders and decks..." value={mgr.searchTerm}
                    onChange={mgr.handleSearchChange} className="search-input" />
                </div>
                <div className="sort-container">
                  <select value={mgr.sortBy} onChange={mgr.handleSortChange} className="sort-select">
                    <option value="alphabetical">Alphabetical</option>
                    <option value="recent">Recently Modified</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>

              <div className="tree-controls">
                <button className="tree-control-btn" onClick={mgr.handleExpandAll} title="Expand All">
                  <FontAwesomeIcon icon={faLayerGroup} /> Expand All
                </button>
                <button className="tree-control-btn" onClick={mgr.handleCollapseAll} title="Collapse All">
                  <FontAwesomeIcon icon={faList} /> Collapse All
                </button>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="set-content">
            {mgr.loading ? (
              <div className="loading-section">
                <div className="loading-spinner"></div>
                <p>Loading your library...</p>
              </div>
            ) : mgr.tree.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">&#128218;</div>
                <h3>Welcome to your library</h3>
                <p>Start building your learning library by creating folders and flashcard decks!</p>
                <div className="empty-actions">
                  <button onClick={() => mgr.handleCreateFolder()} className="empty-action-btn secondary">
                    <FontAwesomeIcon icon={faFolder} /> Create Folder
                  </button>
                  <button onClick={() => mgr.handleCreateDeck()} className="empty-action-btn">Create Deck</button>
                  <button onClick={() => mgr.handleImport()} className="empty-action-btn secondary">
                    <FontAwesomeIcon icon={faFileImport} /> Import Decks
                  </button>
                </div>
              </div>
            ) : (
              <div className="tree-view">
                {mgr.tree.map(item => (
                  <TreeNode key={item.id} item={item} depth={0}
                    onToggleExpand={mgr.handleToggleExpand} onDeleteItem={mgr.handleDeleteItem}
                    onCreateFolder={mgr.handleCreateFolder} onCreateDeck={mgr.handleCreateDeck}
                    onImport={mgr.handleImport} onNavigate={handleNavigate}
                    expandedFolders={mgr.expandedFolders} searchTerm={mgr.searchTerm}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        {mgr.showModal && (
          <ClassDeckModal
            onClose={() => { mgr.setShowModal(false); mgr.setSelectedFolderId(null); }}
            onSuccess={() => { mgr.fetchAllData(); mgr.setShowModal(false); mgr.setSelectedFolderId(null); }}
            preselectedClassId={mgr.selectedFolderId}
          />
        )}

        {mgr.showImportModal && (
          <ImportModal
            onClose={() => { mgr.setShowImportModal(false); mgr.setSelectedFolderId(null); }}
            onSuccess={mgr.handleImportSuccess}
            preselectedClassId={mgr.selectedFolderId}
          />
        )}

        {mgr.showCreateFolderModal && (
          <CreateFolderModal
            onClose={() => { mgr.setShowCreateFolderModal(false); mgr.setSelectedFolderId(null); }}
            onSuccess={(folderName) => mgr.createNewFolder(folderName, mgr.selectedFolderId)}
            parentFolderId={mgr.selectedFolderId}
          />
        )}

        <DeleteConfirmationModal
          isOpen={mgr.deleteModal.isOpen}
          onClose={mgr.closeDeleteModal}
          onConfirm={mgr.deleteModal.onConfirm}
          title={mgr.deleteModal.title}
          message={mgr.deleteModal.message}
          itemName={mgr.deleteModal.name}
          type={mgr.deleteModal.type}
        />
      </div>
    </Layout>
  );
}
