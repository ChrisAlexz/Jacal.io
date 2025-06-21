// src/components/ImageOcclusionEditor.jsx - ENHANCED WITH COPY/PASTE FUNCTIONALITY
import React, { useState, useRef, useEffect, useContext } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import '../styles/ImageOcclusionEditor.css';

const ImageOcclusionEditor = ({ onSave, disabled }) => {
  const { user } = useContext(UserAuthContext);
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [occlusions, setOcclusions] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentRect, setCurrentRect] = useState(null);
  const [nextId, setNextId] = useState(1);
  const [cardTitle, setCardTitle] = useState('Image Occlusion Card'); // Default title
  const [canvasSize, setCanvasSize] = useState(100);
  const [isUploading, setIsUploading] = useState(false);
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });

  // Enhanced image processing function used by both upload and paste
  const processImageFile = async (file) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    
    // Reset occlusions when new image is uploaded
    setOcclusions([]);
    setNextId(1);
    
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setupCanvas(img);
    };
    img.src = url;

    await uploadImageToSupabase(file);
  };

  // Load image and setup canvas
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      await processImageFile(file);
    }
  };

  // Handle paste events for image pasting
  const handlePaste = async (event) => {
    const items = event.clipboardData.items;
    
    for (let item of items) {
      if (item.type.indexOf('image') === 0) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await processImageFile(file);
          break;
        }
      }
    }
  };

  // Add paste event listener
  useEffect(() => {
    const handleGlobalPaste = (e) => {
      // Only handle paste if the editor is visible and no input is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
      );
      
      if (!isInputFocused) {
        handlePaste(e);
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => {
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, []);

  const uploadImageToSupabase = async (file) => {
    if (!user || !file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('flashcard-images')
        .upload(fileName, file);

      if (error) {
        console.error('Error uploading image:', error);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('flashcard-images')
        .getPublicUrl(fileName);

      setUploadedImageUrl(publicUrl);
      console.log('Image uploaded successfully:', publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const setupCanvas = (img) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;

    const BASE_WIDTH = 600;
    const BASE_HEIGHT = 400;
    
    const sizeMultiplier = canvasSize / 100;
    const targetWidth = BASE_WIDTH * sizeMultiplier;
    const targetHeight = BASE_HEIGHT * sizeMultiplier;
    
    const imgAspectRatio = img.width / img.height;
    const targetAspectRatio = targetWidth / targetHeight;
    
    let canvasWidth, canvasHeight;
    
    if (imgAspectRatio > targetAspectRatio) {
      canvasWidth = targetWidth;
      canvasHeight = targetWidth / imgAspectRatio;
    } else {
      canvasHeight = targetHeight;
      canvasWidth = targetHeight * imgAspectRatio;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    drawCanvas();
  };

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
    
    // Draw occlusions with improved opacity
    occlusions.forEach((occlusion) => {
      // Black rectangle with higher opacity
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; // Increased from 0.8
      ctx.fillRect(occlusion.x, occlusion.y, occlusion.width, occlusion.height);
      
      // Blue border
      ctx.strokeStyle = '#4facfe';
      ctx.lineWidth = 3; // Increased from 2
      ctx.strokeRect(occlusion.x, occlusion.y, occlusion.width, occlusion.height);
      
      // Label with better contrast
      ctx.fillStyle = '#ffffff'; // Changed to white for better contrast
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const labelX = occlusion.x + occlusion.width / 2;
      const labelY = occlusion.y + occlusion.height / 2;
      
      // Add text shadow for better readability
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      ctx.fillText(occlusion.id.toString(), labelX, labelY);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    });
    
    // Draw current rectangle being drawn
    if (currentRect) {
      ctx.strokeStyle = '#4facfe';
      ctx.lineWidth = 3; // Increased from 2
      ctx.setLineDash([8, 4]); // Increased dash size
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
      ctx.setLineDash([]);
    }
  };

  // Improved mouse position calculation
  const getMousePos = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (event) => {
    if (!image || disabled || !canvasRef.current) return;
    
    event.preventDefault(); // Prevent any default behavior
    
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
    
    // Start drawing
    setIsDrawing(true);
    startPosRef.current = pos;
    setCurrentRect({ 
      x: pos.x, 
      y: pos.y, 
      width: 0, 
      height: 0 
    });
  };

  const handleMouseMove = (event) => {
    if (!isDrawing || !currentRect || !canvasRef.current) return;
    
    event.preventDefault();
    
    const pos = getMousePos(event);
    const startPos = startPosRef.current;
    
    setCurrentRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y)
    });
  };

  const handleMouseUp = (event) => {
    if (!isDrawing || !currentRect) return;
    
    event.preventDefault();
    
    // Only add if rectangle is large enough (reduced threshold for better UX)
    if (Math.abs(currentRect.width) > 20 && Math.abs(currentRect.height) > 20) {
      const normalizedRect = {
        id: nextId,
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: currentRect.height
      };
      
      setOcclusions(prev => [...prev, normalizedRect]);
      setNextId(prev => prev + 1);
    }
    
    setIsDrawing(false);
    setCurrentRect(null);
  };

  // Add mouse leave handler to stop drawing if mouse leaves canvas
  const handleMouseLeave = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setCurrentRect(null);
    }
  };

  // Redraw when occlusions or currentRect change
  useEffect(() => {
    if (image) {
      drawCanvas();
    }
  }, [occlusions, currentRect, image]);

  // FIXED: Create cards ONLY from CURRENT occlusions and reset properly
  const handleSave = () => {
    if (!image || occlusions.length === 0 || !uploadedImageUrl) {
      alert('Please upload an image and create at least one occlusion. Make sure the image is uploaded before saving.');
      return;
    }

    console.log('Creating cards from occlusions:', occlusions);

    // Create a snapshot of current occlusions to avoid state issues
    const currentOcclusions = [...occlusions];

    const cards = currentOcclusions.map(occlusion => ({
      id: occlusion.id,
      title: `${cardTitle} - ${occlusion.id}`,
      imageUrl: uploadedImageUrl,
      occlusions: currentOcclusions, // Use the snapshot
      revealedId: occlusion.id
    }));

    console.log('Cards being created:', cards);

    // Save the cards first
    onSave(cards);

    // CRITICAL FIX: Clear occlusions immediately after saving
    setOcclusions([]);
    setNextId(1);
    setCurrentRect(null);
    setIsDrawing(false);
    
    console.log('Editor state reset - occlusions cleared');
    
    // IMMEDIATE VISUAL RESET: Force canvas redraw immediately
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Clear canvas and redraw just the image (no occlusions)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      console.log('Canvas visually cleared - no more occlusion marks');
    }
  };

  const clearAll = () => {
    setOcclusions([]);
    setNextId(1);
    console.log('All occlusions cleared manually');
  };

  const undoLast = () => {
    if (occlusions.length > 0) {
      setOcclusions(prev => prev.slice(0, -1));
      setNextId(prev => prev - 1);
      console.log('Last occlusion undone');
    }
  };

  const setSizePreset = (size) => {
    setCanvasSize(size);
  };

  // Debug logging for occlusions state
  useEffect(() => {
    console.log('Occlusions state updated:', occlusions);
  }, [occlusions]);

  return (
    <div className="image-occlusion-editor" ref={containerRef}>
      <div className="editor-header">
        <h3>Image Occlusion Editor</h3>
        <p>Upload an image or paste one from your clipboard, then draw rectangles to hide parts of it</p>
      </div>

      <div className="editor-controls">
        <div className="control-group">
          <label>Upload or Paste Image:</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={disabled || isUploading}
          />
          <div className="paste-info">
            <small style={{ color: '#4facfe', fontStyle: 'italic', display: 'block', marginTop: '8px' }}>
              💡 Tip: You can also paste an image directly using Ctrl+V (Cmd+V on Mac)
            </small>
          </div>
          {isUploading && (
            <div style={{ marginTop: '8px', color: '#4facfe', fontSize: '0.9rem' }}>
              Uploading image... Please wait.
            </div>
          )}
          {uploadedImageUrl && (
            <div style={{ marginTop: '8px', color: '#28a745', fontSize: '0.9rem' }}>
              ✅ Image uploaded successfully
            </div>
          )}
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
              onMouseLeave={handleMouseLeave}
              style={{ 
                cursor: disabled ? 'default' : 'crosshair',
                border: '2px solid #444',
                borderRadius: '8px',
                maxWidth: '100%',
                height: 'auto',
                display: 'block'
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
              disabled={disabled || !image || occlusions.length === 0 || isUploading || !uploadedImageUrl}
            >
              {isUploading ? 'Uploading...' : `Create ${occlusions.length} Cards`}
            </button>
          </div>
        </>
      )}

      {!image && (
        <div className="upload-prompt">
          <div className="upload-icon">🖼️</div>
          <h4>Upload or Paste an Image to Get Started</h4>
          <p>Select an image file or paste one from your clipboard (Ctrl+V / Cmd+V)</p>
          <div className="upload-methods">
            <div className="upload-method">
              <span className="method-icon">📁</span>
              <span>Click "Choose File" to browse</span>
            </div>
            <div className="upload-method">
              <span className="method-icon">📋</span>
              <span>Copy an image and press Ctrl+V</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageOcclusionEditor;