// Punto de entrada y rutas de CurvaLab.
//
// Un portal de aplicaciones de laboratorio: cada una vive en su propio enlace y
// tiene su hoja, sus menús y su fichero de proyecto.
//   /                 portada desde la que se elige la aplicación
//   /2d               ajuste de curvas y análisis de errores (y = f(x))
//   /3d               ajuste de superficies (z = f(x,y))
//   /incertidumbres   propagación de errores a una magnitud indirecta
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { Home } from './pages/Home.tsx'
import { Surface3D } from './pages/Surface3D.tsx'
import { Uncertainty } from './pages/Uncertainty.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/2d" element={<App />} />
        <Route path="/3d" element={<Surface3D />} />
        <Route path="/incertidumbres" element={<Uncertainty />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
