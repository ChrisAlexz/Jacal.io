// src/components/ImageOcclusionEditor.jsx
import React, { useState, useRef, useEffect } from 'react';
import '../styles/ImageOcclusionEditor.css';

const ImageOcclusionEditor = ({ onSave, disabled }) => {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [occlusions, setOcclusions] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentRect, setCurrentRect] = useState(null);
  const [nextId, setNextId] = useState(1);
  const [cardTitle, setCardTitle] = useState('');
  const [canvasSize, setCanvasSize] = useState(100); // Size percentage (50-200%)
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Load image and setup canvas
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setupCanvas(img);
      };
      img.src = url;
    }
  };

  const setupCanvas = (img) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;

    // Base target dimensions
    const BASE_WIDTH = 600;
    const BASE_HEIGHT = 400;
    
    // Apply user size adjustment
    const sizeMultiplier = canvasSize / 100;
    const targetWidth = BASE_WIDTH * sizeMultiplier;
    const targetHeight = BASE_HEIGHT * sizeMultiplier;
    
    const imgAspectRatio = img.width / img.height;
    const targetAspectRatio = targetWidth / targetHeight;
    
    let canvasWidth, canvasHeight;
    
    if (imgAspectRatio > targetAspectRatio) {
      // Image is wider - fit to width
      canvasWidth = targetWidth;
      canvasHeight = targetWidth / imgAspectRatio;
    } else {
      // Image is taller - fit to height
      canvasHeight = targetHeight;
      canvasWidth = targetHeight * imgAspectRatio;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    drawCanvas();
  };

  // Update canvas size when user changes the slider
  useEffect(() => {
    if (image) {
      setupCanvas(image);
    }
  }, [canvasSize, image]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    // Draw occlusions
    occlusions.forEach((occlusion) => {
      // Black rectangle
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(occlusion.x, occlusion.y, occlusion.width, occlusion.height);
      
      // Blue border
      ctx.strokeStyle = '#4facfe';
      ctx.lineWidth = 2;
      ctx.strokeRect(occlusion.x, occlusion.y, occlusion.width, occlusion.height);
      
      // Label
      ctx.fillStyle = '#4facfe';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const labelX = occlusion.x + occlusion.width / 2;
      const labelY = occlusion.y + occlusion.height / 2;
      ctx.fillText(occlusion.id.toString(), labelX, labelY);
    });
    
    // Draw current rectangle
    if (currentRect) {
      ctx.strokeStyle = '#4facfe';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
      ctx.setLineDash([]);
    }
  };

  // Mouse event handlers with proper coordinate calculation
  const getMousePos = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const handleMouseDown = (event) => {
    if (!image || disabled || !canvasRef.current) return;
    
    const pos = getMousePos(event);
    
    // Check for deletion (Shift+Click)
    if (event.shiftKey) {
      const clickedIndex = occlusions.findIndex(occlusion => 
        pos.x >= occlusion.x && pos.x <= occlusion.x + occlusion.width &&
        pos.y >= occlusion.y && pos.y <= occlusion.y + occlusion.height
      );
      
      if (clickedIndex !== -1) {
        setOcclusions(prev => prev.filter((_, index) => index !== clickedIndex));
        return;
      }
    }
    
    setIsDrawing(true);
    setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (event) => {
    if (!isDrawing || !currentRect) return;
    
    const pos = getMousePos(event);
    setCurrentRect(prev => ({
      ...prev,
      width: pos.x - prev.x,
      height: pos.y - prev.y
    }));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect) return;
    
    // Only add if rectangle is large enough
    if (Math.abs(currentRect.width) > 30 && Math.abs(currentRect.height) > 30) {
      const normalizedRect = {
        id: nextId,
        x: currentRect.width < 0 ? currentRect.x + currentRect.width : currentRect.x,
        y: currentRect.height < 0 ? currentRect.y + currentRect.height : currentRect.y,
        width: Math.abs(currentRect.width),
        height: Math.abs(currentRect.height)
      };
      
      setOcclusions(prev => [...prev, normalizedRect]);
      setNextId(prev => prev + 1);
    }
    
    setIsDrawing(false);
    setCurrentRect(null);
  };

  // Redraw when occlusions change
  useEffect(() => {
    if (image) {
      drawCanvas();
    }
  }, [occlusions, currentRect, image]);

  const handleSave = () => {
    if (!image || occlusions.length === 0 || !cardTitle.trim()) {
      alert('Please add a title, upload an image, and create at least one occlusion.');
      return;
    }

    const cards = occlusions.map(occlusion => ({
      id: occlusion.id,
      title: `${cardTitle} - ${occlusion.id}`,
      imageUrl: imageUrl,
      occlusions: occlusions,
      revealedId: occlusion.id
    }));

    onSave(cards);
  };

  const clearAll = () => {
    setOcclusions([]);
    setNextId(1);
  };

  const undoLast = () => {
    if (occlusions.length > 0) {
      setOcclusions(prev => prev.slice(0, -1));
      setNextId(prev => prev - 1);
    }
  };

  // Quick size presets
  const setSizePreset = (size) => {
    setCanvasSize(size);
  };

  return (
    <div className="image-occlusion-editor" ref={containerRef}>
      <div className="editor-header">
        <h3>Image Occlusion Editor</h3>
        <p>Upload an image and draw rectangles to hide parts of it</p>
      </div>

      <div className="editor-controls">
        <div className="control-group">
          <label>Card Title:</label>
          <input
            type="text"
            value={cardTitle}
            onChange={(e) => setCardTitle(e.target.value)}
            placeholder="Enter a title for your image cards..."
            disabled={disabled}
          />
        </div>

        <div className="control-group">
          <label>Upload Image:</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={disabled}
          />
        </div>

        {image && (
          <>
            <div className="control-group">
              <label>Canvas Size: {canvasSize}%</label>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={canvasSize}
                onChange={(e) => setCanvasSize(parseInt(e.target.value))}
                disabled={disabled}
                className="size-slider"
              />
              <div className="size-presets">
                <button 
                  type="button"
                  className="preset-btn"
                  onClick={() => setSizePreset(75)}
                  disabled={disabled}
                >
                  Small
                </button>
                <button 
                  type="button"
                  className="preset-btn"
                  onClick={() => setSizePreset(100)}
                  disabled={disabled}
                >
                  Medium
                </button>
                <button 
                  type="button"
                  className="preset-btn"
                  onClick={() => setSizePreset(150)}
                  disabled={disabled}
                >
                  Large
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {image && (
        <>
          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => setIsDrawing(false)}
              style={{ 
                cursor: disabled ? 'default' : 'crosshair',
                border: '1px solid #444',
                borderRadius: '8px',
                maxWidth: '100%',
                height: 'auto'
              }}
            />
          </div>

          <div className="editor-tools">
            <div className="tool-group">
              <button 
                className="tool-btn undo-btn"
                onClick={undoLast}
                disabled={disabled || occlusions.length === 0}
              >
                ↶ Undo Last
              </button>
              <button 
                className="tool-btn clear-btn"
                onClick={clearAll}
                disabled={disabled || occlusions.length === 0}
              >
                🗑️ Clear All
              </button>
            </div>

            <div className="occlusion-info">
              <span>Occlusions: {occlusions.length}</span>
              <small>Shift+Click to delete an occlusion</small>
            </div>

            <button 
              className="save-btn"
              onClick={handleSave}
              disabled={disabled || !image || occlusions.length === 0 || !cardTitle.trim()}
            >
              Create {occlusions.length} Cards
            </button>
          </div>
        </>
      )}

      {!image && (
        <div className="upload-prompt">
          <div className="upload-icon">🖼️</div>
          <h4>Upload an Image to Get Started</h4>
          <p>Select an image file to begin creating image occlusion cards</p>
        </div>
      )}
    </div>
  );
};

export default ImageOcclusionEditor;