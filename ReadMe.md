# SeeFood Project

**SeeFood** is a real-time image recognition web application designed to identify various types of food using machine learning. Users can upload images or use their webcam to classify food items into predefined categories, like samosas, pizza, ice cream, and more.

## Features

- **Image Upload**: Users can upload food images to the system for classification.
- **Webcam Integration**: Users can use their webcam to take pictures of food and have them classified in real-time.
- **Model Correction**: Users can correct the classification by labeling food items that are misclassified, which is saved for retraining.
- **Backend**: The backend is powered by Flask and uses TensorFlow for food image classification with a pre-trained model.
- **Database**: MongoDB is used to store user corrections and model predictions.

## Project Structure

- **frontend/**: Contains the React-based frontend for the application, responsible for interacting with the backend and displaying results.
  - **public/**: Static files like the favicon and the HTML file.
  - **src/**: Source code for React components, including assets like images and components for interaction.
- **backend/**: Contains the Flask-based backend for image classification and model correction.
  - **app.py**: The main Flask app responsible for API routes like image upload and model corrections.
  - **best_model.keras**: The trained machine learning model used for food classification.
  - **restructured_labels.csv**: The CSV file mapping image filenames to their respective food labels.
  - **corrections/**: Folder where corrected images are stored for future model retraining.

## Tech Stack

- **Frontend**:
  - React.js
  - CSS/SCSS for styling
  - Axios for API calls
- **Backend**:
  - Flask (Python web framework)
  - TensorFlow for food image classification
  - MongoDB for storing corrections and user interactions
- **Machine Learning**:
  - TensorFlow (Keras) for image classification
  - Pre-trained food classification model (`best_model.keras`)

## Getting Started

### Prerequisites

To get the project up and running locally, you need to have the following installed:

- Python 3.x
- Node.js and npm
- MongoDB (or MongoDB Atlas for cloud hosting)
- TensorFlow and Keras
- Flask

### Installation

#### Frontend

1. Navigate to the `frontend/` directory.
2. Install dependencies using npm:

```bash
cd frontend
npm install
