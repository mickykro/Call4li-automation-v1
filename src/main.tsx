import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LocaleProvider } from './contexts/LocaleContext'

const container = document.getElementById('root');
if (container) {
    createRoot(container).render(
        <StrictMode>
            <LocaleProvider>
                <App />
            </LocaleProvider>
        </StrictMode>,
    )
}
