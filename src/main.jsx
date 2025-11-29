import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css' // Pastikan ini ada
import 'bootstrap-icons/font/bootstrap-icons.css' // Pastikan ini ada
import './index.css' 
import { BrowserRouter } from 'react-router-dom' // <--- WAJIB ADA
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* <--- WAJIB DIBUNGKUS INI */}
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)