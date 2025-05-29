// src/components/ImageOcclusionEditor.jsx
import React, { useState, useRef, useEffect } from 'react';
import '../styles/ImageOcclusionEditor.css';

const ImageOcclusionEditor = ({ onSave, disabled }) => {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [occlusions, setOcclusions] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentRect, setCurrentRect] = useState(null);
  const [selectedTool, setSelectedTool] = useState('rectangle');
  const [nextId, setNextId] = useState(1);
  const [cardTitle, setCardTitle] = useState('');
  const [imageScale, setImageScale] = useState(1);
  
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
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
    const container = containerRef.current;
    
    if (!canvas || !container || !img) return;

    // Calculate dimensions with better sizing logic
    const containerWidth = Math.max(container.clientWidth - 40, 400);
    const aspectRatio = img.width / img.height;
    
    // Base size calculation
    let baseWidth, baseHeight;
    const minDisplaySize = 500; // Minimum size for readability
    
    if (aspectRatio > 1) {
      // Landscape image
      baseWidth = Math.max(minDisplaySize, Math.min(containerWidth, img.width * 0.7));
      baseHeight = baseWidth / aspectRatio;
    } else {
      // Portrait or square image  
      baseHeight = Math.max(minDisplaySize, Math.min(700, img.height * 0.7));
      baseWidth = baseHeight * aspectRatio;
    }
    
    // Apply user scale
    const canvasWidth = Math.round(baseWidth * imageScale);
    const canvasHeight = Math.round(baseHeight * imageScale);
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Only draw if canvas is properly set up
    setTimeout(() => {
      if (canvasRef.current) {
        drawCanvas();
      }
    }, 10);
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return; // Exit if canvas doesn't exist
    
    const ctx = canvas.getContext('2d');
    if (!ctx || !image) return; // Exit if context or image doesn't exist

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    // Draw occlusions
    occlusions.forEach((occlusion, index) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(occlusion.x, occlusion.y, occlusion.width, occlusion.height);
      
      // Draw label
      ctx.fillStyle = '#4facfe';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      const labelX = occlusion.x + occlusion.width / 2;
      const labelY = occlusion.y + occlusion.height / 2 + 6;
      ctx.fillText(occlusion.id.toString(), labelX, labelY);
    });
    
    // Draw current rectangle while drawing
    if (currentRect) {
      ctx.strokeStyle = '#4facfe';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
      ctx.setLineDash([]);
    }
  };

  // Mouse event handlers
  const handleMouseDown = (event) => {
    if (!image || disabled || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if clicking on existing occlusion to delete
    const clickedOcclusion = occlusions.findIndex(occlusion => 
      x >= occlusion.x && x <= occlusion.x + occlusion.width &&
      y >= occlusion.y && y <= occlusion.y + occlusion.height
    );
    
    if (event.shiftKey && clickedOcclusion !== -1) {
      // Delete occlusion
      setOcclusions(prev => prev.filter((_, index) => index !== clickedOcclusion));
      return;
    }
    
    setIsDrawing(true);
    setCurrentRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (event) => {
    if (!isDrawing || !image || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setCurrentRect(prev => ({
      ...prev,
      width: x - prev.x,
      height: y - prev.y
    }));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect) return;
    
    // Only add if rectangle is large enough
    if (Math.abs(currentRect.width) > 20 && Math.abs(currentRect.height) > 20) {
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

  // Redraw canvas when occlusions change
  useEffect(() => {
    if (image && canvasRef.current) {
      drawCanvas();
    }
  }, [occlusions, currentRect, image]);

  // Handle scale change
  const handleScaleChange = (newScale) => {
    setImageScale(newScale);
    if (image) {
      setupCanvas(image);
    }
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (image) {
        setupCanvas(image);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image, imageScale]);

  const handleSave = () => {
    if (!image || occlusions.length === 0 || !cardTitle.trim()) {
      alert('Please add a title, upload an image, and create at least one occlusion.');
      return;
    }

    // Create cards for each occlusion
    const cards = occlusions.map(occlusion => ({
      id: occlusion.id,
      title: `${cardTitle} - ${occlusion.id}`,
      imageUrl: imageUrl,
      occlusions: occlusions.map(o => ({
        ...o,
        hidden: o.id === occlusion.id ? false : true
      })),
      revealedId: occlusion.id
    }));

    onSave(cards);
  };

  const clearAll = () => {
    setOcclusions([]);
    setNextId(1);
  };

  const undoLast = () => {
    setOcclusions(prev => prev.slice(0, -1));
    if (occlusions.length > 0) {
      setNextId(prev => prev - 1);
    }
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
          <div className="control-group">
            <label>Image Size: {Math.round(imageScale * 100)}%</label>
            <div className="scale-controls">
              <button 
                type="button"
                onClick={() => handleScaleChange(0.5)}
                disabled={disabled}
                className="scale-btn"
              >
                50%
              </button>
              <button 
                type="button"
                onClick={() => handleScaleChange(0.75)}
                disabled={disabled}
                className="scale-btn"
              >
                75%
              </button>
              <button 
                type="button"
                onClick={() => handleScaleChange(1)}
                disabled={disabled}
                className="scale-btn"
              >
                100%
              </button>
              <button 
                type="button"
                onClick={() => handleScaleChange(1.25)}
                disabled={disabled}
                className="scale-btn"
              >
                125%
              </button>
              <button 
                type="button"
                onClick={() => handleScaleChange(1.5)}
                disabled={disabled}
                className="scale-btn"
              >
                150%
              </button>
            </div>
          </div>
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
              style={{ cursor: disabled ? 'default' : 'crosshair' }}
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