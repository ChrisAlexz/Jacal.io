// src/components/study/LoadingStudy.jsx - Loading state for study
import React from 'react';

const LoadingStudy = ({ message = "Loading cards..." }) => {
  return (
    <div className="loading-study">
      <div className="loading-spinner"></div>
      <p>{message}</p>
    </div>
  );
};

export default LoadingStudy;