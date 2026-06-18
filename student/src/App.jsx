import { useEffect } from 'react';
import SetupPage from './pages/SetupPage';
import LockPage from './pages/LockPage';
import BroadcastPage from './pages/BroadcastPage';

// Route đơn giản dựa trên hash URL
function useRoute() {
  const hash = window.location.hash.replace('#', '').split('?')[0];
  return hash || 'setup';
}

function getHashParam(key) {
  const hash = window.location.hash;
  const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
  const params = new URLSearchParams(queryStr);
  return params.get(key);
}

export default function App() {
  const route = useRoute();

  if (route === 'lock') {
    const msg = getHashParam('msg') || 'Màn hình đang bị khóa bởi giáo viên';
    return <LockPage initialMessage={decodeURIComponent(msg)} />;
  }

  if (route === 'broadcast') {
    return <BroadcastPage />;
  }

  return <SetupPage />;
}
