import './style.css';
import { bootstrapViewer } from './bootstrap';
void bootstrapViewer().then(dispose => {
  if (import.meta.hot) import.meta.hot.dispose(dispose);
}).catch(error => { const message = document.getElementById('message')!; message.textContent = error.message; message.hidden = false; });
