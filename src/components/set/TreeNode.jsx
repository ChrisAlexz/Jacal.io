// src/components/set/TreeNode.jsx - Tree node component for folder/deck display
import React, { useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown, faChevronRight, faTrash, faEdit, faPlus,
  faFileImport, faFolder, faFolderOpen, faBookOpen
} from '@fortawesome/free-solid-svg-icons';
import { truncateTitle, formatDate, filterItems } from '../../utils/setHelpers';

const TreeNode = React.memo(({
  item, depth = 0, onToggleExpand, onDeleteItem, onCreateFolder,
  onCreateDeck, onImport, onNavigate, expandedFolders, searchTerm
}) => {
  const isFolder = item?.type === 'folder';
  const isExpanded = expandedFolders.has(item?.id);
  const hasChildren = isFolder && ((item?.children?.length > 0) || (item?.sets?.length > 0));

  const filteredChildren = useMemo(() => {
    if (!isFolder || !item?.children) return [];
    return filterItems(item.children, searchTerm);
  }, [isFolder, item?.children, searchTerm]);

  const filteredSets = useMemo(() => {
    if (!isFolder || !item?.sets) return [];
    return filterItems(item.sets, searchTerm);
  }, [isFolder, item?.sets, searchTerm]);

  const handleItemClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFolder && hasChildren) onToggleExpand(item.id);
    else if (!isFolder) onNavigate(`/flashcards/${item.id}`);
  }, [isFolder, hasChildren, item?.id, onToggleExpand, onNavigate]);

  const handleActionClick = useCallback((e, action) => {
    e.preventDefault();
    e.stopPropagation();
    switch (action) {
      case 'delete': onDeleteItem(item.id, item.name, item.type, e); break;
      case 'createFolder': onCreateFolder(item.id); break;
      case 'createDeck': onCreateDeck(item.id); break;
      case 'import': onImport(item.id); break;
      case 'study': onNavigate(`/study/${item.id}`); break;
      case 'edit': onNavigate(`/flashcards/${item.id}`); break;
    }
  }, [item?.id, item?.name, item?.type, onDeleteItem, onCreateFolder, onCreateDeck, onImport, onNavigate]);

  if (depth > 8 || !item?.id) return null;

  const hasVisibleChildren = filteredChildren.length > 0 || filteredSets.length > 0;
  if (searchTerm && !item.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !hasVisibleChildren) {
    return null;
  }

  const displayTitle = truncateTitle(item.name, 30);
  const formattedDate = formatDate(item.created_at);

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isFolder ? 'tree-folder' : 'tree-deck'}`}
        style={{ paddingLeft: `${Math.min(depth * 24 + 12, 240)}px` }}
        onClick={handleItemClick}
      >
        <div className="tree-icon">
          {isFolder && hasChildren && (
            <FontAwesomeIcon
              icon={isExpanded ? faChevronDown : faChevronRight}
              className="expand-icon"
              onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id); }}
            />
          )}
          {isFolder && !hasChildren && <div className="expand-placeholder" />}
          <FontAwesomeIcon
            icon={isFolder ? (isExpanded ? faFolderOpen : faFolder) : faBookOpen}
            className={`item-icon ${isFolder ? 'folder-icon' : 'deck-icon'}`}
          />
        </div>

        <div className="tree-item-info">
          <div className="tree-item-title-row">
            <span className="tree-item-name" title={item.name || 'Unnamed Item'}>{displayTitle}</span>
            <span className="tree-item-date">{formattedDate}</span>
          </div>
          <div className="tree-item-meta">
            {isFolder ? (
              <span className="item-count">{(item.children?.length || 0) + (item.sets?.length || 0)} items</span>
            ) : (
              <span className="card-count">{item.card_count || 0} cards</span>
            )}
          </div>
        </div>

        <div className="tree-item-actions">
          {isFolder ? (
            <>
              <button className="tree-action-btn create-subfolder" onClick={(e) => handleActionClick(e, 'createFolder')} title="Create subfolder">
                <FontAwesomeIcon icon={faFolder} />
              </button>
              <button className="tree-action-btn create-deck" onClick={(e) => handleActionClick(e, 'createDeck')} title="Create deck">
                <FontAwesomeIcon icon={faPlus} />
              </button>
              <button className="tree-action-btn import-deck" onClick={(e) => handleActionClick(e, 'import')} title="Import deck">
                <FontAwesomeIcon icon={faFileImport} />
              </button>
            </>
          ) : (
            <>
              <button className="tree-action-btn study-deck" onClick={(e) => handleActionClick(e, 'study')} title="Study deck">Study</button>
              <button className="tree-action-btn edit-deck" onClick={(e) => handleActionClick(e, 'edit')} title="Edit deck">
                <FontAwesomeIcon icon={faEdit} />
              </button>
            </>
          )}
          <button className="tree-action-btn delete-item" onClick={(e) => handleActionClick(e, 'delete')} title={`Delete ${isFolder ? 'folder' : 'deck'}`}>
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>

      {isFolder && isExpanded && hasVisibleChildren && (
        <div className="tree-children">
          {filteredChildren.map(child => (
            <TreeNode key={`folder-${child.id}`} item={child} depth={depth + 1}
              onToggleExpand={onToggleExpand} onDeleteItem={onDeleteItem} onCreateFolder={onCreateFolder}
              onCreateDeck={onCreateDeck} onImport={onImport} onNavigate={onNavigate}
              expandedFolders={expandedFolders} searchTerm={searchTerm}
            />
          ))}
          {filteredSets.map(set => (
            <TreeNode key={`deck-${set.id}`} item={set} depth={depth + 1}
              onToggleExpand={onToggleExpand} onDeleteItem={onDeleteItem} onCreateFolder={onCreateFolder}
              onCreateDeck={onCreateDeck} onImport={onImport} onNavigate={onNavigate}
              expandedFolders={expandedFolders} searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default TreeNode;
