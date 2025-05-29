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
    const containerWidth = Math.max(container.clientWidth - 40, 400); // Min width 400px
    const minHeight = 300; // Minimum height
    const maxHeight = 800; // Maximum height
    
    const aspectRatio = img.width / img.height;
    let canvasWidth, canvasHeight;
    
    // Calculate initial size based on container
    if (aspectRatio > 1) {
      // Landscape image
      canvasWidth = Math.min(containerWidth, Math.max(600, img.width * 0.8));
      canvasHeight = canvasWidth / aspectRatio;
    } else {
      // Portrait or square image
      canvasHeight = Math.min(maxHeight, Math.max(minHeight, img.height * 0.8));
      canvasWidth = canvasHeight * aspectRatio;
    }
    
    // Ensure minimum readable size
    const minSize = 400;
    if (canvasWidth < minSize && canvasHeight < minSize) {
      if (aspectRatio > 1) {
        canvasWidth = minSize;
        canvasHeight = minSize / aspectRatio;
      } else {
        canvasHeight = minSize;
        canvasWidth = minSize * aspectRatio;
      }
    }
    
    // Make sure it fits in container but isn't too small
    if (canvasWidth > containerWidth) {
      canvasWidth = containerWidth;
      canvasHeight = canvasWidth / aspectRatio;
    }
    
    // Final size check - ensure readability
    const finalScale = Math.max(canvasWidth / img.width, canvasHeight / img.height);
    if (finalScale < 0.3) {
      // If image would be too small, scale it up
      canvasWidth = img.width * 0.5;
      canvasHeight = img.height * 0.5;
    }
    
    canvas.width = Math.round(canvasWidth);
    canvas.height = Math.round(canvasHeight);
    
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

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (image) {
        setupCanvas(image);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image]);

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